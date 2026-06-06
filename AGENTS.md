# AGENTS.md - Job Posting Aggregator

## Project Overview
This is a TypeScript-based job posting aggregator that scrapes jobs from multiple sources (LinkedIn, Glassdoor, Indeed, Bayt, Wuzzuf), stores them in PostgreSQL, and exposes them via a REST API.

## Build Commands

```bash
# Build (compiles TypeScript and copies selector JSON files)
npm run build

# Start (production - runs compiled JS)
npm start

# Development (runs with ts-node)
npm run dev

# Scheduler only
npm run scheduler
```

**Note:** There are no lint or test scripts configured. Run `npm run build` to verify TypeScript compiles correctly.

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled (`strict: true` in tsconfig.json)
- Target: ES2020, Module: commonjs
- No implicit any, strict null checks enabled
- Use explicit types - avoid `any`

### Imports
```typescript
// Third-party imports first
import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";

// Relative imports
import { Job, ScrapingResult } from "../types/job.types";
import { PostgresDatabase } from "../database/postgres-db";
```

### Naming Conventions
- **Classes**: PascalCase (e.g., `JobAggregator`, `LinkedInScraper`)
- **Variables/functions**: camelCase (e.g., `jobUrlCache`, `aggregateJobs`)
- **Constants**: camelCase or SCREAMING_SNAKE_CASE (e.g., `MAX_JOB_AGE_DAYS`, `CONCURRENCY_LIMIT`)
- **Interfaces**: PascalCase (e.g., `Job`, `JobFilter`)
- **Abstract classes**: PascalCase with `Base` prefix (e.g., `BaseScraper`)

### Error Handling Pattern
```typescript
try {
  // async operation
} catch (error) {
  console.error(`Failed to fetch ${url}:`, error);
  throw error; // or return error result
}

// Check error type before accessing message
error instanceof Error ? error.message : "Unknown error"
```

### Class Structure Pattern
```typescript
export abstract class BaseScraper {
  protected userAgent = "...";
  protected delay = 1000;

  protected abstract sourceName: string;
  protected abstract baseUrl: string;

  protected async fetchPage(url: string): Promise<string> { ... }
  
  public abstract scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult>;
}
```

### Async/Await
- Always use async/await for asynchronous operations
- Use Promise.all for concurrent operations when appropriate
- Always handle promise rejections with try-catch

### Database (PostgreSQL)
- Use parameterized queries to prevent SQL injection
- Always release clients back to pool in finally blocks
- Use transactions for multi-table operations
- Connection pool: max 20 connections

### Scraper Selectors
Selector JSON files are stored in `src/scrapers/` and copied to `dist/scrapers/` on build:
- `*-selectors.json` pattern (e.g., `linkedin-selectors.json`)

## Project Structure

```
src/
├── index.ts              # Entry point, starts API server
├── scheduler.ts         # Cron-based job scheduler
├── api/
│   └── server.ts         # Express REST API
├── database/
│   ├── database.ts       # SQLite (legacy)
│   └── postgres-db.ts    # PostgreSQL implementation
├── scrapers/
│   ├── base-scraper.ts   # Abstract base class
│   ├── anti-detection.ts # Puppeteer anti-detection
│   ├── linkedin-scraper.ts
│   ├── glassdoor-scraper.ts
│   ├── indeed-scraper.ts
│   ├── bayt-scraper.ts
│   └── wuzzuf-scraper.ts
├── services/
│   ├── job-aggregator.ts # Orchestrates scraping
│   └── matcher-client.ts # External matcher API
└── types/
    └── job.types.ts      # TypeScript interfaces
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
PORT=3010
SCHEDULER_CRON=0 * * * *        # Default: every hour
SCHEDULER_TEST_MODE=             # Set to "matcher-only" for testing
SCHEDULER_TEST_WINDOW_MINUTES=60
BYPASS_CACHE=true                # Skip cached responses
MATCHER_API_URL=                 # Matcher endpoint
MATCHER_API_KEY=                 # Matcher API key
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check with scheduler status |
| GET | /api/jobs | Get all jobs |
| GET | /api/jobs/skills/:skills | Get jobs by skills (comma-separated) |
| POST | /api/jobs/search | Search with filters |
| GET | /api/stats | Database statistics |
| POST | /api/jobs/refresh | Manually trigger job refresh |
| POST | /api/matcher/trigger | Trigger matcher for recent jobs |
| GET | /api/skills | Get all available skills |

## Key Patterns

### Scraping Flow
1. `JobScheduler` triggers `JobAggregator.aggregateJobs()` on cron schedule
2. `JobAggregator` iterates through enabled scrapers
3. Each scraper calls `onJobScraped` callback for each job found
4. Jobs are deduplicated (URL check + in-memory signature cache)
5. New jobs saved to PostgreSQL with skills
6. After scraping, `MatcherClient` is notified of the time window

### Job Type Values
- `full-time` | `part-time` | `contract` | `internship` | `remote`

### Adding a New Scraper
1. Create `src/scrapers/newsource-scraper.ts` extending `BaseScraper`
2. Create `src/scrapers/newsource-selectors.json` with CSS selectors
3. Add to `scrapers` array in `job-aggregator.ts`
4. Ensure `MAX_JOB_AGE_DAYS` is set appropriately
