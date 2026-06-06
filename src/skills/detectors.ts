import aliasesData from "./skill-aliases.json";
import roleSkillsData from "./role-skills-map.json";
import type { Seniority, SkillEnhancementResult } from "./types";

const aliasMap: Record<string, string> = aliasesData;
const roleSkillMap: Record<string, { junior: string[]; mid: string[]; senior: string[] }> = roleSkillsData;

function getImpliedSkills(role: string, seniority: Seniority): string[] {
  const roleData = roleSkillMap[role];
  if (!roleData) {
    return [];
  }

  const levels: Seniority[] = ["junior", "mid", "senior"];
  const seniorityIndex = levels.indexOf(seniority);

  const implied: string[] = [];
  for (let i = 0; i <= seniorityIndex; i++) {
    const level = levels[i];
    implied.push(...roleData[level]);
  }

  return [...new Set(implied)];
}

function getAllRoles(): string[] {
  return Object.keys(roleSkillMap);
}

export function normalizeSkill(skill: string): string {
  const trimmed = skill.trim();
  const lower = trimmed.toLowerCase();
  return aliasMap[lower] || trimmed;
}

export function detectSeniority(title: string): Seniority {
  const lower = title.toLowerCase();

  const seniorMarkers = [
    /\bsenior\b/, /\bsr\.?\b/, /\blead\b/, /\bstaff\b/, /\bprincipal\b/,
    /\barchitect\b/, /\bhead\b/, /\bdirector\b/, /\bmanager\b/, /\bvp\b/,
    /\b5\s*\+\s*years\b/, /\b6\s*\+\s*years\b/, /\b7\s*\+\s*years\b/,
    /\b8\s*\+\s*years\b/, /\b10\s*\+\s*years\b/, /\b10\+?\s*yrs\b/,
  ];

  const juniorMarkers = [
    /\bjunior\b/, /\bjr\.?\b/, /\bentry\b/, /\bentry-level\b/, /\bassociate\b/,
    /\bintern\b/, /\binternship\b/, /\bgraduate\b/, /\bnew grad\b/,
    /\b0-2\s*years\b/, /\b0-3\s*years\b/, /\b1-2\s*years\b/, /\b1-3\s*years\b/,
  ];

  const hasSenior = seniorMarkers.some((marker) => marker.test(lower));
  const hasJunior = juniorMarkers.some((marker) => marker.test(lower));

  if (hasSenior && !hasJunior) {
    return "senior";
  }
  if (hasJunior && !hasSenior) {
    return "junior";
  }
  if (hasSenior && hasJunior) {
    return "senior";
  }
  return "mid";
}

export function detectRoles(title: string): string[] {
  const lower = title.toLowerCase();
  const allRoles = getAllRoles();
  const matchedRoles: string[] = [];

  for (const role of allRoles) {
    if (rolePatternMatches(role, lower)) {
      matchedRoles.push(role);
    }
  }

  return matchedRoles;
}

