import axios from "axios";

export interface ScrapedJobsMatchRequest {
  since: string;
  until: string;
  requestId?: string;
}

export interface ScrapedJobsMatchAcceptedResponse {
  type: "scraped";
  status: "accepted";
  requestId: string;
  since: string;
  until: string;
  acceptedAt: string;
}

export class MatcherClient {
  private readonly scrapedJobsUrl: string | null;
  private missingConfigurationLogged = false;

  constructor() {
    const explicitUrl = process.env.MATCHER_SCRAPED_JOBS_URL?.trim();
    const baseUrl = process.env.MATCHER_BASE_URL?.trim().replace(/\/+$/, "");

    this.scrapedJobsUrl = explicitUrl || (baseUrl ? `${baseUrl}/match/scraped-jobs` : null);
  }

  public async triggerScrapedJobsMatching(
    payload: ScrapedJobsMatchRequest,
  ): Promise<ScrapedJobsMatchAcceptedResponse | null> {
    if (!this.scrapedJobsUrl) {
      if (!this.missingConfigurationLogged) {
        console.warn(
          "[Matcher] MATCHER_BASE_URL or MATCHER_SCRAPED_JOBS_URL is not set. Skipping matcher trigger.",
        );
        this.missingConfigurationLogged = true;
      }
      return null;
    }

    const response = await axios.post<ScrapedJobsMatchAcceptedResponse>(this.scrapedJobsUrl, payload, {
      timeout: 10000,
    });

    return response.data;
  }
}
