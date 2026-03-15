import express from "express";
import { JobAggregator } from "../services/job-aggregator";
import { JobScheduler } from "../scheduler";
import { JobFilter } from "../types/job.types";

export class JobApiServer {
  private app: express.Application;
  private aggregator: JobAggregator;
  private scheduler: JobScheduler;
  private port: number;
  private initialized: boolean = false;

  constructor(port: number = 3000, bypassCache: boolean = false) {
    this.app = express();
    this.port = port;
    this.aggregator = new JobAggregator(undefined, bypassCache);
    this.scheduler = new JobScheduler(bypassCache);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.aggregator.initialize();
    await this.scheduler.initialize();
    this.initialized = true;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      next();
    });

    // Logging middleware - only log non-health check requests
    this.app.use((req, res, next) => {
      if (req.path !== "/health") {
        console.log(`[API] ${req.method} ${req.path}`);
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        scheduler: {
          cron: this.scheduler.getCronExpression(),
          isRunning: this.scheduler.isRunning(),
          runInProgress: this.scheduler.isAggregationInProgress(),
          testMode: this.scheduler.getTestMode(),
          nextRun: this.scheduler.getNextRunTime(),
        },
      });
    });

    // Get all jobs
    this.app.get("/api/jobs", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const jobs = await this.aggregator.getAllJobs(limit);

        res.json({
          success: true,
          count: jobs.length,
          jobs: jobs,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get jobs by skills
    this.app.get("/api/jobs/skills/:skills", async (req, res) => {
      try {
        const skillsParam = req.params.skills;
        const skills = skillsParam.split(",").map((skill) => skill.trim());
        const limit = parseInt(req.query.limit as string) || 100;

        const jobs = await this.aggregator.getJobsBySkills(skills, limit);

        res.json({
          success: true,
          skills: skills,
          count: jobs.length,
          jobs: jobs,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Search jobs with filters
    this.app.post("/api/jobs/search", async (req, res) => {
      try {
        const filter: JobFilter = req.body;
        const jobs = await this.aggregator.searchJobs(filter);

        res.json({
          success: true,
          filter: filter,
          count: jobs.length,
          jobs: jobs,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get database statistics
    this.app.get("/api/stats", async (req, res) => {
      try {
        const stats = await this.aggregator.getJobStats();

        res.json({
          success: true,
          stats: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Manually trigger job aggregation
    this.app.post("/api/jobs/refresh", async (req, res) => {
      try {
        console.log("[API] Manual job refresh triggered");

        // Don't await - let it run in background and return immediately
        this.scheduler.runOnce().catch((error) => {
          console.error(
            "[API] Background refresh error:",
            error instanceof Error ? error.message : "Unknown error"
          );
        });

        res.json({
          success: true,
          message: "Job refresh started in background. Matcher will be triggered after the scrape finishes.",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[API] Refresh trigger error:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Manually trigger matcher for a recent time window
    this.app.post("/api/matcher/trigger", async (req, res) => {
      try {
        const rawMinutes = req.body?.minutes;
        const minutes =
          typeof rawMinutes === "number"
            ? rawMinutes
            : rawMinutes !== undefined
              ? Number(rawMinutes)
              : 60;

        if (!Number.isFinite(minutes) || minutes <= 0) {
          res.status(400).json({
            success: false,
            error: "minutes must be a positive number",
          });
          return;
        }

        const response = await this.scheduler.triggerMatcherForRecentWindow(minutes);

        res.json({
          success: true,
          triggered: Boolean(response),
          windowMinutes: minutes,
          message: response
            ? "Matcher trigger accepted"
            : "Matcher trigger skipped because matcher configuration is missing or the request failed",
          matcher: response,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[API] Matcher trigger error:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get available skills (extracted from all jobs)
    this.app.get("/api/skills", async (req, res) => {
      try {
        const jobs = await this.aggregator.getAllJobs(1000);
        const skillsSet = new Set<string>();

        jobs.forEach((job) => {
          job.skills.forEach((skill) => skillsSet.add(skill));
        });

        const skills = Array.from(skillsSet).sort();

        res.json({
          success: true,
          count: skills.length,
          skills: skills,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Error handling middleware
    this.app.use(
      (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error("Unhandled error:", err);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      }
    );

    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        error: "Route not found",
      });
    });
  }

  public async start(): Promise<void> {
    await this.initialize();
    
    return new Promise((resolve) => {
      this.app.listen(this.port, async () => {
        console.log(`Job API server running on port ${this.port}`);
        console.log(`Available endpoints:`);
        console.log(`  GET /health - Health check`);
        console.log(`  GET /api/jobs - Get all jobs`);
        console.log(`  GET /api/jobs/skills/:skills - Get jobs by skills (comma-separated)`);
        console.log(`  POST /api/jobs/search - Search jobs with filters`);
        console.log(`  GET /api/stats - Get database statistics`);
        console.log(`  POST /api/jobs/refresh - Manually trigger job refresh`);
        console.log(`  POST /api/matcher/trigger - Manually trigger matcher for recent scraped jobs`);
        console.log(`  GET /api/skills - Get all available skills`);

        // Start the scheduler
        this.scheduler.start();

        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    await this.scheduler.stop();
    await this.aggregator.close();
  }
}
