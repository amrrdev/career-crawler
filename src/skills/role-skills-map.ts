import roleSkillsData from "./role-skills-map.json";
import type { RoleSkillMap, Seniority } from "./types";

export const roleSkillMap: RoleSkillMap = roleSkillsData;

export function getImpliedSkills(role: string, seniority: Seniority): string[] {
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

export function getAllRoles(): string[] {
  return Object.keys(roleSkillMap);
}

export function hasRole(role: string): boolean {
  return role in roleSkillMap;
}
