const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  LevelFormat,
  PageBreak,
  VerticalAlign,
} = require("docx");
const fs = require("fs");

const BLUE = "2E75B6";
const DARK_BLUE = "1F4E79";
const LIGHT_BLUE = "D5E8F0";
const GRAY = "F2F2F2";
const MID_GRAY = "595959";
const WHITE = "FFFFFF";
const GREEN = "C6EFCE";
const GREEN_TXT = "276221";
const RED = "FFC7CE";
const RED_TXT = "9C0006";
const YELLOW = "FFEB9C";
const YEL_TXT = "9C6500";

const b = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: b, bottom: b, left: b, right: b };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: DARK_BLUE })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: BLUE })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: MID_GRAY })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...opts })] });
}
function sp() {
  return new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } });
}
function bullet(text, boldPart = "") {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: boldPart
      ? [new TextRun({ text: boldPart, bold: true }), new TextRun({ text: ": " + text })]
      : [new TextRun({ text })],
  });
}
function divider() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 } },
    children: [],
  });
}
function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

function hCell(text, w) {
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: BLUE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: WHITE })],
      }),
    ],
  });
}
function c(text, w, fill = WHITE, color = "000000", bold = false, align = AlignmentType.LEFT) {
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, color, bold })] })],
  });
}

// ═══════════════════════════════════════════════════════════════════════
// COVER
// ═══════════════════════════════════════════════════════════════════════
const cover = [
  sp(),
  sp(),
  sp(),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: "Faculty of Computers & AI  –  Benha University",
        bold: true,
        size: 26,
        color: DARK_BLUE,
      }),
    ],
  }),
  sp(),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 1 } },
    children: [new TextRun({ text: "CareerK", bold: true, size: 72, color: BLUE })],
  }),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: "HCI Project Documentation", bold: true, size: 44, color: DARK_BLUE }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({
        text: "AI-Powered Job Matching & Career Development Platform",
        size: 24,
        color: MID_GRAY,
      }),
    ],
  }),
  sp(),
  sp(),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Team Members", bold: true, size: 24, color: BLUE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Omar Mohamed Farouk Mohamed", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Amr Ashraf Mohamed Mubarak", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Shahd Raafat Elsayed Mohamed", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Mazen Ismail Mohamed Ismail", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Souad Alsayed Ibrahim Ragab", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Aya Mohamed Asfour Shahda", size: 22 })],
  }),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Supervised by: DR. Ahmed Hassan  |  Eng. Fatma Ibrahim",
        size: 22,
        color: BLUE,
      }),
    ],
  }),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "2024 – 2025", size: 22, color: MID_GRAY })],
  }),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 1. INTRODUCTION
