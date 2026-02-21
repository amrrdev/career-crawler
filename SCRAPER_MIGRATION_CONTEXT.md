# Scraper Database Migration Context

## Overview

Update the scraper to use PostgreSQL directly (via `pg` driver) instead of SQLite, integrating with the existing careerk platform database.

## Important Notes

- **DO NOT USE Prisma** - use raw `pg` driver (PostgreSQL) directly
- Use parameterized queries for security
- Use transactions for atomic operations when linking skills

---

## Database Schema (PostgreSQL)

### Tables to Use/Create

#### 1. Skills Table (EXISTS - already in DB)

```sql
SELECT * FROM skills;
-- Columns: id (UUID), name (VARCHAR 255), aliases (JSON), created_at, updated_at
```

#### 2. ScrapedJob Table (NEW - need to create)

```sql
CREATE TABLE scraped_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) UNIQUE NOT NULL,
  source VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  salary VARCHAR(255),
  job_type VARCHAR(50),  -- FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraped_jobs_source ON scraped_jobs(source);
CREATE INDEX idx_scraped_jobs_company_name ON scraped_jobs(company_name);
```

#### 3. ScrapedJobSkill Table (NEW - need to create)

```sql
CREATE TABLE scraped_job_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scraped_jobs(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, skill_id)
);
```

---

## Field Mapping

| SQLite Field    | PostgreSQL Column            | Type         | Notes          |
| --------------- | ---------------------------- | ------------ | -------------- |
| `id`            | `id`                         | UUID         | Auto-generate  |
| `url`           | `url`                        | VARCHAR(500) | Unique         |
| `source`        | `source`                     | VARCHAR(100) |                |
| `title`         | `title`                      | VARCHAR(255) |                |
| `company`       | `company_name`               | VARCHAR(255) | Renamed        |
| `location`      | `location`                   | VARCHAR(255) |                |
| `description`   | `description`                | TEXT         |                |
| `salary`        | `salary`                     | VARCHAR(255) |                |
| `skills` (JSON) | → `scraped_job_skills` table |              | Extract & link |
| `jobType`       | `job_type`                   | VARCHAR(50)  | Map to enum    |
| `postedDate`    | `posted_at`                  | TIMESTAMP    | Renamed        |

---

## JobType Mapping

Map string values to PostgreSQL enum values:

```javascript
const jobTypeMap = {
  "full-time": "FULL_TIME",
  "full time": "FULL_TIME",
  "part-time": "PART_TIME",
  "part time": "PART_TIME",
  contract: "CONTRACT",
  freelance: "FREELANCE",
  internship: "INTERNSHIP",
};
```

---

## Implementation Steps

### Step 1: Create Tables (if not exist)

Run CREATE TABLE statements shown above.

### Step 2: Update Scraper Code

Replace SQLite Database class with PostgreSQL client.

### Step 3: Scraping Logic (Pseudocode)

```javascript
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function saveJob(job) {
  // 1. Insert or update ScrapedJob
  const jobResult = await client.query(
    `INSERT INTO scraped_jobs (url, source, title, company_name, location, description, salary, job_type, posted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (url) DO UPDATE SET
       title = EXCLUDED.title,
       company_name = EXCLUDED.company_name,
       location = EXCLUDED.location,
       description = EXCLUDED.description,
       salary = EXCLUDED.salary,
       job_type = EXCLUDED.job_type,
       posted_at = EXCLUDED.posted_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      job.url,
      job.source,
      job.title,
      job.company,
      job.location,
      job.description,
      job.salary,
      mapJobType(job.jobType),
      job.postedDate,
    ],
  );

  const jobId = jobResult.rows[0].id;

  // 2. For each skill, upsert skill then link
  for (const skillName of job.skills) {
    // Upsert skill (create if not exists)
    const skillResult = await client.query(
      `INSERT INTO skills (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [skillName],
    );

    const skillId = skillResult.rows[0].id;

    // Link skill to job (ignore if already linked)
    await client.query(
      `INSERT INTO scraped_job_skills (job_id, skill_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [jobId, skillId],
    );
  }
}
```

---

## Environment Variables Needed

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

---

## Notes

- Use `ON CONFLICT (url) DO UPDATE` for upsert behavior (handle duplicate URLs)
- Use `ON CONFLICT DO NOTHING` for skill linking (handle duplicate skills)
- Skills from scraped jobs should be reusable across multiple jobs
- Always use parameterized queries ($1, $2, etc.) to prevent SQL injection

CURRENT ENTIRE DATABASE SCHEMA

```ts

generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

model JobSeeker {
  id              String    @id @default(uuid()) @db.Uuid
  email           String    @unique
  password        String

  firstName       String    @map("first_name")
  lastName        String    @map("last_name")
  profileImageUrl String?   @map("profile_image_url") @db.VarChar(500)

  isActive        Boolean   @default(true) @map("is_active")
  isVerified      Boolean   @default(false) @map("is_verified")

  lastLoginAt     DateTime? @map("last_login_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  profile JobSeekerProfile?
  educations Education[]
  workExperiences WorkExperience[]
  jobSeekerSkills JobSeekerSkill[]
  cv CV?
  cvParseResult   CvParseResult?  // ← add this

  @@index([isActive])
  @@map("job_seekers")
}

model Company {
  id                   String      @id @default(uuid()) @db.Uuid
  email                String      @unique
  password             String

  name                 String
  description          String?     @db.Text
  logoUrl              String?     @map("logo_url") @db.VarChar(500)
  coverUrl             String?     @map("cover_url") @db.VarChar(500)

  industry             String
  size                 CompanySize
  type                 CompanyType
  headquartersLocation String?     @map("headquarters_location") @db.VarChar(255)
  foundedYear          Int?        @map("founded_year")
  websiteUrl           String?     @map("website_url") @db.VarChar(500)

  benefits             String?     @db.Text

  linkedIn             String?     @map("linked_in") @db.VarChar(500)
  facebook             String?     @db.VarChar(500)
  twitter              String?     @db.VarChar(500)

  isActive             Boolean     @default(true) @map("is_active")
  isVerified           Boolean     @default(false) @map("is_verified")

  createdAt            DateTime    @default(now()) @map("created_at")
  updatedAt            DateTime    @updatedAt @map("updated_at")

  @@index([isActive])
  @@map("companies")
}

model JobSeekerProfile {
  id                 String                  @id @default(uuid()) @db.Uuid
  jobSeekerId        String                  @unique @db.Uuid              @map("job_seeker_id")
  title              String
  cvEmail            String                  @unique                       @map("cv_email")
  phone              String
  summary            String?                 @db.Text
  location           String?
  availabilityStatus AvailabilityStatusEnum  @map("availability_status")
  expectedSalary     Int?                    @map("expected_salary")
  workPreference     WorkPreferenceEnum      @map("work_preference")
  preferredJobTypes  JobTypeEnum[]           @map("preferred_job_types")
  yearsOfExperience  Float?                  @map("years_of_experience")
  noticePeriod       Int?                    @map("notice_period")
  linkedinUrl        String?                 @db.VarChar(500)              @map("linkedin_url")
  portfolioUrl       String?                 @db.VarChar(500)              @map("portfolio_url")
  githubUrl          String?                 @db.VarChar(500)              @map("github_url")
  createdAt          DateTime                @default(now())               @map("created_at")
  updatedAt          DateTime                @updatedAt                    @map("updated_at")
  jobSeeker          JobSeeker               @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)

  @@index([availabilityStatus])
  @@index([workPreference])
  @@index([location])
  @@index([yearsOfExperience])
  @@index([noticePeriod])
  @@map("job_seeker_profiles")
}

model Education {
  id              String          @id @default(uuid()) @db.Uuid
  jobSeekerId     String          @db.Uuid @map("job_seeker_id")
  institutionName String          @map("institution_name") @db.VarChar(255)
  degreeType      DegreeTypeEnum @map("degree_type")
  fieldOfStudy    String          @map("field_of_study") @db.VarChar(255)
  startDate       DateTime        @map("start_date") @db.Date
  endDate         DateTime?       @map("end_date") @db.Date
  gpa             Float?
  isCurrent       Boolean         @default(false) @map("is_current")
  description     String?         @db.Text

  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  jobSeeker       JobSeeker       @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)

  @@index([jobSeekerId])
  @@unique([jobSeekerId, institutionName, degreeType, fieldOfStudy])
  @@map("educations")
}

