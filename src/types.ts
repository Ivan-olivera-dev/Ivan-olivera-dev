/** Hand-written profile facts that do not come from the GitHub API. */
export interface Profile {
  username: string;
  handle: string;
  name: string;
  role: string;
  company: string;
  location: string;
  uptime: string;
  stack: string;
  focus: Array<{ title: string; detail: string }>;
  links: Array<{ label: string; value: string }>;
}

/** Live GitHub numbers; `null` means unavailable and is rendered as a dash, never invented. */
export interface ProfileStats {
  repos: number | null;
  stars: number | null;
  followers: number | null;
  contributions: number | null;
}

export interface ProfileData extends Profile {
  stats: ProfileStats;
  languages: Array<{ name: string; percentage: number }>;
}

/** Commit habits from public repositories; `null` peaks mean there were no commits. */
export interface Habits {
  total: number;
  /** Commits per local hour, index 0..23. */
  byHour: number[];
  /** Commits per local weekday, Monday first (index 0 = Mon .. 6 = Sun). */
  byWeekday: number[];
  peakHour: number | null;
  peakWeekday: number | null;
  timeZone: string;
}
