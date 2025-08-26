import { CronJob } from "cron";
import { JobAggregator } from "./services/job-aggregator";

export class JobScheduler {
  private aggregator: JobAggregator;
  private job: CronJob | null = null;

  constructor() {
    this.aggregator = new JobAggregator();
  }

  public start(): void {
    console.log("Starting job scheduler...");

    // Run every hour at minute 0
    this.job = new CronJob(
      "0 * * * *",
      async () => {
        console.log(`[${new Date().toISOString()}] Starting scheduled job aggregation...`);

        try {
          const result = await this.aggregator.aggregateJobs();

          console.log(`[${new Date().toISOString()}] Scheduled aggregation completed:`);
          console.log(`- Total jobs fetched: ${result.totalFetched}`);
          console.log(`- Total jobs saved: ${result.totalSaved}`);
          console.log(`- Sources processed: ${result.results.length}`);

          // Log individual source results
          result.results.forEach((sourceResult) => {
            if (sourceResult.success) {
              console.log(`  ✓ ${sourceResult.source}: ${sourceResult.jobs.length} jobs`);
            } else {
              console.log(`  ✗ ${sourceResult.source}: Failed - ${sourceResult.error}`);
            }
          });

          // Log current database stats
          const stats = await this.aggregator.getJobStats();
          console.log(`Database now contains ${stats.total} total jobs`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Scheduled aggregation failed:`, error);
        }
      },
      null,
      true,
      "UTC"
    );

    console.log("Job scheduler started. Will run every hour at minute 0.");
    console.log("Next run time:", this.job.nextDate().toString());

    // Run immediately on startup
    this.runOnce();
  }

  public async runOnce(): Promise<void> {
    console.log(`[${new Date().toISOString()}] Running job aggregation manually...`);

    try {
      const result = await this.aggregator.aggregateJobs();

      console.log(`[${new Date().toISOString()}] Manual aggregation completed:`);
      console.log(`- Total jobs fetched: ${result.totalFetched}`);
      console.log(`- Total jobs saved: ${result.totalSaved}`);
      console.log(`- Sources processed: ${result.results.length}`);

      result.results.forEach((sourceResult) => {
        if (sourceResult.success) {
          console.log(`  ✓ ${sourceResult.source}: ${sourceResult.jobs.length} jobs`);
        } else {
          console.log(`  ✗ ${sourceResult.source}: Failed - ${sourceResult.error}`);
        }
      });

      const stats = await this.aggregator.getJobStats();
      console.log(`Database now contains ${stats.total} total jobs`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Manual aggregation failed:`, error);
    }
  }

  public stop(): void {
    if (this.job) {
      this.job.stop();
      console.log("Job scheduler stopped.");
    }
    this.aggregator.close();
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
