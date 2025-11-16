# Technical Documentation - Job Scraping System

## Overview

This is a sophisticated job aggregation system that scrapes technology job postings from multiple sources (LinkedIn, Indeed, Glassdoor, Wuzzuf, Bayt) and provides a unified REST API to access them. The system uses advanced anti-detection techniques, intelligent caching, and automated scheduling to maintain a fresh database of job listings.

---

## System Architecture

### Core Components

1. **API Server** (`src/api/server.ts`)

   - Express-based REST API
   - Provides endpoints for job searching, filtering, and statistics
   - Handles CORS and request logging
   - Integrates with the scheduler for automated updates

2. **Job Scheduler** (`src/scheduler.ts`)

   - Cron-based scheduler that runs hourly
   - Triggers automatic job aggregation at regular intervals
   - Runs immediately on startup for fresh data
   - Provides manual trigger capability via API

3. **Job Aggregator** (`src/services/job-aggregator.ts`)

   - Orchestrates multiple scrapers simultaneously
   - Manages duplicate detection using in-memory cache and database checks
   - Provides unified interface for all job sources
   - Tracks statistics and success rates per source

4. **Database Layer** (`src/database/database.ts`)

   - SQLite-based persistent storage
   - Indexed for fast skill-based and location-based searches
   - Stores job metadata including skills, dates, and sources
   - Tracks job source statistics

5. **Scraper System** (`src/scrapers/`)
   - Base scraper with shared functionality
   - Individual scrapers for each job platform
   - Anti-detection manager for avoiding blocks

---

## How Scraping Works

### Two-Phase Architecture (LinkedIn & Indeed)

These scrapers use a sophisticated two-phase approach:

#### Phase 1: Search Page Scraping

- Fetch search result pages for various tech keywords and locations
- Extract job URLs from listing cards
- Use multiple search queries to maximize coverage
- Filter out duplicate URLs using in-memory cache

#### Phase 2: Detail Page Scraping

- Batch process job detail pages (2-4 concurrent requests)
- Extract comprehensive job information:
  - Title, company, location
  - Full job description (2000+ characters)
  - Posted date for freshness filtering
  - Salary information when available
- Apply intelligent skill extraction

**Search Strategy:**

- Multiple search terms: "software engineer", "frontend developer", "data scientist", etc.
- Multiple locations: Remote, US cities, European cities, MENA regions
- Randomized and limited to avoid detection
- Adaptive delays between searches (5-10 seconds)

### Single-Phase Architecture (Wuzzuf, Bayt, Glassdoor)

These scrapers process jobs directly from search results:

- Parse job cards on search pages
- Extract basic information without detail page navigation
- Faster but less comprehensive data
- More resilient to blocking

---

## Anti-Detection System

The `AntiDetectionManager` (`src/scrapers/anti-detection.ts`) implements multiple strategies to avoid being blocked:

### Browser Fingerprinting Prevention

**1. User Agent Rotation**

- Maintains pool of realistic user agents from Chrome, Firefox, Safari, Edge
- Rotates between different OS (Windows, macOS) and browser versions
- Includes proper browser metadata (Sec-Ch-Ua headers)

**2. Viewport Randomization**

- Uses common desktop screen resolutions (1920×1080, 1366×768, etc.)
- Each session gets a random but realistic viewport size
- Matches viewport to user agent platform

**3. Session Management**

- Creates separate sessions per domain
- Each session has:
  - Unique user agent
  - Cookie storage
  - Request counter
  - Last used timestamp
  - Blocked status flag
- Sessions expire after 30 minutes of inactivity
- Maximum 25 requests per session before rotation

### Behavioral Simulation

**1. Human-Like Behavior**

- Random mouse movements on pages
- Random scrolling (up and down)
- Variable delays between actions
- Realistic browsing patterns

**2. Smart Rate Limiting**

- Base delay of 2 seconds between requests
- Multiplier increases with request count (up to 3x)
- Random variation (0.5x to 1.5x) for unpredictability
- Adaptive delays: more requests = longer waits

