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

  public async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    try {
      let totalFound = 0;

      const searchTerms = ["software developer", "frontend developer", "backend developer", "full stack developer", "javascript developer", "react developer", "python developer", "node.js developer"];
      const locations = ["Remote", "United States", "United Kingdom", "Canada", "Germany", "Australia", "Netherlands", "France"];

      const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
      const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
      const locationsToUse = shuffledLocations.slice(0, 8);
      const termsToUse = shuffledTerms.slice(0, 5);

      console.log(`🌍 Indeed global coverage: ${locationsToUse.join(", ")}`);
      console.log(`🔍 Indeed search terms: ${termsToUse.join(", ")}`);

      let searchCount = 0;
      const maxSearches = 15;

      for (const term of termsToUse) {
        for (const loc of locationsToUse.slice(0, 3)) {
          if (searchCount >= maxSearches) break;

          try {
            console.log(`🎯 Searching Indeed for: "${term}" in "${loc}"`);
            const searchUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(term)}&l=${encodeURIComponent(loc)}&fromage=7&sort=date&radius=25`;
            const html = await this.fetchPage(searchUrl);
            const $ = cheerio.load(html);

            const jobSelectors = ["[data-jk]", ".jobsearch-SerpJobCard", ".job_seen_beacon", ".slider_container .slider_item", ".result", ".jobCard", "a[data-jk]", "[data-testid='job-title']"];

            let foundJobs = false;
            for (const selector of jobSelectors) {
              const jobElements = $(selector);
              console.log(
                `   🔍 Trying selector "${selector}": found ${jobElements.length} elements`
              );
              if (jobElements.length > 0) {
                foundJobs = true;
                const promises = jobElements.map(async (index, element) => {
                  if (index >= 12) return;
                  try {
                    const $job = $(element);
                    let $titleLink = $job.find('h2 a, .jobTitle a, .job-title a, [data-testid="jobTitle"] a').first();
                    if ($titleLink.length === 0) {
                      $titleLink = $job.find('a[data-jk], a[href*="viewjob"], a[href*="/job/"]').first();
                    }
                    let title = $titleLink.text().trim();
                    let jobUrl = $titleLink.attr("href");
                    if (!title) {
                      title = $job.find("h2, .jobTitle, .job-title, .title, span[title]").first().text().trim();
                      if (!title) {
                        title = $job.find("[title]").first().attr("title") || "";
                      }
                    }
                    if (!title || title.length < 5) {
                      console.log(`   ⚠️  Skipping job with invalid title: "${title}"`);
                      return;
                    }

                    if (jobUrl) {
                      if (!jobUrl.startsWith("http")) {
                        jobUrl = jobUrl.startsWith("/") ? `https://www.indeed.com${jobUrl}` : `https://www.indeed.com/viewjob?jk=${jobUrl.match(/jk=([^&]+)/)?.[1] || jobUrl}`;
                      }
                    } else {
                      const jobKey = $job.attr("data-jk") || $job.find("[data-jk]").first().attr("data-jk");
                      jobUrl = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`;
                    }

                    let company = $job.find(".company, .companyName, .jobCard_companyName, [data-testid='company-name'], span[data-testid='company-name']").first().text().trim();
                    if (!company) {
                      company = $job.find(".employer, .employerName, [class*='company'], [class*='employer']").first().text().trim();
                    }
                    if (!company) company = "Indeed Company";

                    let jobLocation = $job.find(".location, .companyLocation, .jobCard_location, [data-testid='job-location'], [class*='location']").first().text().trim();
                    if (!jobLocation) jobLocation = loc;

                    let description = $job.find(".summary, .job-snippet, .jobDescription, [data-testid='jobDescription'], .jobCard_jobDescription").first().text().trim();
                    if (!description) description = `${title} position at ${company} in ${jobLocation}. Apply on Indeed for full details.`;

                    let salary = $job.find(".salary, .salary-snippet, .jobCard_salary, [data-testid='jobSalary'], [class*='salary']").first().text().trim();
                    if (!salary) {
                      const salaryMatch = $job.text().match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:hour|year|month))?/i);
                      if (salaryMatch) salary = salaryMatch[0];
                    }

                    const dateElement = $job.find("time, .date, .jobCard_date, [data-testid='jobDate'], [class*='date']").first();
                    let postedDate = new Date();
                    if (dateElement.length) {
                      postedDate = this.parseIndeedDate(dateElement.attr("datetime") || dateElement.text()) || new Date();
                    }
                    else {
                      const dateText = $job.text();
                      const dateMatch = dateText.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
                      if (dateMatch) postedDate = this.parseIndeedDate(dateMatch[0]) || new Date();
                    }

                    const jobCreateData: any = { title: this.cleanText(title), company: this.cleanText(company), location: this.cleanText(jobLocation), description: this.cleanText(description), url: jobUrl, postedDate };
                    if (salary) jobCreateData.salary = this.cleanText(salary);
                    const jobData = this.createJob(jobCreateData);
                    const indeedSkills = this.extractIndeedSkills(title, description, term);
                    jobData.skills = [...new Set([...jobData.skills, ...indeedSkills])];

                    await onJobScraped(jobData);
                    totalFound++;
                    console.log(`   ✅ Extracted: "${title}" at ${company}`);
                  } catch (error) {
                    console.error("Error processing Indeed job:", error);
                  }
                }).get();
                await Promise.all(promises);
                break;
              }
            }

            if (!foundJobs) {
              console.log(
                `   🔍 No jobs found with standard selectors, trying comprehensive extraction...`
              );
              const comprehensiveJobs = this.extractJobsComprehensively($, html, term, loc);
              for (const job of comprehensiveJobs) {
                await onJobScraped(job);
                totalFound++;
              }
              if (comprehensiveJobs.length > 0) {
                foundJobs = true;
                console.log(
                  `   ✅ Found ${comprehensiveJobs.length} jobs using comprehensive extraction`
                );
              } else {
                console.log(`   ❌ No jobs found with any method for: ${term} in ${loc}`);
                console.log(`   📄 Page content preview: ${html.substring(0, 200)}...`);

                // Debug: Look for job-related text in the HTML
                const jobKeywords = ["jobs", "position", "hiring", "employment", "career"];
                const foundKeywords = jobKeywords.filter((keyword) =>
                  html.toLowerCase().includes(keyword)
                );
                if (foundKeywords.length > 0) {
                  console.log(`   🔍 Found job-related keywords: ${foundKeywords.join(", ")}`);
                }
              }
            }

            searchCount++;
            await this.sleep(this.delay + Math.random() * 3000 + 2000);
          } catch (error) {
            console.error(`❌ Error searching Indeed for ${term} in ${loc}:`, error);
          }
        }
        if (searchCount >= maxSearches) break;
      }

      console.log(`🎉 Indeed scraping completed. Found and processed ${totalFound} jobs.`);

      return {
        jobs: [],
        source: this.sourceName,
        success: totalFound > 0,
        totalFound,
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

  // Comprehensive job extraction method for when standard selectors fail
  private extractJobsComprehensively(
    $: cheerio.CheerioAPI,
    html: string,
    searchTerm: string,
    location: string
  ): any[] {
    const jobs: any[] = [];

    try {
      // Strategy 1: Look for any elements with job-related data attributes
      console.log(`   🔍 Looking for job-related data attributes...`);
      const jobDataElements = $(
        '[data-job], [data-jobkey], [data-id], [data-testid], [id*="job"], [class*="job"]'
      );

      jobDataElements.each((index, element) => {
        if (index >= 10) return false;

        const $element = $(element);
        const text = $element.text().trim();

        // Look for title-like patterns in the text
        const titleMatch = text.match(/^([^-•\n]{10,100})\s*[-•]/);
        if (titleMatch) {
          const title = titleMatch[1].trim();

          // Extract additional info from the element
          let company = "Indeed Company";
          let jobLocation = location;

          // Try to find company in nearby elements
          const companyElement = $element
            .find("span, div")
            .filter((i, el) => {
              const elText = $(el).text().toLowerCase();
              return (
                !elText.includes("ago") &&
                !elText.includes("day") &&
                !elText.includes("hour") &&
                elText.length > 3 &&
                elText.length < 50
              );
            })
            .first();

          if (companyElement.length) {
            company = this.cleanText(companyElement.text());
          }

          const jobData = this.createJob({
            title: this.cleanText(title),
            company: company,
            location: jobLocation,
            description: `${title} position at ${company} in ${jobLocation}. Apply on Indeed for full details.`,
            url: `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`,
            postedDate: new Date(),
          });

          // Add skills
          const indeedSkills = this.extractIndeedSkills(title, title, searchTerm);
          jobData.skills = [...new Set([...jobData.skills, ...indeedSkills])];

          jobs.push(jobData);
          console.log(`   ✅ Comprehensive extraction: "${title}" at ${company}`);
        }
      });

      // Strategy 2: Look for structured data in script tags
      if (jobs.length === 0) {
        console.log(`   🔍 Looking for structured data in scripts...`);
        $('script[type="application/ld+json"]').each((index, script) => {
          try {
            const jsonData = JSON.parse($(script).html() || "{}");

            if (
              jsonData["@type"] === "JobPosting" ||
              (Array.isArray(jsonData) && jsonData.some((item) => item["@type"] === "JobPosting"))
            ) {
              const jobPostings = Array.isArray(jsonData)
                ? jsonData.filter((item) => item["@type"] === "JobPosting")
                : [jsonData];

              jobPostings.forEach((job, idx) => {
                if (idx >= 5) return;

                const jobData = this.createJob({
                  title: this.cleanText(job.title || "Job Position"),
                  company: this.cleanText(job.hiringOrganization?.name || "Indeed Company"),
                  location: this.cleanText(job.jobLocation?.address?.addressLocality || location),
                  description: this.cleanText(
                    job.description ||
                      `Job position at ${job.hiringOrganization?.name || "company"}.`
                  ),
                  url:
                    job.url ||
                    `https://www.indeed.com/jobs?q=${encodeURIComponent(job.title || searchTerm)}`,
                  postedDate: job.datePosted ? new Date(job.datePosted) : new Date(),
                });

                if (job.baseSalary) {
                  jobData.salary = this.cleanText(
                    `${job.baseSalary.value} ${job.baseSalary.currency || "USD"}`
                  );
                }

                // Add skills
                const indeedSkills = this.extractIndeedSkills(
                  job.title || "",
                  job.description || "",
                  searchTerm
                );
                jobData.skills = [...new Set([...jobData.skills, ...indeedSkills])];

                jobs.push(jobData);
                console.log(
                  `   ✅ Structured data extraction: "${job.title}" at ${job.hiringOrganization?.name}`
                );
              });
            }
          } catch (error) {
            // Ignore JSON parsing errors
          }
        });
      }

      // Strategy 3: Text pattern matching as last resort
      if (jobs.length === 0) {
        console.log(`   🔍 Trying text pattern matching...`);
        const jobPatterns = [
          /([A-Z][a-zA-Z\s]{10,80}(?:Developer|Engineer|Manager|Analyst|Specialist|Coordinator))/g,
          /([A-Z][a-zA-Z\s]{5,60}(?:at|@)\s+[A-Z][a-zA-Z\s]{3,40})/g,
        ];

        jobPatterns.forEach((pattern, patternIdx) => {
          if (jobs.length >= 5) return;

          const matches = html.match(pattern);
          if (matches) {
            matches.slice(0, 3).forEach((match, idx) => {
              const title = match.includes(" at ")
                ? match.split(" at ")[0].trim()
                : match.includes(" @ ")
                ? match.split(" @ ")[0].trim()
                : match.trim();
              const company = match.includes(" at ")
                ? match.split(" at ")[1]?.trim() || "Indeed Company"
                : match.includes(" @ ")
                ? match.split(" @ ")[1]?.trim() || "Indeed Company"
                : "Indeed Company";

              if (title.length > 10 && title.length < 100) {
                const jobData = this.createJob({
                  title: this.cleanText(title),
                  company: this.cleanText(company),
                  location: location,
                  description: `${title} position. Apply on Indeed for full details.`,
                  url: `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`,
                  postedDate: new Date(),
                });

                // Add skills
                const indeedSkills = this.extractIndeedSkills(title, title, searchTerm);
                jobData.skills = [...new Set([...jobData.skills, ...indeedSkills])];

                jobs.push(jobData);
                console.log(`   ✅ Pattern matching: "${title}" at ${company}`);
              }
            });
          }
        });
      }
    } catch (error) {
      console.error(`   ❌ Error in comprehensive extraction:`, error);
    }

    return jobs;
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
