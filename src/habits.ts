import type { Habits } from "./types.ts";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Public, non-fork repositories only: a local token can see private repos (see L7).
const QUERY = `
  query($login: String!, $since: GitTimestamp!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        nodes {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100, since: $since) {
                  nodes { committedDate author { user { login } } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Commit timestamps authored by `username` on the default branch of their public repositories.
 * Returns [] when no token is available or the API fails, so callers never invent numbers.
 */
export async function fetchCommitTimestamps(
  username: string,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  since = new Date(Date.now() - YEAR_MS).toISOString()
): Promise<string[]> {
  if (!token) return [];

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ivan-olivera-dev-profile-card"
      },
      body: JSON.stringify({ query: QUERY, variables: { login: username, since } })
    });

    if (!res.ok) {
      console.warn(`GitHub API returned ${res.status}; commit habits are unavailable.`);
      return [];
    }

    const repos = ((await res.json()) as any)?.data?.user?.repositories?.nodes;
    if (!Array.isArray(repos)) {
      console.warn("GitHub API returned no repositories; commit habits are unavailable.");
      return [];
    }

    const login = username.toLowerCase();
    const timestamps: string[] = [];
    for (const repo of repos) {
      for (const commit of repo?.defaultBranchRef?.target?.history?.nodes ?? []) {
        if (commit?.author?.user?.login?.toLowerCase() === login && commit.committedDate) {
          timestamps.push(commit.committedDate);
        }
      }
    }
    return timestamps;
  } catch (error) {
    console.warn("Error fetching commit history; commit habits are unavailable:", error);
    return [];
  }
}

function peakIndex(counts: number[]): number | null {
  const max = Math.max(...counts);
  return max > 0 ? counts.indexOf(max) : null;
}

/** Buckets ISO timestamps by local hour and Monday-first weekday in `timeZone` (DST-aware). */
export function aggregateHabits(timestamps: string[], timeZone = "Europe/Madrid"): Habits {
  const format = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "short" });
  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  let total = 0;

  for (const timestamp of timestamps) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const parts = format.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;
    const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
    if (!Number.isInteger(hour) || weekday < 0) continue;
    byHour[hour]++;
    byWeekday[weekday]++;
    total++;
  }

  return { total, byHour, byWeekday, peakHour: peakIndex(byHour), peakWeekday: peakIndex(byWeekday), timeZone };
}
