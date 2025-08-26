const axios = require("axios");

const API_BASE = "http://localhost:3000/api";

async function testJobAPI() {
  console.log("🚀 Testing Job Posting Aggregator API\n");

  try {
    // Test health endpoint
    console.log("1. Testing health endpoint...");
    const health = await axios.get("http://localhost:3000/health");
    console.log("✅ Health check:", health.data.status);
    console.log("   Scheduler running:", health.data.scheduler.isRunning);
    console.log();

    // Test get all jobs
    console.log("2. Testing get all jobs...");
    const allJobs = await axios.get(`${API_BASE}/jobs?limit=5`);
    console.log(`✅ Found ${allJobs.data.count} jobs (showing first 5)`);
    if (allJobs.data.jobs.length > 0) {
      const job = allJobs.data.jobs[0];
      console.log("   Sample job:");
      console.log(`   - Title: ${job.title}`);
      console.log(`   - Company: ${job.company}`);
      console.log(`   - Skills: ${job.skills.join(", ")}`);
      console.log(`   - Source: ${job.source}`);
    }
    console.log();

    // Test get jobs by skills
    console.log("3. Testing jobs by skills (JavaScript, React)...");
    const skillJobs = await axios.get(`${API_BASE}/jobs/skills/JavaScript,React`);
    console.log(`✅ Found ${skillJobs.data.count} jobs with JavaScript or React`);
    console.log();

    // Test search with filters
    console.log("4. Testing search with filters...");
    const searchResult = await axios.post(`${API_BASE}/jobs/search`, {
      skills: ["JavaScript", "Node.js"],
      jobType: "full-time",
    });
    console.log(`✅ Found ${searchResult.data.count} full-time JavaScript/Node.js jobs`);
    console.log();

    // Test get available skills
    console.log("5. Testing get available skills...");
    const skills = await axios.get(`${API_BASE}/skills`);
    console.log(`✅ Found ${skills.data.count} unique skills in database`);
    console.log("   Top 10 skills:", skills.data.skills.slice(0, 10).join(", "));
    console.log();

    // Test get statistics
    console.log("6. Testing database statistics...");
    const stats = await axios.get(`${API_BASE}/stats`);
    console.log("✅ Database statistics:");
    console.log(`   - Total jobs: ${stats.data.stats.total}`);
    console.log("   - Jobs by source:");
    Object.entries(stats.data.stats.bySource).forEach(([source, count]) => {
      console.log(`     * ${source}: ${count} jobs`);
    });
    console.log();

    console.log("🎉 All API tests completed successfully!");
  } catch (error) {
    console.error("❌ API test failed:", error.response?.data || error.message);
  }
}

// Run the tests
testJobAPI();