**3. Request Interception**

- Blocks unnecessary resources (images, CSS, fonts, media)
- Reduces bandwidth and speeds up page loads
- Mimics ad-blocker behavior (common in real users)

### Puppeteer Stealth Integration

Uses `puppeteer-extra-plugin-stealth` to:

- Hide automation indicators (webdriver, chrome.runtime)
- Patch browser fingerprinting APIs
- Simulate genuine browser environment
- Bypass common bot detection scripts

### Caching Strategy

**1. Response Caching**

- 10-minute cache duration for page content
- Reduces redundant requests
- Can be bypassed for fresh data
- Automatic cleanup of expired cache entries

**2. Browser Instance Reuse**

- Maintains browser sessions across requests
- Reduces startup overhead
- Limits concurrent browsers (max 2) to avoid resource exhaustion
- Proper cleanup on session rotation

---

## Skill Extraction System

The skill extraction is one of the most sophisticated parts of the system. It uses pattern matching across job titles, descriptions, and company names.

### How It Works

**1. Text Normalization**

- Converts to lowercase
- Removes special characters
- Standardizes spacing
- Handles multiple variations of same skill

**2. Pattern Matching**

- Maintains comprehensive skill database with variations:
  - JavaScript: `javascript`, `js`, `vanilla js`, `ecmascript`
  - TypeScript: `typescript`, `ts`, `type script`
  - React: `react`, `reactjs`, `react.js`, `react native`
- Uses regex patterns for flexible matching
- Detects skill synonyms and abbreviations

**3. Multi-Source Extraction**

- Scans job title for role indicators
- Analyzes full description for technology mentions
- Checks company name for tech stack hints
- Combines all sources and deduplicates

**4. Skill Categories Detected**

- Programming languages (20+ languages)
- Frontend frameworks (React, Angular, Vue, etc.)
- Backend frameworks (Node.js, Django, Spring, etc.)
- Databases (SQL, NoSQL, specific databases)
- Cloud platforms (AWS, Azure, GCP)
- DevOps tools (Docker, Kubernetes, CI/CD)
- Mobile development (iOS, Android, React Native, Flutter)
- Testing frameworks
- Data science tools
- Methodologies (Agile, DevOps)

### Quality Metrics

- Indeed scraper: 15-30+ skills per job
- LinkedIn scraper: 10-20 skills per job
- Other scrapers: 5-15 skills per job

---

## Job Type Detection

The system automatically categorizes jobs into types:

### Detection Logic

**1. Internship Detection**

- Keywords: `internship`, `intern`, `graduate role`, `student position`
- Exclusions: Senior roles, experienced positions (to avoid false positives)
- Priority check (checked first)

**2. Contract/Freelance**

- Keywords: `contract`, `freelance`, `consultant`

**3. Part-Time**

- Keywords: `part-time`, `part time`

**4. Remote**

- Keywords: `remote`, `work from home`
- Special handling: Removes "Remote" from location field

**5. Full-Time (Default)**

- Assigned when no other type matches
- Most common job type

---

## Duplicate Detection

Multi-layered approach to prevent duplicate jobs:

### 1. URL-Based Detection (Primary)

- Each job has unique URL from source platform
- Database checks for existing URL before saving
- Fast and 100% accurate for same source

### 2. Signature-Based Detection (Secondary)

- Generates signature from:
  - Normalized job title (first 3 meaningful words)
  - Normalized company name
- Format: `{key_title}::{company}`
- In-memory cache for quick checks during scraping session

### 3. Job ID Generation

- MD5 hash of URL + title
- Prefixed with source name
- Format: `source_name_hash`
- Ensures globally unique IDs across all sources

### Process Flow

1. Scraper finds new job
2. Check in-memory signature cache (fast)
3. If not in cache, check database by URL (accurate)
4. If not duplicate, add to cache and save to database
5. Track statistics (total fetched, saved, duplicates)

---

## Data Flow

