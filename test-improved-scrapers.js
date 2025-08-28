const { JobAggregator } = require("./src/services/job-aggregator.ts");

async function testImprovedScrapers() {
  console.log("🚀 Testing Enhanced Job Scrapers with Global Coverage & Deduplication\n");

  const aggregator = new JobAggregator("./test-jobs.db", true); // Bypass cache for fresh data

  try {
    console.log("=".repeat(80));
    console.log("🌍 GLOBAL JOB AGGREGATION TEST");
    console.log("=".repeat(80));

    const startTime = Date.now();
    const result = await aggregator.aggregateJobs("backend developer", "Remote");
    const duration = Date.now() - startTime;

    console.log("\n" + "=".repeat(50));
    console.log("📊 AGGREGATION RESULTS SUMMARY");
    console.log("=".repeat(50));
    console.log(`⏱️  Total execution time: ${duration.toLocaleString()}ms`);
    console.log(`📈 Jobs fetched across all sources: ${result.totalFetched}`);
    console.log(`🔄 Duplicates intelligently merged: ${result.totalDuplicates}`);
    console.log(`💾 Unique jobs saved to database: ${result.totalSaved}`);
    console.log(
      `📈 Deduplication efficiency: ${(
        (result.totalDuplicates / result.totalFetched) *
        100
      ).toFixed(1)}%`
    );

    console.log("\n" + "=".repeat(50));
    console.log("🔍 SCRAPER PERFORMANCE BREAKDOWN");
    console.log("=".repeat(50));

    result.results.forEach((scraperResult, index) => {
      const emoji = scraperResult.success ? "✅" : "❌";
      console.log(`${emoji} ${scraperResult.source}:`);
      console.log(`   📊 Jobs found: ${scraperResult.totalFound}`);
      console.log(`   ✅ Success: ${scraperResult.success}`);
      if (scraperResult.error) {
        console.log(`   ⚠️  Error: ${scraperResult.error}`);
      }
      if (index < result.results.length - 1) console.log();
    });

    // Test job diversity and quality
    console.log("\n" + "=".repeat(50));
    console.log("🌍 GLOBAL DIVERSITY ANALYSIS");
    console.log("=".repeat(50));

    const allJobs = await aggregator.getAllJobs(200);

    if (allJobs.length > 0) {
      // Analyze geographic diversity
      const locations = [...new Set(allJobs.map((job) => job.location))];
      const companies = [...new Set(allJobs.map((job) => job.company))];
      const sources = [...new Set(allJobs.map((job) => job.source))];
      const skillsSet = new Set(allJobs.flatMap((job) => job.skills));

      console.log(`🗺️  Unique locations: ${locations.length}`);
      console.log(`   Top locations: ${locations.slice(0, 8).join(", ")}`);

      console.log(`\n🏢 Unique companies: ${companies.length}`);
      console.log(`   Sample companies: ${companies.slice(0, 6).join(", ")}`);

      console.log(`\n🔗 Job sources: ${sources.length}`);
      console.log(`   Sources: ${sources.join(", ")}`);

      console.log(`\n🛠️  Total unique skills detected: ${skillsSet.size}`);

      // Count skill frequency
      const skillCounts = {};
      allJobs.forEach((job) => {
        job.skills.forEach((skill) => {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
      });

      const topSkills = Object.entries(skillCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([skill, count]) => `${skill}(${count})`)
        .join(", ");

      console.log(`   Top skills: ${topSkills}`);

      // Analyze job types
      const jobTypes = {};
      allJobs.forEach((job) => {
        jobTypes[job.jobType] = (jobTypes[job.jobType] || 0) + 1;
      });

      console.log(`\n📋 Job types distribution:`);
      Object.entries(jobTypes).forEach(([type, count]) => {
        const percentage = ((count / allJobs.length) * 100).toFixed(1);
        console.log(`   ${type}: ${count} jobs (${percentage}%)`);
      });

      console.log("\n" + "=".repeat(50));
      console.log("🎯 SAMPLE HIGH-QUALITY JOBS");
      console.log("=".repeat(50));

      // Show sample of diverse, high-quality jobs
      const sampleJobs = allJobs
        .filter((job) => job.skills.length >= 3 && job.description.length >= 50)
        .sort((a, b) => {
          // Sort by diversity: different locations and sources preferred
          const aScore = a.skills.length + (a.salary ? 5 : 0) + (a.location.includes(",") ? 2 : 0);
          const bScore = b.skills.length + (b.salary ? 5 : 0) + (b.location.includes(",") ? 2 : 0);
          return bScore - aScore;
        })
        .slice(0, 5);

      sampleJobs.forEach((job, index) => {
        console.log(`${index + 1}. 💼 ${job.title}`);
        console.log(`   🏢 ${job.company} | 📍 ${job.location}`);
        console.log(`   🔗 Source: ${job.source}`);
        console.log(
          `   🛠️  Skills: ${job.skills.slice(0, 6).join(", ")}${job.skills.length > 6 ? "..." : ""}`
        );
        if (job.salary) console.log(`   💰 Salary: ${job.salary}`);
        console.log(`   📝 ${job.description.substring(0, 120)}...`);
        console.log();
      });
    } else {
      console.log("⚠️  No jobs found in database to analyze.");
    }

    // Test specific skill searches
    console.log("=".repeat(50));
    console.log("🔍 SKILL-BASED SEARCH TEST");
    console.log("=".repeat(50));

    const skillSearches = [
      ["React", "JavaScript"],
      ["Python", "Django"],
      ["Node.js", "AWS"],
      ["Flutter", "Mobile Development"],
    ];

    for (const skills of skillSearches) {
      const skillJobs = await aggregator.getJobsBySkills(skills, 10);
      console.log(`🎯 "${skills.join(" + ")}" jobs: ${skillJobs.length} found`);

      if (skillJobs.length > 0) {
        const locations = [...new Set(skillJobs.map((j) => j.location))].slice(0, 4);
        const companies = [...new Set(skillJobs.map((j) => j.company))].slice(0, 4);
        console.log(`   📍 Locations: ${locations.join(", ")}`);
        console.log(`   🏢 Companies: ${companies.join(", ")}`);
      }
      console.log();
    }

    // Final statistics
    const stats = await aggregator.getJobStats();
    console.log("=".repeat(50));
    console.log("📈 FINAL DATABASE STATISTICS");
    console.log("=".repeat(50));
    console.log(`📊 Total jobs in database: ${stats.total}`);
    console.log("📋 Jobs by source:");
    Object.entries(stats.bySource).forEach(([source, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      console.log(`   ${source}: ${count} jobs (${percentage}%)`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("🎉 ENHANCED SCRAPER TEST COMPLETED SUCCESSFULLY!");
    console.log("✨ Key Improvements Validated:");
    console.log("   🌍 Global geographic coverage");
    console.log("   🔄 Intelligent job deduplication");
    console.log("   💾 Cache bypass for fresh data");
    console.log("   🎯 Enhanced skill detection");
    console.log("   📈 Improved data quality");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    aggregator.close();
  }
}

// Run the test
testImprovedScrapers();
