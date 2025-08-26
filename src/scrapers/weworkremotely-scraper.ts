import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class WeWorkRemotelyScraper extends BaseScraper {
  protected sourceName = "WeWorkRemotely";
  protected baseUrl = "https://weworkremotely.com";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Categories to scrape - focusing on tech jobs
      const categories = [
        "remote-programming-jobs",
        "remote-dev-ops-sysadmin-jobs",
        "remote-design-jobs",
        "remote-front-end-programming-jobs",
        "remote-full-stack-programming-jobs",
      ];

      for (const category of categories) {
        try {
          const url = `https://weworkremotely.com/categories/${category}`;
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);

          $("li.feature").each((index, element) => {
            try {
              const $job = $(element);

              // Extract basic info
              const $link = $job.find("a").first();
              const href = $link.attr("href");

              if (!href) return;

              const $title = $job.find(".title");
              const $company = $job.find(".company");
              const $region = $job.find(".region");

              const title = $title.text().trim();
              const company = $company.text().trim();
              const region = $region.text().trim() || "Worldwide";

              if (!title || !company) return;

              // Get job details from the link text
              const jobText = $job.text();
              const description = this.extractDescription(jobText, title);

              const jobCreateData: any = {
                title: title,
                company: company,
                location: region,
                description: description,
                url: `https://weworkremotely.com${href}`,
                postedDate: new Date(), // WeWorkRemotely doesn't show posting dates on listings
              };

              const job = this.createJob(jobCreateData);

              // Enhanced skill extraction for remote jobs
              const extractedSkills = this.extractRemoteJobSkills(jobText);
              job.skills = [...new Set([...job.skills, ...extractedSkills])];

              jobs.push(job);
            } catch (error) {
              console.error("Error processing WeWorkRemotely job:", error);
            }
          });

          // Add delay between category requests
          await this.sleep(1000);
        } catch (error) {
          console.error(`Error scraping WeWorkRemotely category ${category}:`, error);
        }
      }

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: true,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("WeWorkRemotely scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private extractDescription(jobText: string, title: string): string {
    // Create a meaningful description from available text
    const lines = jobText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Remove duplicates and the title/company info
    const uniqueLines = [...new Set(lines)];
    const description = uniqueLines
      .filter((line) => line !== title && line.length > 10)
      .slice(0, 5) // Take first 5 meaningful lines
      .join(" ");

    return description || `${title} position available at this company.`;
  }

  private extractRemoteJobSkills(text: string): string[] {
    const skills: string[] = [];
    const lowerText = text.toLowerCase();

    // Comprehensive skill detection for remote jobs
    const skillPatterns = [
      // Frontend
      { pattern: /react(?:\.?js)?/gi, skill: "React" },
      { pattern: /vue(?:\.?js)?/gi, skill: "Vue.js" },
      { pattern: /angular/gi, skill: "Angular" },
      { pattern: /javascript|js\b/gi, skill: "JavaScript" },
      { pattern: /typescript|ts\b/gi, skill: "TypeScript" },
      { pattern: /html\b/gi, skill: "HTML" },
      { pattern: /css\b/gi, skill: "CSS" },
      { pattern: /sass|scss/gi, skill: "Sass" },

      // Backend
      { pattern: /node(?:\.?js)?/gi, skill: "Node.js" },
      { pattern: /python/gi, skill: "Python" },
      { pattern: /django/gi, skill: "Django" },
      { pattern: /flask/gi, skill: "Flask" },
      { pattern: /ruby/gi, skill: "Ruby" },
      { pattern: /rails/gi, skill: "Ruby on Rails" },
      { pattern: /php/gi, skill: "PHP" },
      { pattern: /laravel/gi, skill: "Laravel" },
      { pattern: /java\b/gi, skill: "Java" },
      { pattern: /spring/gi, skill: "Spring" },
      { pattern: /c#|csharp/gi, skill: "C#" },
      { pattern: /\.net/gi, skill: ".NET" },
      { pattern: /go\b|golang/gi, skill: "Go" },

      // Databases
      { pattern: /postgresql|postgres/gi, skill: "PostgreSQL" },
      { pattern: /mysql/gi, skill: "MySQL" },
      { pattern: /mongodb|mongo/gi, skill: "MongoDB" },
      { pattern: /redis/gi, skill: "Redis" },
      { pattern: /elasticsearch/gi, skill: "Elasticsearch" },

      // Cloud & DevOps
      { pattern: /aws|amazon web services/gi, skill: "AWS" },
      { pattern: /azure/gi, skill: "Azure" },
      { pattern: /gcp|google cloud/gi, skill: "Google Cloud" },
      { pattern: /docker/gi, skill: "Docker" },
      { pattern: /kubernetes|k8s/gi, skill: "Kubernetes" },
      { pattern: /terraform/gi, skill: "Terraform" },
      { pattern: /ansible/gi, skill: "Ansible" },

      // Tools & Methodologies
      { pattern: /git\b/gi, skill: "Git" },
      { pattern: /agile/gi, skill: "Agile" },
      { pattern: /scrum/gi, skill: "Scrum" },
      { pattern: /ci\/cd|continuous integration/gi, skill: "CI/CD" },
      { pattern: /api\b|rest|restful/gi, skill: "REST API" },
      { pattern: /graphql/gi, skill: "GraphQL" },
      { pattern: /microservices/gi, skill: "Microservices" },
    ];

    skillPatterns.forEach(({ pattern, skill }) => {
      if (pattern.test(text)) {
        skills.push(skill);
      }
    });

    return skills;
  }
}
