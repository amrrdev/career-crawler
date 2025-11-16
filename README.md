# CareerK Crawler

An automated job aggregation system that scrapes tech positions from multiple job boards and serves them through a REST API.

> If this helps you land a job, amazing. Buy me a coffee sometime. If it gets you IP banned from Indeed, well... maybe dial down the aggressive scraping next time.

## Overview

Automates job hunting by scraping Glassdoor, LinkedIn, Indeed, Wuzzuf, and Bayt. Instead of manually browsing hundreds of listings across different sites, this system collects everything into a single queryable database.

Built with **Node.js** and **TypeScript** for type safety and maintainability.

## Architecture

### Scraping Engine

Uses **Puppeteer** (headless Chrome) for browser automation combined with **Cheerio** for HTML parsing. Each scraper follows a two-phase approach:

**Phase 1: Search Discovery**

- Navigates to job search pages with predefined keywords and locations
- Extracts job URLs from search result cards
- Maintains in-memory cache to prevent duplicate processing

**Phase 2: Detail Extraction**

- Visits individual job pages to extract comprehensive data
- Parses: title, company, location, full description, posted date, salary
- Applies skill extraction algorithms
- Filters based on job age (7-14 days depending on market)

### Anti-Detection System

Job sites actively block scrapers. The system implements:

- **User Agent Rotation**: Cycles through 11+ different browser signatures (Chrome, Firefox, Safari, Edge across Windows/macOS)
- **Viewport Randomization**: Uses realistic screen resolutions (1920×1080, 1366×768, etc.)
- **Human Behavior Simulation**: Random mouse movements, scrolling patterns, variable delays
- **Session Management**: Rotates browser sessions after 25 requests or 30 minutes
- **Smart Rate Limiting**: Adaptive delays (1-5s) that increase based on request frequency
- **Request Interception**: Blocks images/CSS/fonts to reduce load time and detection surface
- **Response Caching**: 10-minute TTL to avoid redundant requests

Powered by **puppeteer-extra-plugin-stealth** to mask automation markers.

### Skill Extraction

Pattern-matching system with 300+ technology skill patterns across multiple categories:

- Programming languages (JavaScript, Python, Java, Go, Rust, etc.)
- Frontend frameworks (React, Angular, Vue, Svelte)
- Backend frameworks (Node.js, Django, Spring, Laravel, Express)
- Databases (PostgreSQL, MongoDB, MySQL, Redis, Elasticsearch)
- Cloud platforms (AWS, Azure, GCP, Firebase)
- DevOps tools (Docker, Kubernetes, Jenkins, Terraform, Ansible)
- Mobile development (React Native, Flutter, iOS, Android)
- Testing frameworks (Jest, Cypress, Selenium)

Handles variations: "React" matches "react", "reactjs", "react.js", "react native"

Average extraction: 15-30 skills per job posting.

### Scheduler

Uses **node-cron** for automated execution:

- Runs hourly at minute 0
- Executes immediately on startup
- Processes all active scrapers sequentially
- Logs summary statistics (new jobs, duplicates, failures)

### Database Layer

Currently uses **SQLite** for simplicity and zero-configuration deployment. Schema includes:

**Note**: SQLite will be replaced with **PostgreSQL** for better concurrent write performance and scalability at higher volumes.

### API Server

**Express**-based REST API with the following endpoints:

```
GET  /health                      # System health check
GET  /api/jobs                    # List all jobs (paginated)
GET  /api/jobs/skills/:skills     # Filter by skills (comma-separated)
POST /api/jobs/search             # Advanced search with filters
GET  /api/stats                   # Database statistics by source
POST /api/jobs/refresh            # Trigger manual scraping (async)
GET  /api/skills                  # List all extracted skills
```

All responses follow a standard format:

```json
{
  "success": true,
  "count": number,
  "data": [...],
  "timestamp": "ISO-8601"
}
```

## Configuration

**Job Age Filters** (configurable per scraper):

- Indeed: 7 days
- Wuzzuf: 14 days (MENA market slower turnover)
- Bayt: 14 days
- Glassdoor: 7 days

**Concurrency Limits** (parallel job detail requests):

- Indeed: 2 concurrent requests
- Wuzzuf: 3 concurrent requests
- Others: 2-4 based on site tolerance

**Rate Limiting**:

- 1-2 seconds between individual job pages
- 3-5 seconds between search queries
- Adaptive increases based on request count

## Installation & Usage

```bash
npm install
npm run dev
```

Server starts on port 3000 (configurable via `PORT` env variable).

**Environment Variables**:

- `PORT` - API server port (default: 3000)
- `BYPASS_CACHE` - Disable caching when set to 'true'

## Error Handling

Production-ready error handling across all layers:

- **Database operations**: Wrapped in try-catch, return empty arrays on failure
- **Individual job failures**: Logged but don't crash the scraper
- **API errors**: Proper HTTP status codes and error messages
- **Unhandled rejections**: Global handlers prevent crashes
- **Graceful shutdown**: Clean browser/database cleanup on SIGINT/SIGTERM

## Logging

Minimal production logs showing only relevant information:

- Scraping start/completion with job counts
- Source-specific failures
- API requests (excluding health checks)
- Database statistics

Removed verbose per-job logging for cleaner output.

## Known Limitations

- **Indeed blocking**: Rate limits kick in after ~50-100 jobs. Requires proxy rotation for higher volumes.
- **Selector brittleness**: Site HTML changes break selectors. Requires periodic maintenance.
- **No retry logic**: Individual failed jobs not retried within same session.
- **Skill extraction accuracy**: Regex-based approach misses context. ML-based extraction would improve precision.

## Future Improvements

- [ ] Migrate to **PostgreSQL** for better write concurrency
- [ ] Implement proxy rotation for higher throughput
- [ ] Add retry mechanism for failed job extractions
- [ ] ML-based skill extraction for better accuracy

---

## License

Free to use. Seriously, just take it. I'm not a lawyer and don't have the energy to write proper license terms.
