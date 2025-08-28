import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { Job, ScrapingResult } from "../types/job.types";
import { createHash } from "crypto";

export abstract class BaseScraper {
  protected userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  protected delay = 1000; // 1 second delay between requests

  protected abstract sourceName: string;
  protected abstract baseUrl: string;

  protected async fetchPage(url: string): Promise<string> {
    try {
      await this.sleep(this.delay);
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: 10000,
        validateStatus: (status) => status < 400,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected generateJobId(url: string, title: string): string {
    const hash = createHash("md5").update(`${url}-${title}`).digest("hex");
    return `${this.sourceName.toLowerCase().replace(/\s+/g, "_")}_${hash}`;
  }

  protected extractSkillsFromText(text: string): string[] {
    const skills: Set<string> = new Set();
    const cleanText = text.toLowerCase().replace(/[^\w\s\.\+#-]/g, " ");

    // Comprehensive skill detection with multiple variations and synonyms
    const skillPatterns = [
      // Programming Languages with extensive variations
      {
        patterns: [/\bjavascript\b/, /\bjs\b(?!\w)/, /\bvanilla\s*js\b/, /\bec?ma?script\b/],
        skill: "JavaScript",
      },
      {
        patterns: [/\btypescript\b/, /\bts\b(?!\w)/, /\btype\s*script\b/],
        skill: "TypeScript",
      },
      {
        patterns: [/\bpython\b/, /\bpython3?\b/, /\bpy\b(?!\w)/],
        skill: "Python",
      },
      {
        patterns: [/\bjava\b(?!\s*script)/, /\bjava\s*se\b/, /\bjava\s*ee\b/, /\bjdk\b/, /\bjre\b/],
        skill: "Java",
      },
      {
        patterns: [/\bc#\b/, /\bcsharp\b/, /\bc-sharp\b/, /\bdotnet\b/, /\b\.net\b/],
        skill: "C#",
      },
      {
        patterns: [/\bc\+\+\b/, /\bcplusplus\b/, /\bcpp\b/],
        skill: "C++",
      },
      {
        patterns: [/\bphp\b/, /\bphp\d+\b/],
        skill: "PHP",
      },
      {
        patterns: [/\bruby\b(?!\s*on\s*rails)/, /\brb\b/],
        skill: "Ruby",
      },
      {
        patterns: [/\bgolang\b/, /\bgo\s+(lang|programming|language|developer|dev)\b/],
        skill: "Go",
      },
      {
        patterns: [/\brust\b(?!\s)/, /\brust\s+(lang|programming|language)\b/],
        skill: "Rust",
      },
      {
        patterns: [/\bswift\b/, /\bswift\s*ui\b/, /\bios\s*swift\b/],
        skill: "Swift",
      },
      {
        patterns: [/\bkotlin\b/, /\bkotlin\s*native\b/],
        skill: "Kotlin",
      },
      {
        patterns: [/\bscala\b/],
        skill: "Scala",
      },

      // Frontend Technologies with comprehensive coverage
      {
        patterns: [/\breact\b/, /\breactjs\b/, /\breact\.js\b/, /\breact\s*native\b/],
        skill: "React",
      },
      {
        patterns: [/\bangular\b/, /\bangularjs\b/, /\bangular\s*\d+\b/],
        skill: "Angular",
      },
      {
        patterns: [/\bvue\b/, /\bvuejs\b/, /\bvue\.js\b/, /\bnuxt\b/],
        skill: "Vue.js",
      },
      {
        patterns: [/\bhtml\b/, /\bhtml5\b/, /\bmarkup\b/],
        skill: "HTML",
      },
      {
        patterns: [/\bcss\b/, /\bcss3\b/, /\bstylesheet\b/, /\bstyling\b/],
        skill: "CSS",
      },
      {
        patterns: [/\bsass\b/, /\bscss\b/, /\bless\b/, /\bstylus\b/],
        skill: "Sass",
      },
      {
        patterns: [/\bbootstrap\b/, /\bbs\d+\b/],
        skill: "Bootstrap",
      },
      {
        patterns: [/\btailwind\b/, /\btailwindcss\b/, /\btailwind\s*css\b/],
        skill: "Tailwind CSS",
      },
      {
        patterns: [/\bmaterial\s*ui\b/, /\bmui\b/, /\bmaterial\s*design\b/],
        skill: "Material-UI",
      },
      {
        patterns: [/\bredux\b/, /\bredux\s*toolkit\b/, /\brtk\b/],
        skill: "Redux",
      },
      {
        patterns: [/\bjquery\b/, /\bjq\b/],
        skill: "jQuery",
      },
      {
        patterns: [/\bwebpack\b/, /\bvite\b/, /\bparcel\b/, /\brollup\b/],
        skill: "Build Tools",
      },

      // Backend Technologies
      {
        patterns: [/\bnode\b/, /\bnodejs\b/, /\bnode\.js\b/, /\bserver\s*side\s*js\b/],
        skill: "Node.js",
      },
      {
        patterns: [/\bexpress\b/, /\bexpressjs\b/, /\bexpress\.js\b/],
        skill: "Express",
      },
      {
        patterns: [/\bdjango\b/, /\bdjango\s*rest\b/, /\bdrf\b/],
        skill: "Django",
      },
      {
        patterns: [/\bflask\b/, /\bflask\s*api\b/],
        skill: "Flask",
      },
      {
        patterns: [/\blaravel\b/, /\bphp\s*laravel\b/],
        skill: "Laravel",
      },
      {
        patterns: [/\bspring\b/, /\bspring\s*boot\b/, /\bspring\s*framework\b/],
        skill: "Spring",
      },
      {
        patterns: [/\bruby\s*on\s*rails\b/, /\brails\b/, /\bror\b/],
        skill: "Ruby on Rails",
      },
      {
        patterns: [/\basp\.net\b/, /\baspnet\b/],
        skill: "ASP.NET",
      },
      {
        patterns: [/\bfastapi\b/, /\bfast\s*api\b/],
        skill: "FastAPI",
      },
      {
        patterns: [/\bnestjs\b/, /\bnest\.js\b/, /\bnest\s*framework\b/],
        skill: "NestJS",
      },

      // Databases with comprehensive coverage
      {
        patterns: [/\bmysql\b/, /\bmy\s*sql\b/, /\bmariadb\b/],
        skill: "MySQL",
      },
      {
        patterns: [/\bpostgresql\b/, /\bpostgres\b/, /\bpsql\b/],
        skill: "PostgreSQL",
      },
      {
        patterns: [/\bmongodb\b/, /\bmongo\b/, /\bnosql\b/],
        skill: "MongoDB",
      },
      {
        patterns: [/\bredis\b/, /\bcaching\b/, /\bmemcached\b/],
        skill: "Redis",
      },
      {
        patterns: [/\belasticsearch\b/, /\belastic\b/, /\bes\b/, /\belk\b/],
        skill: "Elasticsearch",
      },
      {
        patterns: [/\bsqlite\b/, /\bsql\s*lite\b/],
        skill: "SQLite",
      },
      {
        patterns: [/\boracle\b/, /\boracle\s*db\b/],
        skill: "Oracle",
      },
      {
        patterns: [/\bsql\s*server\b/, /\bmssql\b/, /\bmicrosoft\s*sql\b/],
        skill: "SQL Server",
      },
      {
        patterns: [/\bdynamodb\b/, /\bdynamo\s*db\b/],
        skill: "DynamoDB",
      },
      {
        patterns: [/\bcassandra\b/, /\bcql\b/],
        skill: "Cassandra",
      },

      // Cloud Platforms
      {
        patterns: [
          /\baws\b/,
          /\bamazon\s*web\s*services\b/,
          /\bec2\b/,
          /\bs3\b/,
          /\blambda\b/,
          /\brds\b/,
        ],
        skill: "AWS",
      },
      {
        patterns: [/\bazure\b/, /\bmicrosoft\s*azure\b/, /\bazure\s*cloud\b/],
        skill: "Azure",
      },
      {
        patterns: [/\bgcp\b/, /\bgoogle\s*cloud\b/, /\bgce\b/, /\bgke\b/],
        skill: "Google Cloud",
      },
      {
        patterns: [/\bfirebase\b/, /\bfirestore\b/],
        skill: "Firebase",
      },
      {
        patterns: [/\bheroku\b/, /\bdigital\s*ocean\b/, /\blinode\b/],
        skill: "Cloud Hosting",
      },

      // DevOps & Tools
      {
        patterns: [/\bdocker\b/, /\bcontainerization\b/, /\bcontainer\b/],
        skill: "Docker",
      },
      {
        patterns: [/\bkubernetes\b/, /\bk8s\b/, /\borchestration\b/],
        skill: "Kubernetes",
      },
      {
        patterns: [/\bjenkins\b/, /\bci\s*cd\b/, /\bcontinuous\s*integration\b/],
        skill: "CI/CD",
      },
      {
        patterns: [/\bgitlab\b/, /\bgitlab\s*ci\b/],
        skill: "GitLab",
      },
      {
        patterns: [/\bgithub\b/, /\bgithub\s*actions\b/],
        skill: "GitHub",
      },
      {
        patterns: [/\bterraform\b/, /\binfrastructure\s*as\s*code\b/, /\biac\b/],
        skill: "Terraform",
      },
      {
        patterns: [/\bansible\b/, /\bplaybook\b/],
        skill: "Ansible",
      },
      {
        patterns: [/\bgit\b/, /\bversion\s*control\b/, /\bvcs\b/],
        skill: "Git",
      },

      // Mobile Development
      {
        patterns: [/\breact\s*native\b/, /\brnative\b/],
        skill: "React Native",
      },
      {
        patterns: [/\bflutter\b/, /\bdart\b/],
        skill: "Flutter",
      },
      {
        patterns: [/\bios\b/, /\bxcode\b/, /\bswiftui\b/],
        skill: "iOS Development",
      },
      {
        patterns: [/\bandroid\b/, /\bandroid\s*studio\b/, /\bjetpack\b/],
        skill: "Android Development",
      },

      // Testing
      {
        patterns: [/\bjest\b/, /\bmocha\b/, /\bchai\b/, /\bunit\s*test\b/],
        skill: "Testing",
      },
      {
        patterns: [/\bcypress\b/, /\bselenium\b/, /\be2e\b/, /\bintegration\s*test\b/],
        skill: "E2E Testing",
      },

      // API & Architecture
      {
        patterns: [/\brest\b/, /\brestful\b/, /\brest\s*api\b/],
        skill: "REST API",
      },
      {
        patterns: [/\bgraphql\b/, /\bapollo\b/],
        skill: "GraphQL",
      },
      {
        patterns: [/\bmicroservices\b/, /\bmicroservice\b/, /\bservice\s*oriented\b/],
        skill: "Microservices",
      },
      {
        patterns: [/\bapi\b/, /\bwebservice\b/, /\bweb\s*service\b/],
        skill: "API Development",
      },

      // Methodologies
      {
        patterns: [/\bagile\b/, /\bscrum\b/, /\bkanban\b/],
        skill: "Agile",
      },
      {
        patterns: [/\bdevops\b/, /\bsre\b/, /\bsite\s*reliability\b/],
        skill: "DevOps",
      },

      // Data & Analytics
      {
        patterns: [/\bmachine\s*learning\b/, /\bml\b/, /\bai\b/, /\bartificial\s*intelligence\b/],
        skill: "Machine Learning",
      },
      {
        patterns: [/\bdata\s*science\b/, /\bdata\s*analysis\b/, /\banalytics\b/],
        skill: "Data Science",
      },
      {
        patterns: [/\bbig\s*data\b/, /\bhadoop\b/, /\bspark\b/],
        skill: "Big Data",
      },

      // Specific Job Role Keywords that indicate skills
      {
        patterns: [/\bfrontend\b/, /\bfront-end\b/, /\bfront\s*end\b/],
        skill: "Frontend Development",
      },
      {
        patterns: [/\bbackend\b/, /\bback-end\b/, /\bback\s*end\b/],
        skill: "Backend Development",
      },
      {
        patterns: [/\bfullstack\b/, /\bfull-stack\b/, /\bfull\s*stack\b/],
        skill: "Full Stack Development",
      },
      {
        patterns: [/\bmobile\s*dev\b/, /\bmobile\s*app\b/, /\bapp\s*development\b/],
        skill: "Mobile Development",
      },
    ];

    // Check each skill pattern
    skillPatterns.forEach(({ patterns, skill }) => {
      const hasSkill = patterns.some((pattern) => pattern.test(cleanText));
      if (hasSkill) {
        skills.add(skill);
      }
    });

    return Array.from(skills);
  }

  protected determineJobType(
    text: string
  ): "full-time" | "part-time" | "contract" | "internship" | "remote" {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("intern") || lowerText.includes("internship")) {
      return "internship";
    }
    if (
      lowerText.includes("contract") ||
      lowerText.includes("freelance") ||
      lowerText.includes("consultant")
    ) {
      return "contract";
    }
    if (lowerText.includes("part-time") || lowerText.includes("part time")) {
      return "part-time";
    }
    if (lowerText.includes("remote") || lowerText.includes("work from home")) {
      return "remote";
    }

    return "full-time";
  }

  protected cleanText(text: string): string {
    return text
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/…/g, "")
      .replace(/\bnew(?=\d+)/i, "") // Remove "new" from date strings
      .trim();
  }

  public abstract scrapeJobs(
    onJobScraped: (job: Job) => Promise<void>,
    searchQuery?: string,
    location?: string
  ): Promise<ScrapingResult>;

  protected createJob(data: {
    title: string;
    company: string;
    location: string;
    description: string;
    url: string;
    salary?: string;
    postedDate?: Date;
  }): Job {
    // Extract skills from both title and description for comprehensive coverage
    const titleSkills = this.extractSkillsFromText(data.title);
    const descriptionSkills = this.extractSkillsFromText(data.description);
    const companySkills = this.extractSkillsFromText(data.company);

    // Combine all skills and remove duplicates
    const allSkills = [...new Set([...titleSkills, ...descriptionSkills, ...companySkills])];

    const jobType = this.determineJobType(`${data.title} ${data.description}`);

    let cleanedLocation = this.cleanText(data.location);
    if (jobType === "remote") {
      cleanedLocation = cleanedLocation.replace(/\bremote\b/gi, "").trim();
      // Clean up leading commas or other separators if location becomes empty
      if (cleanedLocation.startsWith(",") || cleanedLocation.startsWith("-")) {
        cleanedLocation = cleanedLocation.substring(1).trim();
      }
      if (cleanedLocation === "") {
        cleanedLocation = "Remote"; // Default to remote if nothing is left
      }
    }

    const job: Job = {
      id: this.generateJobId(data.url, data.title),
      title: this.cleanText(data.title),
      company: this.cleanText(data.company),
      location: cleanedLocation,
      description: this.cleanText(data.description),
      url: data.url,
      skills: allSkills,
      jobType,
      source: this.sourceName,
      postedDate: data.postedDate || new Date(),
      extractedAt: new Date(),
    };

    if (data.salary) {
      job.salary = this.cleanText(data.salary);
    }

    return job;
  }
}