### Startup Sequence

```
1. Application starts (src/index.ts)
2. API Server initializes
   - Sets up Express routes
   - Creates JobAggregator instance
   - Creates JobScheduler instance
3. Server starts listening on port 3000
4. Scheduler starts cron job (hourly)
5. Immediate scraping run triggered
6. All scrapers execute in sequence
7. Jobs saved to database
8. System ready for API requests
```

### Scraping Workflow

```
1. Scheduler triggers (hourly or manual)
2. JobAggregator.aggregateJobs() called
3. For each scraper:
   a. Scraper searches for jobs
   b. For each job found:
      - Extract job details
      - Check for duplicates
      - Call onJobScraped callback
      - JobAggregator checks cache
      - JobAggregator checks database
      - Save if new job
   c. Wait 2 seconds before next scraper
4. Return aggregation results
5. Log statistics
```

### Job Detail Extraction (Indeed Example)

```
1. Build search URL with term + location + filters
2. Fetch search page with browser
3. Parse HTML with Cheerio
4. Extract job card elements
5. Extract job URLs from cards
6. For each URL:
   a. Fetch detail page with browser
   b. Wait for content to load (h1 selector)
   c. Simulate human behavior (scroll, mouse move)
   d. Extract structured data:
      - Title (h1, metadata)
      - Company (company link, data attributes)
      - Location (metadata, address elements)
      - Description (multiple selectors, fallbacks)
      - Date (parse relative dates like "3 days ago")
      - Salary (if available)
   e. Parse date to check freshness (7-day filter)
   f. Extract skills from all text fields
   g. Create Job object
   h. Return job or null if invalid
7. Save valid jobs through callback
```

---

## Date Parsing & Freshness Filter

### Relative Date Parsing

The system parses various date formats from job sites:

**Supported Formats:**

- "Just posted" / "Today" → Current date
- "X hours ago" → Subtract hours from now
- "X days ago" → Subtract days from now
- "30+ days ago" → Extract number, subtract days
- "X weeks ago" → Convert to days, subtract
- "Active X days ago" → Extract days, subtract
- "Posted X days ago" → Extract days, subtract
- ISO date strings → Direct parsing

**7-Day Freshness Filter:**

- Only jobs posted within last 7 days are saved
- Configured per scraper (MAX_JOB_AGE_DAYS = 7)
- Ensures database contains only recent opportunities
- Older jobs logged but skipped

---

## Database Schema

### Jobs Table

```
- id (TEXT PRIMARY KEY) - Unique job identifier
- title (TEXT NOT NULL) - Job title
- company (TEXT NOT NULL) - Company name
- location (TEXT NOT NULL) - Job location
- description (TEXT) - Full job description
- url (TEXT UNIQUE NOT NULL) - Original job posting URL
- salary (TEXT) - Salary information if available
- skills (TEXT) - JSON array of extracted skills
- jobType (TEXT) - full-time/part-time/contract/internship/remote
- source (TEXT NOT NULL) - Platform name (Indeed, LinkedIn, etc.)
- postedDate (TEXT) - When job was posted
- extractedAt (TEXT NOT NULL) - When job was scraped
- created_at (DATETIME) - Database insertion timestamp
```

### Indexes

- Skills (for fast skill-based searches)
- Location (for location filtering)
- Company (for company searches)
- Posted date (for chronological sorting)
- Source (for per-platform filtering)

### Job Sources Table

```
- id (INTEGER PRIMARY KEY)
- name (TEXT UNIQUE) - Source platform name
- url (TEXT) - Base URL
- isActive (BOOLEAN) - Whether scraper is enabled
- lastFetched (TEXT) - Last successful scrape timestamp
- totalJobsFetched (INTEGER) - Cumulative jobs from source
- created_at (DATETIME)
```

---

## API Endpoints

### GET /health

Health check endpoint

- Returns system status
- Scheduler running status
- Next scheduled run time

### GET /api/jobs

Get all jobs with optional limit

