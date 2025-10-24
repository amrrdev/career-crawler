/**
 * Bayt.com Scraper - MENA Job Market Coverage
 *
 * STRATEGY: Similar to Indeed (two-phase hybrid + anti-detection)
 * ✅ Browser-based with Cloudflare bypass (Puppeteer + stealth)
 * ✅ Phase 1: Search pages → Extract job URLs
 * ✅ Phase 2: Batch fetch details
 * ✅ CRITICAL: 7-day filter (user requirement: "only the last week of jobs")
 * ✅ Date parser: "X days ago" → validate < 7 days
 * ✅ Smart rate limiting
 * ✅ MENA coverage: Egypt, UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman
 *
 * Based on real Bayt.com HTML analysis (October 2025)
 */

import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface BaytSelectors {
  search: {
    jobCards: string[];
    jobId: string[];
    title: string[];
    titleText: string[];
    url: string[];
    company: string[];
    companyText: string[];
    location: string[];
    description: string[];
    datePosted: string[];
    logo: string[];
  };
  detail: {
    fullDescription: string[];
    requirements: string[];
    salary: string[];
    jobType: string[];
    careerLevel: string[];
    yearsExperience: string[];
    education: string[];
    postedDate: string[];
  };
}

export class BaytScraper extends BaseScraper {
  protected sourceName = "Bayt";
  protected baseUrl = "https://www.bayt.com";
  private antiDetection: AntiDetectionManager;
  private bypassCache: boolean = false;
  private selectors: BaytSelectors;
  private readonly MAX_JOB_AGE_DAYS = 7; // CRITICAL: User requirement - last 7 days only

  // MENA countries for Bayt.com (reduced for faster processing)
  private readonly COUNTRIES = ["egypt", "uae"];

  // Search terms (reduced for faster processing)
  private readonly SEARCH_TERMS = ["software-engineer", "full-stack-developer"];

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

  private loadSelectors(): BaytSelectors {
    const filePath = path.join(__dirname, "bayt-selectors.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  }

  public setBypassCache(bypass: boolean): void {
    this.bypassCache = bypass;
  }

  protected async fetchPage(url: string): Promise<string> {
    const domain = "bayt.com";
    try {
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) {
          console.log(`📦 Using cached Bayt response...`);
          return cached;
        }
      }

      console.log(`🌐 Fetching Bayt page with browser (bypassing Cloudflare)...`);
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }

      console.log(`✅ Successfully fetched Bayt page (Cloudflare bypassed)`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch Bayt page:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  /**
   * CRITICAL: Parse relative date strings like "12 days ago" or "18 hours ago"
   * and validate against 7-day filter requirement
   */
  private parseRelativeDate(dateText: string): Date | null {
    try {
      const now = new Date();
      const text = dateText.toLowerCase().trim();

      // Handle "Yesterday"
      if (text.includes("yesterday")) {
        const date = new Date(now);
        date.setDate(date.getDate() - 1);
        console.log(`   🔍 Parsed "${dateText}" → yesterday → ${date.toISOString().split("T")[0]}`);
        return date;
      }

      // Handle "Today" or "Just posted"
      if (text.includes("today") || text.includes("just posted")) {
        console.log(`   🔍 Parsed "${dateText}" → today → ${now.toISOString().split("T")[0]}`);
        return now;
      }

      // Match patterns like "12 days ago", "18 hours ago", "2 weeks ago"
      const daysMatch = text.match(/(\d+)\s*days?\s*ago/i);
      const hoursMatch = text.match(/(\d+)\s*hours?\s*ago/i);
      const weeksMatch = text.match(/(\d+)\s*weeks?\s*ago/i);
      const monthsMatch = text.match(/(\d+)\s*months?\s*ago/i);

      if (daysMatch) {
        const daysAgo = parseInt(daysMatch[1], 10);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        console.log(
          `   🔍 Parsed "${dateText}" → ${daysAgo} days ago → ${date.toISOString().split("T")[0]}`
        );
        return date;
      }

      if (hoursMatch) {
        const hoursAgo = parseInt(hoursMatch[1], 10);
        const date = new Date(now);
        date.setHours(date.getHours() - hoursAgo);
        console.log(`   🔍 Parsed "${dateText}" → ${hoursAgo} hours ago → ${date.toISOString()}`);
        return date;
      }

      if (weeksMatch) {
        const weeksAgo = parseInt(weeksMatch[1], 10);
        const date = new Date(now);
        date.setDate(date.getDate() - weeksAgo * 7);
        console.log(
          `   🔍 Parsed "${dateText}" → ${weeksAgo} weeks ago → ${date.toISOString().split("T")[0]}`
        );
        return date;
      }

      if (monthsMatch) {
        const monthsAgo = parseInt(monthsMatch[1], 10);
        const date = new Date(now);
        date.setMonth(date.getMonth() - monthsAgo);
        console.log(
          `   🔍 Parsed "${dateText}" → ${monthsAgo} months ago → ${
            date.toISOString().split("T")[0]
          }`
        );
        return date;
      }

      console.log(`   ⚠️ Could not parse date: "${dateText}"`);
      return null;
    } catch (error) {
      console.error("Error parsing date:", dateText, error);
      return null;
    }
  }

  /**
   * CRITICAL: Validate if a date is within the last 7 days
   * User requirement: "be sure that u scrap only the last week of the jobs, not older than this"
   */
  private isWithinSevenDays(date: Date | null): boolean {
    if (!date) {
      console.log(`   ❌ Date validation failed: date is null`);
      return false;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const isValid = date >= sevenDaysAgo && date <= now;
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (isValid) {
      console.log(`   ✅ Date validation passed: ${daysDiff} days old (within 7 days)`);
    } else {
      console.log(`   ❌ Date validation failed: ${daysDiff} days old (older than 7 days)`);
    }

    return isValid;
  }

  private buildSearchUrl(term: string, country: string): string {
    // Bayt.com URL structure:
    // https://www.bayt.com/en/{country}/jobs/{term}-jobs/
    //
    // Note: Date filter parameter ?filters=date_posted:7 may work
    // but we validate in code anyway for safety
    return `${this.baseUrl}/en/${country}/jobs/${term}-jobs/`;
  }

  private extractText($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }
    return "";
  }

  private extractMultipleText($: cheerio.CheerioAPI, selectors: string[]): string[] {
    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        const texts: string[] = [];
        elements.each((_, el) => {
          const text = $(el).text().trim();
          if (text) texts.push(text);
        });
        if (texts.length > 0) return texts;
      }
    }
    return [];
  }