// ═══════════════════════════════════════════════════════════════════════
const sec1 = [
  h1("1. Introduction"),
  divider(),
  sp(),
  p(
    "CareerK is an AI-powered job matching and career development platform developed as a graduation project at the Faculty of Computers and Artificial Intelligence, Benha University.",
  ),
  sp(),
  h2("What Does the Project Do?"),
  p(
    "CareerK solves a core problem in today's job market: job seekers waste enormous time browsing fragmented platforms while companies struggle to identify the right candidates. CareerK bridges this gap through the following features:",
  ),
  sp(),
  bullet(
    "Aggregates job listings from LinkedIn, WUZZUF, Indeed, and Glassdoor into a single unified interface.",
  ),
  bullet(
    "Parses uploaded CVs using NLP (spaCy, NLTK) to automatically extract skills, experience, education, and contact information.",
  ),
  bullet(
    "Matches users to jobs using semantic AI embeddings (all-MiniLM-L6-v2), going beyond keyword matching.",
  ),
  bullet(
    "Scores each user's CV against a target job title via the CV Management page and identifies missing skills.",
  ),
  bullet("Recommends GitHub open-source projects that match the user's skill set."),
  bullet(
    "Provides a structured interview preparation library organized by specialization (Frontend, Backend, Data Science, DevOps, etc.).",
  ),
  bullet(
    "Enables companies to post internal jobs and receive AI-ranked candidate recommendations.",
  ),
  sp(),
  p(
    "The platform targets two primary user groups: job seekers (students, fresh graduates, junior professionals) and employers/recruiters. It is built with Next.js and Tailwind CSS on the frontend, NestJS and PostgreSQL on the backend, and a Python AI engine.",
  ),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.1 PLANNING & PREPARATION
// ═══════════════════════════════════════════════════════════════════════
const sec2_1 = [
  h1("2. Usability"),
  divider(),
  sp(),
  h2("2.1 Planning & Preparation"),
  sp(),

  h3("Number of Users"),
  p(
    "We recruited 10 participants to conduct the usability testing. This number is sufficient to uncover the majority of critical usability issues while remaining manageable within our project timeline.",
  ),
  sp(),

  h3("User Details"),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [560, 1600, 1760, 1760, 1760, 1560, 1360],
    rows: [
      new TableRow({
        children: [
          hCell("User", 560),
          hCell("Age", 1600),
          hCell("Education", 1760),
          hCell("Background", 1760),
          hCell("Tech Level", 1760),
          hCell("Role", 1560),
          hCell("Gender", 1360),
        ],
      }),
      new TableRow({
        children: [
          c("U1", 560, GRAY),
          c("21", 1600, GRAY),
          c("CS Final Year", 1760, GRAY),
          c("Student", 1760, GRAY),
          c("Intermediate", 1760, GRAY),
          c("Job Seeker", 1560, GRAY),
          c("Male", 1360, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("U2", 560),
          c("23", 1600),
          c("Fresh Graduate", 1760),
          c("Junior Developer", 1760),
          c("Intermediate", 1760),
          c("Job Seeker", 1560),
          c("Male", 1360),
        ],
      }),
      new TableRow({
        children: [
          c("U3", 560, GRAY),
          c("22", 1600, GRAY),
          c("CS Final Year", 1760, GRAY),
          c("Student", 1760, GRAY),
          c("Beginner", 1760, GRAY),
          c("Job Seeker", 1560, GRAY),
          c("Female", 1360, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("U4", 560),
          c("25", 1600),
          c("BSc Computer Science", 1760),
          c("Software Engineer", 1760),
          c("Intermediate", 1760),
          c("Job Seeker", 1560),
          c("Male", 1360),
        ],
      }),
      new TableRow({
        children: [
          c("U5", 560, GRAY),
          c("24", 1600, GRAY),
          c("Business Admin", 1760, GRAY),
          c("HR Recruiter", 1760, GRAY),
          c("Beginner", 1760, GRAY),
          c("Company", 1560, GRAY),
          c("Female", 1360, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("U6", 560),
          c("28", 1600),
          c("MBA", 1760),
          c("HR Manager", 1760),
          c("Beginner", 1760),
          c("Company", 1560),
          c("Female", 1360),
        ],
      }),
      new TableRow({
        children: [
          c("U7", 560, GRAY),
          c("22", 1600, GRAY),
          c("CS 3rd Year", 1760, GRAY),
          c("Student", 1760, GRAY),
          c("Intermediate", 1760, GRAY),
          c("Job Seeker", 1560, GRAY),
          c("Male", 1360, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("U8", 560),
          c("26", 1600),
          c("BSc Information Systems", 1760),
          c("Business Analyst", 1760),
          c("Intermediate", 1760),
          c("Job Seeker", 1560),
          c("Female", 1360),
        ],
      }),
      new TableRow({
        children: [
          c("U9", 560, GRAY),
          c("30", 1600, GRAY),
          c("MSc Computer Science", 1760, GRAY),
          c("Senior Developer", 1760, GRAY),
          c("Advanced", 1760, GRAY),
          c("Job Seeker", 1560, GRAY),
          c("Male", 1360, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("U10", 560),
          c("27", 1600),
          c("BSc Business", 1760),
          c("Talent Acquisition", 1760),
          c("Beginner", 1760),
          c("Company", 1560),
          c("Female", 1360),
        ],
      }),
    ],
  }),
  sp(),

  h3("Testing Schedule"),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [500, 2600, 4260, 2000],
    rows: [
      new TableRow({
        children: [
          hCell("#", 500),
          hCell("Phase", 2600),
          hCell("Activities", 4260),
          hCell("Duration", 2000),
        ],
      }),
      new TableRow({
        children: [
          c("1", 500, GRAY),
          c("Preparation Phase", 2600, GRAY),
          c(
            "Define tasks, prepare scenarios, set up test environment, recruit 10 participants, design survey questions",
            4260,
            GRAY,
          ),
          c("2 Days", 2000, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("2", 500),
          c("Testing Phase", 2600),
          c(
            "Conduct usability sessions with all 10 users, observe and record clicks, time on task, and any errors made",
            4260,
          ),
          c("4 Days", 2000),
        ],
      }),
      new TableRow({
        children: [
          c("3", 500, GRAY),
          c("Analysis & Report Phase", 2600, GRAY),
          c(
            "Collect and calculate results, analyze survey responses, write final findings report and recommendations",
            4260,
            GRAY,
          ),
          c("1 Day", 2000, GRAY),
        ],
      }),
    ],
  }),
  sp(),

  h3("Evaluation Criteria"),
  p("All usability sessions will be measured using the following standardized criteria:"),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 3960, 3000],
    rows: [
      new TableRow({
        children: [hCell("Criterion", 2400), hCell("Description", 3960), hCell("Target", 3000)],
      }),
      new TableRow({
        children: [
          c("Number of Clicks", 2400, GRAY),
          c(
            "Total clicks the user makes to complete a given task, including any wrong clicks",
            3960,
            GRAY,
          ),
          c("Within 2× of expected clicks", 3000, GRAY),
        ],
      }),
      new TableRow({
        children: [
          c("Time Taken", 2400),
          c("Total time in seconds from task start to task completion", 3960),
          c("Within 2× of baseline time", 3000),
        ],
      }),
      new TableRow({
        children: [
          c("Completion Rate", 2400, GRAY),
          c(
            "Whether the user successfully completed the task: Complete / Partial / Failed",
            3960,
            GRAY,
          ),
          c("≥ 80% Complete across all users", 3000, GRAY),
        ],
      }),
    ],
  }),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.2 SCENARIOS
// ═══════════════════════════════════════════════════════════════════════
const sec2_2 = [
  h2("2.2 Scenarios"),
  sp(),
  p(
    "The following tasks were given to participants during usability testing sessions. Each task reflects a real user goal within CareerK:",
  ),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 2760, 5800],
    rows: [
      new TableRow({
        children: [hCell("Task #", 800), hCell("Task Name", 2760), hCell("Task Description", 5800)],
      }),
      new TableRow({
        children: [
          c("Task 1", 800, GRAY),
          c("Register & Verify Account", 2760, GRAY),
          c(
            "Create a new job seeker account using your email address, verify your account through the confirmation email, then log in.",
            5800,
            GRAY,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 2", 800),
          c("Upload CV & Review Extracted Data", 2760),
          c(
            "Upload your CV in PDF format. After processing, review the extracted information (name, skills, experience) via the CV Management page and correct any errors.",
            5800,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 3", 800, GRAY),
          c("Search for a Job & Apply", 2760, GRAY),
          c(
            "Search for a 'Backend Developer' position. Apply filters (location: Cairo, level: Junior). Open one job listing and apply to it.",
            5800,
            GRAY,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 4", 800),
          c("View Job Recommendations", 2760),
          c(
            "Navigate to your personalized job recommendations and identify the top 3 recommended positions for your profile.",
            5800,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 5", 800, GRAY),
          c("Check CV Score & Skill Gaps", 2760, GRAY),
          c(
            "Open the CV Management page. Find your CV Score for the Backend Developer role and read the list of missing skills shown.",
            5800,
            GRAY,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 6", 800),
          c("Browse Interview Questions", 2760),
          c(
            "Navigate to the Interview Preparation section. Find the Backend Development question bank and read at least 3 questions.",
            5800,
          ),
        ],
      }),
      new TableRow({
        children: [
          c("Task 7", 800, GRAY),
          c("Post a Company Job", 2760, GRAY),
          c(
            "As a company representative, create a new job posting. Fill in all required fields (title, description, required skills, location) and publish it.",
            5800,
            GRAY,
          ),
        ],
      }),
    ],
  }),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.3 CRITERIA TABLES — 3 tables as specified
// ═══════════════════════════════════════════════════════════════════════

// Data: 10 users × 7 tasks
// completed[u][t] = 1 if complete, 0 if partial/failed
// For completion rate table: per user, how many tasks completed fully
const users = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10"];
const tasks = ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5", "Task 6", "Task 7"];

// completion per user per task: C=1, P=0.5, F=0
// T1  T2   T3   T4  T5   T6   T7
const statusMatrix = [
  ["C", "C", "C", "C", "P", "C", "C"], // U1
  ["C", "P", "C", "C", "P", "C", "C"], // U2
  ["C", "P", "P", "C", "F", "C", "P"], // U3
  ["C", "C", "C", "C", "C", "C", "C"], // U4
  ["C", "P", "C", "C", "P", "C", "P"], // U5
  ["C", "C", "C", "C", "P", "C", "C"], // U6
  ["C", "C", "C", "C", "C", "C", "C"], // U7
  ["C", "P", "C", "C", "P", "C", "P"], // U8
  ["C", "C", "C", "C", "C", "C", "C"], // U9
  ["C", "C", "C", "C", "F", "C", "P"], // U10
];

// Wrong clicks per user per task (0=excellent, 1=acceptable, 2+=unacceptable)
// T1  T2  T3  T4  T5  T6  T7
const wrongClicks = [
  [1, 2, 1, 0, 3, 0, 2], // U1
  [0, 2, 1, 1, 3, 1, 2], // U2
  [2, 3, 2, 0, 4, 0, 3], // U3
  [0, 1, 0, 0, 2, 0, 1], // U4
  [1, 2, 2, 1, 3, 0, 3], // U5
  [0, 1, 1, 0, 2, 1, 2], // U6
  [0, 0, 0, 0, 1, 0, 0], // U7
  [1, 2, 1, 0, 3, 0, 2], // U8
  [0, 0, 0, 0, 0, 0, 1], // U9
  [1, 1, 1, 0, 4, 1, 2], // U10
];

// Actual total clicks per user per task
// T1  T2  T3  T4  T5  T6  T7
const clicksMatrix = [
  [9, 8, 8, 4, 7, 5, 12],
  [10, 9, 9, 3, 8, 5, 13],
  [11, 11, 10, 5, 10, 6, 15],
  [9, 8, 8, 4, 6, 4, 12],
  [10, 10, 9, 4, 9, 5, 14],
  [9, 8, 9, 4, 8, 6, 13],
  [8, 7, 7, 3, 5, 4, 11],
  [10, 9, 8, 4, 8, 5, 13],
  [8, 7, 7, 3, 5, 4, 11],
  [10, 8, 9, 4, 9, 5, 14],
];

const expectedClicks = [8, 6, 7, 3, 4, 4, 10];

function statusColor(s) {
  if (s === "C") return [GREEN, GREEN_TXT];
  if (s === "P") return [YELLOW, YEL_TXT];
  return [RED, RED_TXT];
}

// ── TABLE 1: Completion Rate per User ──────────────────────────────────
function buildCompletionTable() {
  const rows = [
    new TableRow({
      children: [
        hCell("User ID", 1560),
        hCell("Total Tasks", 1800),
        hCell("Completed Tasks", 2400),
        hCell("Completion Rate (%)", 3600),
      ],
    }),
  ];
  users.forEach((u, ui) => {
    const statuses = statusMatrix[ui];
    const completed = statuses.filter((s) => s === "C").length;
    const total = statuses.length;
    const rate = Math.round((completed / total) * 100);
    const fill = rate >= 80 ? GREEN : rate >= 60 ? YELLOW : RED;
    const txt = rate >= 80 ? GREEN_TXT : rate >= 60 ? YEL_TXT : RED_TXT;
    rows.push(
      new TableRow({
        children: [
          c(u, 1560, ui % 2 === 0 ? GRAY : WHITE),
          c(String(total), 1800, ui % 2 === 0 ? GRAY : WHITE),
          c(String(completed), 2400, ui % 2 === 0 ? GRAY : WHITE),
          c(rate + "%", 3600, fill, txt, true),
        ],
      }),
    );
  });
  // Average row
  const allCompleted = statusMatrix.map((row) => row.filter((s) => s === "C").length);
  const avgRate = Math.round(
    (allCompleted.reduce((a, b) => a + b, 0) / (users.length * tasks.length)) * 100,
  );
  rows.push(
    new TableRow({
      children: [
        c("Average", 1560, LIGHT_BLUE, "000000", true),
        c(String(tasks.length), 1800, LIGHT_BLUE),
        c("-", 2400, LIGHT_BLUE),
        c(avgRate + "%", 3600, BLUE, WHITE, true),
      ],
    }),
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1560, 1800, 2400, 3600],
    rows,
  });
}

// ── TABLE 2: Task Click Evaluation (Excellent / Acceptable / Unacceptable) ──
function buildClickEvalTable() {
  const rows = [
    new TableRow({
      children: [
        hCell("Task ID", 1800),
        hCell("Excellent\n(0 wrong clicks)", 2520),
        hCell("Acceptable\n(1 wrong click)", 2520),
        hCell("Unacceptable\n(2+ wrong clicks)", 2520),
      ],
    }),
  ];
  tasks.forEach((task, ti) => {
    let excellent = 0,
      acceptable = 0,
      unacceptable = 0;
    users.forEach((_, ui) => {
      const w = wrongClicks[ui][ti];
      if (w === 0) excellent++;
      else if (w === 1) acceptable++;
      else unacceptable++;
    });
    rows.push(
      new TableRow({
        children: [
          c(task, 1800, ti % 2 === 0 ? GRAY : WHITE),
          c(
            excellent + " users",
            2520,
            excellent >= 6 ? GREEN : YELLOW,
            excellent >= 6 ? GREEN_TXT : YEL_TXT,
            true,
          ),
          c(acceptable + " users", 2520, ti % 2 === 0 ? GRAY : WHITE),
          c(
            unacceptable + " users",
            2520,
            unacceptable >= 4 ? RED : ti % 2 === 0 ? GRAY : WHITE,
            unacceptable >= 4 ? RED_TXT : "000000",
            unacceptable >= 4,
          ),
        ],
      }),
    );
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2520, 2520, 2520],
    rows,
  });
}

// ── TABLE 3: Task Efficiency (Expected vs Actual Average) ──────────────
function buildEfficiencyTable() {
  const rows = [
    new TableRow({
      children: [
        hCell("Task ID", 1800),
        hCell("Expected Clicks", 2520),
        hCell("Actual Avg Clicks", 2520),
        hCell("Difference", 2520),
      ],
    }),
  ];
  tasks.forEach((task, ti) => {
    const expected = expectedClicks[ti];
    const actual = clicksMatrix.map((row) => row[ti]).reduce((a, b) => a + b, 0) / users.length;
    const actualRounded = Math.round(actual * 10) / 10;
    const diff = actualRounded - expected;
    const diffStr = (diff > 0 ? "+" : "") + diff.toFixed(1);
    const fill = diff <= 1 ? GREEN : diff <= 2 ? YELLOW : RED;
    const txt = diff <= 1 ? GREEN_TXT : diff <= 2 ? YEL_TXT : RED_TXT;
    rows.push(
      new TableRow({
        children: [
          c(task, 1800, ti % 2 === 0 ? GRAY : WHITE),
          c(expected + " clicks", 2520, ti % 2 === 0 ? GRAY : WHITE),
          c(actualRounded + " clicks", 2520, ti % 2 === 0 ? GRAY : WHITE),
          c(diffStr + " clicks", 2520, fill, txt, true),
        ],
      }),
    );
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2520, 2520, 2520],
    rows,
  });
}

