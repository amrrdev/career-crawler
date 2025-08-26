export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: string;
  skills: string[];
  jobType: "full-time" | "part-time" | "contract" | "internship" | "remote";
  source: string;
  postedDate: Date;
  extractedAt: Date;
}

export interface JobSource {
  name: string;
  url: string;
  isActive: boolean;
  lastFetched?: Date;
  totalJobsFetched: number;
}

export interface JobFilter {
  skills?: string[];
  location?: string;
  jobType?: string;
  company?: string;
  minSalary?: number;
  maxSalary?: number;
  datePosted?: "today" | "week" | "month";
}

export interface ScrapingResult {
  jobs: Job[];
  source: string;
  success: boolean;
  error?: string;
  totalFound: number;
}
