import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class IndeedScraper extends BaseScraper {
  protected sourceName = "Indeed";
  protected baseUrl = "https://indeed.com";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Different search terms and locations to get diverse results
      const searches = [
        { q: "software developer", l: "remote" },
        { q: "frontend developer", l: "remote" },
        { q: "backend developer", l: "remote" },
        { q: "full stack developer", l: "remote" },
        { q: "python developer", l: "remote" },
        { q: "javascript developer", l: "remote" },
        { q: "react developer", l: "remote" },
        { q: "node.js developer", l: "remote" },
      ];

      for (const search of searches.slice(0, 3)) {
        // Limit to 3 searches to avoid being blocked
        try {
          // Indeed search URL - using simple format to avoid complex parameters
          const url = `https://indeed.com/jobs?q=${encodeURIComponent(
            search.q
          )}&l=${encodeURIComponent(search.l)}&sort=date&limit=50`;

          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);

          // Indeed job result selectors (they change frequently, so we try multiple)
          const jobSelectors = [
            ".jobsearch-SerpJobCard",
            ".slider_container .slider_item",
            '[data-testid="job-result"]',
            ".job_seen_beacon",
            ".jobsearch-ResultWithHeader",
          ];

          let foundJobs = false;

          for (const selector of jobSelectors) {
            const jobElements = $(selector);
            if (jobElements.length > 0) {
              foundJobs = true;

              jobElements.each((index, element) => {
                if (index >= 15) return false; // Limit per search

                try {
                  const $job = $(element);

                  // Try different selectors for title
                  const $titleLink = $job
                    .find('h2 a, .jobTitle a, [data-testid="job-title"] a, .jobTitle span[title]')
                    .first();
                  const title = $titleLink.attr("title") || $titleLink.text().trim();
                  const jobUrl = $titleLink.attr("href");

                  if (!title) return true; // Continue to next iteration

                  // Extract company
                  const company =
                    $job
                      .find('.companyName, [data-testid="company-name"] a, .companyName a')
                      .first()
                      .text()
                      .trim() || "Company";

                  // Extract location
                  const location =
                    $job
                      .find('.companyLocation, [data-testid="job-location"]')
                      .first()
                      .text()
                      .trim() || search.l;

                  // Extract summary/snippet
                  const summary =
                    $job.find('.summary, [data-testid="job-snippet"]').first().text().trim() ||
                    `${title} position at ${company}`;

                  // Extract salary if available
                  const salaryElement = $job
                    .find('.salaryText, [data-testid="salary-snippet"]')
                    .first();
                  const salaryText = salaryElement.text().trim();

                  // Extract posting date
                  const dateElement = $job.find('.date, [data-testid="job-age"]').first();
                  const dateText = dateElement.text().trim();
                  const postedDate = this.parseIndeedDate(dateText);

                  const jobCreateData: any = {
                    title: this.cleanText(title),
                    company: this.cleanText(company),
                    location: this.cleanText(location),
                    description: this.cleanText(summary),
                    url: jobUrl
                      ? jobUrl.startsWith("http")
                        ? jobUrl
                        : `https://indeed.com${jobUrl}`
                      : `https://indeed.com/jobs?q=${encodeURIComponent(title)}`,
                    postedDate: postedDate,
                  };

                  if (salaryText && salaryText.match(/[\$€£]\d+/)) {
                    jobCreateData.salary = this.cleanText(salaryText);
                  }

                  const job = this.createJob(jobCreateData);

                  // Extract skills from title and description
                  const extractedSkills = this.extractIndeedSkills(title, summary);
                  job.skills = [...new Set([...job.skills, ...extractedSkills])];

                  jobs.push(job);
                } catch (error) {
                  console.error("Error processing Indeed job:", error);
                }
              });

              break; // Found jobs with this selector, no need to try others
            }
          }

          if (!foundJobs) {
            console.log(`No jobs found for search: ${search.q} in ${search.l}`);
          }

          // Longer delay for Indeed to avoid rate limiting
          await this.sleep(3000);
        } catch (error) {
          console.error(`Error scraping Indeed search ${search.q}:`, error);
        }
      }

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: jobs.length > 0,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("Indeed scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseIndeedDate(dateText: string): Date {
    const now = new Date();

    if (!dateText) return now;

    const lowerDate = dateText.toLowerCase();

    if (lowerDate.includes("just posted") || lowerDate.includes("today")) {
      return now;
    }

    // Parse "X days ago"
    const daysMatch = lowerDate.match(/(\d+)\s*days?\s*ago/);
    if (daysMatch) {
      const daysAgo = parseInt(daysMatch[1]);
      const date = new Date(now);
      date.setDate(now.getDate() - daysAgo);
      return date;
    }

    // Parse "X hours ago"
    const hoursMatch = lowerDate.match(/(\d+)\s*hours?\s*ago/);
    if (hoursMatch) {
      const hoursAgo = parseInt(hoursMatch[1]);
      const date = new Date(now);
      date.setHours(now.getHours() - hoursAgo);
      return date;
    }

    return now;
  }

  private extractIndeedSkills(title: string, description: string): string[] {
    const skills: string[] = [];
    const text = `${title} ${description}`.toLowerCase();

    // Popular Indeed skills
    const skillKeywords = [
      // Programming Languages
      { keywords: ["javascript", "js"], skill: "JavaScript" },
      { keywords: ["typescript"], skill: "TypeScript" },
      { keywords: ["python"], skill: "Python" },
      { keywords: ["java"], skill: "Java" },
      { keywords: ["c#"], skill: "C#" },
      { keywords: ["php"], skill: "PHP" },
      { keywords: ["ruby"], skill: "Ruby" },
      { keywords: ["go"], skill: "Go" },

      // Frontend
      { keywords: ["react"], skill: "React" },
      { keywords: ["vue"], skill: "Vue.js" },
      { keywords: ["angular"], skill: "Angular" },
      { keywords: ["html"], skill: "HTML" },
      { keywords: ["css"], skill: "CSS" },

      // Backend
      { keywords: ["node.js", "nodejs"], skill: "Node.js" },
      { keywords: ["express"], skill: "Express" },
      { keywords: ["django"], skill: "Django" },
      { keywords: ["flask"], skill: "Flask" },
      { keywords: ["laravel"], skill: "Laravel" },
      { keywords: ["spring"], skill: "Spring" },
      { keywords: [".net"], skill: ".NET" },

      // Databases
      { keywords: ["sql"], skill: "SQL" },
      { keywords: ["mysql"], skill: "MySQL" },
      { keywords: ["postgresql"], skill: "PostgreSQL" },
      { keywords: ["mongodb"], skill: "MongoDB" },
      { keywords: ["redis"], skill: "Redis" },

      // Cloud
      { keywords: ["aws"], skill: "AWS" },
      { keywords: ["azure"], skill: "Azure" },
      { keywords: ["gcp", "google cloud"], skill: "Google Cloud" },
      { keywords: ["docker"], skill: "Docker" },
      { keywords: ["kubernetes"], skill: "Kubernetes" },

      // Other
      { keywords: ["git"], skill: "Git" },
      { keywords: ["agile"], skill: "Agile" },
      { keywords: ["scrum"], skill: "Scrum" },
      { keywords: ["rest"], skill: "REST API" },
      { keywords: ["graphql"], skill: "GraphQL" },
    ];

    skillKeywords.forEach(({ keywords, skill }) => {
      if (keywords.some((keyword) => text.includes(keyword))) {
        skills.push(skill);
      }
    });

    return skills;
  }
}
