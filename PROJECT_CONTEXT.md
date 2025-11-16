# 🎯 Career Crawler - AI Context Document

> **Last Updated**: October 29, 2025  
> **Repository**: career-crawler  
> **Owner**: amrrdev  
> **Branch**: main

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Core Components](#core-components)
4. [Scraper Implementations](#scraper-implementations)
5. [Anti-Detection System](#anti-detection-system)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Development Workflow](#development-workflow)
9. [Key Patterns & Best Practices](#key-patterns--best-practices)
10. [Future Scraper Implementation Guide](#future-scraper-implementation-guide)

---

## 🎯 Project Overview

**Career Crawler** is a **TypeScript/Node.js job aggregation system** that scrapes jobs from multiple job boards globally, extracts skills using pattern matching, and provides a REST API for querying job data.

### **Primary Goal**

Build a comprehensive, automated job posting aggregator with:

- ✅ Global job coverage (US, UK, Canada, Europe, MENA)
- ✅ Advanced skill extraction (200+ tech patterns)
- ✅ Anti-bot detection system (Puppeteer + Stealth)
- ✅ Smart rate limiting & caching
- ✅ SQLite database with full-text search
- ✅ REST API with filters
- ✅ Automated scheduling (cron)

### **Current Status**

- **Indeed Scraper**: ✅ Production-ready (50-100 jobs/session, 15-30 skills/job)
- **LinkedIn Scraper**: ✅ Complete (40-60 jobs/session)
- **Wuzzuf Scraper**: ✅ Complete (30-50 jobs/session, MENA focus)
- **Glassdoor Scraper**: ⚠️ Limited (blocked on detail pages)
- **Bayt Scraper**: ✅ Complete (MENA coverage)

---

## 🏗️ Architecture & Tech Stack

### **Technology Stack**

```typescript
{
  "runtime": "Node.js (TypeScript)",
  "scraping": "Puppeteer + Puppeteer-Extra + Stealth Plugin",
  "parsing": "Cheerio (jQuery-like HTML parsing)",
  "database": "SQLite3 (local, file-based)",
  "api": "Express.js (REST API)",
  "scheduling": "node-cron (automated runs)",
  "http": "Axios (HTTP requests)",
  "language": "TypeScript 5.3+"
}
```

### **Project Structure**

```
job-posting-2/
├── src/
│   ├── index.ts                      # Entry point
│   ├── scheduler.ts                  # Cron job scheduler
│   ├── api/
│   │   └── server.ts                 # Express API server
│   ├── database/
│   │   └── database.ts               # SQLite operations
│   ├── scrapers/
│   │   ├── base-scraper.ts           # Abstract base class (skill extraction)
│   │   ├── anti-detection.ts         # Browser session management
│   │   ├── indeed-scraper.ts         # ⭐ World-class Indeed implementation
│   │   ├── indeed-selectors.json     # CSS selectors config
│   │   ├── linkedin-scraper.ts       # LinkedIn (two-phase)
│   │   ├── linkedin-selectors.json   # LinkedIn selectors
│   │   ├── wuzzuf-scraper.ts         # Wuzzuf (MENA)
│   │   ├── wuzzuf-selectors.json     # Wuzzuf selectors
│   │   ├── glassdoor-scraper.ts      # Glassdoor (limited)
│   │   ├── glassdoor-selectors.json  # Glassdoor selectors
│   │   ├── bayt-scraper.ts           # Bayt (MENA)
│   │   └── bayt-selectors.json       # Bayt selectors
│   ├── services/
│   │   └── job-aggregator.ts         # Orchestrates all scrapers
│   └── types/
│       └── job.types.ts              # TypeScript interfaces
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── INDEED_IMPLEMENTATION_COMPLETE.md # Indeed scraper docs
├── INDEED_SCRAPER_PLAN.md           # Indeed implementation plan
└── PROJECT_CONTEXT.md               # ← This file
```

### **Architecture Pattern: Two-Phase Scraping**

All modern scrapers follow this pattern (inspired by LinkedIn):

```
PHASE 1: Search Page Scraping
┌─────────────────────────────────────┐
│ Build search URL with filters       │
│ (term, location, date range)        │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Fetch search page (browser/HTTP)   │
│ Extract job URLs from cards         │
│ Deduplicate against cache           │
└────────────┬────────────────────────┘
             ↓
        [url1, url2, url3, ...]

PHASE 2: Detail Page Scraping
┌─────────────────────────────────────┐
│ Batch URLs (2-4 parallel)           │
│ Promise.all([fetch(url1), ...])     │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Extract full job details:           │
│ • Title, Company, Location          │
│ • Description (2000+ chars)         │
│ • Posted Date, Salary               │
│ • Skills (15-30+ from BaseScraper)  │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Filter by age (7-10 days max)       │
│ Callback: onJobScraped(job)         │
│ → Database save                     │
└─────────────────────────────────────┘
```

---

## 🧩 Core Components

### **1. BaseScraper (`src/scrapers/base-scraper.ts`)**

**Purpose**: Abstract base class providing common functionality for all scrapers.

**Key Features**:

- ✅ **200+ skill patterns** (languages, frameworks, tools, cloud, DevOps, data science)
- ✅ **Skill extraction** from title + description + company
- ✅ **Job type detection** (full-time, part-time, contract, internship, remote)
- ✅ **Text cleaning** (normalize whitespace, remove special chars)
- ✅ **Job ID generation** (MD5 hash of URL + title)

**Skill Categories** (comprehensive):

- **Languages**: JavaScript, TypeScript, Python, Java, Go, Rust, C#, C++, PHP, Ruby, Swift, Kotlin, Scala
- **Frontend**: React, Angular, Vue, Next.js, Redux, Tailwind, Bootstrap, Material-UI, jQuery
- **Backend**: Node.js, Express, Django, Flask, Laravel, Spring, Ruby on Rails, ASP.NET, FastAPI, NestJS
- **Databases**: MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch, SQLite, Oracle, SQL Server, DynamoDB, Cassandra
- **Cloud**: AWS (EC2, S3, Lambda, RDS), Azure, Google Cloud (GCP, GCE, GKE), Firebase
- **DevOps**: Docker, Kubernetes, Jenkins, GitLab CI/CD, GitHub Actions, Terraform, Ansible, Git
- **Mobile**: React Native, Flutter, iOS (Swift, SwiftUI), Android (Kotlin, Jetpack)
- **Testing**: Jest, Mocha, Chai, Cypress, Selenium, E2E Testing
- **API**: REST, GraphQL, Microservices
- **Data Science**: Machine Learning, TensorFlow, PyTorch, Pandas, NumPy, Scikit-learn, Big Data (Hadoop, Spark, Kafka)
- **Tools**: JIRA, Confluence, Webpack, Babel, ESBuild, JSON/XML/YAML

**Example Usage**:

```typescript
const skills = this.extractSkillsFromText("Senior React Developer with AWS and Docker experience");
// Returns: ["React", "AWS", "Docker", "JavaScript", "Frontend Development"]

const jobType = this.determineJobType("Remote Full Stack Engineer");
// Returns: "remote"

const job = this.createJob({
  title: "Senior React Developer",
  company: "TechCorp",
  location: "Remote",
  description: "Build React apps with TypeScript, Node.js, AWS...",
  url: "https://example.com/job/123",
  salary: "$120k - $150k",
  postedDate: new Date(),
});
// Returns: Job object with 15-30 extracted skills
```

---

### **2. AntiDetectionManager (`src/scrapers/anti-detection.ts`)**

**Purpose**: Manage browser sessions, prevent bot detection, implement rate limiting.

**Key Features**:

- ✅ **Puppeteer + Stealth Plugin** (bypass anti-bot detection)
- ✅ **Session Management** (30-min cooldown, max 25 requests/session)
- ✅ **User Agent Rotation** (11 different Chrome/Firefox/Safari/Edge UAs)
- ✅ **Viewport Randomization** (7 common screen resolutions)
- ✅ **Smart Delays** (2-10 seconds, adaptive based on request count)
- ✅ **Response Caching** (10-min TTL, avoid re-fetching)
- ✅ **Browser Concurrency Control** (max 2 simultaneous browsers)
- ✅ **Request Interception** (block images, CSS, fonts → faster)
- ✅ **Human Behavior Simulation** (mouse movement, scrolling)

**Browser Launch Config**:

```typescript
{
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    "--disable-images",
    "--disable-blink-features=AutomationControlled",
    "--user-agent=" + randomUserAgent
  ]
}
```

**Rate Limiting Algorithm**:

```typescript
baseDelay = 2000ms  // 2 seconds minimum
requestMultiplier = min(requestCount / 10, 3)  // Max 3x
randomFactor = 0.5 to 1.5  // Randomness
finalDelay = baseDelay × (1 + requestMultiplier) × randomFactor
// Results in 1s-10s delays depending on activity
```

**Session Management**:

- New session if: doesn't exist, blocked, >25 requests, >30 min old
- Stores: cookies, user agent, viewport, request count, browser instance
- Cleanup: Every 5 minutes (close old browsers)

---

### **3. JobAggregator (`src/services/job-aggregator.ts`)**

**Purpose**: Orchestrate all scrapers, manage deduplication, save to database.

**Key Features**:

- ✅ **Incremental Processing** (jobs saved as they're scraped, not batched)
- ✅ **Duplicate Detection** (in-memory cache + database URL check)
- ✅ **Job Signature** (title + company, normalized)
- ✅ **Statistics Tracking** (total fetched, saved, duplicates)

**Current Scraper Order**:

```typescript
this.scrapers = [
  new IndeedScraper(bypassCache), // 🚀 Primary (50-100 jobs)
  // new LinkedInScraper(bypassCache), // Disabled
  // new WuzzufScraper(bypassCache),   // Disabled
  // new GlassdoorScraper(bypassCache),// Disabled
  // new BaytScraper(bypassCache),     // Disabled
];
```

**Deduplication Strategy**:

1. Generate signature: `titleWords[0:3] + "::" + normalizedCompany`
2. Check in-memory cache (Set) → fast O(1) lookup
3. If not in cache, check database (URL-based) → slower but accurate
4. Add to cache to avoid future DB checks
5. Save to database if truly new

---

### **4. Database (`src/database/database.ts`)**

**Purpose**: SQLite operations for jobs storage and retrieval.

**Schema**:

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,                -- MD5 hash (source_hash)
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,           -- Primary deduplication key
  salary TEXT,
  skills TEXT,                        -- JSON array
  jobType TEXT,
  source TEXT NOT NULL,               -- "Indeed", "LinkedIn", etc.
  postedDate TEXT,                    -- ISO 8601
  extractedAt TEXT NOT NULL,          -- ISO 8601
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_skills ON jobs(skills);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_posted_date ON jobs(postedDate);
CREATE INDEX idx_jobs_source ON jobs(source);
```

**Key Methods**:

- `jobExists(url)`: Check if job already in DB (O(1) with index)
- `saveJob(job)`: Insert or replace job
- `getJobsBySkills(skills, limit)`: Search by skill patterns
- `getAllJobs(limit)`: Get recent jobs (ordered by postedDate)
- `getJobStats()`: Total count + count by source

---

### **5. API Server (`src/api/server.ts`)**

**Purpose**: Express REST API for querying job data.

**Endpoints**:

```typescript
GET  /health                        // Health check + scheduler status
GET  /api/jobs?limit=100            // Get all jobs (default 100)
GET  /api/jobs/skills/:skills       // Get jobs by skills (comma-separated)
POST /api/jobs/search               // Advanced search with filters
GET  /api/stats                     // Database statistics
POST /api/jobs/refresh              // Manually trigger scraping
GET  /api/skills                    // Get all unique skills
```

**Example Requests**:

```bash
# Get all React jobs
curl http://localhost:3000/api/jobs/skills/React,TypeScript

# Get stats
curl http://localhost:3000/api/stats

# Search with filters
curl -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"skills": ["React", "Node.js"], "location": "Remote"}'
```

---

## 🕷️ Scraper Implementations

### ⭐ **Indeed Scraper** (`src/scrapers/indeed-scraper.ts`)

**Status**: ✅ **PRODUCTION READY - WORLD-CLASS IMPLEMENTATION**

**Quality Metrics**:

- 🎯 **50-100 jobs/session** (2x better than Glassdoor)
- 🎯 **95%+ detail page success** (vs 0% on Glassdoor)
- 🎯 **15-30+ skills/job** (5x better than Glassdoor)
- 🎯 **2000+ char descriptions** (10x better than Glassdoor)
- 🎯 **7-day freshness filter**
- 🎯 **Global coverage** (17 locations)

**Search Strategy**:

```typescript
// 24 search terms (all tech levels - junior to senior)
const searchTerms = [
  "software engineer",
  "frontend developer",
  "backend developer",
  "full stack developer",
  "react developer",
  "javascript developer",
  "python developer",
  "node.js developer",
  "java developer",
  "mobile developer",
  "angular developer",
  "vue developer",
  "devops engineer",
  "data engineer",
  "machine learning engineer",
  "cloud engineer",
  "QA engineer",
  "software developer",
  "web developer",
  "iOS developer",
  "android developer",
  "UI/UX developer",
  "data analyst",
  "data scientist",
];

// 17 locations (US, UK, Canada, Europe, MENA)
const locations = [
  "Remote",
  "United States",
  "New York, NY",
  "San Francisco, CA",
  "Seattle, WA",
  "United Kingdom",
  "London, UK",
  "Canada",
  "Toronto, ON",
  "Germany",
  "Berlin, Germany",
  "Australia",
  "Netherlands",
  "Amsterdam, Netherlands",
  "Cairo, Egypt",
  "Dubai, UAE",
  "Riyadh, Saudi Arabia",
];

// Execution: 8 terms × 2 locations = 16 searches
```

**Rate Limiting**:

- Concurrency: 2 parallel detail fetches (reduced from 4 to avoid blocking)
- Between searches: 5-10 seconds (randomized)
- After error: 10 seconds
- Smart delays: Adaptive based on request count
- Max blocks: 3 consecutive empty results → stop scraper

**Date Parsing** (8 formats):

```typescript
"just posted" → today
"today" → today
"X hours ago" → now - X hours
"X days ago" → now - X days
"30+ days ago" → now - 30 days
"Active X days ago" → now - X days
"Posted X days ago" → now - X days
ISO date → parsed
```

**Selectors** (`indeed-selectors.json`):

```json
{
  "jobCard": [".job_seen_beacon", ".cardOutline", ".slider_item", "div[data-jk]"],
  "url": ["h2.jobTitle a", ".jcs-JobTitle", "a[data-jk]"],
  "detailTitle": [".jobsearch-JobInfoHeader-title", "h1[class*='jobTitle']"],
  "detailCompany": ["[data-company-name='true']", ".icl-u-lg-mr--sm"],
  "detailLocation": [".jobsearch-JobInfoHeader-subtitle > div:nth-child(2)"],
  "detailDescription": ["#jobDescriptionText", ".jobsearch-jobDescriptionText"],
  "detailDate": [".jobsearch-JobMetadataFooter", "span[class*='date']"],
  "detailSalary": [".icl-u-xs-mr--xs", "[id*='salaryInfoAndJobType']"]
}
```

**Key Implementation Details**:

- **CSS Cleanup**: Aggressive filtering to remove `.css-*` pollution
- **Company Extraction**: Multiple strategies (data attributes, links, fallbacks)
- **Description Extraction**: 3-strategy approach (specific selectors → containers → fallback)
- **CAPTCHA Detection**: Checks for verification/blocking pages
- **Blocking Prevention**: Stops after 3 consecutive failures

---

### **LinkedIn Scraper** (`src/scrapers/linkedin-scraper.ts`)

**Status**: ✅ Complete (reference implementation)

**Quality Metrics**:

- 40-60 jobs/session
- 95%+ detail page success
- 15-25 skills/job
- 2000+ char descriptions

**Search Strategy**:

```typescript
// 8 search terms
const searchTerms = [
  "software developer",
  "frontend developer",
  "backend developer",
  "full stack developer",
  "javascript developer",
  "react developer",
  "python developer",
  "node.js developer",
];

// 12 locations (global + MENA)
const locations = [
  "Remote",
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Australia",
  "Netherlands",
  "France",
  "Egypt",
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
];

// Execution: 5 terms × 2 locations = 10 searches
```

**URL Structure**:

```
https://www.linkedin.com/jobs/search?
  keywords={term}&
  location={loc}&
  f_TPR={time}&       // Time filter (r86400=24h, r259200=3d)
  f_JT=F&             // Full-time only
  sortBy=DD           // Sort by date (newest first)
```

**Rate Limiting**:

- Concurrency: 4 parallel detail fetches
- Smart delays: 2-10 seconds (adaptive)
- 7-day freshness filter

**Date Parsing** (English + French):

```typescript
// English
"5 minutes ago" → 5 min before now
"2 hours ago" → 2 hours before now
"3 days ago" → 3 days before now
"1 week ago" → 1 week before now

// French
"il y a 5 minutes" → 5 min before now
"il y a 2 heures" → 2 hours before now
"il y a 3 jours" → 3 days before now
"il y a 1 semaine" → 1 week before now
```

---

### **Wuzzuf Scraper** (`src/scrapers/wuzzuf-scraper.ts`)

**Status**: ✅ Complete (MENA champion)

**Quality Metrics**:

- 30-50 jobs/session
- 95%+ detail page success
- 10-15 skills/job
- 4000+ char descriptions (excellent)

**Focus**: Egypt + MENA region
**Strengths**: Accurate skill extraction, full descriptions, bilingual date parsing (English + Arabic)
**Rate Limiting**: 3 parallel detail fetches (regional site)

---

### **Glassdoor Scraper** (`src/scrapers/glassdoor-scraper.ts`)

**Status**: ⚠️ Limited (detail pages blocked)

**Challenges**:

- Detail pages 100% blocked by anti-bot
- Forced to use search page snippets only
- 200-char descriptions (vs 2000+ on Indeed)
- 3-5 skills/job (vs 15-30 on Indeed)

**Rate Limiting**: 10-15 second delays (aggressive)

---

### **Bayt Scraper** (`src/scrapers/bayt-scraper.ts`)

**Status**: ✅ Complete (MENA coverage)

**Focus**: Middle East job market
**Critical Fix**: 7-day freshness filter added (was scraping 30+ day old jobs)

---

## 🛡️ Anti-Detection System

### **Browser Launch Options**

```typescript
{
  headless: "new",                    // New headless mode (faster)
  defaultViewport: randomViewport,    // 1920x1080 to 1024x768
  protocolTimeout: 60000,             // 60 sec timeout
  args: [
    "--no-sandbox",                   // Security bypass for scraping
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",        // Prevent memory issues
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
    "--disable-features=VizDisplayCompositor",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-images",               // Don't load images (faster)
    "--disable-blink-features=AutomationControlled",
    "--user-agent=" + randomUserAgent
  ]
}
```

### **Request Interception**

```typescript
page.on("request", (req) => {
  const resourceType = req.resourceType();
  if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
    req.abort(); // Block images, CSS, fonts, media
  } else {
    req.continue(); // Allow HTML, scripts, XHR
  }
});
```

### **Human Behavior Simulation**

```typescript
// Random mouse movement
await page.mouse.move(randomX, randomY);

// Random scrolling
await page.evaluate(() => window.scrollBy(0, randomAmount));

// Sometimes scroll back up (70% chance)
if (Math.random() > 0.7) {
  await page.evaluate(() => window.scrollTo(0, 0));
}
```

### **Session Lifecycle**

```
1. Create session (first request)
   ├─ Random user agent
   ├─ Random viewport
   └─ Initialize request count = 0

2. Use session (subsequent requests)
   ├─ Increment request count
   ├─ Update lastUsed timestamp
   └─ Check limits (max 25 requests)

3. Session expiration (triggers)
   ├─ >25 requests → create new session
   ├─ >30 min old → create new session
   ├─ Marked as blocked → create new session
   └─ Browser disconnected → create new session

4. Cleanup (every 5 min)
   ├─ Close old browsers (>60 min unused)
   └─ Clear expired cache entries
```

---

## 💾 Database Schema

### **Jobs Table**

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,               -- Format: "source_md5hash"
  title TEXT NOT NULL,               -- "Senior React Developer"
  company TEXT NOT NULL,             -- "TechCorp Inc"
  location TEXT NOT NULL,            -- "Remote" or "New York, NY"
  description TEXT,                  -- Full job description (2000+ chars)
  url TEXT UNIQUE NOT NULL,          -- Job posting URL
  salary TEXT,                       -- "$120k - $150k" (optional)
  skills TEXT,                       -- JSON array ["React", "TypeScript", ...]
  jobType TEXT,                      -- "full-time", "remote", etc.
  source TEXT NOT NULL,              -- "Indeed", "LinkedIn", "Wuzzuf"
  postedDate TEXT,                   -- ISO 8601 date
  extractedAt TEXT NOT NULL,         -- ISO 8601 date (scrape time)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Indexes**

```sql
CREATE INDEX idx_jobs_skills ON jobs(skills);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_posted_date ON jobs(postedDate);
CREATE INDEX idx_jobs_source ON jobs(source);
```

**Query Performance**:

- Skill search: O(log n) with index
- URL deduplication: O(1) with unique constraint
- Date filtering: O(log n) with index

---

## 🚀 API Endpoints

### **Health Check**

```http
GET /health
```

**Response**:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "scheduler": {
    "isRunning": true,
    "nextRun": "2025-10-30T00:00:00.000Z"
  }
}
```

### **Get All Jobs**

```http
GET /api/jobs?limit=100
```

**Response**:

```json
{
  "success": true,
  "count": 100,
  "jobs": [
    {
      "id": "indeed_a3f8c92b1e4d5f6a",
      "title": "Senior React Developer",
      "company": "TechCorp Inc",
      "location": "Remote",
      "description": "We are seeking...",
      "url": "https://indeed.com/viewjob?jk=abc123",
      "salary": "$120k - $150k",
      "skills": ["React", "TypeScript", "Node.js", "AWS", "Docker"],
      "jobType": "remote",
      "source": "Indeed",
      "postedDate": "2025-10-27T00:00:00.000Z",
      "extractedAt": "2025-10-29T12:00:00.000Z"
    }
  ]
}
```

### **Get Jobs by Skills**

```http
GET /api/jobs/skills/React,TypeScript?limit=50
```

**Response**: Same as above, filtered by skills

### **Advanced Search**

```http
POST /api/jobs/search
Content-Type: application/json

{
  "skills": ["React", "Node.js"],
  "location": "Remote",
  "jobType": "full-time"
}
```

### **Statistics**

```http
GET /api/stats
```

**Response**:

```json
{
  "success": true,
  "stats": {
    "total": 1247,
    "bySource": {
      "Indeed": 687,
      "LinkedIn": 342,
      "Wuzzuf": 158,
      "Glassdoor": 60
    }
  },
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

### **Manual Refresh**

```http
POST /api/jobs/refresh
```

**Response**:

```json
{
  "success": true,
  "message": "Job refresh completed",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

### **Get Available Skills**

```http
GET /api/skills
```

**Response**:

```json
{
  "success": true,
  "count": 152,
  "skills": ["React", "TypeScript", "JavaScript", "Node.js", "AWS", ...]
}
```

---

## 🛠️ Development Workflow

### **Installation**

```bash
npm install
```

### **Development Mode**

```bash
npm run dev
# Runs src/index.ts with ts-node
# Starts API server on port 3000
# Starts cron scheduler
# Scrapes jobs immediately on start
```

### **Build**

```bash
npm run build
# Compiles TypeScript → dist/
# Copies *-selectors.json → dist/scrapers/
```

### **Production**

```bash
npm start
# Runs dist/index.js (compiled)
```

### **Scheduler Only**

```bash
npm run scheduler
# Runs cron scheduler without API server
```

### **Environment Variables**

```bash
PORT=3000                    # API server port (default: 3000)
BYPASS_CACHE=true            # Bypass anti-detection cache (default: false)
```

### **File Locations**

- **Database**: `jobs.db` (root directory)
- **Selectors**: `src/scrapers/*-selectors.json`
- **Compiled**: `dist/` (after build)

---

## 🎯 Key Patterns & Best Practices

### **1. Selector-Driven Architecture**

**WHY**: HTML changes frequently → avoid hardcoding selectors in code

**IMPLEMENTATION**:

```typescript
// ✅ GOOD: Selectors in JSON (easy to update)
private selectors = this.loadSelectors(); // From indeed-selectors.json

// ❌ BAD: Hardcoded selectors
const title = $('h1.job-title').text();
```

**BENEFIT**: Update selectors without touching code when site changes

---

### **2. Fallback Selectors**

**WHY**: Sites change HTML, need multiple backup selectors

**IMPLEMENTATION**:

```json
{
  "detailTitle": [
    ".jobsearch-JobInfoHeader-title", // Primary
    "h1[class*='jobTitle']", // Backup 1
    ".icl-u-xs-mb--xs", // Backup 2
    "h1" // Fallback (any h1)
  ]
}
```

```typescript
private extractText($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text; // Return first match
  }
  return ""; // All failed
}
```

---

### **3. Incremental Processing**

**WHY**: Don't lose all jobs if scraper crashes halfway through

**IMPLEMENTATION**:

```typescript
// ✅ GOOD: Save each job immediately via callback
for (const url of jobUrls) {
  const job = await scrapeJobDetails(url);
  await onJobScraped(job); // Callback → immediate DB save
}

// ❌ BAD: Batch all jobs, save at end
const jobs = await Promise.all(jobUrls.map(scrapeJobDetails));
await saveAllJobs(jobs); // Loses everything if crash before this
```

---

### **4. Deduplication Strategy**

**WHY**: Avoid duplicate jobs in database

**LAYERS**:

1. **In-Memory Cache** (Set) → O(1) lookup, fast
2. **Database URL Check** → Slower but persistent
3. **Signature-Based** → title + company (normalized)

**IMPLEMENTATION**:

```typescript
const signature = `${normalizedTitle.slice(0, 3)}::${normalizedCompany}`;

// Check memory first (fast)
if (jobSignatureCache.has(signature)) return; // Duplicate

// Check database (slower, but accurate)
const exists = await database.jobExists(job.url);
if (exists) {
  jobSignatureCache.add(signature); // Cache for future
  return; // Duplicate
}

// New job - save it
jobSignatureCache.add(signature);
await database.saveJob(job);
```

---

### **5. Rate Limiting & Delays**

**WHY**: Avoid detection, prevent blocking

**STRATEGIES**:

1. **Smart Delays**: Increase with request count (2s → 10s)
2. **Randomization**: +/- 50% randomness
3. **Concurrency Limits**: Max 2-4 parallel requests
4. **Browser Limits**: Max 2 simultaneous browsers
5. **Session Cooldown**: 30-min reset

**IMPLEMENTATION**:

```typescript
// Between searches: 5-10 seconds (randomized)
const delay = 5000 + Math.random() * 5000;
await sleep(delay);

// Smart delay (adaptive)
const smartDelay = antiDetection.getSmartDelay(domain);
// 2s base × (1 + requestCount/10) × (0.5-1.5 random)
```

---

### **6. Browser Concurrency Control**

**WHY**: Too many browsers → timeouts, crashes

**IMPLEMENTATION**:

```typescript
private activeBrowsers = 0;
private readonly MAX_CONCURRENT_BROWSERS = 2;

// Wait if too many browsers active
while (this.activeBrowsers >= this.MAX_CONCURRENT_BROWSERS) {
  console.log(`⏳ Waiting for browser slot...`);
  await sleep(2000);
}

this.activeBrowsers++;
try {
  browser = await puppeteer.launch(...);
  // ... use browser
} finally {
  this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);
}
```

---

### **7. Graceful Error Handling**

**WHY**: One failed job shouldn't stop entire scraper

**IMPLEMENTATION**:

```typescript
// ✅ GOOD: Catch errors per job, continue
for (const url of jobUrls) {
  try {
    const job = await scrapeJobDetails(url);
    await onJobScraped(job);
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    // Continue to next job
  }
}

// ❌ BAD: Let errors propagate, stop scraper
const jobs = await Promise.all(jobUrls.map(scrapeJobDetails));
// One error kills everything
```

---

### **8. Date Parsing with Fallbacks**

**WHY**: Sites use inconsistent date formats

**IMPLEMENTATION**:

```typescript
private parseDate(dateText: string): Date | null {
  // Strategy 1: Relative dates
  if (dateText.includes("today")) return new Date();

  // Strategy 2: "X days ago"
  const match = dateText.match(/(\d+)\s*days?\s*ago/);
  if (match) return new Date(Date.now() - days * 86400000);

  // Strategy 3: ISO date
  try {
    return new Date(dateText);
  } catch (e) {}

  // Fallback: Recent date (within filter range)
  console.warn(`Could not parse date: ${dateText}`);
  return new Date(Date.now() - 3 * 86400000); // 3 days ago
}
```

---

## 📚 Future Scraper Implementation Guide

**Use this guide when implementing new scrapers (e.g., Monster, SimplyHired, ZipRecruiter)**

### **Step 1: Analyze Target Site**

1. **Visit job search page** (e.g., `https://www.monster.com/jobs/search?q=software+engineer&l=remote`)
2. **Inspect job cards**: Find CSS selectors for job links
3. **Visit job detail page**: Find selectors for title, company, location, description, date, salary
4. **Test date formats**: Check various job ages ("today", "2 days ago", "30+ days ago")
5. **Check anti-bot**: Does it require browser? JavaScript rendering?

---

### **Step 2: Create Selector Config**

Create `src/scrapers/{site}-selectors.json`:

```json
{
  "jobCard": [".primary-selector", ".backup-selector", "div[data-attribute]"],
  "url": ["a.job-link", "h2 > a"],
  "detailTitle": ["h1.job-title", ".title", "h1"],
  "detailCompany": [".company-name", "a[data-company]"],
  "detailLocation": [".job-location", "span[data-location]"],
  "detailDescription": [".job-description", "#description", "div[class*='description']"],
  "detailDate": [".posted-date", "time", "span[class*='date']"],
  "detailSalary": [".salary", "span[class*='salary']"]
}
```

---

### **Step 3: Create Scraper Class**

Create `src/scrapers/{site}-scraper.ts`:

```typescript
import { BaseScraper } from "./base-scraper";
import { ScrapingResult, Job } from "../types/job.types";
import { AntiDetectionManager } from "./anti-detection";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface MonsterSelectors {
  jobCard: string[];
  url: string[];
  detailTitle: string[];
  detailCompany: string[];
  detailLocation: string[];
  detailDescription: string[];
  detailDate: string[];
  detailSalary: string[];
}

export class MonsterScraper extends BaseScraper {
  protected sourceName = "Monster";
  protected baseUrl = "https://www.monster.com";
  private antiDetection: AntiDetectionManager;
  private bypassCache: boolean = false;
  private selectors: MonsterSelectors;
  private readonly MAX_JOB_AGE_DAYS = 7;
  private readonly CONCURRENCY_LIMIT = 4;

  constructor(bypassCache: boolean = false) {
    super();
    this.antiDetection = new AntiDetectionManager();
    this.bypassCache = bypassCache;
    this.selectors = this.loadSelectors();
  }

  private loadSelectors(): MonsterSelectors {
    const filePath = path.join(__dirname, "monster-selectors.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  }

  protected async fetchPage(url: string): Promise<string> {
    const domain = "monster.com";
    try {
      if (!this.bypassCache) {
        const cached = this.antiDetection.getCachedResponse(url);
        if (cached) return cached;
      }

      const html = await this.antiDetection.fetchPageWithBrowser(url, domain);

      if (!this.bypassCache) {
        this.antiDetection.setCachedResponse(url, html);
      }

      return html;
    } catch (error) {
      console.error(`Failed to fetch Monster page:`, error);
      this.antiDetection.updateSession(domain, [], true);
      throw error;
    }
  }

  private buildSearchUrl(term: string, loc: string): string {
    // Example: https://www.monster.com/jobs/search?q=software+engineer&where=remote&page=1
    const encodedTerm = encodeURIComponent(term);
    const encodedLoc = encodeURIComponent(loc);
    return `${this.baseUrl}/jobs/search?q=${encodedTerm}&where=${encodedLoc}&page=1`;
  }

  private extractText($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 0) return text;
    }
    return "";
  }

  private async scrapeJobUrls(searchUrl: string): Promise<string[]> {
    try {
      const html = await this.fetchPage(searchUrl);
      const $ = cheerio.load(html);
      const jobUrls: string[] = [];

      const jobCardSelector = this.selectors.jobCard.join(", ");
      const cards = $(jobCardSelector);

      console.log(`   Found ${cards.length} job cards`);

      cards.each((_, element) => {
        const $card = $(element);
        let url: string | undefined;

        for (const sel of this.selectors.url) {
          url = $card.find(sel).attr("href");
          if (url) break;
        }

        if (!url) return;

        // Clean URL
        if (url.startsWith("/")) {
          url = `${this.baseUrl}${url}`;
        }

        // Remove query parameters (keep only job ID)
        const cleanUrl = url.split("?")[0];
        jobUrls.push(cleanUrl);
      });

      console.log(`   Extracted ${jobUrls.length} job URLs`);
      return jobUrls;
    } catch (error) {
      console.error(`Failed to scrape job URLs:`, error);
      return [];
    }
  }

  private async scrapeJobDetails(jobUrl: string): Promise<Job | null> {
    try {
      const html = await this.fetchPage(jobUrl);
      const $ = cheerio.load(html);

      const title = this.extractText($, this.selectors.detailTitle);
      if (!title) return null;

      const company = this.extractText($, this.selectors.detailCompany) || "N/A";
      const location = this.extractText($, this.selectors.detailLocation) || "Remote";
      let description = this.extractText($, this.selectors.detailDescription);

      if (!description || description.length < 50) {
        description = `${title} position at ${company}.`;
      }

      const dateStr = this.extractText($, this.selectors.detailDate);
      const postedDate = this.parseMonsterDate(dateStr) || new Date(Date.now() - 3 * 86400000);

      const salary = this.extractText($, this.selectors.detailSalary);

      const job = this.createJob({
        title,
        company,
        location,
        description,
        url: jobUrl,
        salary: salary || undefined,
        postedDate,
      });

      return job;
    } catch (error) {
      console.error(`Failed to scrape job details:`, error);
      return null;
    }
  }

  private parseMonsterDate(dateText: string): Date | null {
    if (!dateText) return null;

    const now = new Date();
    const lower = dateText.toLowerCase();

    if (lower.includes("today") || lower.includes("just posted")) {
      return now;
    }

    const daysMatch = lower.match(/(\d+)\s*days?\s*ago/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return new Date(now.getTime() - days * 86400000);
    }

    const hoursMatch = lower.match(/(\d+)\s*hours?\s*ago/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      return new Date(now.getTime() - hours * 3600000);
    }

    return null;
  }

  public async scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult> {
    try {
      const jobUrlCache = new Set<string>();
      let totalFound = 0;

      console.log("🔍 Starting Monster job scraping...");

      const searchTerms = [
        "software engineer",
        "frontend developer",
        "backend developer",
        "full stack developer",
        "react developer",
      ];

      const locations = ["Remote", "United States", "New York, NY", "San Francisco, CA"];

      const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
      const shuffledLocs = [...locations].sort(() => Math.random() - 0.5);

      for (const term of shuffledTerms.slice(0, 3)) {
        for (const loc of shuffledLocs.slice(0, 2)) {
          try {
            console.log(`🎯 Searching Monster for: "${term}" in "${loc}"`);

            const searchUrl = this.buildSearchUrl(term, loc);
            const jobUrls = await this.scrapeJobUrls(searchUrl);

            const newUrls = jobUrls.filter((url) => !jobUrlCache.has(url));
            newUrls.forEach((url) => jobUrlCache.add(url));

            console.log(`   Processing ${newUrls.length} new jobs`);

            for (let i = 0; i < newUrls.length; i += this.CONCURRENCY_LIMIT) {
              const batch = newUrls.slice(i, i + this.CONCURRENCY_LIMIT);
              const promises = batch.map((url) => this.scrapeJobDetails(url));
              const results = await Promise.all(promises);

              for (const job of results) {
                if (job) {
                  const jobAgeDays = (new Date().getTime() - job.postedDate.getTime()) / 86400000;

                  if (jobAgeDays <= this.MAX_JOB_AGE_DAYS) {
                    await onJobScraped(job);
                    totalFound++;
                    console.log(`   ✅ Saved: "${job.title}" at ${job.company}`);
                  }
                }
              }

              await this.sleep(this.antiDetection.getSmartDelay("monster.com") + 1000);
            }

            await this.sleep(3000 + Math.random() * 2000);
          } catch (error) {
            console.error(`Error searching Monster:`, error);
          }
        }
      }

      console.log(`🎉 Monster scraping completed. Found ${totalFound} jobs.`);

      return {
        jobs: [],
        source: this.sourceName,
        success: totalFound > 0,
        totalFound,
      };
    } catch (error) {
      console.error("Monster scraper error:", error);
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
```

---

### **Step 4: Register Scraper**

Edit `src/services/job-aggregator.ts`:

```typescript
import { MonsterScraper } from "../scrapers/monster-scraper";

this.scrapers = [
  new IndeedScraper(bypassCache),
  new MonsterScraper(bypassCache), // ← Add here
  // ... other scrapers
];
```

---

### **Step 5: Test**

```bash
npm run dev
# Watch logs for "Starting Monster job scraping..."
# Verify jobs are being saved
# Check for errors/blocking
```

---

### **Step 6: Optimize**

1. **Adjust concurrency** (2-4 parallel based on site tolerance)
2. **Tune delays** (3-10 seconds between searches)
3. **Add more search terms** (expand coverage)
4. **Add more locations** (global reach)
5. **Improve selectors** (add fallbacks if site changes)

---

## 🎓 Summary

**Career Crawler** is a production-ready job aggregation system with:

- ✅ **5 scrapers** (Indeed ⭐, LinkedIn, Wuzzuf, Glassdoor, Bayt)
- ✅ **200+ skill patterns** (comprehensive tech stack coverage)
- ✅ **Advanced anti-detection** (Puppeteer + Stealth + session management)
- ✅ **Smart rate limiting** (adaptive delays, concurrency control)
- ✅ **REST API** (7 endpoints with filters)
- ✅ **Automated scheduling** (cron-based)
- ✅ **SQLite database** (indexed, optimized)

**Best Scraper**: Indeed (50-100 jobs, 15-30 skills, 95%+ success rate)

**Architecture Pattern**: Two-phase (search → details), incremental processing, selector-driven

**Key Features**:

- Deduplication (memory + database)
- Freshness filtering (7-10 days)
- Global coverage (US, UK, Canada, Europe, MENA)
- Skill extraction (languages, frameworks, tools, cloud, DevOps, data science)

**Use This Document** to:

- 🔍 Understand project architecture quickly
- 🛠️ Implement new scrapers (follow the guide)
- 🐛 Debug issues (reference patterns)
- 📚 Onboard new developers

---

**Last Updated**: October 29, 2025  
**Status**: ✅ Production Ready  
**Maintained By**: @amrrdev
