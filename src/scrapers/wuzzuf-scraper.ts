import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface WuzzufSelectors {
  jobCard: string[];
  url: string[];
  detailTitle: string[];
  detailCompany: string[];
  detailLocation: string[];
  detailDescription: string[];
  detailDate: string[];
  detailSalary: string[];
  detailSkills: string[];
}

export class WuzzufScraper extends BaseScraper {
  protected sourceName = "Wuzzuf";
  protected baseUrl = "https://wuzzuf.net";
  private antiDetection: AntiDetectionManager;
  private selectors: WuzzufSelectors;
  private readonly MAX_JOB_AGE_DAYS = 10; // Fresh jobs (last 10 days)
  private readonly CONCURRENCY_LIMIT = 3; // Lower for Egypt market
  private bypassCache: boolean = false;

  constructor(bypassCache: boolean = false) {
    super();
    this.antiDetection = new AntiDetectionManager();
    this.bypassCache = bypassCache;
    this.selectors = this.loadSelectors();

    // Cleanup interval
    setInterval(() => {
      this.antiDetection.cleanup();
    }, 5 * 60 * 1000);
  }

  private loadSelectors(): WuzzufSelectors {
    const filePath = path.join(__dirname, "wuzzuf-selectors.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  }

  public setBypassCache(bypass: boolean): void {
    this.bypassCache = bypass;
  }

  protected async fetchPage(url: string): Promise<string> {
    const domain = "wuzzuf.net";
    try {
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) {
          console.log(`📦 Using cached Wuzzuf response...`);
          return cached;
        }
      }

      console.log(`🌐 Fetching Wuzzuf page with browser...`);
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }

      console.log(`✅ Successfully fetched Wuzzuf page`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch Wuzzuf page:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  private buildSearchUrl(searchTerm: string, page: number = 0): string {
    // Wuzzuf uses kebab-case for URLs
    const kebabTerm = searchTerm.toLowerCase().replace(/\s+/g, "-");
    const baseUrl = `https://wuzzuf.net/search/jobs/?q=${kebabTerm}`;

    if (page > 0) {
      return `${baseUrl}&start=${page}`;
    }

    return baseUrl;
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
      const jobUrls: string[] = [];

      // Find job cards
      const jobCardSelector = this.selectors.jobCard.join(", ");
      const urlSelector = this.selectors.url.join(", ");

      $(jobCardSelector).each((_, element) => {
        const $card = $(element);
        const url = $card.find(urlSelector).attr("href");

        if (url) {
          // Try to find date on the listing card
          let dateStr = "";
          // Common date selectors on listing page
          const listingDateSelectors = ["span.css-jugjhj", "span.css-do6t5g", ".job-date"];
          for (const selector of listingDateSelectors) {
            const text = $card.find(selector).text().trim();
            if (text && (text.includes("ago") || text.includes("منذ"))) {
              dateStr = text;
              break;
            }
          }

          // If we found a date, check if it's recent enough
          if (dateStr) {
            const postedDate = this.parseWuzzufDate(dateStr);
            if (postedDate) {
              const jobAgeDays = (new Date().getTime() - postedDate.getTime()) / (1000 * 3600 * 24);

              // Skip old jobs to save resources
              if (jobAgeDays > this.MAX_JOB_AGE_DAYS) {
                console.log(
                  `   ⏭️  Skipping old job on listing: "${dateStr}" (${Math.floor(
                    jobAgeDays
                  )} days old)`
                );
                return; // Skip this job
              } else {
                console.log(
                  `   ✅ Job is fresh: "${dateStr}" (${Math.floor(jobAgeDays)} days old)`
                );
              }
            } else {
              console.log(`   ⚠️  Could not parse date on listing: "${dateStr}"`);
            }
          } else {
            console.log(`   ⚠️  No date found on listing card - will check in details page`);
          }

          // Clean URL and make absolute
          let cleanUrl = url.split("?")[0].trim();

          // Fix URLs with spaces or invalid characters
          cleanUrl = cleanUrl.replace(/\s+/g, "-");

          const absoluteUrl = cleanUrl.startsWith("http")
            ? cleanUrl
            : `https://wuzzuf.net${cleanUrl}`;
          jobUrls.push(absoluteUrl);
        }
      });

      return jobUrls;
    } catch (error) {
      console.error(`Failed to scrape job URLs from ${searchUrl}:`, error);
      return [];
    }
  }

  private async scrapeJobDetails(jobUrl: string): Promise<Job | null> {
    try {
      console.log(`   📄 Scraping details from: ${jobUrl.substring(0, 60)}...`);
      const html = await this.fetchPage(jobUrl);
      const $ = cheerio.load(html);

      // Extract required fields - try selectors first, then fallback to any h1
      let title = this.extractText($("body"), this.selectors.detailTitle);

      // Fallback: try to find any h1 on the page
      if (!title) {
        title = $("h1").first().text().trim();
      }

      if (!title) {
        console.log(`   ⚠️  No title found, skipping job`);
        console.log(`   🔍 Debug: First 500 chars of HTML: ${html.substring(0, 500)}`);
        return null;
      }

      const company = this.extractText($("body"), this.selectors.detailCompany) || "Wuzzuf Company";
      let location = this.extractText($("body"), this.selectors.detailLocation) || "Egypt";

      // Clean location - remove employee count patterns like "· 51-200 Employees", "• 100+ employees", etc.
      location = location
        .replace(/[·•]\s*\d+[-+]?\d*\s*employees?/gi, "") // Remove "· 51-200 Employees" or "• 100+ employees"
        .replace(/\d+[-+]?\d*\s*employees?/gi, "") // Remove "100 employees" or "50-200 employees"
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // Extract description - try multiple methods to get ALL content
      let description = this.extractText($("body"), this.selectors.detailDescription);

      // If description is empty or too short, try to get all text from common job detail containers
      if (!description || description.length < 100) {
        const contentSelectors = [
          ".css-1uobp1k",
          "[class*='job-description']",
          "[class*='job-details']",
          "[class*='description']",
          "[class*='requirements']",
          "[class*='responsibilities']",
          "main",
          "article",
        ];

        for (const selector of contentSelectors) {
          const content = $(selector).text().trim();
          if (content && content.length > description.length) {
            description = content;
          }
        }
      }

      // Last resort: get all text from body but exclude headers/footers
      if (!description || description.length < 100) {
        description = $("main, article, [role='main']").text().trim() || $("body").text().trim();
      }

      // Fallback
      if (!description) {
        description = `${title} position at ${company}`;
      }

      console.log(`   📝 Description length: ${description.length} chars`);

      const dateStr = this.extractText($("body"), this.selectors.detailDate);
      const postedDate = this.parseWuzzufDate(dateStr);

      if (!postedDate) {
        console.log(`   ⚠️  Could not parse date "${dateStr}", skipping job (no valid date)`);
        return null;
      }

      // Calculate age immediately to verify
      const jobAgeDays = (new Date().getTime() - postedDate.getTime()) / (1000 * 3600 * 24);
      console.log(`   📅 Job posted: "${dateStr}" → ${Math.floor(jobAgeDays)} days ago`);

      const salary = this.extractText($("body"), this.selectors.detailSalary);

      // Extract skills from skill tags on page
      const pageSkills: string[] = [];
      this.selectors.detailSkills.forEach((selector) => {
        $(selector).each((_, el) => {
          const skill = $(el).text().trim();
          if (skill && skill.length < 30) pageSkills.push(skill); // Avoid long text
        });
      });

      // Also try to extract skills from common sections
      const skillSections = [
        ".css-158icaa", // Wuzzuf skills container
        "[class*='skills']",
        "[class*='requirements']",
        "[class*='qualifications']",
      ];

      skillSections.forEach((selector) => {
        $(selector)
          .find("span, li, div")
          .each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 2 && text.length < 30) {
              pageSkills.push(text);
            }
          });
      });