model WorkExperience {
  id              String        @id @default(uuid()) @db.Uuid
  jobSeekerId     String        @db.Uuid @map("job_seeker_id")
  companyName     String        @map("company_name") @db.VarChar(255)
  jobTitle        String        @map("job_title") @db.VarChar(255)
  location        String?       @db.VarChar(255)
  startDate       DateTime      @map("start_date") @db.Date
  endDate         DateTime?     @map("end_date") @db.Date
  isCurrent       Boolean       @default(false) @map("is_current")
  description     String?       @db.Text

  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  jobSeeker       JobSeeker     @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)

  @@index([jobSeekerId])
  @@unique([jobSeekerId, companyName, jobTitle, startDate])
  @@map("work_experiences")
}

model Skill {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(255)
  aliases     Json?

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  jobSeekerSkills JobSeekerSkill[]
  scrapedJobSkills ScrapedJobSkill[]
  @@map("skills")
}

model JobSeekerSkill {
  id            String   @id @default(uuid()) @db.Uuid
  jobSeekerId   String   @db.Uuid @map("job_seeker_id")
  skillId       String   @db.Uuid @map("skill_id")
  verified      Boolean  @default(true)

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  jobSeeker     JobSeeker @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)
  skill         Skill     @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([jobSeekerId, skillId])
  @@index([jobSeekerId])
  @@map("job_seeker_skills")
}

model CV {
  id          String    @id @default(uuid()) @db.Uuid
  jobSeekerId String    @unique @db.Uuid @map("job_seeker_id")
  key         String
  fileName    String    @map("file_name")
  mimeType    String    @map("mime_type")
  uploadedAt  DateTime  @default(now()) @map("uploaded_at")

  jobSeeker   JobSeeker @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)

  @@map("cvs")
}


model CvParseResult {
  id             String        @id @default(uuid()) @db.Uuid
  jobSeekerId    String        @unique @db.Uuid @map("job_seeker_id")
  cvKey          String        @map("cv_key")
  status         CvParseStatusEnum @default(PENDING)

  parsedData     Json?         @map("parsed_data")
  parsedAt       DateTime?     @map("parsed_at")

  errorMessage   String?       @map("error_message")

  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  jobSeeker      JobSeeker     @relation(fields: [jobSeekerId], references: [id], onDelete: Cascade)

  @@map("cv_parse_results")
}

model ScrapedJob {
  id              String   @id @default(uuid()) @db.Uuid
  url             String   @unique
  source          String
  title           String
  companyName     String   @map("company_name")
  location        String?
  description     String?  @db.Text
  salary          String?
  jobType         JobTypeEnum? @map("job_type")

  postedAt        DateTime? @map("posted_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  skills          ScrapedJobSkill[]

  @@index([source])
  @@index([companyName])
  @@map("scraped_jobs")
}

model ScrapedJobSkill {
  id          String   @id @default(uuid()) @db.Uuid
  jobId       String   @db.Uuid @map("job_id")
  skillId     String   @db.Uuid @map("skill_id")
  createdAt   DateTime @default(now()) @map("created_at")

  job         ScrapedJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  skill       Skill      @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([jobId, skillId])
  @@map("scraped_job_skills")
}

enum CvParseStatusEnum {
  PENDING
  COMPLETED
  CONFIRMED
  FAILED
}


enum DegreeTypeEnum {
  HIGH_SCHOOL
  ASSOCIATE
  BACHELOR
  MASTER
  PHD
  BOOTCAMP
  CERTIFICATION
  OTHER
}


enum JobTypeEnum {
  FULL_TIME
  PART_TIME
  CONTRACT
  FREELANCE
  INTERNSHIP
}

enum AvailabilityStatusEnum {
  OPEN_TO_WORK
  NOT_LOOKING
  PASSIVELY_LOOKING
}

enum WorkPreferenceEnum {
  ONSITE
  REMOTE
  HYBRID
  ANY
}

enum CompanyType {
  STARTUP
  SCALE_UP
  ENTERPRISE
  NON_PROFIT
  GOVERNMENT
}

enum CompanySize {
  SIZE_1_50
  SIZE_51_200
  SIZE_201_1000
  SIZE_1000_PLUS
}
```
