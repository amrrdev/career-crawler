# Skill Imputation Implementation Plan (Reference Only)

## Purpose

This document defines the full design for improving scraped job skills by combining:

1. extracted skills from job content (existing behavior), and
2. implied skills from role + seniority rules (new behavior).

This is a **design/reference document only**. No code implementation is included here.

---

## Problem Statement

The current scraper extracts skills primarily from raw text (title/description/company) using regex patterns. This misses many expected or implied skills because:

- different sites have inconsistent job description structures,
- many postings omit foundational skills (for example frontend posts not explicitly mentioning HTML/CSS),
- wording/aliases vary heavily (`nodejs`, `node.js`, `Node`, etc.),
- matching quality downstream depends on complete skill coverage.

This impacts the matcher service (candidate skills vs job skills) by under-representing actual job requirements.

---

## Goals

1. Keep scraper architecture simple and maintainable.
2. Add a central skill enhancement layer with zero per-scraper logic changes.
3. Preserve extracted skills, then enrich with implied skills.
4. Normalize aliases so matching is consistent.
5. Support role-level + seniority-level progression.
6. Cover 80-90% of common technical job families encountered in scraping.

---

## Non-Goals

- No ML model integration in this phase.
- No database schema changes in this phase.
- No confidence scoring columns in this phase.
- No separate storage for implied vs extracted skills in this phase (can be added later).

---

## High-Level Solution

When creating a job object:

1. Extract raw skills (current regex extraction).
2. Detect role(s) from job title.
3. Detect seniority from title.
4. Get implied skills for each detected role, progressively by level.
5. Normalize both extracted and implied skills through alias map.
6. Merge + deduplicate.
7. Save final skill array.

Key strategy decision:

- **Role detection policy = merge all matching roles (Option A).**
  - Better to over-include than under-include for matching use case.

---

## Planned File Structure

```text
src/
  skills/
    role-skills-map.json      # role -> { junior, mid, senior }
    skill-aliases.json        # alias -> canonical skill
    role-skills-map.ts        # typed loader/exports
    types.ts                  # Seniority and map types
    detectors.ts              # detectRoles, detectSeniority, getImpliedSkills, normalizeSkill
```

Main integration target:

- `src/scrapers/base-scraper.ts` (centralized in `createJob()` flow)

---

## Data Model Design

### 1) Role Skill Map (JSON)

Structure:

```json
{
  "frontend": {
    "junior": ["..."],
    "mid": ["..."],
    "senior": ["..."]
  }
}
```

Rules:

- Each role has exactly 3 levels: `junior`, `mid`, `senior`.
- Higher levels add additional skills; lower-level fundamentals remain relevant.
- No requirement to avoid duplicate strings across levels (final dedup handles this), but map should try to keep entries clean.

### 2) Skill Alias Map (JSON)

Structure:

```json
{
  "react.js": "React",
  "reactjs": "React"
}
```

Rules:

- keys are lowercase aliases,
- values are canonical display names,
- apply normalization to both extracted and implied skills.

---

## Initial Role Coverage

Primary roles to include now:

- frontend
- backend
- fullstack
- devops
- mobile
- data
- security
- qa
- ml
- uiux

Deferred/optional later:

- embedded
- blockchain/web3

Rationale:

- primary set covers majority of scraped tech vacancies,
- avoids over-expanding into low-volume/noisy domains in first rollout.

---

## Seniority Detection Design

Output type:

- `junior` | `mid` | `senior`

Default behavior:

- if no clear marker is found, default to `mid`.

Marker examples:

### Senior markers

- `senior`, `sr`, `lead`, `staff`, `principal`, `architect`, `head`
- explicit experience markers such as `5+ years`, `6+ years`, `7+ years`, etc.

### Junior markers

- `junior`, `jr`, `entry`, `associate`, `intern`, `graduate`
- early experience markers such as `0-2 years`, `1-2 years`

### Mid markers

- explicit `mid`, `intermediate`, or implicit default when neither senior nor junior detected.

Conflict policy:

- if both junior and senior markers appear, senior wins.

---

## Role Detection Design

Input:

- job title text.

Behavior:

- return all roles whose keywords/patterns match title.

Policy:

- **merge all detected roles** (no strict priority tree initially).

Examples:

- `Senior React Frontend Developer` -> `frontend` (+ optional framework sub-match if defined).
- `Full Stack React Engineer` -> `fullstack` + `frontend` (if both markers exist).
- `DevOps / Platform Engineer` -> `devops`.

Why merge-all:

- practical and robust for real title noise,
- avoids brittle priority rules,
- dedup minimizes side effects.

---

## Progressive Skill Accumulation

Given detected `seniority`:

- junior -> include junior only,
- mid -> include junior + mid,
- senior -> include junior + mid + senior.

Given detected `roles`:

- implied skill set = union of all role-level skills up to seniority.

