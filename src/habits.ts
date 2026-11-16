import type { Habits } from "./types.ts";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Hard cap on GraphQL requests per refresh, so a runaway pagination can never hang the Action. */
const MAX_REQUESTS = 50;

// Public, non-fork repositories only: a local token can see private repos (see L7).
const REPOS_QUERY = `
  query($login: String!, $cursor: String) {
    user(login: $login) {
      id
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        pageInfo { hasNextPage endCursor }
        nodes { name defaultBranchRef { name } }
      }
    }
  }
`;

// `author: { id }` filters on the server, so only the user's own commits are transferred.
const HISTORY_QUERY = `
  query($owner: String!, $name: String!, $since: GitTimestamp!, $userId: ID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $cursor, since: $since, author: { id: $userId }) {
              pageInfo { hasNextPage endCursor }
              nodes { committedDate }
            }
          }
        }
      }
    }
  }
`;

class HabitsUnavailable extends Error {}
class RequestLimitReached extends Error {}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/**
 * Commit timestamps authored by `username` on the default branch of their public repositories,
 * paginating every repository page and every history page.
 *
 * Returns [] when no token is available or any request fails, including mid-pagination: a partial
 * year would render as if it were real data, while [] lets the caller keep the previous panel.
 * The only partial result is the MAX_REQUESTS safety stop, which is warned about explicitly.
 */
export async function fetchCommitTimestamps(
  username: string,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  since = new Date(Date.now() - YEAR_MS).toISOString()
): Promise<string[]> {
  if (!token) return [];

  let requests = 0;
  const graphql = async (query: string, variables: Record<string, unknown>): Promise<any> => {
    if (requests >= MAX_REQUESTS) throw new RequestLimitReached();
    requests++;
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ivan-olivera-dev-profile-card"
      },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) throw new HabitsUnavailable(`GitHub API returned ${res.status}; commit habits are unavailable.`);
    const data = ((await res.json()) as any)?.data;
    if (!data) throw new HabitsUnavailable("GitHub API returned no data; commit habits are unavailable.");
    return data;
  };

  const timestamps: string[] = [];
  try {
    let repoCursor: string | null = null;
    do {
      const user = (await graphql(REPOS_QUERY, { login: username, cursor: repoCursor }))?.user;
      const repos = user?.repositories;
      if (!user?.id || !Array.isArray(repos?.nodes)) {
        throw new HabitsUnavailable("GitHub API returned no repositories; commit habits are unavailable.");
      }

      for (const repo of repos.nodes) {
        if (!repo?.name || !repo.defaultBranchRef) continue; // empty repository: no history to read
        let historyCursor: string | null = null;
        do {
          const variables = { owner: username, name: repo.name, since, userId: user.id, cursor: historyCursor };
          const history = (await graphql(HISTORY_QUERY, variables))?.repository?.defaultBranchRef?.target?.history;
          if (!Array.isArray(history?.nodes)) {
            throw new HabitsUnavailable(`GitHub API returned no history for ${repo.name}; commit habits are unavailable.`);
          }
          for (const commit of history.nodes) if (commit?.committedDate) timestamps.push(commit.committedDate);
          historyCursor = nextCursor(history.pageInfo);
        } while (historyCursor);
      }
      repoCursor = nextCursor(repos.pageInfo);
    } while (repoCursor);
    return timestamps;
  } catch (error) {
    if (error instanceof RequestLimitReached) {
      console.warn(`Stopped after ${MAX_REQUESTS} requests; commit habits use the ${timestamps.length} commits collected so far.`);
      return timestamps;
    }
    if (error instanceof HabitsUnavailable) console.warn(error.message);
    else console.warn("Error fetching commit history; commit habits are unavailable:", error);
    return [];
  }
}

function nextCursor(pageInfo: PageInfo | undefined): string | null {
  return pageInfo?.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : null;
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
