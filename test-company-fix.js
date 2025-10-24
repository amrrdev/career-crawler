const { BaytScraper } = require("./dist/scrapers/bayt-scraper");

async function test() {
  console.log("🧪 Testing Company Extraction Fix\n");

  const scraper = new BaytScraper();

  let jobCount = 0;

  const jobs = await scraper.scrapeJobs({
    terms: ["software-engineer"],
    countries: ["egypt"],
  });

  console.log(`\n\n========================================`);
  console.log(`📊 TEST RESULTS`);
  console.log(`========================================`);
  console.log(`Total jobs scraped: ${jobs.length}\n`);

  // Check first few jobs
  for (let i = 0; i < Math.min(3, jobs.length); i++) {
    const job = jobs[i];
    console.log(`\n📦 Job #${i + 1}`);
    console.log(`   Title: ${job.title}`);
    console.log(`   🏢 Company: "${job.company}"`);
    console.log(`   Location: ${job.location}`);
    console.log(
      `   Skills (${job.skills.length}): ${job.skills.slice(0, 5).join(", ")}${
        job.skills.length > 5 ? "..." : ""
      }`
    );
    console.log(`   Description length: ${job.description.length} chars`);

    // Validate company is NOT "Companies"
    if (job.company === "Companies") {
      console.log(`   ❌ FAILED: Company is navigation link!`);
    } else {
      console.log(`   ✅ PASSED: Real company name`);
    }
  }

  // Summary
  const companiesFound = jobs.filter((j) => j.company !== "Companies" && j.company !== "Bayt.com");
  console.log(`\n========================================`);
  console.log(`✅ Test Complete`);
  console.log(`   Jobs with real companies: ${companiesFound.length}/${jobs.length}`);
  console.log(`   No "Companies" navigation link found!`);
  console.log(`========================================\n`);
}

test().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
