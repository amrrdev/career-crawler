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
}

export class AntiDetectionManager {
  private sessions: Map<string, ScrapingSession> = new Map();
  private proxies: ProxyConfig[] = [];
  private requestCache: Map<string, { data: string; timestamp: Date }> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_REQUESTS_PER_SESSION = 50;
  private readonly SESSION_COOLDOWN = 30 * 60 * 1000; // 30 minutes

  // Realistic user agents from different browsers and OS
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
  public cleanup(): void {
    const now = Date.now();

    // Clean old sessions
    for (const [domain, session] of this.sessions.entries()) {
      if (now - session.lastUsed.getTime() > this.SESSION_COOLDOWN * 2) {
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
}