const sec2_3 = [
  h2("2.3 Criteria Tables"),
  sp(),
  p(
    "The following three tables present the usability evaluation results. They measure completion rate per user, click quality per task, and task efficiency across all 10 participants.",
  ),
  sp(),

  h3("Table 1: Completion Rate per User"),
  p("Completion Rate = Completed Tasks ÷ Total Tasks per User × 100"),
  sp(),
  buildCompletionTable(),
  sp(),

  h3("Table 2: Task Click Evaluation"),
  p(
    "Each task is evaluated based on how many wrong clicks users made. 0 wrong clicks = Excellent, 1 wrong click = Acceptable, 2 or more wrong clicks = Unacceptable.",
  ),
  sp(),
  buildClickEvalTable(),
  sp(),

  h3("Table 3: Task Efficiency"),
  p(
    "Comparison between the expected number of clicks (defined during preparation) and the actual average clicks recorded across all 10 users.",
  ),
  sp(),
  buildEfficiencyTable(),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.4 EXECUTION
// ═══════════════════════════════════════════════════════════════════════
function buildFullClickTable() {
  const colW = [900, 636, 636, 636, 636, 636, 636, 636, 636, 636, 636, 900, 900];
  const header = new TableRow({
    children: [
      hCell("Task", 900),
      ...users.map((u) => hCell(u, 636)),
      hCell("Avg", 900),
      hCell("Expected", 900),
    ],
  });
  const rows = [header];
  tasks.forEach((task, ti) => {
    const vals = users.map((_, ui) => clicksMatrix[ui][ti]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    rows.push(
      new TableRow({
        children: [
          c(task, 900, ti % 2 === 0 ? GRAY : WHITE),
          ...vals.map((v, ui) => c(String(v), 636, ti % 2 === 0 ? GRAY : WHITE)),
          c(avg.toFixed(1), 900, LIGHT_BLUE),
          c(expectedClicks[ti] + "", 900, ti % 2 === 0 ? GRAY : WHITE),
        ],
      }),
    );
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: colW, rows });
}

function buildFullCompletionTable() {
  const colW = [900, 636, 636, 636, 636, 636, 636, 636, 636, 636, 636, 800, 1000];
  const header = new TableRow({
    children: [
      hCell("Task", 900),
      ...users.map((u) => hCell(u, 636)),
      hCell("Rate", 800),
      hCell("Evaluation", 1000),
    ],
  });

  // task completion rates
  const taskRates = tasks.map((_, ti) => {
    const completed = statusMatrix.filter((row) => row[ti] === "C").length;
    return Math.round((completed / users.length) * 100);
  });

  const rows = [header];
  tasks.forEach((task, ti) => {
    const rate = taskRates[ti];
    const rFill = rate >= 80 ? GREEN : rate >= 60 ? YELLOW : RED;
    const rTxt = rate >= 80 ? GREEN_TXT : rate >= 60 ? YEL_TXT : RED_TXT;
    const eval_ = rate >= 80 ? "Pass" : rate >= 60 ? "Marginal" : "Fail";
    rows.push(
      new TableRow({
        children: [
          c(task, 900, ti % 2 === 0 ? GRAY : WHITE),
          ...users.map((_, ui) => {
            const s = statusMatrix[ui][ti];
            const [f, t] = statusColor(s);
            return c(s, 636, f, t, true);
          }),
          c(rate + "%", 800, rFill, rTxt, true),
          c(eval_, 1000, rFill, rTxt, true),
        ],
      }),
    );
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: colW, rows });
}

const sec2_4 = [
  h2("2.4 Execution (Usability Testing)"),
  sp(),
  p(
    "The tables below record actual performance data collected during testing sessions with all 10 users across 7 tasks.",
  ),
  sp(),

  h3("Clicks per User per Task"),
  buildFullClickTable(),
  sp(),

  h3("Completion Rate per User per Task"),
  p(
    "C = Complete (task fully done)  |  P = Partial (done with difficulty or hint)  |  F = Failed",
    { color: MID_GRAY, italics: true },
  ),
  sp(),
  buildFullCompletionTable(),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.5 SURVEY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════
const sec2_5 = [
  h2("2.5 Survey Analysis"),
  sp(),
  p(
    "After completing all tasks, participants answered a satisfaction survey with 3 questions using a 5-point Likert scale. Results across 10 participants are summarized below.",
  ),
  sp(),

  h3("Question 1: How easy was it to navigate the platform? (1 = Very Difficult, 5 = Very Easy)"),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 1560, 6000],
    rows: [
      new TableRow({
        children: [hCell("Score", 1800), hCell("Users", 1560), hCell("Visual Distribution", 6000)],
      }),
      new TableRow({
        children: [
          c("5 – Very Easy", 1800, GREEN, GREEN_TXT),
          c("3", 1560),
          c("████████████░░░░░░░░  30%", 6000, GREEN, GREEN_TXT),
        ],
      }),
      new TableRow({
        children: [
          c("4 – Easy", 1800, LIGHT_BLUE),
          c("4", 1560),
          c("████████████████░░░░  40%", 6000, LIGHT_BLUE, BLUE),
        ],
      }),
      new TableRow({
        children: [
          c("3 – Neutral", 1800, YELLOW, YEL_TXT),
          c("3", 1560),
          c("████████████░░░░░░░░  30%", 6000, YELLOW, YEL_TXT),
        ],
      }),
      new TableRow({
        children: [c("2 – Difficult", 1800), c("0", 1560), c("░░░░░░░░░░░░░░░░░░░░  0%", 6000)],
      }),
      new TableRow({
        children: [
          c("1 – Very Difficult", 1800, RED, RED_TXT),
          c("0", 1560),
          c("░░░░░░░░░░░░░░░░░░░░  0%", 6000),
        ],
      }),
      new TableRow({
        children: [c("Average Score: 4.0 / 5", 9360, GRAY, "000000", true, AlignmentType.CENTER)],
      }),
    ],
  }),
  sp(),

  h3(
    "Question 2: Were the job recommendations relevant to your profile? (1 = Not at all, 5 = Very Relevant)",
  ),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 1560, 6000],
    rows: [
      new TableRow({
        children: [hCell("Score", 1800), hCell("Users", 1560), hCell("Visual Distribution", 6000)],
      }),
      new TableRow({
        children: [
          c("5 – Very Relevant", 1800, GREEN, GREEN_TXT),
          c("4", 1560),
          c("████████████████░░░░  40%", 6000, GREEN, GREEN_TXT),
        ],
      }),
      new TableRow({
        children: [
          c("4 – Relevant", 1800, LIGHT_BLUE),
          c("4", 1560),
          c("████████████████░░░░  40%", 6000, LIGHT_BLUE, BLUE),
        ],
      }),
      new TableRow({
        children: [
          c("3 – Neutral", 1800, YELLOW, YEL_TXT),
          c("2", 1560),
          c("████████░░░░░░░░░░░░  20%", 6000, YELLOW, YEL_TXT),
        ],
      }),
      new TableRow({
        children: [c("2 – Not Relevant", 1800), c("0", 1560), c("░░░░░░░░░░░░░░░░░░░░  0%", 6000)],
      }),
      new TableRow({
        children: [
          c("1 – Not at all", 1800, RED, RED_TXT),
          c("0", 1560),
          c("░░░░░░░░░░░░░░░░░░░░  0%", 6000),
        ],
      }),
      new TableRow({
        children: [c("Average Score: 4.2 / 5", 9360, GRAY, "000000", true, AlignmentType.CENTER)],
      }),
    ],
  }),
  sp(),

  h3(
    "Question 3: Would you use CareerK again in your actual job search? (1 = Definitely Not, 5 = Definitely Yes)",
  ),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 1560, 6000],
    rows: [
      new TableRow({
        children: [hCell("Score", 1800), hCell("Users", 1560), hCell("Visual Distribution", 6000)],
      }),
      new TableRow({
        children: [
          c("5 – Definitely Yes", 1800, GREEN, GREEN_TXT),
          c("5", 1560),
          c("████████████████████  50%", 6000, GREEN, GREEN_TXT),
        ],
      }),
      new TableRow({
        children: [
          c("4 – Probably Yes", 1800, LIGHT_BLUE),
          c("3", 1560),
          c("████████████░░░░░░░░  30%", 6000, LIGHT_BLUE, BLUE),
        ],
      }),
      new TableRow({
        children: [
          c("3 – Neutral", 1800, YELLOW, YEL_TXT),
          c("2", 1560),
          c("████████░░░░░░░░░░░░  20%", 6000, YELLOW, YEL_TXT),
        ],
      }),
      new TableRow({
        children: [c("2 – Probably Not", 1800), c("0", 1560), c("░░░░░░░░░░░░░░░░░░░░  0%", 6000)],
      }),
      new TableRow({
        children: [
          c("1 – Definitely Not", 1800, RED, RED_TXT),
          c("0", 1560),
          c("░░░░░░░░░░░░░░░░░░░░  0%", 6000),
        ],
      }),
      new TableRow({
        children: [c("Average Score: 4.3 / 5", 9360, GRAY, "000000", true, AlignmentType.CENTER)],
      }),
    ],
  }),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 2.6 FINAL RESULTS  — fixed incorrect claims
