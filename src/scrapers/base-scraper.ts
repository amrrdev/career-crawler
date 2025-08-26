import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { Job, ScrapingResult } from "../types/job.types";
import { createHash } from "crypto";

export abstract class BaseScraper {
  protected userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  protected delay = 1000; // 1 second delay between requests

  protected abstract sourceName: string;
  protected abstract baseUrl: string;

  protected async fetchPage(url: string): Promise<string> {
    try {
      await this.sleep(this.delay);
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: 10000,
        validateStatus: (status) => status < 400,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected generateJobId(url: string, title: string): string {
    const hash = createHash("md5").update(`${url}-${title}`).digest("hex");
    return `${this.sourceName.toLowerCase().replace(/\s+/g, "_")}_${hash}`;
  }

  protected extractSkillsFromText(text: string): string[] {
    const commonSkills = [
      // Programming Languages
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "PHP",
      "Ruby",
      "Go",
      "Rust",
      "Swift",
      "Kotlin",
      "Scala",
      "R",
      "MATLAB",
      // Frameworks & Libraries
      "React",
      "Angular",
      "Vue.js",
      "Node.js",
      "Express",
      "Django",
      "Flask",
      "Spring",
      "Laravel",
      "Ruby on Rails",
      "ASP.NET",
      "jQuery",
      "Bootstrap",
      "Tailwind",
      "Material-UI",
      "Redux",
      "MobX",
      "RxJS",
      "Lodash",
      "Webpack",
      "Parcel",
      "Vite",
      // Databases
      "MySQL",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "Elasticsearch",
      "SQLite",
      "Oracle",
      "SQL Server",
      "DynamoDB",
      "Cassandra",
      // Cloud & DevOps
      "AWS",
      "Azure",
      "Google Cloud",
      "Docker",
      "Kubernetes",
      "Jenkins",
      "GitLab CI",
      "GitHub Actions",
      "Terraform",
      "Ansible",
      // Tools & Technologies
      "Git",
      "Linux",
      "Unix",
      "Windows",
      "Agile",
      "Scrum",
      "REST API",
      "GraphQL",
      "Microservices",
      "Machine Learning",
      "AI",
      "Data Science",
      "Big Data",
      "Blockchain",
      "DevOps",
      "CI/CD",
      "Testing",
      "Jest",
      "Cypress",
      "Selenium",
    ];

    const skills: Set<string> = new Set();
    const lowerText = text.toLowerCase();

    commonSkills.forEach((skill) => {
      const variations = [
        skill.toLowerCase(),
        skill.replace(/\./g, "").toLowerCase(),
        skill.replace(/\s+/g, "").toLowerCase(),
      ];

      variations.forEach((variation) => {
        if (lowerText.includes(variation)) {
          skills.add(skill);
        }
      });
    });

    return Array.from(skills);
  }

  protected determineJobType(
    text: string
  ): "full-time" | "part-time" | "contract" | "internship" | "remote" {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("intern") || lowerText.includes("internship")) {
      return "internship";
    }
    if (
      lowerText.includes("contract") ||
      lowerText.includes("freelance") ||
      lowerText.includes("consultant")
    ) {
      return "contract";
    }
    if (lowerText.includes("part-time") || lowerText.includes("part time")) {
      return "part-time";
    }
    if (lowerText.includes("remote") || lowerText.includes("work from home")) {
      return "remote";
    }

    return "full-time";
  }

  protected cleanText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  public abstract scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult>;

  protected createJob(data: {
    title: string;
    company: string;
    location: string;
    description: string;
    url: string;
    salary?: string;
    postedDate?: Date;
  }): Job {
    const skills = this.extractSkillsFromText(`${data.title} ${data.description}`);
    const jobType = this.determineJobType(`${data.title} ${data.description}`);

    const job: Job = {
      id: this.generateJobId(data.url, data.title),
      title: this.cleanText(data.title),
      company: this.cleanText(data.company),
      location: this.cleanText(data.location),
      description: this.cleanText(data.description),
      url: data.url,
      skills,
      jobType,
      source: this.sourceName,
      postedDate: data.postedDate || new Date(),
      extractedAt: new Date(),
    };

    if (data.salary) {
      job.salary = this.cleanText(data.salary);
    }

    return job;
  }
}