- Query param: `limit` (default: 100)
- Returns jobs sorted by posted date (newest first)

### GET /api/jobs/skills/:skills

Search jobs by skills

- Path param: `skills` (comma-separated)
- Query param: `limit` (default: 100)
- Example: `/api/jobs/skills/React,TypeScript,Node.js`

### POST /api/jobs/search

Advanced search with filters

- Body: JSON with filter criteria (skills, location, company, etc.)
- Returns matching jobs

### GET /api/stats

Database statistics

- Total job count
- Jobs per source breakdown
- Timestamp of query

### POST /api/jobs/refresh

Manually trigger scraping

- Initiates immediate job aggregation
- Bypasses scheduler
- Returns when complete with statistics

### GET /api/skills

Get all available skills

- Aggregates skills from all jobs in database
- Returns sorted unique skill list
- Useful for building search UIs

---

## Error Handling & Resilience

### Scraper-Level Error Handling

- Try-catch blocks around each scraper execution
- Failed scrapers don't stop other scrapers
- Errors logged with source identification
- Returns partial results on scraper failure

### Page-Level Error Handling

- Retry logic for browser sessions
- Timeout handling (60 seconds per page)
- CAPTCHA/block detection
- Graceful degradation when selectors fail

### Network Error Handling

- Session marked as blocked on network errors
- Automatic session rotation after failures
- Rate limiting prevents overwhelming servers
- Smart delays increase after errors

### Database Error Handling

- Individual job save failures logged but don't crash system
- Transaction-like behavior per job
- Database connection management
- Automatic cleanup of stale data

---

## Performance Optimizations

### 1. Concurrent Processing

- Batch job detail fetching (2-4 parallel requests)
- Sequential scraper execution to avoid resource conflicts
- Browser instance reuse across requests

### 2. Caching Strategy

- In-memory signature cache during scraping session
- 10-minute response cache for repeated requests
- Database query optimization with indexes

### 3. Resource Management

- Limit concurrent browsers (max 2)
- Request interception to block unnecessary resources
- Automatic cleanup of expired sessions
- Browser cleanup on shutdown

### 4. Smart Filtering

- 7-day freshness filter reduces database bloat
- Duplicate detection before database writes
- Skill extraction happens once during scraping

---

## Scheduler Configuration

### Cron Schedule

- Pattern: `"0 * * * *"` (every hour at minute 0)
- Timezone: UTC
- Always runs on startup (immediate first run)

### Manual Triggers

- API endpoint: `POST /api/jobs/refresh`
- Direct method: `scheduler.runOnce()`

### Graceful Shutdown

- SIGINT/SIGTERM handlers
- Stops scheduler
- Closes database connections
- Closes all browser instances
- Exits cleanly

---

## Platform-Specific Details

### Indeed Scraper

- **Strategy**: Two-phase (search → detail pages)
- **Coverage**: 8 search terms × 2 locations = 16 searches
- **Concurrency**: 2 parallel detail page fetches
- **Expected Yield**: 50-100 jobs per run
- **Skills Per Job**: 15-30+
- **Special Features**:
  - Aggressive CSS cleanup
  - Multiple fallback selectors
  - Advanced date parsing

### LinkedIn Scraper

- **Strategy**: Two-phase with lazy loading
- **Special Handling**: Scroll to load more jobs
- **Expected Yield**: 30-60 jobs per run

### Wuzzuf Scraper

- **Strategy**: Single-phase (search page only)
- **Coverage**: MENA region focus
- **Expected Yield**: 20-40 jobs per run

### Bayt Scraper

- **Strategy**: Single-phase
- **Coverage**: Middle East focus
- **Special Feature**: Critical 7-day filter

### Glassdoor Scraper

- **Strategy**: Single-phase
- **Challenge**: Heavy bot detection
- **Mitigation**: Extended delays, cookie handling
- **Expected Yield**: 10-30 jobs per run

---

## Monitoring & Logging

### Console Logging

