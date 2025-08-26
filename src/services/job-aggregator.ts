import { Database } from "../database/database";
import { BaseScraper } from "../scrapers/base-scraper";
import { LinkedInScraper } from "../scrapers/linkedin-scraper";
import { WuzzufScraper } from "../scrapers/wuzzuf-scraper";
import { IndeedScraper } from "../scrapers/indeed-scraper";
import { MonsterScraper } from "../scrapers/monster-scraper";
import { Job, JobFilter, ScrapingResult } from "../types/job.types";

export class JobAggregator {
  private database: Database;
  private scrapers: BaseScraper[];

  constructor(dbPath?: string, bypassCache: boolean = false) {
    this.database = new Database(dbPath);
    this.scrapers = [
      new LinkedInScraper(bypassCache),
      new WuzzufScraper(),
      new IndeedScraper(),
      new MonsterScraper(),
    ];
  }

  public async aggregateJobs(
    searchQuery?: string,
    location?: string
  ): Promise<{
    totalFetched: number;
    totalSaved: number;
    results: ScrapingResult[];
  }> {
    const results: ScrapingResult[] = [];
    let totalFetched = 0;
    let totalSaved = 0;

    console.log("Starting job aggregation...");

    for (const scraper of this.scrapers) {
      try {
        console.log(`Scraping jobs from ${scraper.constructor.name}...`);
        const result = await scraper.scrapeJobs(searchQuery, location);
        results.push(result);

        if (result.success && result.jobs.length > 0) {
          const savedCount = await this.database.saveJobs(result.jobs);
          totalSaved += savedCount;
          totalFetched += result.jobs.length;

          console.log(
            `${scraper.constructor.name}: ${result.jobs.length} jobs found, ${savedCount} saved`
          );

          // Update source statistics
          await this.database.updateJobSource({
            name: result.source,
            url: "",
            isActive: true,
            lastFetched: new Date(),
            totalJobsFetched: result.jobs.length,
          });
        } else {
          console.log(
            `${scraper.constructor.name}: Failed or no jobs found. Error: ${result.error || "None"}`
          );
        }

        // Delay between different scrapers
        await this.sleep(2000);
      } catch (error) {
        console.error(`Error with ${scraper.constructor.name}:`, error);
        results.push({
          jobs: [],
          source: scraper.constructor.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          totalFound: 0,
        });
      }
    }

    console.log(
      `Job aggregation completed. Total fetched: ${totalFetched}, Total saved: ${totalSaved}`
    );

    return {
      totalFetched,
      totalSaved,
      results,
    };
  }

  public async getJobsBySkills(skills: string[], limit: number = 100): Promise<Job[]> {
    return this.database.getJobsBySkills(skills, limit);
  }

  public async getAllJobs(limit: number = 1000): Promise<Job[]> {
    return this.database.getAllJobs(limit);
  }

  public async getJobStats(): Promise<{ total: number; bySource: { [key: string]: number } }> {
    return this.database.getJobStats();
  }

  public async searchJobs(filter: JobFilter): Promise<Job[]> {
    // For now, we'll implement a simple search based on skills
    // In a more advanced implementation, you could add more complex filtering
    if (filter.skills && filter.skills.length > 0) {
      return this.getJobsBySkills(filter.skills, 100);
    }

    return this.getAllJobs(100);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public close(): void {
    this.database.close();
  }
}
