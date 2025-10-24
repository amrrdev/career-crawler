import puppeteer, { Browser, Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ScrapingSession {
  cookies: string[];
  userAgent: string;
  lastUsed: Date;
  requestCount: number;
  blocked: boolean;
  browser?: Browser;
  viewport: { width: number; height: number };
}

export class AntiDetectionManager {
  private sessions: Map<string, ScrapingSession> = new Map();
  private proxies: ProxyConfig[] = [];
  private requestCache: Map<string, { data: string; timestamp: Date }> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_REQUESTS_PER_SESSION = 25; // Reduced for browser sessions
  private readonly SESSION_COOLDOWN = 30 * 60 * 1000; // 30 minutes
  private activeBrowsers: number = 0;
  private readonly MAX_CONCURRENT_BROWSERS = 2; // Limit concurrent browsers
  private browserQueue: Promise<any> = Promise.resolve(); // Sequential browser operations

  // Realistic user agents and viewports from different browsers and OS
  private userAgents = [
    // Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",

    // Chrome macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

    // Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0",

    // Firefox macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",

    // Safari macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",

    // Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  ];

  // Common desktop screen resolutions for realistic viewport sizes
  private viewportSizes = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 1024, height: 768 },
  ];

  constructor(proxies: ProxyConfig[] = []) {
    this.proxies = proxies;
  }

  public getSession(domain: string): ScrapingSession {
    let session = this.sessions.get(domain);

    // Create new session if doesn't exist or is blocked/overused
    if (
      !session ||
      session.blocked ||
      session.requestCount >= this.MAX_REQUESTS_PER_SESSION ||
      Date.now() - session.lastUsed.getTime() > this.SESSION_COOLDOWN
    ) {
      session = {
        cookies: [],
        userAgent: this.getRandomUserAgent(),
        lastUsed: new Date(),
        requestCount: 0,
        blocked: false,
        viewport: this.getRandomViewport(),
      };

      this.sessions.set(domain, session);
    }

    return session;
  }

  public updateSession(domain: string, cookies?: string[], blocked = false): void {
    const session = this.sessions.get(domain);
    if (session) {
      session.lastUsed = new Date();
      session.requestCount++;
      session.blocked = blocked;

      if (cookies) {
        session.cookies = cookies;
      }
    }
  }

  public getCachedResponse(url: string): string | null {
    const cached = this.requestCache.get(url);

    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_DURATION) {
      return cached.data;
    }

    // Clean expired cache
    if (cached) {
      this.requestCache.delete(url);
    }

    return null;
  }

  public setCachedResponse(url: string, data: string): void {
    this.requestCache.set(url, {
      data,
      timestamp: new Date(),
    });
  }

  public getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  public getRandomProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }

  // Calculate smart delay based on recent activity
  public getSmartDelay(domain: string): number {
    const session = this.sessions.get(domain);
    const baseDelay = 2000; // 2 seconds minimum

    if (!session) return baseDelay;

    // Increase delay based on request count
    const requestMultiplier = Math.min(session.requestCount / 10, 3); // Max 3x multiplier

    // Add randomness
    const randomFactor = 0.5 + Math.random(); // 0.5 to 1.5x

    return Math.floor(baseDelay * (1 + requestMultiplier) * randomFactor);
  }

  // Generate realistic headers for a request
  public getRealisticHeaders(domain: string, referrer?: string): Record<string, string> {
    const session = this.getSession(domain);

    const headers: Record<string, string> = {
      "User-Agent": session.userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": referrer ? "same-origin" : "none",
      "Sec-Ch-Ua": this.getSecChUa(session.userAgent),
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": this.getPlatform(session.userAgent),
      "Cache-Control": "max-age=0",
    };

    if (referrer) {
      headers["Referer"] = referrer;
    }

    if (session.cookies.length > 0) {
      headers["Cookie"] = session.cookies.join("; ");
    }

    return headers;
  }

  private getSecChUa(userAgent: string): string {
    if (userAgent.includes("Chrome/120")) {
      return '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    }
    if (userAgent.includes("Chrome/119")) {
      return '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"';
    }
    if (userAgent.includes("Firefox")) {
      return '"Firefox";v="120"';
    }
    if (userAgent.includes("Safari")) {
      return '"Safari";v="17"';
    }
    return '"Not_A Brand";v="8", "Chromium";v="120"';
  }

  private getPlatform(userAgent: string): string {
    if (userAgent.includes("Windows")) return '"Windows"';
    if (userAgent.includes("Macintosh")) return '"macOS"';
    if (userAgent.includes("Linux")) return '"Linux"';
    return '"Windows"';
  }

  // Clean up old sessions and cache
  public async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean old sessions
    for (const [domain, session] of this.sessions.entries()) {
      if (now - session.lastUsed.getTime() > this.SESSION_COOLDOWN * 2) {
        // Close browser if exists
        if (session.browser) {
          try {
            await session.browser.close();
          } catch (error) {
            console.error("Error closing browser:", error);
          }
        }
        this.sessions.delete(domain);
      }
    }

    // Clean old cache
    for (const [url, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp.getTime() > this.CACHE_DURATION) {
        this.requestCache.delete(url);
      }
    }
  }

  // Rate limiting check
  public canMakeRequest(domain: string): boolean {
    const session = this.sessions.get(domain);
    if (!session) return true;

    // Check if session is blocked
    if (session.blocked) return false;

    // Check request count
    if (session.requestCount >= this.MAX_REQUESTS_PER_SESSION) return false;

    // Check if enough time has passed since last request
    const timeSinceLastRequest = Date.now() - session.lastUsed.getTime();
    return timeSinceLastRequest >= this.getSmartDelay(domain) / 2;
  }

  public getRandomViewport(): { width: number; height: number } {
    return this.viewportSizes[Math.floor(Math.random() * this.viewportSizes.length)];
  }

  // Enhanced browser-based page fetching
  public async fetchPageWithBrowser(url: string, domain: string): Promise<string> {
    const session = this.getSession(domain);
    let retries = 1;

    while (retries >= 0) {
      let browser = session.browser;
      let page: Page | null = null;

      try {
        if (!browser || !browser.isConnected()) {
          console.log(`🚀 Launching new browser session for ${domain}`);
          if (browser) await browser.close().catch(() => {});

          // Wait if too many browsers are active
          while (this.activeBrowsers >= this.MAX_CONCURRENT_BROWSERS) {
            console.log(
              `⏳ Waiting for browser slot (${this.activeBrowsers}/${this.MAX_CONCURRENT_BROWSERS} active)...`
            );
            await this.sleep(2000);
          }

          this.activeBrowsers++;
          try {
            // Use puppeteer-extra with stealth plugin for better anti-detection
            browser = await puppeteerExtra.launch({
              headless: "new",
              defaultViewport: session.viewport,
              protocolTimeout: 60000, // Increase timeout to 60 seconds
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-features=VizDisplayCompositor",
                "--disable-extensions",
                "--disable-plugins",
                "--disable-images",
                "--disable-blink-features=AutomationControlled",
                "--user-agent=" + session.userAgent,
              ],
            });
            session.browser = browser;
            this.sessions.set(domain, session);
          } catch (launchError) {
            this.activeBrowsers--;
            throw launchError;
          }
        }

        page = await browser.newPage();
        await page.setViewport(session.viewport);
        await page.setUserAgent(session.userAgent);
        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,ar;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        });

        await page.setRequestInterception(true);
        page.on("request", (req) => {
          const resourceType = req.resourceType();
          if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        let gotoRetries = 2;
        while (gotoRetries >= 0) {
          try {
            await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
            break;
          } catch (error) {
            if (error instanceof Error && error.message.includes("Timeout") && gotoRetries > 0) {
              console.warn(
                `Navigation timeout for ${url}, retrying... (${gotoRetries} retries left)`
              );
              gotoRetries--;
              await this.sleep(2000);
            } else {
              throw error;
            }
          }
        }

        // Wait for main content to load (h1 for job title)
        try {
          await page.waitForSelector("h1", { timeout: 10000 });
        } catch (e) {
          console.warn(`⚠️  No h1 found on page, proceeding anyway...`);
        }

        // Glassdoor-specific: wait MUCH longer and add cookies
        if (domain.includes("glassdoor")) {
          // Wait for dynamic content to load
          await this.sleep(3000 + Math.random() * 3000); // 3-6 seconds

          // Try to wait for actual job content
          try {
            await page.waitForSelector('[data-test="jobListing"], li.react-job-listing', {
              timeout: 5000,
            });
          } catch (e) {
            console.warn(`⚠️  Glassdoor job listings not found, page might be blocked`);
          }

          // Add realistic cookies
          await page.setCookie({
            name: "gdId",
            value: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            domain: ".glassdoor.com",
          });

          // Check for bot detection page
          const pageText = await page.content();
          if (
            pageText.includes("Job is OOO") ||
            pageText.includes("Access Denied") ||
            pageText.includes("captcha")
          ) {
            console.warn(`⚠️  Glassdoor bot detection triggered`);
          }
        }

        await this.simulateHumanBehavior(page);
        const html = await page.content();
        await page.close();

        // Decrement browser counter to free up slot
        this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);

        this.updateSession(domain, [], false);
        return html;
      } catch (error) {
        if (page) await page.close().catch(() => {});

        // Decrement browser counter even on error to free up slot
        this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);

        if (
          error instanceof Error &&
          error.message.includes("Session with given id not found") &&
          retries > 0
        ) {
          console.warn(" puppeteer session lost, restarting browser and retrying...");
          if (session.browser) {
            await session.browser.close().catch(() => {});
          }
          delete session.browser;
          retries--;
          await this.sleep(1000);
          continue;
        }

        console.error(`❌ Browser fetch error for ${domain}:`, error);
        if (
          error instanceof Error &&
          (error.message.includes("net::ERR_") || error.message.includes("TimeoutError"))
        ) {
          this.updateSession(domain, [], true);
        }
        throw error;
      }
    }
    throw new Error("Failed to fetch page with browser after multiple retries");
  }

  // Simulate human-like behavior on the page
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movement
      const viewport = await page.viewport();
      if (viewport) {
        const x = Math.random() * viewport.width;
        const y = Math.random() * viewport.height;
        await page.mouse.move(x, y);
      }

      // Random scroll
      if (Math.random() > 0.5) {
        const scrollAmount = Math.random() * 500 + 100;
        await page.evaluate((amount) => {
          window.scrollBy(0, amount);
        }, scrollAmount);

        await this.sleep(Math.random() * 1000 + 500);

        // Scroll back up sometimes
        if (Math.random() > 0.7) {
          await page.evaluate(() => {
            window.scrollTo(0, 0);
          });
        }
      }
    } catch (error) {
      // Ignore errors in human simulation
    }
  }

  // Helper method for delays
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Close all browsers when shutting down
  public async closeAllBrowsers(): Promise<void> {
    for (const [domain, session] of this.sessions.entries()) {
      if (session.browser) {
        try {
          await session.browser.close();
        } catch (error) {
          console.error(`Error closing browser for ${domain}:`, error);
        }
      }
    }
  }
}
