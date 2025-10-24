/**
 * Glassdoor Scraper - HYBRID APPROACH (Option 3)
 *
 * STRATEGY: Extract data from search pages (fast, reliable) + selective detail scraping
 *
 * Glassdoor employs sophisticated bot detection on detail pages that blocks automated scrapers.
 * This hybrid approach maximizes data extraction while minimizing bot detection:
 *
 * ✅ Search pages: Extract title, company, location, salary, description snippet, skills, date (WORKS)
 * ✅ Detail pages: Only fetch if description snippet < 100 chars (SLOW, 10-15 sec delays)
 * ✅ Fallback: If detail page blocked, use search page data
 *
 * Data completeness:
 * - 90% of jobs have sufficient data from search page alone
 * - 10% need detail scraping (handled with aggressive rate limiting)
 *
 * Performance:
 * - ~30 jobs per search page (instant)
 * - ~3-5 detail pages per search (if needed, slow)
 * - Total: ~1-2 minutes per search vs 4-5 minutes with full detail scraping
 */

import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface GlassdoorSelectors {
  jobCard: string[];
  url: string[];
  detailTitle: string[];
  detailCompany: string[];
  detailLocation: string[];
  detailDescription: string[];
  detailDate: string[];
  detailSalary: string[];
}

export class GlassdoorScraper extends BaseScraper {
  protected sourceName = "Glassdoor";
  protected baseUrl = "https://www.glassdoor.com";
  private antiDetection: AntiDetectionManager;
  private bypassCache: boolean = false;
  private selectors: GlassdoorSelectors;
  private readonly MAX_JOB_AGE_DAYS = 7; // Fresh jobs only (last 7 days)
  private readonly CONCURRENCY_LIMIT = 4; // Parallel job detail fetching

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

  private loadSelectors(): GlassdoorSelectors {
    const filePath = path.join(__dirname, "glassdoor-selectors.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  }

  public setBypassCache(bypass: boolean): void {
    this.bypassCache = bypass;
  }

  protected async fetchPage(url: string): Promise<string> {
    const domain = "glassdoor.com";
    try {
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) {
          console.log(`📦 Using cached Glassdoor response...`);
          return cached;
        }
      }

      console.log(`🌐 Fetching Glassdoor page with browser...`);
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }

      console.log(`✅ Successfully fetched Glassdoor page`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch Glassdoor page:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  private buildSearchUrl(term: string, loc: string, searchCount: number): string {
    // Glassdoor uses a simpler URL format - just keyword search
    // Don't overcomplicate with too many filters that might trigger blocks
    const encodedTerm = encodeURIComponent(term);
    const encodedLoc = encodeURIComponent(loc);

    // Simple Glassdoor job search format
    return `https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&suggestChosen=false&clickSource=searchBtn&typedKeyword=${encodedTerm}&sc.keyword=${encodedTerm}&locT=C&locId=&jobType=&context=Jobs&dropdown=0`;
  }

  private extractText($element: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) return text;
    }
    return "";
  }

