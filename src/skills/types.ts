export type Seniority = "junior" | "mid" | "senior";

export interface RoleSkillEntry {
  junior: string[];
  mid: string[];
  senior: string[];
}

export type RoleSkillMap = Record<string, RoleSkillEntry>;

export interface SkillEnhancementResult {
  extractedSkills: string[];
  impliedSkills: string[];
  finalSkills: string[];
  detectedRoles: string[];
  detectedSeniority: Seniority;
}
