import express from "express";
import { JobAggregator } from "../services/job-aggregator";
import { JobScheduler } from "../scheduler";
import { JobFilter } from "../types/job.types";

export class JobApiServer {
  private app: express.Application;
  private aggregator: JobAggregator;
  private scheduler: JobScheduler;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.aggregator = new JobAggregator();
    this.scheduler = new JobScheduler();

    this.setupMiddleware();
    this.setupRoutes();
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

    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
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
          isRunning: this.scheduler.isRunning(),
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
        console.log("Manual job refresh triggered via API");
        await this.scheduler.runOnce();

        res.json({
          success: true,
          message: "Job refresh completed",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
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
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Job API server running on port ${this.port}`);
        console.log(`Available endpoints:`);
        console.log(`  GET /health - Health check`);
        console.log(`  GET /api/jobs - Get all jobs`);
        console.log(`  GET /api/jobs/skills/:skills - Get jobs by skills (comma-separated)`);
        console.log(`  POST /api/jobs/search - Search jobs with filters`);
        console.log(`  GET /api/stats - Get database statistics`);
        console.log(`  POST /api/jobs/refresh - Manually trigger job refresh`);
        console.log(`  GET /api/skills - Get all available skills`);

        // Start the scheduler
        this.scheduler.start();

        resolve();
      });
    });
  }

  public stop(): void {
    this.scheduler.stop();
    this.aggregator.close();
  }
}
