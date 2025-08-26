import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";

export class IndeedScraper extends BaseScraper {
  protected sourceName = "Indeed";
  protected baseUrl = "https://www.indeed.com";
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
      const domain = "indeed.com";

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

      console.log(`🌐 Fetching Indeed with browser: ${url.substring(0, 100)}...`);

      // Use the enhanced browser-based fetching
      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      // Cache successful response
      this.antiDetection.setCachedResponse(url, html);

      console.log(`✅ Successfully fetched Indeed page with browser`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to fetch Indeed page:`, error);

      // Try fallback method if browser fails
      if (error instanceof Error && error.message.includes("browser")) {
        console.log(`🔄 Trying fallback fetch method for Indeed...`);
        return await this.fallbackFetch(url);
      }

      this.antiDetection.updateSession("indeed.com", [], true);
      throw error;
    }
  }

  // Fallback method using regular fetch with enhanced headers
  private async fallbackFetch(url: string): Promise<string> {
    const domain = "indeed.com";

    try {
      // Smart delay based on activity
      const smartDelay = this.antiDetection.getSmartDelay(domain);
      console.log(`⏱️  Fallback delay: ${smartDelay}ms for Indeed`);
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
          console.log("⚠️  Indeed rate limited us in fallback, marking session as blocked");
          this.antiDetection.updateSession(domain, [], true);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`✅ Fallback fetch successful for Indeed`);
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
            console.log(`🎯 Searching Indeed for: "${term}" in "${loc}"`);

            // Indeed job search URL with additional parameters
            const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(
              term
            )}&l=${encodeURIComponent(loc)}&fromage=7&sort=date&radius=25`;

            const html = await this.fetchPage(searchUrl);
            const $ = cheerio.load(html);

            // Enhanced Indeed job card selectors (updated for current site)
            const jobSelectors = [
              "[data-jk]", // Primary job card identifier
              ".jobsearch-SerpJobCard",
              ".job_seen_beacon",
              ".slider_container .slider_item",
              ".result",
              ".jobCard",
              "a[data-jk]", // Direct job links
              "[data-testid='job-title']", // New testid selector
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
                      .find('h2 a, .jobTitle a, .job-title a, [data-testid="jobTitle"] a')
                      .first();

                    // Try alternative selectors if not found
                    if ($titleLink.length === 0) {
                      $titleLink = $job
                        .find('a[data-jk], a[href*="viewjob"], a[href*="/job/"]')
                        .first();
                    }

                    let title = $titleLink.text().trim();
                    let jobUrl = $titleLink.attr("href");

                    // Alternative title extraction methods
                    if (!title) {
                      title = $job
                        .find("h2, .jobTitle, .job-title, .title, span[title]")
                        .first()
                        .text()
                        .trim();
                      // Try getting from title attribute
                      if (!title) {
                        title = $job.find("[title]").first().attr("title") || "";
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
                          jobUrl = `https://www.indeed.com${jobUrl}`;
                        } else if (jobUrl.includes("jk=")) {
                          // Extract job key from URL
                          const jkMatch = jobUrl.match(/jk=([^&]+)/);
                          if (jkMatch) {
                            jobUrl = `https://www.indeed.com/viewjob?jk=${jkMatch[1]}`;
                          }
                        } else {
                          jobUrl = `https://www.indeed.com/viewjob?jk=${jobUrl}`;
                        }
                      }
                    } else {
                      // Try to extract job key from data attributes
                      const jobKey =
                        $job.attr("data-jk") || $job.find("[data-jk]").first().attr("data-jk");
                      if (jobKey) {
                        jobUrl = `https://www.indeed.com/viewjob?jk=${jobKey}`;
                      } else {
                        jobUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`;
                      }
                    }

                    // Enhanced company extraction
                    let company = $job
                      .find(
                        ".company, .companyName, .jobCard_companyName, [data-testid='company-name'], span[data-testid='company-name']"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!company) {
                      company = $job
                        .find(".employer, .employerName, [class*='company'], [class*='employer']")
                        .first()
                        .text()
                        .trim();
                    }

                    // Try alternative company extraction
                    if (!company) {
                      company = $job
                        .find("a[href*='company'], span[title*='company' i]")
                        .first()
                        .text()
                        .trim();
                    }

                    if (!company) company = "Indeed Company";

                    // Enhanced location extraction
                    let jobLocation = $job
                      .find(
                        ".location, .companyLocation, .jobCard_location, [data-testid='job-location'], [class*='location']"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!jobLocation) {
                      jobLocation = $job
                        .find("[class*='location'], span[title*='location' i]")
                        .first()
                        .text()
                        .trim();
                    }

                    if (!jobLocation) jobLocation = loc;

                    // Enhanced description extraction
                    let description = $job
                      .find(
                        ".summary, .job-snippet, .jobDescription, [data-testid='jobDescription'], .jobCard_jobDescription"
                      )
                      .first()
                      .text()
                      .trim();

                    if (!description) {
                      // Try getting from closest elements
                      description = $job
                        .find("div:contains('$'), div:contains('year'), div:contains('experience')")
                        .first()
                        .text()
                        .trim();
                    }

                    if (!description) {
                      description = `${title} position at ${company} in ${jobLocation}. Apply on Indeed for full details.`;
                    }

                    // Enhanced salary extraction
                    let salary = $job
                      .find(
                        ".salary, .salary-snippet, .jobCard_salary, [data-testid='jobSalary'], [class*='salary']"
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
                      .find("time, .date, .jobCard_date, [data-testid='jobDate'], [class*='date']")
                      .first();
                    let postedDate = new Date();
                    if (dateElement.length) {
                      const datetime = dateElement.attr("datetime") || dateElement.text();
                      postedDate = this.parseIndeedDate(datetime) || new Date();
                    } else {
                      // Try finding date in text content
                      const dateText = $job.text();
                      const dateMatch = dateText.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
                      if (dateMatch) {
                        postedDate = this.parseIndeedDate(dateMatch[0]) || new Date();
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

                    // Enhanced Indeed skill extraction
                    const indeedSkills = this.extractIndeedSkills(title, description, term);
                    jobData.skills = [...new Set([...jobData.skills, ...indeedSkills])];

                    jobs.push(jobData);
                    console.log(
                      `   ✅ Extracted: "${title}" at ${company} | ${jobLocation} | ${
                        salary || "No salary"
                      }`
                    );
                  } catch (error) {
                    console.error("Error processing Indeed job:", error);
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
            console.error(`❌ Error searching Indeed for ${term} in ${loc}:`, error);
          }
        }

        if (searchCount >= maxSearches) break;
      }

      console.log(
        `🎉 Indeed scraping completed. Found ${jobs.length} jobs from ${searchCount} searches.`
      );

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: jobs.length > 0,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("❌ Indeed scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private parseIndeedDate(dateStr: string): Date | null {
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

  private extractIndeedSkills(title: string, description: string, searchTerm: string): string[] {
    const skills: string[] = [];
    const text = `${title} ${description} ${searchTerm}`.toLowerCase();

    // Indeed-specific skill patterns
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
