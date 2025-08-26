import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";

export class MonsterScraper extends BaseScraper {
  protected sourceName = "Monster";
  protected baseUrl = "https://www.monster.com";
  private antiDetection: AntiDetectionManager;

  constructor() {
    super();
    this.antiDetection = new AntiDetectionManager();

    // Clean up old sessions periodically
    setInterval(() => {
      this.antiDetection.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  protected async fetchPage(url: string): Promise<string> {
    try {
      const domain = "monster.com";

      // Check cache first
      const cached = this.antiDetection.getCachedResponse(url);
      if (cached && !process.env.BYPASS_CACHE) {
        console.log(`📦 Using cached response for ${url.substring(0, 100)}...`);
        return cached;
      }

      // Check if we can make request (rate limiting)
      if (!this.antiDetection.canMakeRequest(domain)) {
        const delay = this.antiDetection.getSmartDelay(domain);
        console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }

      console.log(`🌐 Fetching Monster with browser: ${url.substring(0, 100)}...`);

      // Use the enhanced browser-based fetching
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      // Cache successful response
      this.antiDetection.setCachedResponse(url, html);

      console.log(`✅ Successfully fetched Monster page with browser`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch Monster page:`, error);

      // Try fallback method if browser fails
      if (error instanceof Error && error.message.includes("browser")) {
        console.log(`🔄 Trying fallback fetch method for Monster...`);
        return await this.fallbackFetch(url);
      }

      this.antiDetection.updateSession("monster.com", [], true);
      throw error;
    }
  }

  // Fallback method using regular fetch with enhanced headers
  private async fallbackFetch(url: string): Promise<string> {
    const domain = "monster.com";

    try {
      // Smart delay based on activity
      const smartDelay = this.antiDetection.getSmartDelay(domain);
      console.log(`⏱️  Fallback delay: ${smartDelay}ms for Monster`);
      await this.sleep(smartDelay);

      // Get realistic headers
      const headers = this.antiDetection.getRealisticHeaders(domain);

      // Add some additional stealth headers
      headers["DNT"] = "1";
      headers["Pragma"] = "no-cache";
      headers["Sec-Fetch-User"] = "?1";

      const response = await fetch(url, {
        headers,
        redirect: "follow",
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log("⚠️  Monster rate limited us in fallback, marking session as blocked");
          this.antiDetection.updateSession(domain, [], true);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`✅ Fallback fetch successful for Monster`);
      return html;
    } catch (error) {
      console.error(`❌ Fallback fetch also failed:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Popular tech job searches
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
        "mobile developer",
        "cloud engineer",
      ];

      // Global locations to search
      const locations = [
        "Remote",
        "United States",
        "United Kingdom",
        "Canada",
        "Germany",
        "Australia",
        "Netherlands",
        "France",
        "Switzerland",
        "Sweden",
        "Singapore",
        "Dubai, UAE",
        "Saudi Arabia",
        "Egypt",
        "India",
        "Ireland",
        "Spain",
        "Italy",
        "Poland",
        "Brazil",
        "Japan",
      ];

      // Shuffle for global diversity
      const shuffledLocations = locations.sort(() => Math.random() - 0.5);
      const shuffledTerms = searchTerms.sort(() => Math.random() - 0.5);

      let searchCount = 0;
      const maxSearches = 8; // Increased for global coverage

      for (const term of shuffledTerms.slice(0, 4)) {
        // Use 4 search terms
        for (const loc of shuffledLocations.slice(0, 2)) {
          // Use 2 random locations each time
          if (searchCount >= maxSearches) break;

          try {
            console.log(`🎯 Searching Monster for: "${term}" in "${loc}"`);

            // Monster job search URL with additional parameters
            const searchUrl = `https://www.monster.com/jobs/search?q=${encodeURIComponent(
              term
            )}&where=${encodeURIComponent(loc)}&tm=7&sort=rv.dt.di`;

            const html = await this.fetchPage(searchUrl);
            const $ = cheerio.load(html);

            // Enhanced Monster job card selectors
            const jobSelectors = [
              "[data-jobid]", // Primary job identifier
              ".job-card-container",
              ".card-content",
              ".job-card",
              ".job-result-item",
              ".job-results .job-card",
              "[class*='job-card']",
              "[class*='job-result']",
              ".search-results .job-card",
              "article[data-jobid]",
            ];

            let foundJobs = false;

            for (const selector of jobSelectors) {
              const jobElements = $(selector);
              console.log(
                `   🔍 Trying selector "${selector}": found ${jobElements.length} elements`
              );

              if (jobElements.length > 0) {
                foundJobs = true;

                jobElements.each((index, element) => {
                  if (index >= 15) return false; // Increased limit per search

                  try {
                    const $job = $(element);

                    // Enhanced job title extraction
                    let $titleLink = $job
                      .find('h2 a, .job-title a, .title a, [name="title"] a, a[data-jobid]')
                      .first();

                    // Try alternative selectors if not found
                    if ($titleLink.length === 0) {
                      $titleLink = $job
                        .find('a[href*="job-openings"], a[href*="/job/"], h3 a, h4 a')
                        .first();
                    }

                    let title = $titleLink.text().trim();
                    let jobUrl = $titleLink.attr("href");

                    // Alternative title extraction methods
                    if (!title) {
                      title = $job
                        .find("h2, .job-title, .title, .jobTitle, [data-cy='jobTitle']")
                        .first()
                        .text()
                        .trim();
                      // Try getting from aria-label or title attributes
                      if (!title) {
                        title =
                          $job
                            .find("[aria-label*='job' i], [title*='job' i]")
                            .first()
                            .attr("aria-label") ||
                          $job
                            .find("[aria-label*='job' i], [title*='job' i]")
                            .first()
                            .attr("title") ||
                          "";
                        title = title.trim();
                      }
                    }

                    if (!title || title.length < 5) {
                      console.log(`   ⚠️  Skipping job with invalid title: "${title}"`);
                      return;
                    }

                    // Enhanced URL cleaning and validation
                    if (jobUrl) {
                      if (!jobUrl.startsWith("http")) {
                        if (jobUrl.startsWith("/")) {
                          jobUrl = `https://www.monster.com${jobUrl}`;
                        } else {
                          jobUrl = `https://www.monster.com/${jobUrl}`;
                        }
                      }
                    } else {
                      // Try to extract job ID from data attributes
                      const jobId =
                        $job.attr("data-jobid") ||
                        $job.find("[data-jobid]").first().attr("data-jobid");
                      if (jobId) {
                        jobUrl = `https://www.monster.com/job-openings/${jobId}`;
                      } else {
                        jobUrl = `https://www.monster.com/jobs/search?q=${encodeURIComponent(
                          title
                        )}`;
                      }
                    }

                    // Enhanced company extraction
                    let company = $job
                      .find(
                        ".company, .company-name, .employer, [data-testid='company'], [data-cy='companyName']"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!company) {
                      company = $job
                        .find(
                          ".employer-name, .companyName, [class*='company'], [class*='employer']"
                        )
                        .first()
                        .text()
                        .trim();
                    }

                    // Try alternative company extraction
                    if (!company) {
                      company = $job
                        .find(
                          "a[href*='company'], span[title*='company' i], div[data-cy*='company']"
                        )
                        .first()
                        .text()
                        .trim();
                    }

                    if (!company) company = "Monster Company";

                    // Enhanced location extraction
                    let jobLocation = $job
                      .find(
                        ".location, .job-location, .city, [data-testid='job-location'], [data-cy='jobLocation']"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!jobLocation) {
                      jobLocation = $job
                        .find("[class*='location'], [class*='city'], span[title*='location' i]")
                        .first()
                        .text()
                        .trim();
                    }

                    if (!jobLocation) jobLocation = loc;

                    // Enhanced description extraction
                    let description = $job
                      .find(
                        ".summary, .job-summary, .description, [data-testid='job-description'], [data-cy='jobSummary']"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!description) {
                      // Try getting from closest elements or summary sections
                      description = $job
                        .find(
                          "p, div:contains('$'), div:contains('year'), div:contains('experience')"
                        )
                        .first()
                        .text()
                        .trim();
                    }

                    if (!description) {
                      description = `${title} position at ${company} in ${jobLocation}. Apply on Monster for full details.`;
                    }

                    // Enhanced salary extraction
                    let salary = $job
                      .find(
                        ".salary, .job-salary, .pay, [data-testid='job-salary'], [data-cy='salary'], [class*='salary']"
                      )
                      .first()
                      .text()
                      .trim();

                    // Try alternative salary patterns
                    if (!salary) {
                      const salaryText = $job.text();
                      const salaryMatch = salaryText.match(
                        /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:hour|year|month))?/i
                      );
                      if (salaryMatch) {
                        salary = salaryMatch[0];
                      }
                    }

                    // Enhanced date extraction
                    const dateElement = $job
                      .find(
                        "time, .date, .posted, [data-testid='job-date'], [data-cy='postedDate'], [class*='date']"
                      )
                      .first();
                    let postedDate = new Date();
                    if (dateElement.length) {
                      const datetime = dateElement.attr("datetime") || dateElement.text();
                      postedDate = this.parseMonsterDate(datetime) || new Date();
                    } else {
                      // Try finding date in text content
                      const dateText = $job.text();
                      const dateMatch = dateText.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
                      if (dateMatch) {
                        postedDate = this.parseMonsterDate(dateMatch[0]) || new Date();
                      }
                    }

                    const jobCreateData: any = {
                      title: this.cleanText(title),
                      company: this.cleanText(company),
                      location: this.cleanText(jobLocation),
                      description: this.cleanText(description),
                      url: jobUrl,
                      postedDate: postedDate,
                    };

                    if (salary) {
                      jobCreateData.salary = this.cleanText(salary);
                    }

                    const jobData = this.createJob(jobCreateData);

                    // Enhanced Monster skill extraction
                    const monsterSkills = this.extractMonsterSkills(title, description, term);
                    jobData.skills = [...new Set([...jobData.skills, ...monsterSkills])];

                    jobs.push(jobData);
                    console.log(
                      `   ✅ Extracted: "${title}" at ${company} | ${jobLocation} | ${
                        salary || "No salary"
                      }`
                    );
                  } catch (error) {
                    console.error("Error processing Monster job:", error);
                  }
                });

                break; // Found jobs with this selector
              }
            }

            if (!foundJobs) {
              console.log(`   ❌ No jobs found with any selector for: ${term} in ${loc}`);
              console.log(`   📄 Page content preview: ${html.substring(0, 200)}...`);
            }

            searchCount++;

            // Enhanced delay between searches for browser mode
            const extraDelay = Math.random() * 3000 + 2000; // 2-5 seconds extra
            await this.sleep(this.delay + extraDelay);
          } catch (error) {
            console.error(`❌ Error searching Monster for ${term} in ${loc}:`, error);
          }
        }

        if (searchCount >= maxSearches) break;
      }

      console.log(
        `🎉 Monster scraping completed. Found ${jobs.length} jobs from ${searchCount} searches.`
      );

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: jobs.length > 0,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("❌ Monster scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseMonsterDate(dateStr: string): Date | null {
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

    if (lowerDate.includes("month")) {
      const months = parseInt(lowerDate.match(/(\d+)/)?.[1] || "1");
      return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    }

    // Try parsing ISO date
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  private extractMonsterSkills(title: string, description: string, searchTerm: string): string[] {
    const skills: string[] = [];
    const text = `${title} ${description} ${searchTerm}`.toLowerCase();

    // Monster-specific skill patterns
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
      { regex: /scala/g, skill: "Scala" },
      { regex: /rust/g, skill: "Rust" },

      // Frontend Technologies
      { regex: /react(?:\.?js)?/g, skill: "React" },
      { regex: /vue(?:\.?js)?/g, skill: "Vue.js" },
      { regex: /angular/g, skill: "Angular" },
      { regex: /html5?/g, skill: "HTML" },
      { regex: /css3?/g, skill: "CSS" },
      { regex: /sass|scss/g, skill: "Sass" },
      { regex: /bootstrap/g, skill: "Bootstrap" },
      { regex: /tailwind/g, skill: "Tailwind CSS" },
      { regex: /material.?ui/g, skill: "Material-UI" },

      // Backend Technologies
      { regex: /node(?:\.?js)?/g, skill: "Node.js" },
      { regex: /express(?:\.?js)?/g, skill: "Express" },
      { regex: /django/g, skill: "Django" },
      { regex: /flask/g, skill: "Flask" },
      { regex: /laravel/g, skill: "Laravel" },
      { regex: /spring/g, skill: "Spring" },
      { regex: /\.net/g, skill: ".NET" },
      { regex: /asp\.net/g, skill: "ASP.NET" },
      { regex: /ruby on rails/g, skill: "Ruby on Rails" },

      // Databases
      { regex: /postgresql|postgres/g, skill: "PostgreSQL" },
      { regex: /mysql/g, skill: "MySQL" },
      { regex: /mongodb|mongo/g, skill: "MongoDB" },
      { regex: /redis/g, skill: "Redis" },
      { regex: /elasticsearch/g, skill: "Elasticsearch" },
      { regex: /sqlite/g, skill: "SQLite" },
      { regex: /oracle/g, skill: "Oracle" },
      { regex: /sql server/g, skill: "SQL Server" },
      { regex: /dynamodb/g, skill: "DynamoDB" },
      { regex: /cassandra/g, skill: "Cassandra" },

      // Cloud & DevOps
      { regex: /aws|amazon web services/g, skill: "AWS" },
      { regex: /azure/g, skill: "Azure" },
      { regex: /gcp|google cloud/g, skill: "Google Cloud" },
      { regex: /firebase/g, skill: "Firebase" },
      { regex: /docker/g, skill: "Docker" },
      { regex: /kubernetes|k8s/g, skill: "Kubernetes" },
      { regex: /jenkins/g, skill: "Jenkins" },
      { regex: /gitlab/g, skill: "GitLab" },
      { regex: /github/g, skill: "GitHub" },
      { regex: /terraform/g, skill: "Terraform" },
      { regex: /ansible/g, skill: "Ansible" },
      { regex: /heroku/g, skill: "Heroku" },

      // Other Important Skills
      { regex: /git(?!\w)/g, skill: "Git" },
      { regex: /linux/g, skill: "Linux" },
      { regex: /agile/g, skill: "Agile" },
      { regex: /scrum/g, skill: "Scrum" },
      { regex: /rest api|restful/g, skill: "REST API" },
      { regex: /graphql/g, skill: "GraphQL" },
      { regex: /microservices/g, skill: "Microservices" },
      { regex: /machine learning|ml/g, skill: "Machine Learning" },
      { regex: /artificial intelligence|ai/g, skill: "AI" },
      { regex: /data science/g, skill: "Data Science" },
      { regex: /big data/g, skill: "Big Data" },
      { regex: /blockchain/g, skill: "Blockchain" },
    ];

    skillPatterns.forEach(({ regex, skill }) => {
      if (regex.test(text)) {
        skills.push(skill);
      }
    });

    return skills;
  }
}
