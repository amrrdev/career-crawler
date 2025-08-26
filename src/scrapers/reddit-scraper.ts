import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    url: string;
    author: string;
    created_utc: number;
    permalink: string;
    subreddit: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

export class RedditScraper extends BaseScraper {
  protected sourceName = "Reddit";
  protected baseUrl = "https://www.reddit.com";

  public async scrapeJobs(searchQuery?: string, location?: string): Promise<ScrapingResult> {
    try {
      const jobs: Job[] = [];

      // Job-related subreddits
      const subreddits = [
        "forhire",
        "jobbit",
        "remotejobs",
        "digitalnomadswanted",
        "javascriptjobs",
        "reactjobs",
        "remotework",
        "startupjobs",
        "WorkOnline",
      ];

      for (const subreddit of subreddits) {
        try {
          const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=25`;
          const response = await this.fetchPage(url);
          const data: RedditResponse = JSON.parse(response);

          for (const post of data.data.children) {
            const postData = post.data;

            // Filter for hiring posts
            const title = postData.title.toLowerCase();
            const isHiring =
              title.includes("hiring") ||
              title.includes("[hiring]") ||
              title.includes("job") ||
              title.includes("remote") ||
              title.includes("developer") ||
              title.includes("engineer") ||
              title.includes("opportunity");

            if (isHiring && postData.selftext && postData.selftext.length > 50) {
              // Extract job details from the post
              const fullText = `${postData.title} ${postData.selftext}`;

              // Try to extract company name from title
              let company = postData.author;
              const companyMatch = postData.title.match(/\[([^\]]+)\]/);
              if (companyMatch) {
                company = companyMatch[1];
              }

              // Determine job type and location from content
              const content = fullText.toLowerCase();
              let jobLocation = "Remote";

              // Common location patterns
              const locationPatterns = [
                /location[:\s]+([^.,\n]+)/i,
                /based in ([^.,\n]+)/i,
                /([a-z\s]+,\s*[a-z]{2,})/i,
                /(new york|san francisco|london|berlin|toronto|remote|anywhere)/i,
              ];

              for (const pattern of locationPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                  jobLocation = match[1].trim();
                  break;
                }
              }

              jobs.push(
                this.createJob({
                  title: this.cleanJobTitle(postData.title),
                  company: company,
                  location: jobLocation,
                  description: postData.selftext.substring(0, 1000),
                  url: `https://www.reddit.com${postData.permalink}`,
                  postedDate: new Date(postData.created_utc * 1000),
                })
              );
            }
          }

          // Rate limiting
          await this.sleep(1000);
        } catch (error) {
          console.error(`Error scraping r/${subreddit}:`, error);
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

  private cleanJobTitle(title: string): string {
    // Remove common Reddit prefixes and clean up
    return (
      title
        .replace(/^\[HIRING\]\s*/i, "")
        .replace(/^\[.*?\]\s*/, "")
        .replace(/\s*-\s*.*$/, "")
        .trim()
        .substring(0, 100) || "Job Opportunity"
    );
  }
}
