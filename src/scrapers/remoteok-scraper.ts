import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class RemoteOkScraper extends BaseScraper {
  protected sourceName = "RemoteOK";
  protected baseUrl = "https://remoteok.io";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // RemoteOK has a simple API-like endpoint
      const url = "https://remoteok.io/remote-jobs.json";

      const response = await this.fetchPage(url);
      const jobsData = JSON.parse(response);

      // Skip the first item (it's metadata)
      const actualJobs = jobsData.slice(1);

      for (const jobData of actualJobs.slice(0, 50)) {
        // Limit to 50 jobs
        try {
          if (!jobData.position || !jobData.company) continue;

          const jobCreateData: any = {
            title: jobData.position,
            company: jobData.company,
            location: jobData.location || "Remote",
            description: jobData.description || "",
            url: `https://remoteok.io/remote-jobs/${jobData.id}`,
            postedDate: jobData.date ? new Date(jobData.date * 1000) : new Date(),
          };
          
          if (jobData.salary_min && jobData.salary_max) {
            jobCreateData.salary = `$${jobData.salary_min} - $${jobData.salary_max}`;
          }
          
          const job = this.createJob(jobCreateData);

          // Add specific remote job skills
          const remoteSkills = this.extractRemoteSkills(jobData);
          job.skills = [...new Set([...job.skills, ...remoteSkills])];

          jobs.push(job);
        } catch (error) {
          console.error("Error processing RemoteOK job:", error);
        }
      }

      return {
        jobs,
        source: this.sourceName,
        success: true,
        totalFound: jobs.length,
      };
    } catch (error) {
      console.error("RemoteOK scraper error:", error);
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }

  private extractRemoteSkills(jobData: any): string[] {
    const skills: string[] = [];

    // Extract from tags
    if (jobData.tags && Array.isArray(jobData.tags)) {
      jobData.tags.forEach((tag: string) => {
        const skill = this.normalizeSkill(tag);
        if (skill) skills.push(skill);
      });
    }

    // Extract from position title and description
    const text = `${jobData.position} ${jobData.description}`.toLowerCase();

    // Common remote job technologies
    const remoteSkills = [
      "React",
      "Vue.js",
      "Angular",
      "JavaScript",
      "TypeScript",
      "Node.js",
      "Python",
      "Django",
      "Flask",
      "Ruby",
      "Rails",
      "PHP",
      "Laravel",
      "Java",
      "Spring",
      "C#",
      ".NET",
      "Go",
      "Rust",
      "Kubernetes",
      "Docker",
      "AWS",
      "GCP",
      "Azure",
      "MongoDB",
      "PostgreSQL",
      "MySQL",
      "Redis",
    ];

    remoteSkills.forEach((skill) => {
      if (text.includes(skill.toLowerCase())) {
        skills.push(skill);
      }
    });

    return skills;
  }

  private normalizeSkill(tag: string): string | null {
    const skillMap: { [key: string]: string } = {
      js: "JavaScript",
      ts: "TypeScript",
      py: "Python",
      rb: "Ruby",
      php: "PHP",
      java: "Java",
      golang: "Go",
      react: "React",
      vue: "Vue.js",
      angular: "Angular",
      node: "Node.js",
      django: "Django",
      rails: "Ruby on Rails",
      laravel: "Laravel",
      aws: "AWS",
      gcp: "Google Cloud",
      azure: "Azure",
      k8s: "Kubernetes",
      docker: "Docker",
    };

    const normalizedTag = tag.toLowerCase().trim();
    return skillMap[normalizedTag] || (tag.length > 2 ? tag : null);
  }
}
