const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve("jobs.db");
const db = new sqlite3.Database(dbPath);

// Get the most recent LinkedIn jobs to see their skills
db.all(
  "SELECT id, title, company, skills FROM jobs WHERE source = 'LinkedIn' ORDER BY extractedAt DESC LIMIT 10",
  (err, rows) => {
    if (err) {
      console.error("Error fetching LinkedIn jobs:", err.message);
      return;
    }

    console.log(`Found ${rows.length} LinkedIn jobs:`);
    rows.forEach((row, index) => {
      console.log(`\nLinkedIn Job ${index + 1}:`);
      console.log(`Title: ${row.title}`);
      console.log(`Company: ${row.company}`);
      console.log(`Skills: ${row.skills}`);

      try {
        const skillsArray = JSON.parse(row.skills || "[]");
        console.log(`Parsed skills (${skillsArray.length}):`, skillsArray);
      } catch (e) {
        console.log("Error parsing skills JSON:", e.message);
      }
    });

    db.close();
  }
);