Pseudo behavior:

```ts
roles = detectRoles(title)
level = detectSeniority(title)
levelsToInclude = upTo(level)
implied = union(roleSkillMap[role][lvl] for each role and lvl)
```

---

## Skill Normalization Pipeline

For each skill from:

1. extracted list,
2. implied list,

Apply:

1. trim whitespace,
2. lowercase for alias lookup,
3. map alias to canonical name if present,
4. keep canonical value,
5. deduplicate with a Set.

Examples:

- `react.js` -> `React`
- `reactjs` -> `React`
- `nodejs` -> `Node.js`
- `k8s` -> `Kubernetes`
- `postgres` -> `PostgreSQL`

---

## Merge Strategy

Final skills output for each job:

```text
finalSkills = dedupe(normalize(extractedSkills) + normalize(impliedSkills))
```

Important:

- never replace extracted skills,
- implied skills are additive,
- dedup always applied last.

---

## Integration Point (Where This Will Run)

Primary integration point:

- `BaseScraper.createJob()` (or helper called from it).

Reason:

- every scraper funnels through this common path,
- enables enhancement without editing each site scraper,
- keeps behavior consistent across LinkedIn/Indeed/Glassdoor/Bayt/Wuzzuf.

---

## Observability and Debugging Plan

Optional debug logs (controlled by env flag):

- detected roles,
- detected seniority,
- extracted skill count,
- implied skill count,
- merged final count,
- top N final skills preview.

This helps validate if over-imputation becomes noisy.

---

## Edge Cases and Rules

1. No role detected:

- keep extracted skills only.

2. No extracted skills but role detected:

- keep implied skills only.

3. Non-tech role title (false-positive risk):

- rely on role keywords; if none match, no imputation.

4. Multiple roles detected:

- merge all, then dedup.

5. Seniority not detectable:

- default mid.

6. Alias map miss:

- keep original skill string.

---

## Risk Assessment

### Risk: Over-imputation

Potential issue:

- job gets extra skills not explicitly required.

Mitigation:

- conservative role keyword definitions,
- monitor final skill counts,
- tune role map entries over time,
- optional future split into `primarySkills` vs `niceToHave`.

### Risk: Title ambiguity

Potential issue:

- broad titles like `Software Engineer` may not map clearly.

Mitigation:

- map only when strong role terms are present,
- fallback to extracted-only behavior.

---

## Rollout Plan

1. Add new `src/skills/` data + helper modules.
2. Wire into base scraper central flow.
3. Run build and smoke scrape for each source.
4. Validate sample jobs in DB for skill quality.
5. Tune role map/aliases based on real outputs.

No DB migration required for phase 1.

---

## Validation Checklist

### Functional

- [ ] Extracted skills still present.
- [ ] Implied skills added when role detected.
- [ ] No duplicate skill names in final output.
- [ ] Alias normalization works as expected.

### Quality

- [ ] Frontend roles include core stack (HTML/CSS/JavaScript baseline).
- [ ] Backend roles include API/DB fundamentals.
- [ ] Fullstack roles include both frontend+backend expected baseline.
- [ ] Senior roles include advanced architecture/platform terms progressively.

### Compatibility

- [ ] Existing scrapers still run unchanged.
- [ ] Existing DB writes and matcher flow unaffected.

---

## Testing Strategy (Planned)

Unit tests:

- `detectSeniority(title)` with representative title matrix,
- `detectRoles(title)` multi-role and single-role cases,
- progressive accumulation correctness,
- alias normalization mapping,
- merge + dedup behavior.

Integration tests:

- `createJob()` output includes expected implied skills for known sample titles,
- no regression in existing skill extraction.

Regression samples:

- `Junior Frontend Developer`
- `Senior React Frontend Engineer`
- `Full Stack Node.js Developer`
- `Mid-Level DevOps Engineer`
- `QA Automation Engineer`
- `ML Engineer`
- `UI/UX Designer`

---

## Future Enhancements (Not in Phase 1)

1. Add `primarySkills` vs `niceToHave` distinction.
2. Store extracted vs implied source tags for explainability.
3. Add confidence score per skill.
4. Add title+description contextual weighting.
5. Add admin-configurable role map updates via API/UI.
6. Use skill ontology/graph for better relationship-aware matching.

---

## Decision Summary

- Centralized integration in base scraper: **Yes**
- Replace vs merge: **Merge**
- Role policy: **Merge all matched roles**
- Seniority model: **junior/mid/senior progressive**
- Normalization: **Yes, alias map on both extracted and implied**
- Data location: **JSON data + TypeScript typed loader**
- Initial role expansion: **include qa + ml + uiux (plus core roles)**

---

## Final Note

This plan is intentionally pragmatic: it increases match quality quickly without adding heavy ML dependencies or per-source scraper complexity. It keeps maintenance cost low while materially improving downstream candidate-job matching relevance.
