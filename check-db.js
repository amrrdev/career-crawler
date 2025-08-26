const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('jobs.db');
console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
});

// Check if jobs table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'", (err, row) => {
  if (err) {
    console.error('Error checking tables:', err.message);
    return;
  }
  
  if (!row) {
    console.log('No jobs table found in database.');
    db.close();
    return;
  }
  
  console.log('Jobs table exists.');
  
  // Check total jobs count
  db.get("SELECT COUNT(*) as count FROM jobs", (err, row) => {
    if (err) {
      console.error('Error counting jobs:', err.message);
      return;
    }
    
    console.log(`Total jobs in database: ${row.count}`);
    
    if (row.count > 0) {
      // Check some sample skills
      db.all("SELECT id, title, skills FROM jobs LIMIT 5", (err, rows) => {
        if (err) {
          console.error('Error fetching jobs:', err.message);
          return;
        }
        
        console.log('\nSample jobs and their skills:');
        rows.forEach((row, index) => {
          console.log(`\nJob ${index + 1}:`);
          console.log(`ID: ${row.id}`);
          console.log(`Title: ${row.title}`);
          console.log(`Skills: ${row.skills}`);
          
          try {
            const skillsArray = JSON.parse(row.skills || '[]');
            console.log(`Parsed skills (${skillsArray.length}):`, skillsArray);
          } catch (e) {
            console.log('Error parsing skills JSON:', e.message);
          }
        });
        
        db.close();
      });
    } else {
      console.log('No jobs found in database.');
      db.close();
    }
  });
});
