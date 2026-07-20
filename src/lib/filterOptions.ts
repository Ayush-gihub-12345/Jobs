export const JOB_TYPES = [
  { v: "full-time", label: "Full-time" },
  { v: "internship", label: "Internship" },
  { v: "contract", label: "Contract" },
  { v: "part-time", label: "Part-time" },
];

// hireers only ever stores internship/fresher/entry-level postings (see worker/extract.ts
// isJuniorLevel) — mid/senior/lead are omitted here since they'd always show zero results.
export const LEVELS = [
  { v: "intern", label: "Intern" },
  { v: "entry", label: "Entry level (0–1 yrs)" },
];

export const CATEGORIES = [
  "engineering", "data", "design", "product", "marketing",
  "sales", "hr", "finance", "operations", "support", "other",
];

export const POSTED_WITHIN = [
  { v: "", label: "Any time" },
  { v: "1", label: "Last 24 hours" },
  { v: "7", label: "Last week" },
  { v: "30", label: "Last month" },
];

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

export const FILTER_KEYS = [
  "skills", "types", "levels", "categories", "companies",
  "location", "remote", "maxYears", "postedWithin",
];
