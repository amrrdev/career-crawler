# Job Posting Aggregator

This is a job posting aggregator that scrapes job listings from LinkedIn and Wuzzuf. It uses advanced anti-detection techniques with Puppeteer, extracts skills from job descriptions, and provides a REST API for accessing job data.

## 🎯 LinkedIn Scraper - Complete Technical Documentation

### Architecture Overview

The LinkedIn scraper uses a **two-phase approach**:

1. **Phase 1**: Scrape job listing pages to collect job URLs
2. **Phase 2**: Visit each job URL to extract detailed information

This approach is more reliable than trying to extract all data from listing pages.

### Core Components

#### 1. LinkedInScraper Class (`src/scrapers/linkedin-scraper.ts`)

**Extends**: `BaseScraper`
**Purpose**: Orchestrates LinkedIn job scraping using Puppeteer-based browser automation

**Key Properties**:

- `sourceName`: "LinkedIn" (identifies scraper in database)
- `baseUrl`: "https://www.linkedin.com"
- `antiDetection`: Instance of `AntiDetectionManager` (handles browser sessions, rate limiting, caching)
- `bypassCache`: Boolean flag to force fresh fetches (default: false)
- `selectors`: Loaded from `linkedin-selectors.json` (CSS selectors for DOM extraction)
- `MAX_JOB_AGE_DAYS`: 7 (filters jobs older than 7 days)
- `CONCURRENCY_LIMIT`: 4 (parallel job detail fetches)

**Constructor**:

```typescript
constructor(bypassCache: boolean = false)
```

- Initializes `AntiDetectionManager`
- Loads selectors from JSON file
- Sets up cleanup interval (5 minutes) to close old browser sessions

#### 2. Search URL Building (`buildSearchUrl`)

**Purpose**: Constructs LinkedIn job search URLs with parameters

**Parameters**:

- `term`: Job search keyword (e.g., "software developer")
- `loc`: Location (e.g., "Remote", "United States")
- `searchCount`: Used to rotate time ranges

**URL Structure**:

```
https://www.linkedin.com/jobs/search?keywords=<term>&location=<loc>&f_TPR=<time>&f_JT=F&sortBy=DD
```

**Query Parameters**:

- `keywords`: Job title/keyword
- `location`: Geographic location
- `f_TPR`: Time filter - rotates between:
  - `r86400`: Last 24 hours
  - `r259200`: Last 3 days
- `f_JT=F`: Full-time jobs only
- `sortBy=DD`: Sort by date (newest first)

#### 3. Selector System (`linkedin-selectors.json`)

**Job Card Selectors** (for finding jobs on listing pages):

```json
"jobCard": [
  "[data-entity-urn*='jobPosting']",    // Primary: LinkedIn's data attribute
  ".job-search-card:has(a[href*='/jobs/view/'])",  // Backup: Card with job link
  ".jobs-search-results__list-item",     // Backup: List item
  ".job-result-card"                     // Backup: Result card
]
```

**URL Extraction Selector**:

```json
"url": ["a[href*='/jobs/view/']"]  // Links containing job view URLs
```

**Detail Page Selectors** (for extracting from individual job pages):

```json
"detailTitle": [
  ".top-card-layout__title",                          // Primary
  ".job-details-jobs-unified-top-card__job-title",   // Backup
  "h1.jobs-unified-top-card__job-title"              // Backup
],
"detailCompany": [
  ".top-card-layout__second-subline a",              // Company link
  ".job-details-jobs-unified-top-card__company-name a"
],
"detailLocation": [
  ".top-card-layout__second-subline",
  ".job-details-jobs-unified-top-card__primary-description-container"
],
"detailDescription": [
  ".description__text",
  "#job-details",
  ".jobs-description__content"
],
"detailDate": [
  ".posted-time-ago__text",
  ".job-details-jobs-unified-top-card__posted-date"
]
```

**How Selectors Work**:

- Tries each selector in order until one returns data
- If primary selector fails, falls back to alternates
- Returns empty string if all fail