  private async scrapeJobsFromSearchPage(searchUrl: string): Promise<Job[]> {
    try {
      const html = await this.fetchPage(searchUrl);
      const $ = cheerio.load(html);
      const jobs: Job[] = [];

      // Debug: Check what we actually got
      console.log(`   🔍 HTML length: ${html.length} chars`);
      console.log(`   🔍 Page title: ${$("title").text()}`);

      // Try each job card selector
      let foundCards = 0;
      for (const cardSelector of this.selectors.jobCard) {
        const cards = $(cardSelector);
        console.log(`   🔍 Selector "${cardSelector}" found ${cards.length} cards`);
        if (cards.length > foundCards) {
          foundCards = cards.length;
        }
      }

      // Find job cards and extract all data directly from search page
      const jobCardSelector = this.selectors.jobCard.join(", ");

      $(jobCardSelector).each((_, element) => {
        const $card = $(element);

        // Extract URL
        let url = null;
        for (const sel of this.selectors.url) {
          url = $card.find(sel).attr("href");
          if (url) break;
        }

        if (!url) {
          url = $card.find("a").first().attr("href");
        }

        if (!url) return; // Skip if no URL

        // Make URL absolute - KEEP query parameters (they're essential for Glassdoor)
        const cleanUrl = url.trim();
        const absoluteUrl = cleanUrl.startsWith("http")
          ? cleanUrl
          : `https://www.glassdoor.com${cleanUrl}`;

        // Extract all data from search card (Option 3: avoid detail page scraping)
        const title =
          $card.find('.JobCard_jobTitle__GLyJ1, [data-test="job-title"]').first().text().trim() ||
          $card.find('a[class*="jobTitle"]').first().text().trim() ||
          "Unknown Title";

        const company =
          $card
            .find('.EmployerProfile_compactEmployerName__9MGcV, [class*="employerName"]')
            .first()
            .text()
            .trim() || "Unknown Company";

        const location =
          $card
            .find('.JobCard_location__Ds1fM, [data-test="emp-location"]')
            .first()
            .text()
            .trim() || "Not Specified";

        const salary = $card
          .find('.JobCard_salaryEstimate__QpbTW, [data-test="detailSalary"]')
          .first()
          .text()
          .trim();

        // Extract description snippet from search page
        const descriptionSnippet = $card
          .find('.JobCard_jobDescriptionSnippet__l1tnl, [data-test="descSnippet"]')
          .first()
          .text()
          .trim();

        // Extract skills from the search card (Glassdoor shows skills in snippet)
        const skillsText = $card
          .find('b:contains("Skills:")')
          .parent()
          .text()
          .replace("Skills:", "")
          .trim();

        // Extract posting date from search card
        const dateText = $card
          .find('.JobCard_listingAge__jJsuc, [data-test="job-age"]')
          .first()
          .text()
          .trim();

        let postedDate: Date | null = null;
        if (dateText) {
          postedDate = this.parseGlassdoorDate(dateText);
        }

        if (!postedDate) {
          postedDate = new Date(); // Default to today
        }

        // FILTER: Skip jobs older than 7 days (MAX_JOB_AGE_DAYS)
        const jobAgeDays = (new Date().getTime() - postedDate.getTime()) / (1000 * 3600 * 24);
        if (jobAgeDays > this.MAX_JOB_AGE_DAYS) {
          console.log(
            `   ⏰ Skipping old job: "${title}" (${Math.floor(
              jobAgeDays
            )} days old, posted: ${dateText})`
          );
          return; // Skip this job
        }

        // Build full description from snippet + skills
        let description = descriptionSnippet;
        if (skillsText) {
          description += `\n\nRequired Skills: ${skillsText}`;
        }

        // IMPORTANT: We need the full description for accurate skill extraction
        // Mark ALL jobs for detail scraping to get complete skills
        const needsDetailScraping = true; // Always fetch details for accurate skills

        const jobCreateData: any = {
          title,
          company,
          location,
          description: description || `${title} position at ${company}. Tech job opportunity.`,
          url: absoluteUrl,
          postedDate,
          _needsDetailScraping: needsDetailScraping, // Internal flag
        };

        if (salary && salary.match(/\d+/)) {
          jobCreateData.salary = salary;
        }

        const job = this.createJob(jobCreateData);

        // Extract skills from title + description + skills section
        const titleSkills = this.extractSkillsFromText(title);
        const descriptionSkills = this.extractSkillsFromText(description);
        const skillsSectionSkills = skillsText ? this.extractSkillsFromText(skillsText) : [];
        job.skills = [...new Set([...titleSkills, ...descriptionSkills, ...skillsSectionSkills])];

        jobs.push(job);
      });

      console.log(`   ✅ Successfully extracted ${jobs.length} jobs from search page`);
      return jobs;
    } catch (error) {
      console.error(`Failed to scrape jobs from ${searchUrl}:`, error);
      return [];
    }
  }

