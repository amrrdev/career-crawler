import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class LinkedInScraper extends BaseScraper {
  protected sourceName = "LinkedIn";
  protected baseUrl = "https://www.linkedin.com";

  // Multiple user agents to rotate
  private userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  ];

  protected async fetchPage(url: string): Promise<string> {
    try {
      // Longer delay for LinkedIn
      await this.sleep(this.delay + Math.random() * 2000); // Random delay 1-3 seconds

      const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

      const response = await fetch(url, {
        headers: {
          "User-Agent": randomUserAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Failed to fetch LinkedIn page ${url}:`, error);
      throw error;
    }
  }

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

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
      const maxSearches = 4; // Limit to avoid being blocked

      for (const term of searchTerms.slice(0, 2)) {
        // Only 2 search terms
        for (const loc of locations.slice(0, 2)) {
          // Only 2 locations
          if (searchCount >= maxSearches) break;

          try {
            console.log(`Searching LinkedIn for: ${term} in ${loc}`);

            // LinkedIn public job search URL
            const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
              term
            )}&location=${encodeURIComponent(loc)}&f_TPR=r86400&f_JT=F&sortBy=DD&start=0`;

            const html = await this.fetchPage(searchUrl);
            const $ = cheerio.load(html);

            // LinkedIn job card selectors (they change frequently)
            const jobSelectors = [
              ".job-search-card",
              ".jobs-search__results-list li",
              ".jobs-search-results__list-item",
              ".job-result-card",
              '[data-entity-urn*="jobPosting"]',
            ];

            let foundJobs = false;

            for (const selector of jobSelectors) {
              const jobElements = $(selector);
              console.log(`Trying selector ${selector}: found ${jobElements.length} elements`);

              if (jobElements.length > 0) {
                foundJobs = true;

                jobElements.each((index, element) => {
                  if (index >= 10) return false; // Limit per search

                  try {
                    const $job = $(element);

                    // Extract job title
                    const $titleLink = $job
                      .find(
                        'h3 a, .job-title a, [data-tracking-control-name="public_jobs_jserp-result_search-card"] h3 a'
                      )
                      .first();
                    let title = $titleLink.text().trim();
                    let jobUrl = $titleLink.attr("href");

                    // Alternative title extraction
                    if (!title) {
                      title = $job
                        .find("h3, .job-title, .jobs-search-results__list-item h3")
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
                      .find(".job-search-card__subtitle-link, .job-result-card__company-link, h4 a")
                      .first()
                      .text()
                      .trim();
                    if (!company) {
                      company = $job
                        .find('h4, .company-name, [data-tracking-control-name*="company"]')
                        .first()
                        .text()
                        .trim();
                    }
                    if (!company) company = "LinkedIn Company";

                    // Extract location
                    let jobLocation = $job
                      .find(".job-search-card__location, .job-result-card__location")
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
                      .find(".job-search-card__snippet, .job-result-card__snippet")
                      .first()
                      .text()
                      .trim();
                    if (!description) {
                      description = `${title} position at ${company} in ${jobLocation}. Apply on LinkedIn for full details.`;
                    }

                    // Extract posting date
                    const dateElement = $job
                      .find("time, .job-search-card__listdate, [datetime]")
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

                    // Enhanced LinkedIn skill extraction
                    const linkedinSkills = this.extractLinkedInSkills(title, description, term);
                    jobData.skills = [...new Set([...jobData.skills, ...linkedinSkills])];

                    jobs.push(jobData);
                    console.log(`✓ Extracted job: ${title} at ${company}`);
                  } catch (error) {
                    console.error("Error processing LinkedIn job:", error);
                  }
                });

                break; // Found jobs with this selector
              }
            }

            if (!foundJobs) {
              console.log(`No jobs found with any selector for: ${term} in ${loc}`);
            }

            searchCount++;

            // Longer delay between searches for LinkedIn
            await this.sleep(4000 + Math.random() * 2000); // 4-6 seconds
          } catch (error) {
            console.error(`Error searching LinkedIn for ${term} in ${loc}:`, error);
          }
        }

        if (searchCount >= maxSearches) break;
      }

      console.log(
        `LinkedIn scraping completed. Found ${jobs.length} jobs from ${searchCount} searches.`
      );

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: jobs.length > 0,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("LinkedIn scraper error:", error);
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

  private extractLinkedInSkills(title: string, description: string, searchTerm: string): string[] {
    const skills: string[] = [];
    const text = `${title} ${description} ${searchTerm}`.toLowerCase();

    // LinkedIn-specific skill patterns
    const skillPatterns = [
      // Programming Languages
      { regex: /javascript|js(?!\w)/g, skill: "JavaScript" },
      { regex: /typescript|ts(?!\w)/g, skill: "TypeScript" },
      { regex: /python/g, skill: "Python" },
      { regex: /java(?!\w)/g, skill: "Java" },
      { regex: /c#|csharp/g, skill: "C#" },
      { regex: /php/g, skill: "PHP" },
      { regex: /ruby/g, skill: "Ruby" },
      { regex: /golang|go(?!\w)/g, skill: "Go" },
      { regex: /swift/g, skill: "Swift" },
      { regex: /kotlin/g, skill: "Kotlin" },

      // Frontend Technologies
      { regex: /react(?:\.?js)?/g, skill: "React" },
      { regex: /vue(?:\.?js)?/g, skill: "Vue.js" },
      { regex: /angular/g, skill: "Angular" },
      { regex: /html5?/g, skill: "HTML" },
      { regex: /css3?/g, skill: "CSS" },
      { regex: /sass|scss/g, skill: "Sass" },
      { regex: /bootstrap/g, skill: "Bootstrap" },
      { regex: /tailwind/g, skill: "Tailwind CSS" },

      // Backend Technologies
      { regex: /node(?:\.?js)?/g, skill: "Node.js" },
      { regex: /express(?:\.?js)?/g, skill: "Express" },
      { regex: /django/g, skill: "Django" },
      { regex: /flask/g, skill: "Flask" },
      { regex: /laravel/g, skill: "Laravel" },
      { regex: /spring/g, skill: "Spring" },
      { regex: /\.net/g, skill: ".NET" },
      { regex: /asp\.net/g, skill: "ASP.NET" },

      // Databases
      { regex: /postgresql|postgres/g, skill: "PostgreSQL" },
      { regex: /mysql/g, skill: "MySQL" },
      { regex: /mongodb|mongo/g, skill: "MongoDB" },
      { regex: /redis/g, skill: "Redis" },
      { regex: /elasticsearch/g, skill: "Elasticsearch" },
      { regex: /sql server/g, skill: "SQL Server" },

      // Cloud Platforms
      { regex: /aws|amazon web services/g, skill: "AWS" },
      { regex: /azure/g, skill: "Azure" },
      { regex: /gcp|google cloud/g, skill: "Google Cloud" },
      { regex: /firebase/g, skill: "Firebase" },

      // DevOps & Tools
      { regex: /docker/g, skill: "Docker" },
      { regex: /kubernetes|k8s/g, skill: "Kubernetes" },
      { regex: /jenkins/g, skill: "Jenkins" },
      { regex: /gitlab/g, skill: "GitLab" },
      { regex: /github/g, skill: "GitHub" },
      { regex: /terraform/g, skill: "Terraform" },
      { regex: /ansible/g, skill: "Ansible" },

      // Other Important Skills
      { regex: /git(?!\w)/g, skill: "Git" },
      { regex: /agile/g, skill: "Agile" },
      { regex: /scrum/g, skill: "Scrum" },
      { regex: /rest api|restful/g, skill: "REST API" },
      { regex: /graphql/g, skill: "GraphQL" },
      { regex: /microservices/g, skill: "Microservices" },
      { regex: /machine learning|ml/g, skill: "Machine Learning" },
      { regex: /artificial intelligence|ai/g, skill: "AI" },
      { regex: /data science/g, skill: "Data Science" },
    ];

    skillPatterns.forEach(({ regex, skill }) => {
      if (regex.test(text)) {
        skills.push(skill);
      }
    });

    return skills;
  }
}