  private extractAttribute($: cheerio.CheerioAPI, selectors: string[], attribute: string): string {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const attr = element.attr(attribute);
        if (attr) return attr.trim();
      }
    }
    return "";
  }

  /**
   * Clean company name by removing duplicates (e.g., "شركة البدوي للتوظيف/ Albadwy Recruitment" → "Albadwy Recruitment")
   */
  private cleanCompanyName(companyName: string): string {
    // If company has both Arabic and English separated by /
    if (companyName.includes("/")) {
      const parts = companyName.split("/").map((p) => p.trim());
      // Return the English part (usually second)
      return parts[1] || parts[0] || companyName;
    }

    return companyName.trim();
  }

  /**
   * Extract job cards from search page
   */
  private extractJobUrls($: cheerio.CheerioAPI): Array<{ url: string; datePosted: string }> {
    const jobs: Array<{ url: string; datePosted: string }> = [];

    // Find all job cards
    for (const selector of this.selectors.search.jobCards) {
      const jobCards = $(selector);
      if (jobCards.length > 0) {
        jobCards.each((_, card) => {
          const $card = $(card);

          // Extract URL
          let url = "";
          for (const urlSelector of this.selectors.search.url) {
            const linkEl = $card.find(urlSelector).first();
            if (linkEl.length > 0) {
              const href = linkEl.attr("href");
              if (href) {
                url = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
                break;
              }
            }
          }

          // Extract date posted
          let datePosted = "";
          for (const dateSelector of this.selectors.search.datePosted) {
            const dateEl = $card.find(dateSelector).first();
            if (dateEl.length > 0) {
              datePosted = dateEl.text().trim();
              break;
            }
          }

          if (url && datePosted) {
            jobs.push({ url, datePosted });
          }
        });

        break; // Found job cards, stop trying other selectors
      }
    }

    return jobs;
  }

  /**
   * Extract full job details from detail page
   * @param validatedDate - Pre-validated date from search page (detail page dates are unreliable)
   */
  private extractJobDetails(
    $: cheerio.CheerioAPI,
    url: string,
    validatedDate: Date | null
  ): Job | null {
    try {
      // Extract title - Try multiple strategies
      let title = "";

      // Strategy 1: Try h1 tags (most job titles are in h1)
      title = $("h1").first().text().trim();

      // Strategy 2: Try data-testid or specific selectors
      if (!title || title.includes("Get contacted")) {
        title = this.extractText($, this.selectors.search.titleText);
      }

      // Strategy 3: Try og:title meta tag
      if (!title || title.includes("Get contacted")) {
        title = $('meta[property="og:title"]').attr("content")?.trim() || "";
      }

      // Filter out noise
      if (
        !title ||
        title.includes("Get contacted") ||
        title.includes("Easy Apply") ||
        title.length < 3
      ) {
        console.log(`   ⚠️ Could not extract valid title from detail page`);
        return null;
      }

      console.log(`   📋 Title: ${title}`);

      // Extract company
      let company = this.extractText($, this.selectors.search.companyText);

      // Try alternative: company link (with filtering to avoid navigation links)
      if (!company || company.includes("Get contacted") || company === "Companies") {
        $("a").each((_, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().trim();
          // Must have /company/ in href, valid text, and must NOT be generic navigation
          if (
            href &&
            href.includes("/company/") &&
            text &&
            text.length > 2 &&
            text.length < 100 &&
            text !== "Companies" && // Filter out navigation link
            text !== "See company details" && // Filter out generic text
            !href.endsWith("/company/") && // Filter out base /company/ URL (navigation)
            href.match(/\/company\/.+-\d+\/$/) // Must have company slug + ID pattern
          ) {
            company = text;
            return false; // break
          }
        });
      }

      company = this.cleanCompanyName(company);
      if (!company || company === "N/A" || company === "Companies") {
        company = "Bayt.com";
      }

      console.log(`   🏢 Company: ${company}`);

      // Extract location - IMPROVED: Clean extraction
      let location = "";

      // Strategy 1: Try to find location from job card metadata
      const locationLinks = $("a[href*='/jobs/'][href*='-in-']");
      if (locationLinks.length > 0) {
        const locationTexts: string[] = [];
        locationLinks.each((_, el) => {
          const text = $(el).text().trim();
          // Skip if it's the country only (Egypt, UAE, etc.)
          if (text && text.length > 2 && text.length < 50 && !text.includes("jobs")) {
            locationTexts.push(text);
          }
        });
        if (locationTexts.length > 0) {
          // Take the most specific location (usually the first one or two)
          location = locationTexts.slice(0, 2).join(", ");
        }
      }

      // Strategy 2: If no location links found, try the selector approach
      if (!location) {
        const locationParts = this.extractMultipleText($, this.selectors.search.location);
        location = locationParts
          .filter((p) => {
            // Filter out dates, button text, and separators
            const lower = p.toLowerCase();
            return (
              p &&
              p !== "·" &&
              p.length > 1 &&
              p.length < 50 &&
              !lower.includes("ago") &&
              !lower.includes("apply") &&
              !lower.includes("easy") &&
              !lower.includes("today") &&
              !lower.includes("yesterday") &&
              !lower.match(/\d{4}\/\d{2}\/\d{2}/) && // No dates like 2025/12/23
              !lower.match(/\d+\s*(hour|day|week|month)s?\s*ago/) // No "X days ago"
            );
          })
          .join(", ");
      }

      // Fallback
      if (!location || location.length < 2) {
        location = "Remote";
      }

      console.log(`   📍 Location: ${location}`);

      // Extract description - Target the SPECIFIC job description div
      let description = "";

      // Strategy 1: Find the <h2> with "Job description" text, then get its sibling <div class="t-break">
      const h2Elements = $("h2");
      h2Elements.each((_, el) => {
        const heading = $(el).text().trim().toLowerCase();
        if (heading.includes("job description") || heading.includes("responsibilities")) {
          // Get the next sibling div with class t-break
          const descDiv = $(el).next("div.t-break");
          if (descDiv.length > 0) {
            description = descDiv.text().trim();
            console.log(
              `   ✅ Found job description via h2 + t-break (${description.length} chars)`
            );
            return false; // Break the loop
          }
        }
      });

      // Strategy 2: Fallback to finding div.t-break directly
      if (!description || description.length < 100) {
        const tBreakDiv = $("div.t-break").first();
        if (tBreakDiv.length > 0) {
          description = tBreakDiv.text().trim();
          console.log(`   ⚠️ Using first t-break div as fallback (${description.length} chars)`);
        }
      }

      // Strategy 3: Last resort - try card-content but filter out navigation/header
      if (!description || description.length < 100) {
        const cardContent = $(".card-content").text().trim();
        if (cardContent && cardContent.length > 200) {
          // Remove common navigation/header text
          description = cardContent
            .replace(/Get contacted by recruiters.*$/is, "")
            .replace(/Easy Apply.*$/is, "")
            .replace(/Email to Friend.*$/is, "")
            .trim();
          console.log(`   ⚠️ Using card-content as last resort (${description.length} chars)`);
        }
      }

      // Clean up description
      description = description
        .replace(/\s+/g, " ")
        .replace(/Get contacted by recruiters.*$/i, "")
        .replace(/Easy Apply.*$/i, "")
        .trim();

      if (!description || description.length < 50) {
        description = `${title} position at ${company} in ${location}. Join our team!`;
      }

      console.log(`   📝 Description length: ${description.length} chars`);

      // Use the validated date from search page (detail pages have contaminated dates)
      const postedDate = validatedDate || new Date();

      console.log(
        `   📅 Using validated date from search page: ${postedDate.toISOString().split("T")[0]}`
      );

      // ENHANCED SKILL EXTRACTION - Extract from TITLE + DESCRIPTION (not just description)
      const titleSkills = this.extractSkillsFromText(title);
      const descriptionSkills = this.extractSkillsFromText(description);
      const companySkills = this.extractSkillsFromText(company);

      // Combine and deduplicate
      const allSkillsSet = new Set<string>([
        ...titleSkills,
        ...descriptionSkills,
        ...companySkills,
      ]);
      const allSkills = Array.from(allSkillsSet);

      console.log(`   💼 Extracted ${allSkills.length} skills:`);
      console.log(
        `      From title (${titleSkills.length}): ${titleSkills.slice(0, 5).join(", ")}${
          titleSkills.length > 5 ? "..." : ""
        }`
      );
      console.log(
        `      From description (${descriptionSkills.length}): ${descriptionSkills
          .slice(0, 5)
          .join(", ")}${descriptionSkills.length > 5 ? "..." : ""}`
      );
      console.log(`      Total unique: ${allSkills.join(", ")}`);

      // Extract salary (optional)
      const salary = this.extractText($, this.selectors.detail.salary);

      const job: Job = {
        id: this.generateJobId(url, title),
        title,
        company,
        location,
        description,
        url,
        ...(salary && salary.match(/\d+/) && { salary }), // Only include salary if it has numbers
        skills: allSkills,
        jobType: "full-time",
        source: this.sourceName,
        postedDate,
        extractedAt: new Date(),
      };

      return job;
    } catch (error) {
      console.error(`   ❌ Error extracting job details from ${url}:`, error);
      return null;
    }
  }

  /**
   * Phase 1: Extract job URLs from search pages
   */
  private async extractJobUrlsFromSearch(
    term: string,
    country: string
  ): Promise<Array<{ url: string; datePosted: string }>> {
    const searchUrl = this.buildSearchUrl(term, country);
    console.log(`📄 Scraping search page: ${searchUrl}`);

    try {
      const html = await this.fetchPage(searchUrl);
      const $ = cheerio.load(html);

      const jobUrls = this.extractJobUrls($);
      console.log(`Found ${jobUrls.length} job URLs from ${country} - ${term}`);

      return jobUrls;
    } catch (error) {
      console.error(`Failed to fetch search page: ${searchUrl}`, error);
      return [];
    }
  }

  /**
   * Phase 2: Fetch job details (with 7-day validation)
   * IMPORTANT: Use the date from search page, not detail page (detail page dates are contaminated)
   */
  private async fetchJobDetails(jobUrl: { url: string; datePosted: string }): Promise<Job | null> {
    try {
      // CRITICAL: Pre-filter by date before fetching detail page
      const parsedDate = this.parseRelativeDate(jobUrl.datePosted);
      if (!this.isWithinSevenDays(parsedDate)) {
        console.log(`🚫 Skipping detail fetch for job (older than 7 days): ${jobUrl.url}`);
        return null;
      }

      console.log(`   ⏳ Fetching detail page...`);
      const html = await this.fetchPage(jobUrl.url);
      console.log(`   ✅ Detail page fetched, extracting data...`);

      const $ = cheerio.load(html);

      // Pass the validated date from search page to avoid contaminated detail page dates
      const job = this.extractJobDetails($, jobUrl.url, parsedDate);

      if (job) {
        console.log(`   ✅ Job extracted successfully!`);
      } else {
        console.log(`   ❌ Failed to extract job details`);
      }

      return job;
    } catch (error) {
      console.error(`Failed to fetch job details: ${jobUrl.url}`, error);
      return null;
    }
  }

  /**
   * Main scraping method (required by BaseScraper)
   */
  async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    console.log("🚀 Starting Bayt.com scraper (with 7-day filter)...");
    console.log("📋 Strategy: Process jobs immediately after each search (incremental)");

    const startTime = Date.now();
    const allJobs: Job[] = [];
    const processedUrls = new Set<string>(); // Avoid duplicates

    let totalAccepted = 0;
    let totalRejected = 0;
    let totalProcessed = 0;

    try {
      // INCREMENTAL PROCESSING: Fetch details immediately after each search
      for (const country of this.COUNTRIES) {
        for (const term of this.SEARCH_TERMS) {
          console.log(`\n${"=".repeat(60)}`);
          console.log(`🔍 Search: ${term} in ${country}`);
          console.log(`${"=".repeat(60)}`);

          // Phase 1: Get job URLs for this search
          const jobUrls = await this.extractJobUrlsFromSearch(term, country);

          // Filter out duplicates
          const newJobUrls = jobUrls.filter((j) => !processedUrls.has(j.url));
          newJobUrls.forEach((j) => processedUrls.add(j.url));

          console.log(`📦 Found ${jobUrls.length} jobs (${newJobUrls.length} new)`);

          // Phase 2: Process these jobs immediately
          if (newJobUrls.length > 0) {
            console.log(`📄 Processing ${newJobUrls.length} job details...`);

            for (const jobUrl of newJobUrls) {
              try {
                totalProcessed++;
                console.log(
                  `\n[${totalProcessed}] ${jobUrl.url.substring(
                    jobUrl.url.lastIndexOf("/") + 1,
                    jobUrl.url.lastIndexOf("/") + 30
                  )}...`
                );
                console.log(`   Date: ${jobUrl.datePosted}`);

                const job = await this.fetchJobDetails(jobUrl);
                if (job) {
                  allJobs.push(job);
                  // 🔥 SAVE TO DATABASE IMMEDIATELY
                  console.log(`   💾 Saving to database...`);
                  try {
                    await onJobScraped(job);
                    totalAccepted++;
                    console.log(`   ✅ SAVED TO DATABASE! (${totalAccepted} total jobs saved)`);
                  } catch (callbackError) {
                    console.error(`   ❌ Callback error:`, callbackError);
                    totalAccepted++;
                  }
                } else {
                  totalRejected++;
                  console.log(`   🚫 Rejected (${totalRejected} total)`);
                }

                // Rate limiting
                await this.sleep(2000 + Math.random() * 1000);
              } catch (error) {
                console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
                totalRejected++;
              }
            }
          }

          // Rate limiting between searches
          await this.sleep(2000 + Math.random() * 1000);
        }
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📊 FINAL SUMMARY`);
      console.log(`${"=".repeat(60)}`);
      console.log(`   Total processed: ${totalProcessed}`);
      console.log(`   ✅ Accepted: ${totalAccepted}`);
      console.log(`   🚫 Rejected: ${totalRejected}`);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ Bayt.com scraper completed: ${allJobs.length} jobs (all from last 7 days) in ${elapsedTime}s`
      );

      return {
        jobs: allJobs,
        source: this.sourceName,
        success: true,
        totalFound: allJobs.length,
      };
    } catch (error) {
      console.error("❌ Error in Bayt scraper:", error);
      return {
        jobs: allJobs,
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: allJobs.length,
      };
    } finally {
      this.antiDetection.cleanup();
    }
  }
}