      const jobCreateData: any = {
        title,
        company,
        location,
        description,
        url: jobUrl,
        postedDate,
      };

      if (salary && salary.match(/\d+/)) {
        jobCreateData.salary = salary;
      }

      const job = this.createJob(jobCreateData);

      // ONLY use Wuzzuf-specific skill extraction (more accurate with word boundaries)
      // Clear the default skills from BaseScraper which uses loose pattern matching
      const wuzzufSkills = this.extractWuzzufSkills(title, description);
      const allSkills = [...new Set([...pageSkills, ...wuzzufSkills])];

      job.skills = allSkills;

      // Debug logging to see where skills come from
      if (pageSkills.length > 0) {
        console.log(`   📄 Page skills (${pageSkills.length}): ${pageSkills.join(", ")}`);
      }
      if (wuzzufSkills.length > 0) {
        console.log(`   � Extracted skills (${wuzzufSkills.length}): ${wuzzufSkills.join(", ")}`);
      }
      console.log(
        `   💼 Total ${job.skills.length} skills: ${job.skills.slice(0, 10).join(", ")}${
          job.skills.length > 10 ? "..." : ""
        }`
      );

      return job;
    } catch (error) {
      console.error(`   ❌ Failed to scrape job details from ${jobUrl}:`, error);
      return null;
    }
  }

  public async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    try {
      const jobUrlCache = new Set<string>();
      let totalFound = 0;

      console.log("🔍 Starting Wuzzuf two-phase job scraping (Egypt & MENA)...");

      // Search terms focused on core software engineering roles
      const searchTerms = [
        "software engineer",
        "backend developer",
        "frontend developer",
        "full stack developer",
        "mobile developer",
        "react developer",
        "node.js developer",
        "python developer",
        "java developer",
        "javascript developer",
        "angular developer",
        "vue developer",
        "flutter developer",
        "android developer",
        "ios developer",
        "data engineer",
        "data scientist",
        "machine learning engineer",
        "devops engineer",
        "cloud engineer",
      ];

      // Shuffle and limit
      const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
      const termsToUse = shuffledTerms.slice(0, 8);

      console.log(`🔍 Wuzzuf search terms: ${termsToUse.join(", ")}`);

      let searchCount = 0;
      const maxSearches = 12;

      for (const term of termsToUse) {
        if (searchCount >= maxSearches) break;

        try {
          console.log(`🎯 Searching Wuzzuf for: "${term}"`);

          const searchUrl = this.buildSearchUrl(term);
          const jobUrls = await this.scrapeJobUrls(searchUrl);

          console.log(`   Found ${jobUrls.length} job URLs`);

          // Filter out duplicates
          const newUrls = jobUrls.filter((url) => !jobUrlCache.has(url));
          newUrls.forEach((url) => jobUrlCache.add(url));

          console.log(`   Processing ${newUrls.length} new jobs`);

          // Batch process job details (3 at a time for Wuzzuf)
          for (let i = 0; i < newUrls.length; i += this.CONCURRENCY_LIMIT) {
            const batch = newUrls.slice(i, i + this.CONCURRENCY_LIMIT);
            const promises = batch.map((url) => this.scrapeJobDetails(url));
            const results = await Promise.all(promises);

            for (const job of results) {
              if (job) {
                // Check job age (include jobs from 0 to MAX_JOB_AGE_DAYS)
                const jobAgeDays =
                  (new Date().getTime() - job.postedDate.getTime()) / (1000 * 3600 * 24);

                if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                  await onJobScraped(job);
                  totalFound++;
                  console.log(
                    `   ✅ Saved: "${job.title}" at ${job.company} (${Math.floor(
                      jobAgeDays
                    )} days old)`
                  );
                } else {
                  console.log(
                    `   ⏰ Skipped old job: "${job.title}" (${Math.floor(jobAgeDays)} days old)`
                  );
                }
              }
            }

            // Rate limiting
            await this.sleep(this.antiDetection.getSmartDelay("wuzzuf.net") + 1500);
          }

          searchCount++;

          // Delay between search terms
          await this.sleep(2000 + Math.random() * 2000);
        } catch (error) {
          console.error(`❌ Error searching Wuzzuf for "${term}":`, error);
        }
      }

      console.log(`🎉 Wuzzuf scraping completed. Found ${totalFound} fresh jobs.`);

      return {
        jobs: [],
        source: this.sourceName,
        success: totalFound > 0,
        totalFound,
      };
    } catch (error) {
      console.error("Wuzzuf scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseWuzzufDate(dateText: string): Date | null {
    if (!dateText) return null;

    const now = new Date();
    const lowerDate = dateText.toLowerCase().trim();

    // Handle English relative dates
    if (lowerDate.includes("today")) {
      return now;
    }

    if (lowerDate.includes("yesterday")) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Parse "posted X hours ago" / "X hours ago" / "X hour ago"
    const hoursMatch = lowerDate.match(/(?:posted\s+)?(\d+)\s*hours?\s*ago/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    // Parse "posted X days ago" / "X days ago" / "X day ago"
    const daysMatch = lowerDate.match(/(?:posted\s+)?(\d+)\s*days?\s*ago/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Parse "posted X weeks ago" / "X weeks ago" / "X week ago"
    const weeksMatch = lowerDate.match(/(?:posted\s+)?(\d+)\s*weeks?\s*ago/);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1]);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Parse "posted X months ago" / "X months ago" / "X month ago"
    const monthsMatch = lowerDate.match(/(?:posted\s+)?(\d+)\s*months?\s*ago/);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    }

    // Handle Arabic relative dates
    if (lowerDate.includes("اليوم")) {
      return now;
    }

    if (lowerDate.includes("أمس")) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Parse "منذ X يوم/أيام" (Arabic days)
    const arabicDaysMatch = lowerDate.match(/منذ\s*(\d+)\s*(يوم|أيام)/);
    if (arabicDaysMatch) {
      const days = parseInt(arabicDaysMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Parse "منذ X أسبوع/أسابيع" (Arabic weeks)
    const arabicWeeksMatch = lowerDate.match(/منذ\s*(\d+)\s*(أسبوع|أسابيع)/);
    if (arabicWeeksMatch) {
      const weeks = parseInt(arabicWeeksMatch[1]);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Parse "منذ X شهر/أشهر" (Arabic months)
    const arabicMonthsMatch = lowerDate.match(/منذ\s*(\d+)\s*(شهر|أشهر)/);
    if (arabicMonthsMatch) {
      const months = parseInt(arabicMonthsMatch[1]);
      return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    }

    // Try parsing as ISO date
    try {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    console.warn(`   ⚠️  Could not parse Wuzzuf date: "${dateText}"`);
    return null;
  }

  private extractWuzzufSkills(title: string, description: string): string[] {
    // Use the same comprehensive skill extraction as LinkedIn (from BaseScraper)
    // This ensures consistency across scrapers
    const titleSkills = this.extractSkillsFromText(title);
    const descriptionSkills = this.extractSkillsFromText(description);

    // Combine and deduplicate
    const allSkills = [...new Set([...titleSkills, ...descriptionSkills])];

    return allSkills;
  }
}
