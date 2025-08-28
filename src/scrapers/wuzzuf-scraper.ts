import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class WuzzufScraper extends BaseScraper {
  protected sourceName = "Wuzzuf";
  protected baseUrl = "https://wuzzuf.net";

  public async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    try {
      let totalFound = 0;
      console.log("🔍 Starting Wuzzuf job scraping (Egypt-focused)...");

      const searches = [
        "software-developer-jobs-in-egypt",
        "frontend-developer-jobs-in-egypt",
        "backend-developer-jobs-in-egypt",
        "full-stack-developer-jobs-in-egypt",
        "javascript-developer-jobs-in-egypt",
        "python-developer-jobs-in-egypt",
        "react-developer-jobs-in-egypt",
        "mobile-developer-jobs-in-egypt",
        "devops-engineer-jobs-in-egypt",
        "software-engineer-jobs-in-egypt",
      ];

      const shuffledSearches = [...searches].sort(() => Math.random() - 0.5);
      const searchesToUse = shuffledSearches.slice(0, 7);

      console.log(
        `🔍 Wuzzuf searches: ${searchesToUse
          .map((s) => s.replace("-jobs-in-egypt", ""))
          .join(", ")}`
      );

      for (const search of searchesToUse) {
        try {
          const searchTerm = search.replace("-jobs-in-egypt", "").replace(/-/g, " ");
          console.log(`🎯 Searching Wuzzuf for: "${searchTerm}" in Egypt`);

          const url = `https://wuzzuf.net/search/jobs/?q=${search
            .replace("-jobs-in-egypt", "")
            .replace(/-/g, "%20")}&a=hpb`;
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);

          const jobElements = $('div[data-search-result="true"], .css-1gatmva, .css-pkv5jc');
          const promises = jobElements.map(async (index, element) => {
            if (index >= 20) return;

            try {
              const $job = $(element);
              const $titleLink = $job.find('h2 a, .css-m604qf a, a[data-cy="job-title"]').first();
              const title = $titleLink.text().trim();
              const jobUrl = $titleLink.attr("href");

              if (!title || !jobUrl) return;

              const company = $job.find('a[data-cy="job-company-name"], .css-d7j1kk a, .css-17s97q8').first().text().trim() || "Wuzzuf Company";
              const location = $job.find('span[class*="location"], .css-5wys0k, .css-1ve4b75').first().text().trim() || "Egypt";
              const description = $job.find(".css-y4udm8, .job-requirements").text().trim() || `${title} position at ${company}. Located in ${location}.`;
              const dateText = $job.find(".css-4c4ojb, .css-1lh32fc").text().trim();
              const postedDate = this.parseWuzzufDate(dateText);

              const jobCreateData: any = {
                title: this.cleanText(title),
                company: this.cleanText(company),
                location: this.cleanText(location),
                description: this.cleanText(description),
                url: jobUrl.startsWith("http") ? jobUrl : `https://wuzzuf.net${jobUrl}`,
                postedDate: postedDate,
              };

              const salaryText = $job.find(".css-4xky9y, .salary").text().trim();
              if (salaryText && salaryText.match(/\d+/)) {
                jobCreateData.salary = this.cleanText(salaryText);
              }

              const jobData = this.createJob(jobCreateData);
              const extractedSkills = this.extractWuzzufSkills(title, description, searchTerm);
              jobData.skills = [...new Set([...jobData.skills, ...extractedSkills])];

              await onJobScraped(jobData);
              totalFound++;
              console.log(`   ✅ Extracted: "${title}" at ${company}`);
            } catch (error) {
              console.error("Error processing Wuzzuf job:", error);
            }
          }).get();

          await Promise.all(promises);
          await this.sleep(2000 + Math.random() * 1000);
        } catch (error) {
          console.error(`❌ Error scraping Wuzzuf search ${search}:`, error);
        }
      }

      console.log(`🎉 Wuzzuf scraping completed. Found and processed ${totalFound} jobs.`);

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

  private parseWuzzufDate(dateText: string): Date {
    const now = new Date();

    if (!dateText) return now;

    const lowerDate = dateText.toLowerCase();

    if (lowerDate.includes("today") || lowerDate.includes("اليوم")) {
      return now;
    }

    if (lowerDate.includes("yesterday") || lowerDate.includes("أمس")) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return yesterday;
    }

    // Parse "X days ago" or "منذ X أيام"
    const daysMatch = lowerDate.match(/(\d+)\s*(day|أيام|يوم)/);
    if (daysMatch) {
      const daysAgo = parseInt(daysMatch[1]);
      const date = new Date(now);
      date.setDate(now.getDate() - daysAgo);
      return date;
    }

    // Parse "X weeks ago" or "منذ X أسابيع"
    const weeksMatch = lowerDate.match(/(\d+)\s*(week|أسبوع|أسابيع)/);
    if (weeksMatch) {
      const weeksAgo = parseInt(weeksMatch[1]);
      const date = new Date(now);
      date.setDate(now.getDate() - weeksAgo * 7);
      return date;
    }

    return now;
  }

  private extractWuzzufSkills(title: string, description: string, searchTerm: string): string[] {
    const skills: string[] = [];
    const text = `${title} ${description} ${searchTerm}`.toLowerCase();

    // Enhanced skills for Middle East market
    const skillMap = [
      // Frontend
      { patterns: ["react", "reactjs"], skill: "React" },
      { patterns: ["vue", "vue.js", "vuejs"], skill: "Vue.js" },
      { patterns: ["angular"], skill: "Angular" },
      { patterns: ["javascript", "js"], skill: "JavaScript" },
      { patterns: ["typescript"], skill: "TypeScript" },
      { patterns: ["html"], skill: "HTML" },
      { patterns: ["css"], skill: "CSS" },
      { patterns: ["bootstrap"], skill: "Bootstrap" },

      // Backend
      { patterns: ["node", "nodejs", "node.js"], skill: "Node.js" },
      { patterns: ["python"], skill: "Python" },
      { patterns: ["django"], skill: "Django" },
      { patterns: ["flask"], skill: "Flask" },
      { patterns: ["php"], skill: "PHP" },
      { patterns: ["laravel"], skill: "Laravel" },
      { patterns: ["java"], skill: "Java" },
      { patterns: ["spring"], skill: "Spring" },
      { patterns: ["c#", "csharp"], skill: "C#" },
      { patterns: [".net", "dotnet"], skill: ".NET" },
      { patterns: ["asp.net"], skill: "ASP.NET" },

      // Mobile
      { patterns: ["android"], skill: "Android" },
      { patterns: ["ios"], skill: "iOS" },
      { patterns: ["flutter"], skill: "Flutter" },
      { patterns: ["react native"], skill: "React Native" },
      { patterns: ["xamarin"], skill: "Xamarin" },

      // Databases
      { patterns: ["mysql"], skill: "MySQL" },
      { patterns: ["postgresql", "postgres"], skill: "PostgreSQL" },
      { patterns: ["mongodb"], skill: "MongoDB" },
      { patterns: ["sql server"], skill: "SQL Server" },
      { patterns: ["oracle"], skill: "Oracle" },

      // Cloud & DevOps
      { patterns: ["aws"], skill: "AWS" },
      { patterns: ["azure"], skill: "Azure" },
      { patterns: ["docker"], skill: "Docker" },
      { patterns: ["kubernetes"], skill: "Kubernetes" },

      // Other
      { patterns: ["git"], skill: "Git" },
      { patterns: ["agile"], skill: "Agile" },
      { patterns: ["scrum"], skill: "Scrum" },
      { patterns: ["rest api", "restful"], skill: "REST API" },
      { patterns: ["graphql"], skill: "GraphQL" },
    ];

    skillMap.forEach(({ patterns, skill }) => {
      if (patterns.some((pattern) => text.includes(pattern))) {
        skills.push(skill);
      }
    });

    return skills;
  }
}
