import { CronJob } from "cron";
import { JobAggregator } from "./services/job-aggregator";

export class JobScheduler {
  private aggregator: JobAggregator;
  private job: CronJob | null = null;

  constructor(bypassCache: boolean = false) {
    this.aggregator = new JobAggregator(undefined, bypassCache);
  }

  public start(): void {
    console.log("[Scheduler] Starting job scheduler...");

    // Run every hour at minute 0
    this.job = new CronJob(
      "0 * * * *",
      async () => {
        console.log(`[Scheduler] Starting scheduled aggregation...`);

        try {
          const result = await this.aggregator.aggregateJobs();

          console.log(
            `[Scheduler] Completed: ${result.totalSaved} new jobs saved, ${result.totalDuplicates} duplicates`
          );

          // Only log failures
          result.results.forEach((sourceResult) => {
            if (!sourceResult.success) {
              console.error(`[Scheduler] ${sourceResult.source} failed: ${sourceResult.error}`);
            }
          });

          const stats = await this.aggregator.getJobStats();
          console.log(`[Scheduler] Database: ${stats.total} total jobs`);
        } catch (error) {
          console.error(
            `[Scheduler] Aggregation failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      },
      null,
      true,
      "UTC"
    );

    console.log("[Scheduler] Started. Running hourly at minute 0.");
    console.log("[Scheduler] Next run:", this.job.nextDate().toFormat("yyyy-MM-dd HH:mm:ss"));

    // Run immediately on startup
    this.runOnce();
  }

  public async runOnce(): Promise<void> {
    console.log(`[Scheduler] Running manual aggregation...`);

    try {
      const result = await this.aggregator.aggregateJobs();

      console.log(
        `[Scheduler] Manual run completed: ${result.totalSaved} new jobs, ${result.totalDuplicates} duplicates`
      );

      const stats = await this.aggregator.getJobStats();
      console.log(`[Scheduler] Database: ${stats.total} total jobs`);
    } catch (error) {
      console.error(
        `[Scheduler] Manual aggregation failed:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  public stop(): void {
    try {
      if (this.job) {
        this.job.stop();
        console.log("[Scheduler] Stopped.");
      }
      this.aggregator.close();
    } catch (error) {
      console.error(
        "[Scheduler] Error during shutdown:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  public getNextRunTime(): Date | null {
    return this.job ? this.job.nextDate().toJSDate() : null;
  }

  public isRunning(): boolean {
    return this.job ? this.job.running : false;
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
