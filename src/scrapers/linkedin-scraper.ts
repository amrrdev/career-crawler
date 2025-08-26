import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";

export class LinkedInScraper extends BaseScraper {
  protected sourceName = "LinkedIn";
  protected baseUrl = "https://www.linkedin.com";
  private antiDetection: AntiDetectionManager;
  private bypassCache: boolean = false;

  constructor(bypassCache: boolean = false) {
    super();
    this.antiDetection = new AntiDetectionManager();
    this.bypassCache = bypassCache;

    // Clean up old sessions periodically
    setInterval(() => {
      this.antiDetection.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Method to set cache bypass
  public setBypassCache(bypass: boolean): void {
    this.bypassCache = bypass;
  }

  protected async fetchPage(url: string): Promise<string> {
    try {
      const domain = "linkedin.com";

      // Check cache first (unless bypassing)
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) {
          console.log(`Using cached response for ${url.substring(0, 100)}...`);
          return cached;
        }
      }

      // Check if we can make request (rate limiting)
      if (!this.antiDetection.canMakeRequest(domain)) {
        const delay = this.antiDetection.getSmartDelay(domain);
        console.log(`Rate limited, waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }

      // Smart delay based on activity
      const smartDelay = this.antiDetection.getSmartDelay(domain);
      console.log(`Smart delay: ${smartDelay}ms for LinkedIn`);
      await this.sleep(smartDelay);

      // Get realistic headers
      const headers = this.antiDetection.getRealisticHeaders(domain);

      console.log(`Fetching LinkedIn: ${url.substring(0, 100)}...`);
      const response = await fetch(url, { headers });

      // Update session
      this.antiDetection.updateSession(domain, [], !response.ok && response.status === 429);

      if (!response.ok) {
        if (response.status === 429) {
          console.log("⚠️  LinkedIn rate limited us, marking session as blocked");
          this.antiDetection.updateSession(domain, [], true);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Cache successful response (unless bypassing)
      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }

      console.log(`✅ Successfully fetched LinkedIn page`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch LinkedIn page:`, error);
      this.antiDetection.updateSession("linkedin.com", [], true);
      throw error;
    }
  }

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];
      console.log("🔍 Starting LinkedIn job scraping with anti-detection...");

      // LinkedIn job search terms - focusing on tech jobs
      const searchTerms = [
        "software developer",
        "frontend developer",
        "backend developer",
        "full stack developer",
        "javascript developer",
        "react developer",
        "python developer",
        "node.js developer",
        "devops engineer",
        "data scientist",
      ];

      // Locations to search
      const locations = [
        "Egypt",
        "Remote",
        "United States",
        "United Kingdom",
        "Canada",
        "Germany",
        "Dubai",
        "Saudi Arabia",
      ];

      let searchCount = 0;
      const maxSearches = 8; // Increased limit for more variation

      // Try multiple pages for each search to get more diverse results
      for (const term of searchTerms.slice(0, 3)) {
        // Use 3 search terms
        for (const loc of locations.slice(0, 3)) {
          // Use 3 locations
          // Try multiple pages (0, 25, 50) for each search
          for (let page = 0; page < 3; page++) {
            const start = page * 25; // LinkedIn uses 25 results per page

            if (searchCount >= maxSearches) break;

            try {
              console.log(`🎯 Searching LinkedIn for: "${term}" in "${loc}", page ${page + 1}`);

              // Add cache busting parameter and vary the time range
              const cacheBuster = Date.now();
              const timeRange = page === 0 ? "r86400" : page === 1 ? "r259200" : "r604800"; // Last 1, 3, or 7 days

              // LinkedIn public job search URL with cache busting and varied parameters
              const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
                term
              )}&location=${encodeURIComponent(
                loc
              )}&f_TPR=${timeRange}&f_JT=F&sortBy=DD&start=${start}&_=${cacheBuster}`;

              const html = await this.fetchPage(searchUrl);
              const $ = cheerio.load(html);

              // LinkedIn job card selectors (they change frequently)
              const jobSelectors = [
                ".job-search-card",
                ".jobs-search__results-list li",
                ".jobs-search-results__list-item",
                ".job-result-card",
                '[data-entity-urn*="jobPosting"]',
                ".base-search-card",
                ".base-card",
              ];

              let foundJobs = false;

              for (const selector of jobSelectors) {
                const jobElements = $(selector);
                console.log(
                  `   Trying selector "${selector}": found ${jobElements.length} elements`
                );

                if (jobElements.length > 0) {
                  foundJobs = true;

                  jobElements.each((index, element) => {
                    if (index >= 15) return false; // Increased limit per search

                    try {
                      const $job = $(element);

                      // Extract job title
                      const $titleLink = $job
                        .find(
                          'h3 a, .job-title a, [data-tracking-control-name="public_jobs_jserp-result_search-card"] h3 a, .base-search-card__title a'
                        )
                        .first();
                      let title = $titleLink.text().trim();
                      let jobUrl = $titleLink.attr("href");

                      // Alternative title extraction
                      if (!title) {
                        title = $job
                          .find(
                            "h3, .job-title, .jobs-search-results__list-item h3, .base-search-card__title"
                          )
                          .first()
                          .text()
                          .trim();
                      }

                      if (!title || title.length < 5) return;

                      // Clean and validate URL
                      if (jobUrl && !jobUrl.startsWith("http")) {
                        jobUrl = jobUrl.startsWith("/")
                          ? `https://www.linkedin.com${jobUrl}`
                          : `https://www.linkedin.com/jobs/${jobUrl}`;
                      }
                      if (!jobUrl) {
                        jobUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
                          title
                        )}`;
                      }

                      // Extract company
                      let company = $job
                        .find(
                          ".job-search-card__subtitle-link, .job-result-card__company-link, h4 a, .base-search-card__subtitle a"
                        )
                        .first()
                        .text()
                        .trim();
                      if (!company) {
                        company = $job
                          .find(
                            'h4, .company-name, [data-tracking-control-name*="company"], .base-search-card__subtitle'
                          )
                          .first()
                          .text()
                          .trim();
                      }
                      if (!company) company = "LinkedIn Company";

                      // Extract location
                      let jobLocation = $job
                        .find(
                          ".job-search-card__location, .job-result-card__location, .base-search-card__metadata"
                        )
                        .first()
                        .text()
                        .trim();
                      if (!jobLocation) {
                        jobLocation = $job
                          .find('[class*="location"], .job-search-card__location')
                          .first()
                          .text()
                          .trim();
                      }
                      if (!jobLocation) jobLocation = loc;

                      // Extract job description/summary
                      let description = $job
                        .find(
                          ".job-search-card__snippet, .job-result-card__snippet, .base-search-card__info"
                        )
                        .first()
                        .text()
                        .trim();
                      if (!description) {
                        description = `${title} position at ${company} in ${jobLocation}. Apply on LinkedIn for full details.`;
                      }

                      // Extract posting date
                      const dateElement = $job
                        .find(
                          "time, .job-search-card__listdate, [datetime], .base-search-card__metadata-item"
                        )
                        .first();
                      let postedDate = new Date();
                      if (dateElement.length) {
                        const datetime = dateElement.attr("datetime") || dateElement.text();
                        postedDate = this.parseLinkedInDate(datetime) || new Date();
                      }

                      const jobData = this.createJob({
                        title: this.cleanText(title),
                        company: this.cleanText(company),
                        location: this.cleanText(jobLocation),
                        description: this.cleanText(description),
                        url: jobUrl,
                        postedDate: postedDate,
                      });

                      jobs.push(jobData);
                      console.log(`   ✅ Extracted: "${title}" at ${company}`);
                    } catch (error) {
                      console.error("Error processing LinkedIn job:", error);
                    }
                  });

                  break; // Found jobs with this selector
                }
              }

              if (!foundJobs) {
                console.log(`   ❌ No jobs found with any selector for: ${term} in ${loc}`);
              }

              searchCount++;

              // Smart delay between searches
              const smartDelay = this.antiDetection.getSmartDelay("linkedin.com");
              console.log(`   ⏱️  Smart delay: ${smartDelay}ms before next search`);
              await this.sleep(smartDelay);
            } catch (error) {
              console.error(
                `❌ Error searching LinkedIn for ${term} in ${loc}, page ${page + 1}:`,
                error
              );
            }
          }

          if (searchCount >= maxSearches) break;
        }

        if (searchCount >= maxSearches) break;
      }

      console.log(
        `🎉 LinkedIn scraping completed. Found ${jobs.length} jobs from ${searchCount} searches.`
      );

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: jobs.length > 0,
        totalFound: jobs.length,
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
    const lowerDate = dateStr.toLowerCase();

    // Parse relative dates
    if (lowerDate.includes("hour")) {
      const hours = parseInt(lowerDate.match(/(\d+)/)?.[1] || "1");
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    if (lowerDate.includes("day")) {
      const days = parseInt(lowerDate.match(/(\d+)/)?.[1] || "1");
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    if (lowerDate.includes("week")) {
      const weeks = parseInt(lowerDate.match(/(\d+)/)?.[1] || "1");
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Try parsing ISO date
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }
}