function rolePatternMatches(role: string, titleLower: string): boolean {
  const rolePatterns: Record<string, RegExp[]> = {
    frontend: [
      /\bfrontend\b/, /\bfront-end\b/, /\bfront\s*end\b/,
      /\bfront\s*end\s*(developer|engineer|engineer)\b/,
      /\bui\s*developer\b/, /\bui\s*engineer\b/,
      /\bweb\s*developer\b(?!\s*(java|php|python|node|backend|full))/,
    ],
    backend: [
      /\bbackend\b/, /\bback-end\b/, /\bback\s*end\b/,
      /\bbackend\s*(developer|engineer)\b/,
      /\bserver\s*(developer|engineer)\b/,
      /\bapi\s*(developer|engineer)\b/,
    ],
    fullstack: [
      /\bfullstack\b/, /\bfull-stack\b/, /\bfull\s*stack\b/,
      /\bfull\s*stack\s*(developer|engineer)\b/,
    ],
    mobile: [
      /\bmobile\b/, /\bandroid\b/, /\bios\b/, /\bflutter\b/,
      /\breact\s*native\b/, /\bxamarin\b/, /\bapp\s*developer\b/,
      /\bmobile\s*(developer|engineer|app)\b/,
    ],
    devops: [
      /\bdevops\b/, /\bsre\b/, /\bsite\s*reliability\b/,
      /\bplatform\s*engineer\b/, /\binfra\s*engineer\b/,
      /\bcloud\s*engineer\b(?!\s*(aws|azure|gcp))/,
      /\boperations\b(?!\s*(manager|analyst))/,
    ],
    qa: [
      /\bqa\b/, /\bquality\b/, /\btest(?:er|ing|automation)?\b/,
      /\bautomation\s*(engineer|tester|developer)\b/,
      /\bqatest\b/, /\btest\s*engineer\b/,
    ],
    data: [
      /\bdata\s*(engineer|analyst|scientist)\b/,
      /\bdata\b(?=\s*(management|warehouse|platform))/,
    ],
    "data-science": [
      /\bdata\s*scientist\b/, /\bdata\s*science\b/,
      /\bresearch\s*scientist\b(?=\s*(machine|ml|ai))/,
    ],
    ml: [
      /\bml\b(?!\s*(engineer|model))/,
      /\bmachine\s*learning\b/,
      /\bml\s*engineer\b/, /\bai\s*engineer\b/,
      /\bai\s*research\b/,
    ],
    security: [
      /\bsecurity\b/, /\bcyber\b/, /\bpenetration\b/,
      /\bappsec\b/, /\binfosec\b/, /\bsecurity\s*engineer\b/,
      /\bsecurity\s*analyst\b/,
    ],
    dba: [
      /\bdba\b/, /\bdatabase\s*(admin|engineer|architect)\b/,
      /\bdata\s*admin\b/,
    ],
    cloud: [
      /\bcloud\b(?!\s*(engineer|architect))/,
      /\baws\b/, /\bazure\b/, /\bgcp\b/,
      /\bcloud\s*(engineer|architect|developer)\b/,
    ],
    embedded: [
      /\bembedded\b/, /\bfirmware\b/, /\brealtime\b/, /\brtOS\b/,
      /\bios\b(?=\s*(engineer|developer))/,
      /\bmicrocontroller\b/,
    ],
    blockchain: [
      /\bblockchain\b/, /\bweb3\b/, /\bsolidity\b/,
      /\bcrypto\b(?=\s*(developer|engineer))/,
      /\bnft\b(?=\s*(developer|engineer))/,
    ],
    "game-dev": [
      /\bgame\s*(developer|engineer|designer)\b/,
      /\bgameplay\b/, /\bunity\b(?=\s*(developer|engineer))/,
      /\bunreal\b(?=\s*(developer|engineer))/,
    ],
    "ar-vr": [
      /\bar\b/, /\bvr\b/, /\bmixed\s*reality\b/,
      /\bxr\b/, /\bmetaverse\b/,
    ],
    network: [
      /\bnetwork(?:ing)?\s*(engineer|admin|architect)\b/,
      /\bnetwork\s*engineer\b/, /\bcisco\b/,
    ],
    systems: [
      /\bsystems?\s*(engineer|programmer|developer)\b/,
      /\bsystem\s*programmer\b/, /\bcore\b(?=\s*(engineer|developer))/,
    ],
    "ui-ux": [
      /\bui[\s-]*ux\b/, /\buser\s*interface\b/, /\buser\s*experience\b/,
      /\bux\s*designer\b/, /\bui\s*designer\b/, /\bproduct\s*designer\b/,
    ],
    "software-architecture": [
      /\bsoftware\s*architect\b/, /\bsolutions?\s*architect\b/,
      /\bsystem\s*architect\b/, /\benterprise\s*architect\b/,
      /\barchitect\b(?=\s*(aws|azure|cloud|solutions))/,
    ],
    product: [
      /\bproduct\s*manager\b/, /\bproduct\s*owner\b/,
      /\bpm\b(?=\s*(google|facebook|amazon|apple|microsoft))/,
    ],
    "technical-writer": [
      /\btechnical\s*writer\b/, /\btechnical\s*author\b/,
      /\bdocs?\s*engineer\b/, /\bdocumentation\b(?=\s*(specialist|engineer))/,
    ],
    "sales-engineer": [
      /\bsales\s*engineer\b/, /\bse\b(?=\s*(aws|azure|gcp|technical))/,
      /\bsolutions\s*engineer\b(?!\s*(cloud|kubernetes))/,
    ],
    "site-reliability": [
      /\bsre\b/, /\bsite\s*reliability\b/,
      /\breliability\s*engineer\b/,
    ],
    platform: [
      /\bplatform\s*(engineer|developer)\b/,
      /\bdeveloper\s*experience\b/,
      /\bdevex\b/,
    ],
    analytics: [
      /\banalytics\b(?=\s*(engineer|manager|analyst))/,
      /\bbusiness\s*analyst\b/, /\bbi\s*analyst\b/,
    ],
    growth: [
      /\bgrowth\b(?=\s*(engineer|manager|marketing|hacker))/,
      /\bgrowth\s*marketing\b/,
    ],
  };

  const patterns = rolePatterns[role];
  if (!patterns) {
    const roleKeyword = new RegExp(`\\b${role.replace(/-/g, "[\\s-]")}\\b`, "i");
    return roleKeyword.test(titleLower);
  }

  return patterns.some((pattern) => pattern.test(titleLower));
}

export function enhanceJobSkills(
  title: string,
  extractedSkills: string[]
): SkillEnhancementResult {
  const detectedRoles = detectRoles(title);
  const detectedSeniority = detectSeniority(title);

  const normalizedExtracted = extractedSkills.map(normalizeSkill);

  const impliedSkills: string[] = [];
  for (const role of detectedRoles) {
    const roleImplied = getImpliedSkills(role, detectedSeniority);
    impliedSkills.push(...roleImplied);
  }

  const normalizedImplied = impliedSkills.map(normalizeSkill);

  const allSkills = [...normalizedExtracted, ...normalizedImplied];
  const finalSkills = [...new Set(allSkills)];

  const debugEnabled = process.env.SKILL_DEBUG === "true";
  if (debugEnabled) {
    console.log(`[SkillEnhancement] Title: "${title}"`);
    console.log(`[SkillEnhancement] Detected roles: ${detectedRoles.join(", ") || "none"}`);
    console.log(`[SkillEnhancement] Detected seniority: ${detectedSeniority}`);
    console.log(`[SkillEnhancement] Extracted skills: ${extractedSkills.length} -> ${normalizedExtracted.length} (normalized)`);
    console.log(`[SkillEnhancement] Implied skills: ${impliedSkills.length} -> ${normalizedImplied.length} (normalized)`);
    console.log(`[SkillEnhancement] Final skills: ${finalSkills.length}`);
    console.log(`[SkillEnhancement] Final skill list: ${finalSkills.slice(0, 20).join(", ")}${finalSkills.length > 20 ? "..." : ""}`);
  }

  return {
    extractedSkills: normalizedExtracted,
    impliedSkills: normalizedImplied,
    finalSkills,
    detectedRoles,
    detectedSeniority,
  };
}