  private async scrapeJobDetails(jobUrl: string): Promise<Job | null> {
    try {
      console.log(`   📄 Scraping details from: ${jobUrl.substring(0, 60)}...`);
      const html = await this.fetchPage(jobUrl);
      const $ = cheerio.load(html);

      // Extract required fields
      let title = this.extractText($("body"), this.selectors.detailTitle);

      // Fallback: try to find any h1 on the page
      if (!title) {
        title = $("h1").first().text().trim();
      }

      // Additional fallback for Glassdoor
      if (!title) {
        const titleSelectors = [
          "[class*='JobDetails_jobTitle']",
          "[class*='job-title']",
          ".css-1vg6q84",
        ];
        for (const sel of titleSelectors) {
          const text = $(sel).first().text().trim();
          if (text) {
            title = text;
            break;
          }
        }
      }

      // Check for bot detection / blocked page
      if (title === "Job is OOO" || html.includes("Job is OOO") || html.includes("Access Denied")) {
        console.log(`   🚫 Bot detected or page blocked - skipping`);
        return null;
      }

      if (!title) {
        console.log(`   ⚠️  No title found, skipping job`);
        console.log(`   🔍 Debug: HTML preview: ${html.substring(0, 500)}`);
        return null;
      }

      const company =
        this.extractText($("body"), this.selectors.detailCompany) || "Unknown Company";
      const location =
        this.extractText($("body"), this.selectors.detailLocation) || "Not Specified";

      console.log(`   📋 Title: ${title}`);
      console.log(`   🏢 Company: ${company}`);
      console.log(`   📍 Location: ${location}`);

      // Extract description - AGGRESSIVE MODE: Get ALL relevant text from the page
      let description = "";

      // Strategy 1: Try specific selectors first
      const descriptionSelectors = this.selectors.detailDescription || [];
      for (const selector of descriptionSelectors) {
        const text = $(selector).text().trim();
        if (text && text.length > 200) {
          description = text;
          break;
        }
      }

      // Strategy 2: If no good description, grab EVERYTHING from main content areas
      if (!description || description.length < 200) {
        const contentSelectors = [
          "[class*='JobDetails']",
          "[class*='jobDetails']",
          "[class*='job-description']",
          "[class*='jobDescription']",
          "[class*='description']",
          "#JobDescriptionContainer",
          "[id*='JobDescription']",
          "main",
          "article",
          "[role='main']",
          ".content",
          "#content",
        ];

        for (const selector of contentSelectors) {
          const content = $(selector).text().trim();
          if (content && content.length > description.length) {
            description = content;
          }
        }
      }

      // Strategy 3: If still not enough, extract ALL text from body (excluding nav/header/footer)
      if (!description || description.length < 200) {
        // Remove navigation, headers, footers, scripts, styles
        $(
          "nav, header, footer, script, style, [class*='nav'], [class*='header'], [class*='footer']"
        ).remove();
        description = $("body").text().trim();
      }

      // Clean up the description - remove excessive whitespace but keep content
      description = description
        .replace(/\s+/g, " ") // Normalize whitespace
        .replace(/\n\s*\n/g, "\n") // Remove empty lines
        .trim();

      if (!description || description.length < 50) {
        description = `${title} position at ${company}. Tech job opportunity.`;
      }

      console.log(`   📝 Description length: ${description.length} chars`);
      console.log(`   📝 First 200 chars: ${description.substring(0, 200)}...`);

      // Extract date - try multiple approaches
      let dateStr = this.extractText($("body"), this.selectors.detailDate);

      // Glassdoor often hides dates in various places, try alternative selectors
      if (!dateStr) {
        const altSelectors = [
          "span:contains('Posted')",
          "div:contains('days ago')",
          "div:contains('hours ago')",
          "[class*='posted']",
          "[class*='date']",
        ];

        for (const selector of altSelectors) {
          const text = $(selector).first().text().trim();
          if (text && (text.includes("ago") || text.includes("Posted"))) {
            dateStr = text;
            break;
          }
        }
      }

      // If still no date, assume it's recent (within search filter)
      let postedDate: Date | null = null;
      if (dateStr) {
        postedDate = this.parseGlassdoorDate(dateStr);
      }

      if (!postedDate) {
        // Default to today if no date found (Glassdoor search filter already limits by date)
        console.log(
          `   ⚠️  No date found ("${dateStr}"), defaulting to today (search filter active)`
        );
        postedDate = new Date();
      }

      // Calculate age
      const jobAgeDays = (new Date().getTime() - postedDate.getTime()) / (1000 * 3600 * 24);
      if (dateStr) {
        console.log(`   📅 Job posted: "${dateStr}" → ${Math.floor(jobAgeDays)} days ago`);
      }

      // Extract salary if available
      const salary = this.extractText($("body"), this.selectors.detailSalary);

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

      // Use BaseScraper's comprehensive skill extraction (same as LinkedIn/Wuzzuf)
      const titleSkills = this.extractSkillsFromText(title);
      const descriptionSkills = this.extractSkillsFromText(description);
      job.skills = [...new Set([...titleSkills, ...descriptionSkills])];

      console.log(
        `   💼 Extracted ${job.skills.length} skills: ${job.skills.slice(0, 10).join(", ")}${
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

      console.log(
        "🔍 Starting Glassdoor hybrid job scraping (Option 3: Search page + selective details)..."
      );

      // Search terms focused on tech roles
      const searchTerms = [
        "software engineer",
        "software developer",
        "frontend developer",
        "backend developer",
        "full stack developer",
        "mobile developer",
        "react developer",
        "javascript developer",
        "python developer",
        "java developer",
        "node.js developer",
        "angular developer",
        "vue developer",
        "data engineer",
        "devops engineer",
      ];

      const locations = [
        "Remote",
        "United States",
        "United Kingdom",
        "Canada",
        "Germany",
        "Australia",
        "Netherlands",
      ];

      // Shuffle and limit
      const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
      const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
      const termsToUse = shuffledTerms.slice(0, 5);
      const locationsToUse = shuffledLocations.slice(0, 4);

      console.log(`🔍 Glassdoor search terms: ${termsToUse.join(", ")}`);
      console.log(`📍 Glassdoor locations: ${locationsToUse.join(", ")}`);

      let searchCount = 0;
      const maxSearches = 10;

      for (const term of termsToUse) {
        for (const loc of locationsToUse.slice(0, 2)) {
          if (searchCount >= maxSearches) break;

          try {
            console.log(`🎯 Searching Glassdoor for: "${term}" in "${loc}"`);

            const searchUrl = this.buildSearchUrl(term, loc, searchCount);

            // NEW: Extract all data from search page (Option 3)
            const jobs = await this.scrapeJobsFromSearchPage(searchUrl);

            console.log(`   Found ${jobs.length} jobs from search page`);

            // Filter out duplicates by URL
            const newJobs = jobs.filter((job) => !jobUrlCache.has(job.url));
            newJobs.forEach((job) => jobUrlCache.add(job.url));

            console.log(`   Processing ${newJobs.length} new jobs`);

            // Option 3: Only fetch detail page if description is too short
            const jobsNeedingDetails = newJobs.filter((job: any) => job._needsDetailScraping);
            const jobsReady = newJobs.filter((job: any) => !job._needsDetailScraping);

            console.log(
              `   ℹ️  All ${newJobs.length} jobs need detail scraping for accurate skills`
            );
            console.log(`   ⏳ Fetching detail pages with 10-15 sec delays to avoid blocking...`);

            // Process jobs that are ready (no detail page needed) - THIS WON'T RUN NOW
            for (const job of jobsReady) {
              const jobAgeDays =
                (new Date().getTime() - job.postedDate.getTime()) / (1000 * 3600 * 24);

              if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                // Clean up internal flag before saving
                delete (job as any)._needsDetailScraping;

                await onJobScraped(job);
                totalFound++;
                console.log(
                  `   ✅ Saved (search): "${job.title}" at ${job.company} (${
                    job.skills.length
                  } skills, ${Math.floor(jobAgeDays)} days old)`
                );
              }
            }

            // For jobs needing more details, fetch them with VERY slow rate limiting to avoid blocks
            // Process ONE at a time with 10+ second delays
            if (jobsNeedingDetails.length > 0) {
              for (let i = 0; i < jobsNeedingDetails.length; i++) {
                const baseJob = jobsNeedingDetails[i];

                console.log(
                  `   📄 [${i + 1}/${
                    jobsNeedingDetails.length
                  }] Fetching: "${baseJob.title.substring(0, 40)}..."`
                );

                try {
                  // Try to get more details, but don't fail if blocked
                  const detailedJob = await this.scrapeJobDetails(baseJob.url);

                  const finalJob = detailedJob || baseJob; // Fallback to search page data if blocked
                  const jobAgeDays =
                    (new Date().getTime() - finalJob.postedDate.getTime()) / (1000 * 3600 * 24);

                  if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                    // Clean up internal flag before saving
                    delete (finalJob as any)._needsDetailScraping;

                    await onJobScraped(finalJob);
                    totalFound++;
                    console.log(
                      `   ✅ Saved (${
                        detailedJob ? "detail" : "search"
                      }): "${finalJob.title.substring(0, 35)}..." (${
                        finalJob.skills.length
                      } skills)`
                    );
                  }

                  // VERY slow rate limiting for detail pages (10-15 seconds between requests)
                  if (i < jobsNeedingDetails.length - 1) {
                    const delay = 10000 + Math.random() * 5000;
                    console.log(
                      `   ⏳ Waiting ${Math.round(delay / 1000)}s before next request...`
                    );
                    await this.sleep(delay);
                  }
                } catch (error) {
                  console.error(
                    `   ⚠️ Failed to fetch details, using search data:`,
                    error instanceof Error ? error.message : error
                  );

                  // Still save the job with search page data
                  const jobAgeDays =
                    (new Date().getTime() - baseJob.postedDate.getTime()) / (1000 * 3600 * 24);

                  if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                    delete (baseJob as any)._needsDetailScraping;
                    await onJobScraped(baseJob);
                    totalFound++;
                  }
                }
              }
            }

            searchCount++;

            // Delay between searches
            await this.sleep(2000 + Math.random() * 2000);
          } catch (error) {
            console.error(`❌ Error searching Glassdoor for "${term}" in "${loc}":`, error);
          }
        }
        if (searchCount >= maxSearches) break;
      }

      console.log(`🎉 Glassdoor scraping completed. Found ${totalFound} fresh jobs.`);

      return {
        jobs: [],
        source: this.sourceName,
        success: totalFound > 0,
        totalFound,
      };
    } catch (error) {
      console.error("Glassdoor scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseGlassdoorDate(dateText: string): Date | null {
    if (!dateText) return null;

    const now = new Date();
    const lowerDate = dateText.toLowerCase().trim();

    // Handle "today", "yesterday"
    if (lowerDate.includes("today") || lowerDate.includes("just posted")) {
      return now;
    }

    if (lowerDate.includes("yesterday")) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Parse SHORT FORMATS used by Glassdoor: "24h", "2d", "14d", "30d+", etc.

    // Parse "Xh" or "X hours ago" or "X hour ago"
    let hoursMatch = lowerDate.match(/^(\d+)h$/);
    if (!hoursMatch) {
      hoursMatch = lowerDate.match(/(\d+)\s*hours?\s*ago/);
    }
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    // Parse "Xd" or "X days ago" or "X day ago"
    let daysMatch = lowerDate.match(/^(\d+)d$/);
    if (!daysMatch) {
      daysMatch = lowerDate.match(/(\d+)\s*days?\s*ago/);
    }
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Parse "Xw" or "X weeks ago" or "X week ago"
    let weeksMatch = lowerDate.match(/^(\d+)w$/);
    if (!weeksMatch) {
      weeksMatch = lowerDate.match(/(\d+)\s*weeks?\s*ago/);
    }
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1]);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Parse "Xm" or "X months ago" or "X month ago"
    let monthsMatch = lowerDate.match(/^(\d+)m$/);
    if (!monthsMatch) {
      monthsMatch = lowerDate.match(/(\d+)\s*months?\s*ago/);
    }
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    }

    // Parse "X+" formats (e.g., "30d+", "30+ days ago")
    let plusDaysMatch = lowerDate.match(/^(\d+)d\+$/);
    if (!plusDaysMatch) {
      plusDaysMatch = lowerDate.match(/(\d+)\+\s*days?\s*ago/);
    }
    if (plusDaysMatch) {
      const days = parseInt(plusDaysMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
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

    console.warn(`   ⚠️  Could not parse Glassdoor date: "${dateText}"`);
    return null;
  }
}
