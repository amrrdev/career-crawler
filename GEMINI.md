### Plan to Enhance LinkedIn Scraper

This plan outlines the steps to make the LinkedIn scraper more powerful, resilient, and accurate.

#### 1. **Configuration-Driven Selectors**
   - **Problem:** CSS selectors are hard-coded within the `scrapeJobs` method. When LinkedIn updates its HTML structure, the code must be changed.
   - **Solution:**
     - Create a `linkedin-selectors.json` file to store all CSS selectors.
     - The scraper will load this configuration file at runtime.
     - This allows for quick updates to selectors without deploying new code.
   - **Selector Strategy:**
     - Prioritize selectors based on `data-` attributes, `aria-label`, and other less-volatile attributes over generated class names.
     - For each data point (title, company, location), define an array of selectors to be tried in order of preference.

   **Example `linkedin-selectors.json`:**
   ```json
   {
     "jobCard": [".job-search-card", ".jobs-search__results-list li"],
     "title": ["h3 a", ".base-search-card__title a"],
     "company": [".job-search-card__subtitle-link", ".base-search-card__subtitle a"],
     "location": [".job-search-card__location", ".base-search-card__metadata"],
     "description": [".job-search-card__snippet", ".base-search-card__info"],
     "date": ["time", ".job-search-card__listdate"]
   }
   ```

#### 2. **Refactor `scrapeJobs` for Clarity**
   - **Problem:** The `scrapeJobs` method is very long and handles multiple responsibilities (building search URLs, iterating through selectors, extracting data).
   - **Solution:**
     - Break down the method into smaller, more focused functions:
       - `buildSearchUrl(term, location)`: Constructs the search URL.
       - `findJobElements($)`: Uses the configured selectors to find job card elements.
       - `extractJobData(element)`: Extracts all data for a single job posting. This function will iterate through the configured selectors for each field.
       - `scrapeAndProcessPage(url)`: Fetches a page and orchestrates the scraping process for that page.

#### 3. **Improve Data Extraction and Cleaning**
   - **Problem:** The current extraction logic has some fallback mechanisms, but it can be made more robust. Data cleaning is minimal.
   - **Solution:**
     - In `extractJobData`, for each field (e.g., `title`), loop through the corresponding selectors from the config file until a value is found.
     - Implement more thorough text cleaning in the `cleanText` utility in `base-scraper.ts`. For example, remove "new" indicators from dates, or "remote" from location strings if it's also a job type.
     - Enhance `parseLinkedInDate` to handle more date formats and edge cases.

#### 4. **Enhanced Anti-Detection and Error Handling**
   - **Problem:** The current anti-detection is good, but can be more proactive.
   - **Solution:**
     - **Puppeteer Integration:** The `anti-detection.ts` already has a `fetchPageWithBrowser` method using Puppeteer. The LinkedIn scraper should use this method instead of `fetch` to better mimic a real browser and handle JavaScript-rendered pages. This is a major step up in resilience.
     - **Smarter Retries:** When a request fails, especially due to rate limiting (429), the scraper should not just wait but also switch to a new session/proxy if available.
     - **Health Check:** Before starting a scraping run, make a simple request to `linkedin.com` to check for captchas or blocks. If a block is detected, abort the run or switch IP/session.

#### 5. **State Management**
   - **Problem:** The scraper is stateless, which is simple but limits its ability to recover from failures or perform long-running, multi-page scraping sessions.
   - **Solution (Advanced):**
     - Introduce a simple state management system. The main `scheduler.ts` could pass a state object to the scraper.
     - The scraper can then save its progress (e.g., last successfully scraped search term and location) to this state object.
     - If the scraper is restarted, it can resume from where it left off.

#### 6. **Testing with Fixtures**
   - **Problem:** Testing the scraper requires hitting the live LinkedIn site, which is slow, unreliable, and can lead to IP blocks.
   - **Solution:**
     - Create a `test/fixtures/linkedin` directory.
     - Save real HTML responses from LinkedIn job searches into files in this directory.
     - Create a test suite for `linkedin-scraper.ts` that reads these local HTML files instead of making live network requests. This allows for fast, deterministic, and safe testing of the parsing and data extraction logic.

By implementing these changes, the LinkedIn scraper will be significantly more robust, maintainable, and reliable.

### Plan to Ensure Job Freshness

This plan details strategies to prevent outdated job postings from being included in the scraping results.

#### 1. **Stricter Time-Based Filtering in Search URL**

   - **Problem:** The current search rotates between 1, 3, and 7-day filters. The 7-day filter may be too permissive.
   - **Solution:**
     - **Modify the `timeRanges` in `linkedin-scraper.ts`:** Change the `timeRanges` array to focus on more recent postings. e.g., `const timeRanges = ["r86400", "r259200"];` (last 24 and 72 hours).
     - **Default to the strictest filter:** Prioritize the "last 24 hours" filter.

