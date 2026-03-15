import { CronJob } from "cron";
import { randomUUID } from "crypto";
import { JobAggregator } from "./services/job-aggregator";
import {
  MatcherClient,
  ScrapedJobsMatchAcceptedResponse,
} from "./services/matcher-client";

export class JobScheduler {
  private aggregator: JobAggregator;
  private matcherClient: MatcherClient;
  private job: CronJob | null = null;
  private initialized: boolean = false;
  private aggregationInProgress: boolean = false;
  private readonly cronExpression: string;
  private readonly testMatcherOnlyMode: boolean;
  private readonly testMatcherWindowMinutes: number;

  constructor(bypassCache: boolean = false) {
    this.aggregator = new JobAggregator(undefined, bypassCache);
    this.matcherClient = new MatcherClient();
    this.cronExpression = process.env.SCHEDULER_CRON?.trim() || "0 * * * *";
    this.testMatcherOnlyMode = process.env.SCHEDULER_TEST_MODE?.trim().toLowerCase() === "matcher-only";

    const configuredTestWindowMinutes = Number(process.env.SCHEDULER_TEST_WINDOW_MINUTES ?? "60");
    this.testMatcherWindowMinutes =
      Number.isFinite(configuredTestWindowMinutes) && configuredTestWindowMinutes > 0
        ? configuredTestWindowMinutes
        : 60;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.aggregator.initialize();
    this.initialized = true;
  }

  public start(): void {
    console.log("[Scheduler] Starting job scheduler...");

    // Default: every hour at minute 0. Override via SCHEDULER_CRON for testing.
    this.job = new CronJob(
      this.cronExpression,
      async () => {
        await this.executeAggregation("scheduled");
      },
      null,
      true,
      "UTC",
    );

    console.log(`[Scheduler] Started. Running on cron "${this.cronExpression}" (UTC).`);
    if (this.testMatcherOnlyMode) {
      console.log(
        `[Scheduler] Test mode enabled: skipping scraping and triggering matcher immediately for the last ${this.testMatcherWindowMinutes} minute(s).`,
      );
    }
    console.log("[Scheduler] Next run:", this.job.nextDate().toFormat("yyyy-MM-dd HH:mm:ss"));

    // Run immediately on startup
    this.executeAggregation("startup").catch((error) => {
      console.error(
        "[Scheduler] Startup aggregation failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    });
  }

  public async runOnce(): Promise<void> {
    await this.executeAggregation("manual");
  }

  public async stop(): Promise<void> {
    try {
      if (this.job) {
        this.job.stop();
        console.log("[Scheduler] Stopped.");
      }
      await this.aggregator.close();
    } catch (error) {
      console.error(
        "[Scheduler] Error during shutdown:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  public getNextRunTime(): Date | null {
    return this.job ? this.job.nextDate().toJSDate() : null;
  }

  public isRunning(): boolean {
    return this.job ? this.job.running : false;
  }

  public isAggregationInProgress(): boolean {
    return this.aggregationInProgress;
  }

  public getCronExpression(): string {
    return this.cronExpression;
  }

  public getTestMode(): string {
    return this.testMatcherOnlyMode ? "matcher-only" : "off";
  }

  public async triggerMatcherForRecentWindow(
    windowMinutes: number = 60,
  ): Promise<ScrapedJobsMatchAcceptedResponse | null> {
    if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
      throw new Error("windowMinutes must be a positive number");
    }

    const runFinishedAt = new Date();
    const runStartedAt = new Date(runFinishedAt.getTime() - windowMinutes * 60 * 1000);

    return this.notifyMatcherForWindow(runStartedAt, runFinishedAt);
  }

  private async executeAggregation(reason: "scheduled" | "manual" | "startup"): Promise<void> {
    if (this.aggregationInProgress) {
      console.warn(
        `[Scheduler] ${reason} run skipped because another aggregation is already in progress.`,
      );
      return;
    }

    this.aggregationInProgress = true;
    const runStartedAt = new Date();
    const label = reason.charAt(0).toUpperCase() + reason.slice(1);
    console.log(`[Scheduler] ${label} aggregation started...`);

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.testMatcherOnlyMode) {
        console.log(
          `[Scheduler] ${label} test mode active. Skipping scrape and triggering matcher immediately.`,
        );
        await this.triggerMatcherForRecentWindow(this.testMatcherWindowMinutes);
        return;
      }

      const result = await this.aggregator.aggregateJobs();
      const runFinishedAt = new Date();

      console.log(
        `[Scheduler] ${label} aggregation completed: ${result.totalSaved} new jobs saved, ${result.totalDuplicates} duplicates`,
      );

      result.results.forEach((sourceResult) => {
        if (!sourceResult.success) {
          console.error(`[Scheduler] ${sourceResult.source} failed: ${sourceResult.error}`);
        }
      });

      await this.notifyMatcherForWindow(runStartedAt, runFinishedAt);

      const stats = await this.aggregator.getJobStats();
      console.log(`[Scheduler] Database: ${stats.total} total jobs`);
    } catch (error) {
      console.error(
        `[Scheduler] ${label} aggregation failed:`,
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      this.aggregationInProgress = false;
    }
  }

  private async notifyMatcherForWindow(
    runStartedAt: Date,
    runFinishedAt: Date,
  ): Promise<ScrapedJobsMatchAcceptedResponse | null> {
    const requestId = `scraper-${Date.now()}-${randomUUID()}`;

    try {
      const response = await this.matcherClient.triggerScrapedJobsMatching({
        since: runStartedAt.toISOString(),
        until: runFinishedAt.toISOString(),
        requestId,
      });

      if (!response) {
        return null;
      }

      console.log(
        `[Scheduler] Matcher accepted scraped jobs request ${response.requestId} for ${response.since} -> ${response.until}`,
      );
      return response;
    } catch (error) {
      console.error(
        "[Scheduler] Matcher trigger failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }
}

// If this file is run directly, start the scheduler
if (require.main === module) {
  const scheduler = new JobScheduler();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Gracefully shutting down...");
    scheduler.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM. Gracefully shutting down...");
    scheduler.stop();
    process.exit(0);
  });

  scheduler.start();
}
