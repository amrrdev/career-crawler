import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import * as cheerio from "cheerio";

export class HackerNewsScraper extends BaseScraper {
  protected sourceName = "HackerNews";
  protected baseUrl = "https://hacker-news.firebaseio.com/v0";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Get latest "Who's hiring" post
      const searchUrl = "https://hn.algolia.com/api/v1/search?query=who%20is%20hiring&tags=story";
      const searchResponse = await this.fetchPage(searchUrl);
      const searchData = JSON.parse(searchResponse);

      if (searchData.hits && searchData.hits.length > 0) {
        // Get the most recent "Who's hiring" post
        const latestPost = searchData.hits[0];
        const postId = latestPost.objectID;

        // Get comments from the post
        const commentsUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${postId}`;
        const commentsResponse = await this.fetchPage(commentsUrl);
        const commentsData = JSON.parse(commentsResponse);

        for (const comment of commentsData.hits.slice(0, 100)) {
          // Limit to first 100 comments
          if (comment.comment_text && comment.comment_text.length > 50) {
            const text = comment.comment_text;
            const $ = cheerio.load(text);
            const cleanText = $.text();

            // Extract company name (usually in the first line or starts with company name)
            const lines = cleanText.split("\n").filter((line) => line.trim().length > 0);
            let company = "HackerNews Company";
            let title = "Software Developer";
            let location = "Remote";

            if (lines.length > 0) {
              const firstLine = lines[0].trim();

              // Try to extract company name
              const companyMatch = firstLine.match(/^([A-Za-z0-9\s&.,'-]+)(?:\s*\||:|\s*-|\s*is)/);
              if (companyMatch) {
                company = companyMatch[1].trim();
              }

              // Try to extract job title
              const titleKeywords = [
                "engineer",
                "developer",
                "architect",
                "manager",
                "designer",
                "analyst",
                "scientist",
              ];
              for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (titleKeywords.some((keyword) => lowerLine.includes(keyword))) {
                  title = line.trim().substring(0, 100); // Limit title length
                  break;
                }
              }

              // Try to extract location
              const locationKeywords = [
                "remote",
                "onsite",
                "hybrid",
                "san francisco",
                "new york",
                "london",
                "berlin",
                "toronto",
              ];
              for (const line of lines) {
                const lowerLine = line.toLowerCase();
                if (locationKeywords.some((keyword) => lowerLine.includes(keyword))) {
                  location = line.trim().substring(0, 50);
                  break;
                }
              }
            }

            jobs.push(
              this.createJob({
                title: title,
                company: company,
                location: location,
                description: cleanText.substring(0, 1000), // Limit description
                url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
                postedDate: new Date(comment.created_at),
              })
            );
          }

          // Add small delay
          await this.sleep(100);
        }
      }

      return {
        jobs: jobs.slice(0, 50), // Limit to 50 jobs
        source: this.sourceName,
        success: true,
        totalFound: jobs.length,
      };
    } catch (error) {
      return {
        jobs: [],
        source: this.sourceName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        totalFound: 0,
      };
    }
  }
}
