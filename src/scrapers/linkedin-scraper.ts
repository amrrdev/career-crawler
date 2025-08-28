import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface LinkedInSelectors {
  jobCard: string[];
  url: string[];
  detailTitle: string[];
  detailCompany: string[];
  detailLocation: string[];
  detailDescription: string[];
  detailDate: string[];
}

export class LinkedInScraper extends BaseScraper {
  protected sourceName = "LinkedIn";
  protected baseUrl = "https://www.linkedin.com";
  private antiDetection: AntiDetectionManager;
  private bypassCache: boolean = false;
  private selectors: LinkedInSelectors;
  private readonly MAX_JOB_AGE_DAYS = 7;

  constructor(bypassCache: boolean = false) {
    super();
    this.antiDetection = new AntiDetectionManager();
    this.bypassCache = bypassCache;
    this.selectors = this.loadSelectors();

    setInterval(() => {
      this.antiDetection.cleanup();
    }, 5 * 60 * 1000);
  }

  private loadSelectors(): LinkedInSelectors {
    const filePath = path.join(__dirname, "linkedin-selectors.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  }

  public setBypassCache(bypass: boolean): void {
    this.bypassCache = bypass;
  }

  protected async fetchPage(url: string): Promise<string> {
    const domain = "linkedin.com";
    try {
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) {
          console.log(`Using cached response for ${url.substring(0, 100)}...`);
          return cached;
        }
      }
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);
      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }
      console.log(`✅ Successfully fetched LinkedIn page with Puppeteer`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch LinkedIn page with Puppeteer:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  private buildSearchUrl(term: string, loc: string, searchCount: number): string {
    const timeRanges = ["r86400", "r259200"]; // 1 and 3 days
    const timeRange = timeRanges[searchCount % timeRanges.length];
    const searchParams = new URLSearchParams({
      keywords: term,
      location: loc,
      f_TPR: timeRange,
      f_JT: "F",
      sortBy: "DD",
    });
    return `https://www.linkedin.com/jobs/search?${searchParams.toString()}`;
  }

  private extractText($element: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) return text;
    }
    return "";
  }

  private async scrapeJobUrls(searchUrl: string): Promise<string[]> {
    try {
      const html = await this.fetchPage(searchUrl);
      const $ = cheerio.load(html);
      const jobUrls = new Set<string>();

      $(this.selectors.jobCard.join(", ")).each((_, element) => {
        const url = $(element).find(this.selectors.url.join(", ")).attr("href");
        if (url) {
          jobUrls.add(url.split("?")[0]); // Clean URL
        }
      });

      return Array.from(jobUrls);
    } catch (error) {
      console.error(`Failed to scrape job URLs from ${searchUrl}:`, error);
      return [];
    }
  }

  private async scrapeJobDetails(jobUrl: string): Promise<Job | null> {
    try {
      console.log(`Scraping details from: ${jobUrl}`);
      const html = await this.fetchPage(jobUrl);
      const $ = cheerio.load(html);

      const title = this.extractText($("body"), this.selectors.detailTitle);
      if (!title) return null; // Essential field

      const company = this.extractText($("body"), this.selectors.detailCompany) || "N/A";
      const location = this.extractText($("body"), this.selectors.detailLocation);
      const description = this.extractText($("body"), this.selectors.detailDescription);
      const dateStr = this.extractText($("body"), this.selectors.detailDate);
      const postedDate = this.parseLinkedInDate(dateStr) || new Date();

      return this.createJob({
        title,
        company,
        location,
        description,
        url: jobUrl,
        postedDate,
      });
    } catch (error) {
      console.error(`Failed to scrape job details from ${jobUrl}:`, error);
      return null;
    }
  }

  private readonly CONCURRENCY_LIMIT = 4;

  public async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    try {
      const jobUrlCache = new Set<string>();
      let totalFound = 0;
      console.log("🔍 Starting LinkedIn two-phase job scraping...");

      const searchTerms = [
        "software developer",
        "frontend developer",
        "backend developer",
        "full stack developer",
        "javascript developer",
        "react developer",
        "python developer",
        "node.js developer",
      ];
      const locations = [
        "Remote", "United States", "United Kingdom", "Canada", "Germany", "Australia", "Netherlands", "France",
        "Egypt", "Saudi Arabia", "United Arab Emirates", "Qatar"
      ];

      const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
      const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
      const locationsToUse = shuffledLocations.slice(0, 4);

      let searchCount = 0;
      const maxSearches = 10;

      for (const term of shuffledTerms.slice(0, 5)) {
        for (const loc of locationsToUse.slice(0, 2)) {
          if (searchCount >= maxSearches) break;

          console.log(`🎯 Searching LinkedIn for: "${term}" in "${loc}"`);
          const searchUrl = this.buildSearchUrl(term, loc, searchCount);
          const jobUrls = await this.scrapeJobUrls(searchUrl);
          console.log(`   Found ${jobUrls.length} job URLs`);

          const newUrls = jobUrls.filter(url => !jobUrlCache.has(url));
          newUrls.forEach(url => jobUrlCache.add(url));

          for (let i = 0; i < newUrls.length; i += this.CONCURRENCY_LIMIT) {
            const batch = newUrls.slice(i, i + this.CONCURRENCY_LIMIT);
            const promises = batch.map(url => this.scrapeJobDetails(url));
            const results = await Promise.all(promises);

            for (const job of results) {
              if (job) {
                const jobAgeDays = (new Date().getTime() - job.postedDate.getTime()) / (1000 * 3600 * 24);
                if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                  await onJobScraped(job);
                  totalFound++;
                }
              }
            }
            await this.sleep(this.antiDetection.getSmartDelay("linkedin.com") + 1000);
          }
          searchCount++;
        }
        if (searchCount >= maxSearches) break;
      }

      console.log(
        `🎉 LinkedIn scraping completed. Found and processed ${totalFound} fresh jobs.`
      );

      return {
        jobs: [], // Jobs are now processed via callback
        source: this.sourceName,
        success: true,
        totalFound,
      };
    } catch (error) {
      console.error("❌ LinkedIn scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseLinkedInDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const now = new Date();
    const lowerDate = dateStr.toLowerCase().trim();

    // Handle English relative dates
    const englishMatch = lowerDate.match(/(\d+)\s*(minute|hour|day|week)s?/);
    if (englishMatch) {
      const value = parseInt(englishMatch[1]);
      const unit = englishMatch[2];
      if (unit === "minute") return new Date(now.getTime() - value * 60 * 1000);
      if (unit === "hour") return new Date(now.getTime() - value * 60 * 60 * 1000);
      if (unit === "day") return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      if (unit === "week") return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    }

    // Handle French relative dates
    const frenchMatch = lowerDate.match(/il y a (\d+)\s*(minute|heure|jour|semaine)s?/);
    if (frenchMatch) {
      const value = parseInt(frenchMatch[1]);
      const unit = frenchMatch[2];
      if (unit === "minute") return new Date(now.getTime() - value * 60 * 1000);
      if (unit === "heure") return new Date(now.getTime() - value * 60 * 60 * 1000);
      if (unit === "jour") return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      if (unit === "semaine") return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    }

    try {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    } catch {}

    console.warn(`Could not parse date: "${dateStr}"`);
    return null;
  }
}