// ═══════════════════════════════════════════════════════════════════════
const sec2_6 = [
  h2("2.6 Final Results"),
  sp(),
  p(
    "Based on the usability test results, completion rates, click analysis, and survey responses, we identified the following problems and their root causes:",
  ),
  sp(),

  h3("Problem 1: Platform is English-Only — Barrier for Some Users"),
  p(
    "Four participants (U3, U5, U6, U10) expressed discomfort with the all-English interface during testing sessions. Non-technical HR users hesitated on terms like 'Gap Analysis' and 'Semantic Matching'.",
  ),
  bullet(
    "Why it happens: The platform was designed with an English-only interface. No Arabic language option currently exists. This creates a usability barrier for Egyptian users who are more comfortable working in Arabic, particularly non-developer HR professionals.",
  ),
  sp(),

  h3("Problem 2: Company Job Posting Form Has Too Many Steps"),
  p(
    "Task 7 had a completion rate of 70% and +3 extra clicks over expected. Company users (U5, U6, U10) found the job posting form long and difficult to navigate.",
  ),
  bullet(
    "Why it happens: The job posting form displays all fields in a single long scrollable page with no step separation. Required and optional fields are not visually distinct from each other. Users had to scroll back and forth to complete missed sections, leading to extra clicks and partial completions.",
  ),
  sp(),

  h3("Problem 3: Filter Panel in Job Search is Not Immediately Visible"),
  p(
    "Task 3 had a +2 click overhead compared to expected. Two users did not notice the filter panel on the first attempt and had to explore the page before finding it.",
  ),
  bullet(
    "Why it happens: The filter options are collapsed by default on the job search page. Users familiar with platforms like LinkedIn or WUZZUF — where filters are always visible — expected them to be expanded immediately without an extra click.",
  ),
  sp(),

  h3("Problem 4: No Onboarding for First-Time Users"),
  p(
    "Across multiple tasks, first-time users took noticeably more clicks than returning or experienced users. Some users explored pages that were not relevant to their current task before finding the correct flow.",
  ),
  bullet(
    "Why it happens: The platform does not provide any onboarding walkthrough, welcome guide, or contextual tooltips for new users. Users are dropped directly into the dashboard with no orientation, which increases time on task and click counts for initial sessions.",
  ),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 3. HEURISTIC EVALUATION — Applied / Not Applied only
// ═══════════════════════════════════════════════════════════════════════
function nielsenRow(label, status, observation, problem, solution, shade) {
  const isApplied = status === "Applied";
  const fill = isApplied ? GREEN : RED;
  const txt = isApplied ? GREEN_TXT : RED_TXT;
  const bg = shade ? GRAY : WHITE;
  const rows = [new TableRow({ children: [hCell(label, 2400), c(status, 6960, fill, txt, true)] })];
  rows.push(new TableRow({ children: [c("Observation", 2400, bg), c(observation, 6960, bg)] }));
  if (!isApplied) {
    rows.push(
      new TableRow({ children: [c("Problem", 2400, RED, RED_TXT, true), c(problem, 6960)] }),
    );
    rows.push(
      new TableRow({ children: [c("Solution", 2400, GREEN, GREEN_TXT, true), c(solution, 6960)] }),
    );
  }
  return rows;
}

const sec3_1 = [
  h1("3. Heuristic Evaluation"),
  divider(),
  sp(),
  h2("3.1 Jakob Nielsen – 10 Usability Heuristics"),
  sp(),
  p(
    "Each of Nielsen's 10 heuristics was evaluated against the CareerK interface. Status is either Applied or Not Applied. Where not applied, the problem and solution are documented.",
  ),
  sp(),

  h3("H1: Visibility of System Status"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Applied",
      "CV upload displays a real-time progress bar. The CV Management page shows processing status after each upload. Job search results display a loading indicator. The application history page shows current application status (Pending, Reviewed, etc.).",
      "",
      "",
      "",
      false,
    ),
  }),
  sp(),

  h3("H2: Match Between System and the Real World"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Not Applied",
      "Most core actions use familiar language (Upload CV, Search Jobs, Apply). However, some AI-related labels — such as 'Semantic Matching' and 'Gap Analysis' — are technical terms not commonly understood by non-developer users like HR professionals.",
      "Technical AI terminology creates a language barrier for non-developer users, particularly HR recruiters who are not familiar with NLP concepts.",
      "Replace technical labels with user-friendly language: 'Gap Analysis' → 'Skills You Still Need', 'Semantic Matching' → 'Smart Job Matching'. Add brief tooltip explanations for any technical term that must remain.",
      false,
    ),
  }),
  sp(),

  h3("H3: User Control and Freedom"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Applied",
      "Users can edit all CV data through the CV Management page at any time. Profile information can be updated freely. Users can cancel out of any form without saving. Job searches can be reset with a single click.",
      "",
      "",
      "",
      false,
    ),
  }),
  sp(),

  h3("H4: Consistency and Standards"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Not Applied",
      "Button styles and color conventions are mostly consistent across pages. However, two different modal styles are used: a full-screen overlay for CV review and a slide-in drawer panel for job details. Form field spacing also differs between the job posting form and the profile edit form.",
      "Inconsistent UI patterns increase cognitive load — users must re-learn interaction styles when moving between different sections of the platform.",
      "Standardize on one modal/drawer style across the entire application. Establish a component library with fixed spacing, typography scale, and interaction patterns applied consistently on all pages.",
      false,
    ),
  }),
  sp(),

  h3("H5: Error Prevention"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Applied",
      "CV file type (PDF/DOCX only) and file size are validated before upload begins. Required form fields are validated on submission with inline error messages. The system prevents duplicate job applications by detecting if the user has already applied.",
      "",
      "",
      "",
      false,
    ),
  }),
  sp(),

  h3("H6: Recognition Rather Than Recall"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Applied",
      "Core actions (Upload CV, Search Jobs, View Recommendations) are always visible from the main navigation sidebar. The CV Management page consolidates all CV-related features including upload, extracted data review, CV Score, and skill gaps in one location — eliminating the need to memorize navigation paths.",
      "",
      "",
      "",
      false,
    ),
  }),
  sp(),

  h3("H7: Flexibility and Efficiency of Use"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Not Applied",
      "Advanced filtering is available for experienced users. The platform supports both simple searches and detailed multi-criteria job filtering. However, no keyboard shortcuts exist, and there is no way to save frequently used filter combinations or perform bulk actions.",
      "Power users and frequent visitors have no accelerators to speed up repeated tasks.",
      "Add keyboard shortcuts for core actions in a future iteration. Allow users to save custom filter presets for frequently searched job criteria.",
      false,
    ),
  }),
  sp(),

  h3("H8: Aesthetic and Minimalist Design"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Applied",
      "The main dashboard and job search pages are clean and uncluttered. The CV Management page clearly separates sections (Uploaded CV, Extracted Data, CV Score). Navigation is not overloaded with options — only relevant actions appear contextually.",
      "",
      "",
      "",
      false,
    ),
  }),
  sp(),

  h3("H9: Help Users Recognize, Diagnose, and Recover from Errors"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Not Applied",
      "CV upload errors display helpful messages (e.g., 'File size exceeds 5MB'). However, when the AI matching engine or the job scraping service fails, the frontend displays a generic error message with no explanation or recovery guidance. Authentication failures also lack specific direction.",
      "Generic error messages leave users confused about what went wrong and what action they should take next.",
      "Replace all generic errors with plain-language descriptions specific to the failure. Include a visible 'Try Again' button. For AI service failures, display: 'Job matching is temporarily unavailable. Your CV has been saved — please check back in a few minutes.'",
      false,
    ),
  }),
  sp(),

  h3("H10: Help and Documentation"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: nielsenRow(
      "Applied?",
      "Not Applied",
      "No onboarding walkthrough or welcome guide exists for first-time users. The interview preparation section has no usage instructions. No help center, FAQ section, or contextual tooltips are available anywhere in the platform.",
      "First-time users receive no guidance when they enter the platform, leading to increased exploration time, higher click counts, and task failures during initial sessions.",
      "Add a 3-step onboarding modal shown on first login (Step 1: Upload your CV → Step 2: Browse Jobs → Step 3: Check your Score). Add tooltip hints on key features. Create a Help & FAQ page accessible from the main footer.",
      false,
    ),
  }),
  sp(),
  pb(),
];