- Job discovery: `✅ Found X job cards`
- Job processing: `📄 Fetching job...`
- Skill extraction: `💼 Extracted X skills`
- Duplicates: `🔄 Duplicate job found`
- Errors: `❌ Failed to...`
- Statistics: `📊 Total fetched, saved, duplicates`

### Statistics Tracking

- Total jobs fetched (before deduplication)
- Total jobs saved (new jobs only)
- Total duplicates found
- Per-source success rates
- Database totals

---

## Configuration & Environment

### Environment Variables

- `PORT` - API server port (default: 3000)
- `BYPASS_CACHE` - Disable caching (default: false)

### Constants (Configurable in Code)

- `MAX_JOB_AGE_DAYS` - Freshness filter (7 days)
- `CONCURRENCY_LIMIT` - Parallel requests (2-4)
- `CACHE_DURATION` - Response cache time (10 minutes)
- `MAX_REQUESTS_PER_SESSION` - Session rotation threshold (25)
- `SESSION_COOLDOWN` - Session expiry time (30 minutes)
- `MAX_CONCURRENT_BROWSERS` - Browser limit (2)

---

## Technology Stack

### Core Technologies

- **Runtime**: Node.js with TypeScript
- **Web Scraping**: Puppeteer (headless Chrome) + Cheerio (HTML parsing)
- **Anti-Detection**: puppeteer-extra-plugin-stealth
- **Database**: SQLite3
- **API Framework**: Express.js
- **Scheduling**: node-cron
- **HTTP Client**: Axios (fallback)

### Why These Choices?

**Puppeteer**:

- Full browser automation
- JavaScript rendering support
- DevTools protocol access
- Excellent anti-detection when combined with stealth plugin

**Cheerio**:

- Fast HTML parsing
- jQuery-like syntax
- Low memory footprint
- Perfect for static content extraction

**SQLite**:

- Zero configuration
- File-based (no server needed)
- Fast for read-heavy workloads
- Excellent for single-instance applications

**TypeScript**:

- Type safety
- Better IDE support
- Easier refactoring
- Self-documenting code

---

## System Requirements

### Runtime Requirements

- Node.js 16+ (recommended: 18+)
- 2GB RAM minimum (4GB recommended)
- 1GB disk space for database
- Chromium (installed automatically by Puppeteer)

### Network Requirements

- Stable internet connection
- Access to job platforms (no proxy needed)
- Bandwidth: ~100MB per scraping session

---

## Limitations & Challenges

### Rate Limiting

- Job sites actively detect and block scrapers
- Implemented delays slow down scraping (takes 5-10 minutes per run)
- Some sites (Glassdoor) have aggressive bot protection

### Data Accuracy

- HTML structure changes break selectors
- Selectors require periodic updates
- Some platforms dynamically generate content

### Completeness

- Not all jobs from platforms are captured
- Filters (7-day, search terms) limit coverage
- Some detail pages may fail to load

### Scalability

- Single-instance design (one scraper at a time)
- SQLite not ideal for concurrent writes
- Browser automation is resource-intensive

---

## Future Improvements

### Technical Enhancements

- Proxy rotation for better anti-detection
- Distributed scraping across multiple machines
- PostgreSQL migration for better concurrency
- Real-time job updates (webhooks)
- Machine learning for better skill extraction

### Feature Additions

- Job recommendation engine
- Email alerts for matching jobs
- Application tracking integration
- Salary range normalization
- Company information enrichment

### Platform Expansion

- More job boards (Monster, Dice, Stack Overflow)
- Geographic expansion (Asia-Pacific, South America)
- Specialized tech job boards (AngelList, Hired)

---

## Conclusion

This job scraping system demonstrates advanced web scraping techniques, intelligent data extraction, and robust error handling. It balances comprehensiveness with respect for platform rate limits, providing a reliable source of fresh job data through a clean API interface.

The combination of browser automation, anti-detection strategies, smart caching, and multi-platform support makes it a production-ready solution for job aggregation at scale.