#### 4. Page Fetching (`fetchPage`)

**Purpose**: Fetches HTML using Puppeteer browser automation

**Process**:

1. Check cache (unless `bypassCache=true`)
2. Call `antiDetection.fetchPageWithBrowser(url, domain)`
3. Cache response (unless `bypassCache=true`)
4. Return HTML string

**Anti-Detection Features** (handled by `AntiDetectionManager`):

- Rotates user agents (Chrome, Firefox, Safari, Edge)
- Randomizes viewport sizes (1920x1080, 1366x768, etc.)
- Simulates human behavior (mouse movements, scrolling)
- Blocks unnecessary resources (images, CSS, fonts)
- Implements smart delays based on request count
- Manages browser sessions to avoid detection

#### 5. Job URL Scraping (`scrapeJobUrls`)

**Purpose**: Extract job URLs from search result pages

**Process**:

1. Fetch search page HTML
2. Load HTML into Cheerio (jQuery-like parser)
3. Find all job cards using `jobCard` selectors
4. For each card, extract URL using `url` selector
5. Clean URLs (remove query parameters after `?`)
6. Return unique URLs

**Example**:

```typescript
// Input: https://www.linkedin.com/jobs/search?keywords=developer
// Finds: <div data-entity-urn="urn:li:jobPosting:123">
//          <a href="/jobs/view/123?refId=xyz"></a>
//        </div>
// Extracts: "/jobs/view/123"
// Cleans: "/jobs/view/123" (removes ?refId=xyz)
```

#### 6. Job Detail Scraping (`scrapeJobDetails`)

**Purpose**: Extract full job information from individual job pages

**Process**:

1. Fetch job page HTML
2. Load into Cheerio
3. Extract fields using `extractText` helper:
   - **Title** (required - returns null if missing)
   - **Company** (defaults to "N/A" if missing)
   - **Location** (required)
   - **Description** (required)
   - **Date** (parses relative dates like "2 days ago")
4. Parse date string into Date object
5. Call `createJob` from `BaseScraper` to create Job object

**Text Extraction** (`extractText`):

```typescript
// Tries multiple selectors until one returns text
for (const selector of selectors) {
  const text = $element.find(selector).first().text().trim();
  if (text) return text; // Return first match
}
return ""; // All failed
```

#### 7. Date Parsing (`parseLinkedInDate`)

**Purpose**: Convert relative date strings to Date objects

**Supported Formats**:

**English**:

- "5 minutes ago" → 5 minutes before now
- "2 hours ago" → 2 hours before now
- "3 days ago" → 3 days before now
- "1 week ago" → 1 week before now

**French**:

- "il y a 5 minutes" → 5 minutes before now
- "il y a 2 heures" → 2 hours before now
- "il y a 3 jours" → 3 days before now
- "il y a 1 semaine" → 1 week before now

**Implementation**:

```typescript
const englishMatch = lowerDate.match(/(\d+)\s*(minute|hour|day|week)s?/);
// Extracts: ["2 hours", "2", "hour"]
// Calculates: now - (2 * 60 * 60 * 1000)
```

#### 8. Main Scraping Loop (`scrapeJobs`)

**Purpose**: Orchestrate entire scraping process

**Process**:

1. **Setup**:

   ```typescript
   const jobUrlCache = new Set<string>(); // Prevent duplicates
   let totalFound = 0;
   ```

2. **Define Search Parameters**:

   ```typescript
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
   ```

3. **Randomize & Limit**:

   ```typescript
   const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
   const shuffledTerms = [...searchTerms].sort(() => Math.random() - 0.5);
   const locationsToUse = shuffledLocations.slice(0, 4); // Use 4 locations
   ```

4. **Nested Loop** (Terms × Locations):

   ```typescript
   for (const term of shuffledTerms.slice(0, 5)) {        // 5 terms max
     for (const loc of locationsToUse.slice(0, 2)) {      // 2 locations per term
       if (searchCount >= maxSearches) break;              // Max 10 searches total
   ```

