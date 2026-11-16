import { PROFILE } from "./profile.ts";
import type { ProfileData, ProfileStats } from "./types.ts";

const UNAVAILABLE: ProfileStats = { repos: null, stars: null, followers: null, contributions: null };
const LANGUAGE_LIMIT = 4;

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      followers { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges { size node { name } }
          }
        }
      }
      contributionsCollection {
        contributionCalendar { totalContributions }
      }
    }
  }
`;

function offline(): ProfileData {
  return { ...PROFILE, stats: { ...UNAVAILABLE }, languages: [] };
}

export async function fetchProfileData(
  username = PROFILE.username,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
): Promise<ProfileData> {
  if (!token) return offline();

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ivan-olivera-dev-profile-card"
      },
      body: JSON.stringify({ query: QUERY, variables: { login: username } })
    });

    if (!res.ok) {
      console.warn(`GitHub API returned ${res.status}; rendering stats as unavailable.`);
      return offline();
    }

    const user = ((await res.json()) as any)?.data?.user;
    if (!user) {
      console.warn("GitHub API returned no user; rendering stats as unavailable.");
      return offline();
    }

    const repos: any[] = user.repositories?.nodes ?? [];
    const langBytes = new Map<string, number>();
    let stars = 0;

    for (const repo of repos) {
      stars += repo.stargazerCount ?? 0;
      for (const edge of repo.languages?.edges ?? []) {
        langBytes.set(edge.node.name, (langBytes.get(edge.node.name) ?? 0) + (edge.size ?? 0));
      }
    }

    const total = [...langBytes.values()].reduce((sum, size) => sum + size, 0);
    const languages =
      total > 0
        ? [...langBytes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, LANGUAGE_LIMIT)
            .map(([name, size]) => ({ name, percentage: Math.max(1, Math.round((size / total) * 100)) }))
        : [];

    return {
      ...PROFILE,
      stats: {
        repos: user.repositories?.totalCount ?? null,
        stars,
        followers: user.followers?.totalCount ?? null,
        contributions: user.contributionsCollection?.contributionCalendar?.totalContributions ?? null
      },
      languages
    };
  } catch (error) {
    console.warn("Error fetching GitHub data; rendering stats as unavailable:", error);
    return offline();
  }
}