#### 2. **Post-Scraping Date Validation**

   - **Problem:** Some old jobs might slip through even with URL filters.
   - **Solution:**
     - **Add a `maxJobAgeDays` configuration:** Introduce a setting, e.g., `const MAX_JOB_AGE_DAYS = 7;`.
     - **Filter jobs in `scrapeJobs`:** After extraction, filter the results based on the `postedDate` to enforce the max age.

#### 3. **Improve `parseLinkedInDate` Robustness**

   - **Problem:** If `parseLinkedInDate` returns `null`, the `postedDate` defaults to the current date, making an old job appear new.
   - **Solution:**
     - **Add more date formats:** Handle formats like "1w", "2d", "5h".
     - **Handle non-date text:** Isolate the date string from surrounding text like "Promoted".
     - **Log parsing failures:** Log the original string on failure to help identify new formats.

#### 4. **Prioritize "Date" Sort Order**

   - **Problem:** The scraper alternates between sorting by relevance (`R`) and date (`DD`). Relevance can surface older jobs.
   - **Solution:**
     - **Default to sorting by date:** Modify the `buildSearchUrl` function to always use `sortBy: "DD"` to ensure the newest jobs appear first.

### Plan to Fix Job Data Mismatch

This plan addresses the critical issue of incorrect data being associated with job postings (e.g., wrong title, location, skills).

#### 1. **Stricter Job Card Identification**

   - **Problem:** The current `jobCard` selectors might be matching container elements instead of individual job cards, leading to the same data being extracted for multiple jobs.
   - **Solution:**
     - **Refine `jobCard` Selectors:** Review and tighten the selectors in `linkedin-selectors.json`. Prioritize selectors that are unique to a single job posting, like `[data-entity-urn*="jobPosting"]`.
     - **Add a Sanity Check:** Inside the main loop, before extracting data, perform a quick check to ensure the element is a valid, individual job card (e.g., it contains both a title and a company).

#### 2. **Context-Aware Data Extraction**

   - **Problem:** If the job card element is a large container, the scraper will always find the first matching title, company, etc., not the one relevant to a specific job in the container.
   - **Solution:**
     - **Ensure Scoped Search:** The key is to ensure the element passed to the extraction function is a tightly scoped, individual job card element. This will be achieved by refining the `jobCard` selectors.

#### 3. **Implement a "Single Job View" Scraper (Advanced)**

   - **Problem:** The search results page may contain summary data that is less accurate than the dedicated job detail page.
   - **Solution:**
     - **Two-Phase Scraping:**
       1. **Phase 1 (Search Results):** Scrape the search results to get job URLs.
       2. **Phase 2 (Individual Job Page):** For each URL, navigate to that page and perform a detailed scrape for the full description and to verify all other data.
     - **Benefit:** This is the most robust approach to guarantee data accuracy.

#### 4. **Debugging and Verification**

   - **Problem:** It's hard to diagnose selector issues without seeing the HTML the scraper sees.
   - **Solution:**
     - **Add Debug Logging:** Temporarily add logging to save the HTML of the search results page to a file for manual inspection to verify selectors.

### Plan for Performance and Incremental Data Saving

This plan addresses the slowness of the scraper and the issue of delayed data saving.

#### 1. **Implement Parallel Scraping**

   - **Problem:** The scraper currently fetches job details one by one, with a delay after each request, making the process very slow.
   - **Solution:**
     - **Introduce Concurrency:** Scrape a small batch of job detail pages in parallel using `Promise.all`.
     - **Concurrency Limit:** Add a configurable `CONCURRENCY_LIMIT` (e.g., 3-5) to the `LinkedInScraper` class to avoid getting blocked.
     - **Batching Logic:** The main loop in `scrapeJobs` will create a batch of promises (calls to `scrapeJobDetails`) and execute them together. A delay will be placed *between batches*, not between individual requests. This will significantly speed up the process.

#### 2. **Enable Incremental Saving via Callbacks**

   - **Problem:** The application waits for the entire scraping process to finish before saving any jobs to the database. This is slow and risky, as a failure midway could cause all scraped data to be lost.
   - **Solution:**
     - **Modify `scrapeJobs` Signature:** Change the `scrapeJobs` method in `linkedin-scraper.ts` to accept an `onJobScraped` callback function as an argument.
       ```typescript
       // New signature
       public async scrapeJobs(onJobScraped: (job: Job) => Promise<void>): Promise<ScrapingResult>
       ```
     - **Invoke Callback:** Inside the scraper, after a job's details are successfully fetched and processed, invoke the `onJobScraped(job)` callback immediately.
     - **Update the Scheduler:** The main application logic in `scheduler.ts` will be responsible for creating the callback function. This function will contain the logic to save a single job to the database. It will then pass this function to the `scrapeJobs` method.
     - **Benefit:** This makes the system feel more responsive, as data appears in the database in near real-time. It also makes the process more robust to failures.
