import { Database } from "../database/database";
import { BaseScraper } from "../scrapers/base-scraper";
import { LinkedInScraper } from "../scrapers/linkedin-scraper";
import { WuzzufScraper } from "../scrapers/wuzzuf-scraper";
import { IndeedScraper } from "../scrapers/indeed-scraper";
import { Job, JobFilter, ScrapingResult } from "../types/job.types";

export class JobAggregator {
  private database: Database;
  private scrapers: BaseScraper[];
  private jobSignatureCache = new Set<string>();

  constructor(dbPath?: string, bypassCache: boolean = false) {
    this.database = new Database(dbPath);
    this.scrapers = [new LinkedInScraper(bypassCache), new WuzzufScraper(), new IndeedScraper()];
  }

  public async aggregateJobs(
    searchQuery?: string,
    location?: string
  ): Promise<{
    totalFetched: number;
    totalSaved: number;
    totalDuplicates: number;
    results: ScrapingResult[];
  }> {
    const results: ScrapingResult[] = [];
    let totalFetched = 0;
    let totalSaved = 0;
    let totalDuplicates = 0;

    this.jobSignatureCache.clear();
    console.log("🚀 Starting incremental job aggregation...");

    const onJobScraped = async (job: Job) => {
      totalFetched++;
      const signature = this.generateJobSignature(job);
      if (!this.jobSignatureCache.has(signature)) {
        this.jobSignatureCache.add(signature);
        await this.database.saveJob(job);
        totalSaved++;
        console.log(`💾 Saved new job: "${job.title}" from ${job.source}`);
      } else {
        totalDuplicates++;
        console.log(`🔄 Duplicate job found, skipping: "${job.title}"`);
      }
    };

    for (const scraper of this.scrapers) {
      try {
        console.log(`🔍 Scraping jobs from ${scraper.constructor.name}...`);
        const result = await scraper.scrapeJobs(onJobScraped, searchQuery, location);
        results.push(result);

        if (result.success) {
          console.log(`✅ ${scraper.constructor.name} finished, found ${result.totalFound} jobs.`);
        } else {
          console.log(`❌ ${scraper.constructor.name} failed. Error: ${result.error || "None"}`);
        }

        await this.sleep(2000);
      } catch (error) {
        console.error(`❌ Error with ${scraper.constructor.name}:`, error);
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
      `🎉 Job aggregation completed!\n` +
        `   📊 Total fetched: ${totalFetched}\n` +
        `   💾 Jobs saved: ${totalSaved}\n` +
        `   🔄 Duplicates found: ${totalDuplicates}`
    );

    return {
      totalFetched,
      totalSaved,
      totalDuplicates,
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
    if (filter.skills && filter.skills.length > 0) {
      return this.getJobsBySkills(filter.skills, 100);
    }
    return this.getAllJobs(100);
  }

  private generateJobSignature(job: Job): string {
    const normalizeText = (text: string): string => {
      return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    };
    const normalizedTitle = normalizeText(job.title);
    const normalizedCompany = normalizeText(job.company);
    const titleWords = normalizedTitle.split(" ").filter((w) => w.length > 2);
    const keyTitle = titleWords.slice(0, 3).join(" ");
    return `${keyTitle}::${normalizedCompany}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public close(): void {
    this.database.close();
  }
}