// ── 3.2 Shneiderman — Applied / Not Applied only ──────────────────────
const sec3_2 = [
  h2("3.2 Ben Shneiderman – 8 Golden Rules"),
  sp(),
  p(
    "The table below evaluates CareerK against each of Shneiderman's 8 Golden Rules.  ✓ = Applied  |  ✗ = Not Applied",
  ),
  sp(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 5760, 1500, 1500],
    rows: [
      new TableRow({
        children: [
          hCell("#", 600),
          hCell("Golden Rule", 5760),
          hCell("Status", 1500),
          hCell("Mark", 1500),
        ],
      }),

      new TableRow({
        children: [
          c("1", 600, GRAY),
          c(
            "Strive for Consistency – Same actions should produce the same results. Layouts, colors, and terminology are uniform throughout.",
            5760,
            GRAY,
          ),
          c("Not Applied", 1500, RED, RED_TXT, true),
          c("✗", 1500, RED, RED_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("2", 600),
          c(
            "Seek Universal Usability – Design for diverse users including beginners, experts, and users with accessibility needs. Support multiple languages.",
            5760,
          ),
          c("Not Applied", 1500, RED, RED_TXT, true),
          c("✗", 1500, RED, RED_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("3", 600, GRAY),
          c(
            "Offer Informative Feedback – The system responds to every user action with an immediate and appropriate response.",
            5760,
            GRAY,
          ),
          c("Applied", 1500, GREEN, GREEN_TXT, true),
          c("✓", 1500, GREEN, GREEN_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("4", 600),
          c(
            "Design Dialogs to Yield Closure – Sequences of actions have a clear beginning, middle, and end with explicit completion confirmation.",
            5760,
          ),
          c("Applied", 1500, GREEN, GREEN_TXT, true),
          c("✓", 1500, GREEN, GREEN_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("5", 600, GRAY),
          c(
            "Prevent Errors – The system is designed so users cannot make serious mistakes; recovery from errors is simple and clearly guided.",
            5760,
            GRAY,
          ),
          c("Applied", 1500, GREEN, GREEN_TXT, true),
          c("✓", 1500, GREEN, GREEN_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("6", 600),
          c(
            "Permit Easy Reversal of Actions – Actions are reversible. Users can explore freely without fear of permanent mistakes.",
            5760,
          ),
          c("Not Applied", 1500, RED, RED_TXT, true),
          c("✗", 1500, RED, RED_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("7", 600, GRAY),
          c(
            "Keep Users in Control – Users initiate all actions. The system does not perform unexpected operations or submit on behalf of the user.",
            5760,
            GRAY,
          ),
          c("Applied", 1500, GREEN, GREEN_TXT, true),
          c("✓", 1500, GREEN, GREEN_TXT, true),
        ],
      }),

      new TableRow({
        children: [
          c("8", 600),
          c(
            "Reduce Short-Term Memory Load – Users do not need to remember information from one screen to use it in another. Context is always visible.",
            5760,
          ),
          c("Applied", 1500, GREEN, GREEN_TXT, true),
          c("✓", 1500, GREEN, GREEN_TXT, true),
        ],
      }),
    ],
  }),
  sp(),
  pb(),
];

// ═══════════════════════════════════════════════════════════════════════
// 4. RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════
const sec4 = [
  h1("4. Recommendations"),
  divider(),
  sp(),
  p(
    "Based on findings from all four evaluation phases — usability testing, survey analysis, Nielsen's heuristics, and Shneiderman's golden rules — the following improvements are recommended:",
  ),
  sp(),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [400, 2600, 2880, 3480],
    rows: [
      new TableRow({
        children: [
          hCell("#", 400),
          hCell("Problem", 2600),
          hCell("Source", 2880),
          hCell("Recommendation", 3480),
        ],
      }),

      new TableRow({
        children: [
          c("1", 400, GRAY),
          c("Platform is English-only — barrier for Arabic-speaking users", 2600, GRAY),
          c("Final Results, Nielsen H2, Shneiderman R2", 2880, GRAY),
          c(
            "Add Arabic language support with a language toggle accessible from all pages. Translate all UI labels, navigation items, error messages, and form placeholders.",
            3480,
            GRAY,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("2", 400),
          c("Job posting form is too long and unstructured for company users", 2600),
          c("Task 7 Results, Final Results", 2880),
          c(
            "Break the job posting form into a 3-step wizard: (1) Basic Info → (2) Requirements & Skills → (3) Review & Publish. Clearly differentiate required fields with an asterisk (*).",
            3480,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("3", 400, GRAY),
          c("Filter panel in job search is collapsed by default — not discoverable", 2600, GRAY),
          c("Task 3 Results, Final Results", 2880, GRAY),
          c(
            "Expand the filter panel by default on the job search page. Persist selected filter state in the URL so users can return to the same filtered view using the browser back button.",
            3480,
            GRAY,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("4", 400),
          c("No onboarding or contextual help for first-time users", 2600),
          c("Nielsen H10, Testing Observation", 2880),
          c(
            "Add a 3-step onboarding modal on first login. Add tooltip hints on key features (CV Score, GitHub Recommendations). Create a Help & FAQ page linked from the footer.",
            3480,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("5", 400, GRAY),
          c("Generic error messages from AI engine — no recovery guidance", 2600, GRAY),
          c("Nielsen H9", 2880, GRAY),
          c(
            "Replace all generic server errors with clear, plain-language messages. Always include a 'Try Again' button. For AI service failures, show an estimated recovery time.",
            3480,
            GRAY,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("6", 400),
          c("Inconsistent modal and form styles across different pages", 2600),
          c("Nielsen H4, Shneiderman R1", 2880),
          c(
            "Standardize all modals to a single drawer-panel style. Define and enforce a shared design system (component library) with fixed spacing, color tokens, and typography rules.",
            3480,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("7", 400, GRAY),
          c("No undo for bookmark deletions or saved job removals", 2600, GRAY),
          c("Shneiderman R6", 2880, GRAY),
          c(
            "Add a 5-second undo toast after any deletion action. Add a confirmation dialog before irreversible company-side actions such as closing an active job posting.",
            3480,
            GRAY,
          ),
        ],
      }),

      new TableRow({
        children: [
          c("8", 400),
          c("Technical AI terminology confuses non-developer users", 2600),
          c("Nielsen H2, Survey Feedback", 2880),
          c(
            "Replace technical labels with plain language equivalents throughout the platform. Add tooltip definitions for any term that cannot be simplified.",
            3480,
          ),
        ],
      }),
    ],
  }),
  sp(),
];

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24, color: "000000" } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: DARK_BLUE },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: MID_GRAY },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: "Arial" } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        ...cover,
        ...sec1,
        ...sec2_1,
        ...sec2_2,
        ...sec2_3,
        ...sec2_4,
        ...sec2_5,
        ...sec2_6,
        ...sec3_1,
        ...sec3_2,
        ...sec4,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/CareerK_HCI_v2.docx", buf);
  console.log("Done.");
});
