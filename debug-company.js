const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

puppeteer.use(StealthPlugin());

async function debugCompany() {
  const url = "https://www.bayt.com/en/egypt/jobs/senior-java-developer-5384960/";

  console.log(`🔍 Fetching: ${url}\n`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForTimeout(2000);

  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);

  console.log("=== COMPANY EXTRACTION DEBUG ===\n");

  // Try all company selectors
  const selectors = [
    ".job-company-location-wrapper a.t-default.t-bold",
    "a.t-bold[href*='/company/']",
    ".job-company-location-wrapper a.t-default",
    "a[href*='/company/']",
    ".t-default.t-bold",
  ];

  selectors.forEach((selector, i) => {
    const element = $(selector).first();
    if (element.length > 0) {
      console.log(`[${i + 1}] Selector: ${selector}`);
      console.log(`    Text: "${element.text().trim()}"`);
      console.log(`    HTML: ${element.html()?.substring(0, 100)}`);
      console.log("");
    } else {
      console.log(`[${i + 1}] Selector: ${selector} - NOT FOUND\n`);
    }
  });

  // Search for all links with company in href
  console.log("\n=== ALL COMPANY LINKS ===\n");
  $("a[href*='/company/']").each((i, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    console.log(`[${i + 1}] "${text}" → ${href}`);
  });

  // Search for all .t-bold elements
  console.log("\n=== ALL .t-bold ELEMENTS (first 10) ===\n");
  $(".t-bold")
    .slice(0, 10)
    .each((i, el) => {
      const text = $(el).text().trim();
      const tag = el.tagName;
      console.log(`[${i + 1}] <${tag}> "${text}"`);
    });
}

debugCompany().catch(console.error);