5. **For Each Search**:

   - Build search URL
   - Scrape job URLs from listing page
   - Filter out duplicates (check `jobUrlCache`)
   - Add new URLs to cache

6. **Batch Processing** (Concurrency Control):

   ```typescript
   for (let i = 0; i < newUrls.length; i += CONCURRENCY_LIMIT) {
     const batch = newUrls.slice(i, i + CONCURRENCY_LIMIT);  // 4 jobs at a time
     const promises = batch.map(url => scrapeJobDetails(url));
     const results = await Promise.all(promises);            // Parallel fetch
   ```

7. **Job Processing**:

   ```typescript
   for (const job of results) {
     if (job) {
       // Calculate age
       const jobAgeDays = (new Date().getTime() - job.postedDate.getTime()) / (1000 * 3600 * 24);

       // Only save fresh jobs
       if (jobAgeDays <= MAX_JOB_AGE_DAYS) {
         await onJobScraped(job); // Callback to save job
         totalFound++;
       }
     }
   }
   ```

8. **Rate Limiting**:
   ```typescript
   await this.sleep(this.antiDetection.getSmartDelay("linkedin.com") + 1000);
   // Smart delay increases with request count (2s-10s typically)
   ```

### 9. AntiDetectionManager (`src/scrapers/anti-detection.ts`)

**Purpose**: Manage browser sessions, prevent detection, implement rate limiting

**Key Features**:

**Session Management**:

```typescript
interface ScrapingSession {
  cookies: string[]; // Stored cookies
  userAgent: string; // Randomized user agent
  lastUsed: Date; // Last request time
  requestCount: number; // Requests in this session
  blocked: boolean; // If detected/blocked
  browser?: Browser; // Puppeteer browser instance
  viewport: { width; height }; // Random viewport size
}
```

**User Agent Rotation** (11 different user agents):

- Chrome Windows (120, 119, 118)
- Chrome macOS (120, 119)
- Firefox Windows (120, 119)
- Firefox macOS (120)
- Safari macOS (17.1, 17.0)
- Edge Windows (120)

**Viewport Rotation** (7 common resolutions):

- 1920×1080, 1366×768, 1440×900, 1536×864
- 1280×720, 1600×900, 1024×768

**Browser Launch Options**:

```typescript
args: [
  "--no-sandbox", // Security bypass for scraping
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage", // Prevent memory issues
  "--disable-accelerated-2d-canvas", // Reduce resource usage
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
  "--disable-features=VizDisplayCompositor",
  "--disable-extensions",
  "--disable-plugins",
  "--disable-images", // Don't load images (faster)
  "--disable-javascript", // Don't run JS (content already rendered)
  "--user-agent=" + session.userAgent,
];
```

**Request Interception** (blocks unnecessary resources):

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

**Human Behavior Simulation**:

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

**Smart Delay Calculation**:

```typescript
baseDelay = 2000ms  // 2 seconds minimum
requestMultiplier = min(requestCount / 10, 3)  // Max 3x
randomFactor = 0.5 to 1.5  // Randomness
finalDelay = baseDelay × (1 + requestMultiplier) × randomFactor
// Results in 1s-10s delays depending on activity
```

**Caching System**:

- Stores responses for 10 minutes
- Prevents re-fetching same URLs
- Configurable via `bypassCache` flag

**Rate Limiting**:

- Max 25 requests per session
- 30-minute session cooldown
- Blocks requests if session is marked as blocked
- Enforces minimum time between requests

### 10. BaseScraper (`src/scrapers/base-scraper.ts`)

**Purpose**: Provides common functionality for all scrapers

**Key Methods**:

**`createJob(data)`**: Constructs a Job object

- Cleans text (removes newlines, extra spaces)
- Extracts skills from title + description + company
- Determines job type (full-time, part-time, contract, remote)
- Generates unique job ID (MD5 hash of URL + title)
- Combines skills from all sources (deduplicates)

**`extractSkillsFromText(text)`**: AI-powered skill extraction

