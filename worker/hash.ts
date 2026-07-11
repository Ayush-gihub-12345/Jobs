import type { NormalizedJob } from "./ingest";

/** cyrb53 — fast, non-cryptographic string hash. Only used for change detection. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Fingerprint of every field that would trigger a DB write if it changed. */
export function hashJob(j: NormalizedJob): string {
  return cyrb53([
    j.title, j.location, j.remote ? 1 : 0, j.jobType, j.level,
    j.expMin, j.expMax, j.roleCategory, j.skills.join(","),
    j.description, j.applyUrl, j.postedAt,
  ].join(""));
}
