import { randomUUID } from "crypto";
import { Client, Pool, PoolClient, QueryResult } from "pg";
import { Job, JobSource, JobFilter } from "../types/job.types";

export class PostgresDatabase {
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor(connectionString?: string) {
    const connString = connectionString || process.env.DATABASE_URL;
    if (!connString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    this.pool = new Pool({
      connectionString: connString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
      this.isInitialized = true;
      console.log("[PostgreSQL] Database connection verified");
    } catch (error) {
      console.error("[PostgreSQL] Failed to verify database connection:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapJobType(jobType: string | undefined): string {
    if (!jobType) return "FULL_TIME";

    const jobTypeMap: Record<string, string> = {
      "full-time": "FULL_TIME",
      "full time": "FULL_TIME",
      "part-time": "PART_TIME",
      "part time": "PART_TIME",
      contract: "CONTRACT",
      freelance: "FREELANCE",
      internship: "INTERNSHIP",
      remote: "FULL_TIME",
    };

    return jobTypeMap[jobType.toLowerCase()] || "FULL_TIME";
  }

  public async jobExists(url: string): Promise<boolean> {
    const query = `SELECT 1 FROM scraped_jobs WHERE url = $1 LIMIT 1`;
    const result = await this.pool.query(query, [url]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async saveJob(job: Job): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const newJobId = randomUUID();
      const jobResult = await client.query(
        `INSERT INTO scraped_jobs (id, url, source, title, company_name, location, description, salary, job_type, posted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (url) DO UPDATE SET
           title = EXCLUDED.title,
           company_name = EXCLUDED.company_name,
           location = EXCLUDED.location,
           description = EXCLUDED.description,
           salary = EXCLUDED.salary,
           job_type = EXCLUDED.job_type,
           posted_at = EXCLUDED.posted_at,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          newJobId,
          job.url,
          job.source,
          job.title,
          job.company,
          job.location,
          job.description,
          job.salary || null,
          this.mapJobType(job.jobType),
          job.postedDate,
        ],
      );

      const jobId = jobResult.rows[0].id;

      if (job.skills && job.skills.length > 0) {
        for (const skillName of job.skills) {
          const normalizedSkill = skillName.trim();
          if (!normalizedSkill) continue;

          const skillIdCandidate = randomUUID();
          const skillResult = await client.query(
            `INSERT INTO skills (id, name, created_at, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [skillIdCandidate, normalizedSkill],
          );

          const skillId = skillResult.rows[0].id;

          await client.query(
            `INSERT INTO scraped_job_skills (id, job_id, skill_id, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING`,
            [randomUUID(), jobId, skillId],
          );
        }
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Failed to save job ${job.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async saveJobs(jobs: Job[]): Promise<number> {
    let savedCount = 0;
    for (const job of jobs) {
      try {
        await this.saveJob(job);
        savedCount++;
      } catch (error) {
        console.error(`Failed to save job ${job.id}:`, error);
      }
    }
    return savedCount;
  }

  public async getJobsBySkills(skills: string[], limit: number = 100): Promise<Job[]> {
    if (!skills || skills.length === 0) {
      return this.getAllJobs(limit);
    }

    const skillConditions = skills.map((_, idx) => `s.name ILIKE $${idx + 1}`).join(" OR ");
    const skillParams = skills.map((s) => `%${s}%`);

    const query = `
      SELECT DISTINCT j.id, j.url, j.source, j.title, j.company_name, j.location, 
             j.description, j.salary, j.job_type, j.posted_at, j.created_at, j.updated_at,
             COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') as skills
      FROM scraped_jobs j
      LEFT JOIN scraped_job_skills js ON j.id = js.job_id
      LEFT JOIN skills s ON js.skill_id = s.id
      WHERE ${skillConditions}
      GROUP BY j.id
      ORDER BY j.posted_at DESC
      LIMIT $${skills.length + 1}
    `;

    const result = await this.pool.query(query, [...skillParams, limit]);
    return this.mapRowsToJobs(result);
  }

  public async getAllJobs(limit: number = 1000): Promise<Job[]> {
    const query = `
      SELECT j.id, j.url, j.source, j.title, j.company_name, j.location,
             j.description, j.salary, j.job_type, j.posted_at, j.created_at, j.updated_at,
             COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]') as skills
      FROM scraped_jobs j
      LEFT JOIN scraped_job_skills js ON j.id = js.job_id
      LEFT JOIN skills s ON js.skill_id = s.id
      GROUP BY j.id
      ORDER BY j.posted_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return this.mapRowsToJobs(result);
  }

  private mapRowsToJobs(result: QueryResult): Job[] {
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company_name,
      location: row.location || "",
      description: row.description || "",
      url: row.url,
      salary: row.salary,
      skills: Array.isArray(row.skills) ? row.skills.map((s: { name: string }) => s.name) : [],
      jobType: this.mapJobTypeFromPg(row.job_type),
      source: row.source,
      postedDate: row.posted_at ? new Date(row.posted_at) : new Date(),
      extractedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    }));
  }

  private mapJobTypeFromPg(pgType: string | null): "full-time" | "part-time" | "contract" | "internship" | "remote" {
    if (!pgType) return "full-time";

    const reverseMap: Record<string, "full-time" | "part-time" | "contract" | "internship" | "remote"> = {
      FULL_TIME: "full-time",
      PART_TIME: "part-time",
      CONTRACT: "contract",
      FREELANCE: "contract",
      INTERNSHIP: "internship",
    };

    return reverseMap[pgType] || "full-time";
  }

  public async updateJobSource(source: JobSource): Promise<void> {
    const query = `
      INSERT INTO job_sources (name, url, is_active, last_fetched, total_jobs_fetched)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET
        url = EXCLUDED.url,
        is_active = EXCLUDED.is_active,
        last_fetched = EXCLUDED.last_fetched,
        total_jobs_fetched = EXCLUDED.total_jobs_fetched
    `;

    await this.pool.query(query, [
      source.name,
      source.url,
      source.isActive,
      source.lastFetched || null,
      source.totalJobsFetched,
    ]);
  }

  public async getJobStats(): Promise<{ total: number; bySource: { [key: string]: number } }> {
    const totalQuery = "SELECT COUNT(*) as total FROM scraped_jobs";
    const sourceQuery = "SELECT source, COUNT(*) as count FROM scraped_jobs GROUP BY source";

    const [totalResult, sourceResult] = await Promise.all([
      this.pool.query(totalQuery),
      this.pool.query(sourceQuery),
    ]);

    const total = parseInt(totalResult.rows[0]?.total || "0", 10);
    const bySource: { [key: string]: number } = {};

    sourceResult.rows.forEach((row) => {
      bySource[row.source] = parseInt(row.count, 10);
    });

    return { total, bySource };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query("SELECT 1");
      return result.rowCount === 1;
    } catch {
      return false;
    }
  }
}