- 300+ skill patterns across categories:
  - Programming languages (JS, Python, Java, etc.)
  - Frontend frameworks (React, Angular, Vue)
  - Backend frameworks (Node.js, Django, Spring)
  - Databases (MySQL, PostgreSQL, MongoDB)
  - Cloud platforms (AWS, Azure, GCP)
  - DevOps tools (Docker, Kubernetes, Jenkins)
  - Mobile (React Native, Flutter, iOS, Android)
  - Testing (Jest, Cypress, Selenium)
  - APIs (REST, GraphQL)
  - Methodologies (Agile, Scrum, DevOps)
- Uses regex patterns with variations
- Example: `/\breact\b/, /\breactjs\b/, /\breact\.js\b/, /\breact\s*native\b/`

**`determineJobType(text)`**: Classifies job type

- Checks for keywords in title + description
- Priority: internship → contract → part-time → remote → full-time

**`cleanText(text)`**: Normalizes text

- Removes newlines, tabs, carriage returns
- Collapses multiple spaces
- Removes special characters
- Trims whitespace

**`generateJobId(url, title)`**: Creates unique identifier

- MD5 hash of: `url + title`
- Prefixed with source name
- Example: `linkedin_a3f8c92b1e4d5f6a7b8c9d0e1f2a3b4c`

### How It All Works Together

1. **Job Aggregator** calls `linkedInScraper.scrapeJobs(onJobScraped)`
2. **LinkedInScraper** loops through search terms × locations
3. For each search:
   - Builds search URL with filters
   - Fetches listing page via **AntiDetectionManager**
   - Extracts job URLs using **Cheerio** + **selectors**
   - Batches URLs (4 at a time)
   - Fetches each job detail page via **AntiDetectionManager**
   - Extracts job data using **selectors**
   - Parses dates (handles English/French)
   - Creates Job object via **BaseScraper.createJob**
   - Extracts skills via **BaseScraper.extractSkillsFromText**
   - Filters by age (≤7 days)
   - Calls `onJobScraped(job)` → saves to database
4. **AntiDetectionManager** handles:
   - Browser session management
   - User agent rotation
   - Viewport randomization
   - Request interception (block images/CSS)
   - Human behavior simulation
   - Rate limiting & delays
   - Caching (10-minute TTL)

### Configuration

**Search Parameters** (in `scrapeJobs`):

- `searchTerms`: 8 job titles
- `locations`: 12 locations (global coverage)
- `maxSearches`: 10 searches total
- Terms per run: 5 (randomized)
- Locations per term: 2 (randomized)

**Rate Limiting**:

- Concurrency: 4 parallel job detail fetches
- Base delay: 2 seconds
- Smart delay: 2-10 seconds (adaptive)
- Session limit: 25 requests
- Session cooldown: 30 minutes

**Filtering**:

- Job age: ≤7 days
- Job type: Full-time only (f_JT=F)
- Time range: Rotates between 24h and 3 days

### Error Handling

**Fetch Errors**:

- Retries with new browser session on timeout
- Marks session as blocked on network errors
- Falls back to next selector if extraction fails

**Parsing Errors**:

- Returns null if title missing (required field)
- Defaults company to "N/A" if missing
- Warns on unparseable dates, uses current date

**Browser Errors**:

- Closes crashed browsers automatically
- Launches new browser on connection loss
- Cleans up stale sessions every 5 minutes

### Database Integration

Jobs are saved via callback:

```typescript
await onJobScraped(job); // Defined in JobAggregator
```

The aggregator:

1. Generates job signature (title + company)
2. Checks for duplicates
3. Saves to SQLite database
4. Tracks statistics (total fetched, saved, duplicates)

### Performance

**Typical Run**:

- 10 searches (5 terms × 2 locations)
- ~150-300 job URLs found
- ~100-200 jobs after deduplication
- ~50-100 jobs after age filter
- Total time: 15-30 minutes
- Average: 3-5 jobs/minute

**Optimization**:

- Batch processing (4 concurrent)
- Response caching (10 min TTL)
- Resource blocking (images, CSS)
- Duplicate detection (URL cache)
