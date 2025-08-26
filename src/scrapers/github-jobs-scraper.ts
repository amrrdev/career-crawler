import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class GitHubJobsScraper extends BaseScraper {
  protected sourceName = "GitHub Jobs";
  protected baseUrl = "https://jobs.github.com";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Search GitHub for job postings in repositories
      const searchUrls = [
        "https://github.com/search?q=hiring+software+engineer&type=Issues",
        'https://github.com/search?q="We\'re+hiring"&type=Issues',
        "https://github.com/search?q=job+opening+developer&type=Issues",
        "https://github.com/search?q=career+opportunity&type=Issues",
      ];

      for (const url of searchUrls) {
        try {
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);

          $(".search-title a").each((_, element) => {
            const $element = $(element);
            const title = $element.text().trim();
            const relativeUrl = $element.attr("href");

            if (title && relativeUrl) {
              const fullUrl = `https://github.com${relativeUrl}`;
              const parts = relativeUrl.split("/");
              const company = parts[1] || "GitHub User";

              jobs.push(
                this.createJob({
                  title: title,
                  company: company,
                  location: "Remote/Various",
                  description: title,
                  url: fullUrl,
                })
              );
            }
          });

          // Add delay between requests
          await this.sleep(2000);
        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
        }
      }

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: true,
        totalFound: jobs.length,
      };
    } catch (error) {
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }
}
