import sqlite3 from "sqlite3";
import { Job, JobSource } from "../types/job.types";
import path from "path";

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = "jobs.db") {
    const fullPath = path.resolve(dbPath);
    this.db = new sqlite3.Database(fullPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    const createJobsTable = `
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        url TEXT UNIQUE NOT NULL,
        salary TEXT,
        skills TEXT,
        jobType TEXT,
        source TEXT NOT NULL,
        postedDate TEXT,
        extractedAt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createJobSourcesTable = `
      CREATE TABLE IF NOT EXISTS job_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        isActive BOOLEAN DEFAULT 1,
        lastFetched TEXT,
        totalJobsFetched INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs(skills);
      CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
      CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
      CREATE INDEX IF NOT EXISTS idx_jobs_posted_date ON jobs(postedDate);
      CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    `;

    this.db.serialize(() => {
      this.db.run(createJobsTable);
      this.db.run(createJobSourcesTable);
      this.db.run(createIndexes);
    });
  }

  public async saveJob(job: Job): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO jobs 
        (id, title, company, location, description, url, salary, skills, jobType, source, postedDate, extractedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        job.id,
        job.title,
        job.company,
        job.location,
        job.description,
        job.url,
        job.salary || null,
        JSON.stringify(job.skills),
        job.jobType,
        job.source,
        job.postedDate.toISOString(),
        job.extractedAt.toISOString(),
      ];

      this.db.run(query, values, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
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
    return new Promise((resolve, reject) => {
      const skillsQuery = skills.map(() => "skills LIKE ?").join(" OR ");
      const query = `
        SELECT * FROM jobs 
        WHERE ${skillsQuery}
        ORDER BY postedDate DESC 
        LIMIT ?
      `;

      const values = [...skills.map((skill) => `%"${skill}"%`), limit];

      this.db.all(query, values, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const jobs: Job[] = rows.map((row) => ({
            id: row.id,
            title: row.title,
            company: row.company,
            location: row.location,
            description: row.description,
            url: row.url,
            salary: row.salary,
            skills: JSON.parse(row.skills || "[]"),
            jobType: row.jobType,
            source: row.source,
            postedDate: new Date(row.postedDate),
            extractedAt: new Date(row.extractedAt),
          }));
          resolve(jobs);
        }
      });
    });
  }

  public async getAllJobs(limit: number = 1000): Promise<Job[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM jobs 
        ORDER BY postedDate DESC 
        LIMIT ?
      `;

      this.db.all(query, [limit], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const jobs: Job[] = rows.map((row) => ({
            id: row.id,
            title: row.title,
            company: row.company,
            location: row.location,
            description: row.description,
            url: row.url,
            salary: row.salary,
            skills: JSON.parse(row.skills || "[]"),
            jobType: row.jobType,
            source: row.source,
            postedDate: new Date(row.postedDate),
            extractedAt: new Date(row.extractedAt),
          }));
          resolve(jobs);
        }
      });
    });
  }

  public async updateJobSource(source: JobSource): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO job_sources 
        (name, url, isActive, lastFetched, totalJobsFetched)
        VALUES (?, ?, ?, ?, ?)
      `;

      const values = [
        source.name,
        source.url,
        source.isActive ? 1 : 0,
        source.lastFetched?.toISOString() || null,
        source.totalJobsFetched,
      ];

      this.db.run(query, values, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public async getJobStats(): Promise<{ total: number; bySource: { [key: string]: number } }> {
    return new Promise((resolve, reject) => {
      const totalQuery = "SELECT COUNT(*) as total FROM jobs";
      const sourceQuery = "SELECT source, COUNT(*) as count FROM jobs GROUP BY source";

      this.db.get(totalQuery, (err, totalRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(sourceQuery, (err, sourceRows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const bySource: { [key: string]: number } = {};
            sourceRows.forEach((row) => {
              bySource[row.source] = row.count;
            });

            resolve({
              total: totalRow.total,
              bySource,
            });
          }
        });
      });
    });
  }

  public close(): void {
    this.db.close();
  }
}
