# Job Posting Aggregator

A completely **FREE** and reliable job posting aggregation system that collects job listings from multiple sources worldwide every hour. Built with Node.js and TypeScript.

## 🌟 Features

- **100% Free** - No API keys required, no paid subscriptions
- **Global Coverage** - Aggregates jobs from multiple worldwide sources
- **Hourly Updates** - Automatically fetches new jobs every hour
- **Skills-Based Search** - Find jobs based on your technical skills
- **RESTful API** - Easy integration with any frontend or application
- **SQLite Database** - Lightweight, file-based storage
- **TypeScript** - Full type safety and modern development experience

## 🔄 Data Sources

The system aggregates jobs from these **free** sources:

1. **GitHub Issues** - Open source projects hiring through GitHub issues
2. **HackerNews** - Monthly "Who's Hiring" threads with hundreds of job postings
3. **Reddit** - Multiple job-focused subreddits (r/forhire, r/remotejobs, etc.)

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Running the Application

```bash
# Start the server (includes automatic hourly job fetching)
npm start

# Or run in development mode
npm run dev

# Or run only the scheduler (no API server)
npm run scheduler
```

The server will start on `http://localhost:3000` by default.

## 📋 API Endpoints

### Get All Jobs

```http
GET /api/jobs?limit=100
```

### Get Jobs by Skills

```http
GET /api/jobs/skills/javascript,react,node.js
```

### Search Jobs with Filters

```http
POST /api/jobs/search
Content-Type: application/json

{
  "skills": ["python", "django"],
  "location": "remote",
  "jobType": "full-time"
}
```

### Get Database Statistics

```http
GET /api/stats
```

### Get All Available Skills

```http
GET /api/skills
```

### Manually Refresh Jobs

```http
POST /api/jobs/refresh
```

### Health Check

```http
GET /health
```

## 📊 Example API Response

```json
{
  "success": true,
  "skills": ["javascript", "react"],
  "count": 25,
  "jobs": [
    {
      "id": "github_abc123",
      "title": "Frontend Developer - React/TypeScript",
      "company": "TechCompany",
      "location": "Remote",
      "description": "We're looking for a skilled frontend developer...",
      "url": "https://github.com/company/repo/issues/123",
      "skills": ["React", "TypeScript", "JavaScript"],
      "jobType": "full-time",
      "source": "GitHub Jobs",
      "postedDate": "2024-01-15T10:30:00.000Z",
      "extractedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

## 🎯 Skills Recognition

The system automatically detects and extracts skills from job descriptions, including:

### Programming Languages

- JavaScript, TypeScript, Python, Java, C#, C++, PHP, Ruby, Go, Rust, Swift, Kotlin, Scala, R, MATLAB

### Frameworks & Libraries

- React, Angular, Vue.js, Node.js, Express, Django, Flask, Spring, Laravel, Ruby on Rails, ASP.NET

### Databases

- MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch, SQLite, Oracle, SQL Server

### Cloud & DevOps

- AWS, Azure, Google Cloud, Docker, Kubernetes, Jenkins, CI/CD, Terraform, Ansible

### And many more...

## ⏰ Scheduling

The system automatically runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.) to fetch new jobs. You can also trigger manual updates via the API.

## 🗂️ Database

Jobs are stored in a SQLite database (`jobs.db`) with the following features:

- Automatic duplicate detection
- Indexed searches for fast queries
- Job source tracking
- Historical data retention

## 🔧 Configuration

### Environment Variables

```bash
# Port for the API server (default: 3000)
PORT=3000

# Database path (default: jobs.db)
DB_PATH=jobs.db
```

### Customizing Sources

To add or modify job sources, edit the scrapers in `src/scrapers/` directory. Each scraper extends the `BaseScraper` class and implements the `scrapeJobs` method.

## 📁 Project Structure

```
src/
├── api/
│   └── server.ts          # Express API server
├── database/
│   └── database.ts        # SQLite database operations
├── scrapers/
│   ├── base-scraper.ts    # Base scraper class
│   ├── github-jobs-scraper.ts
│   ├── hackernews-scraper.ts
│   └── reddit-scraper.ts
├── services/
│   └── job-aggregator.ts  # Main aggregation service
├── types/
│   └── job.types.ts       # TypeScript type definitions
├── index.ts              # Main entry point
└── scheduler.ts          # Job scheduling service
```

## 🛠️ Development

### Scripts

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Run only the scheduler
npm run scheduler
```

### Adding New Job Sources

1. Create a new scraper in `src/scrapers/`
2. Extend the `BaseScraper` class
3. Implement the `scrapeJobs` method
4. Add the scraper to the `JobAggregator` class

Example:

```typescript
export class NewJobSiteScraper extends BaseScraper {
  protected sourceName = "New Job Site";
  protected baseUrl = "https://newjobsite.com";

  public async scrapeJobs(): Promise<ScrapingResult> {
    // Implementation here
  }
}
```

## 🚨 Rate Limiting & Ethics

The system includes built-in rate limiting and respects robots.txt files. All scraped sources are publicly available and don't require authentication. The system:

- Uses reasonable delays between requests
- Implements proper User-Agent headers
- Handles errors gracefully
- Respects website terms of service

## 📈 Performance

- Fetches 50-150 jobs per hour depending on source availability
- Lightweight SQLite database for fast queries
- Memory-efficient processing with streaming where possible
- Automatic cleanup of duplicate entries

## 🔒 Reliability

This system is designed to run continuously for at least one year with:

- **No API key dependencies** - Won't break due to API changes or rate limits
- **Multiple sources** - If one source fails, others continue working
- **Error recovery** - Individual source failures don't crash the system
- **Graceful degradation** - System continues with available sources

## 📞 API Integration Examples

### JavaScript/Node.js

```javascript
// Get jobs by skills
const response = await fetch("http://localhost:3000/api/jobs/skills/react,nodejs");
const data = await response.json();
console.log(`Found ${data.count} jobs`);
```

### Python

```python
import requests

# Search for Python jobs
response = requests.get('http://localhost:3000/api/jobs/skills/python,django')
jobs = response.json()
print(f"Found {jobs['count']} Python jobs")
```

### cURL

```bash
# Get all jobs
curl "http://localhost:3000/api/jobs?limit=10"

# Search by skills
curl "http://localhost:3000/api/jobs/skills/javascript,react"

# Trigger manual refresh
curl -X POST "http://localhost:3000/api/jobs/refresh"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - feel free to use this in your projects!

## ⭐ Why This Solution?

Unlike paid job APIs or scraping services that can be expensive or unreliable:

- ✅ **Completely free forever**
- ✅ **No API key management**
- ✅ **No rate limit concerns**
- ✅ **Multiple redundant sources**
- ✅ **Easy to extend and customize**
- ✅ **Self-hosted and private**
- ✅ **Works globally**

Perfect for graduation projects, personal job searches, or building job board applications!
