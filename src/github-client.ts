import type { SystemMetrics } from "./types.ts";

const DEFAULT_METRICS: SystemMetrics = {
  username: "Ivan-olivera-dev",
  name: "Iván Olivera González",
  role: "Software Engineer — Backend, Systems & Agentic Workflows",
  location: "Valencia, ES",
  website: "ivanolivera.dev",
  cardUrl: "card.ivanolivera.dev",
  summaryLines: [
    "Designing and building backend services,",
    "system architectures, and practical",
    "multi-agent development workflows."
  ],
  environment: "Node.js · TypeScript · Python · Docker · Linux",
  totalRepos: 12,
  totalContributions: 480,
  languages: [
    { name: "TypeScript & Node.js", percentage: 44, color: "#10b981" },
    { name: "Python", percentage: 26, color: "#34d399" },
    { name: "Linux & Shell (Bash)", percentage: 18, color: "#6ee7b7" },
    { name: "Java", percentage: 12, color: "#52525b" }
  ],
  currentWork: [
    {
      title: "Agentic Workflows & ODD",
      subtitle: "Organic-driven dev & tooling"
    },
    {
      title: "Backend & Systems",
      subtitle: "APIs, Docker infra & Linux"
    }
  ]
};

const PALETTE = ["#10b981", "#34d399", "#6ee7b7", "#52525b"];

export async function fetchSystemMetrics(
  username = "Ivan-olivera-dev",
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
): Promise<SystemMetrics> {
  if (!token) {
    return DEFAULT_METRICS;
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          totalCount
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                }
              }
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
          totalPullRequestContributions
          totalIssueContributions
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ivan-olivera-dev-dashboard"
      },
      body: JSON.stringify({ query, variables: { login: username } })
    });

    if (!res.ok) {
      console.warn(`GitHub API returned ${res.status}. Using default profile metrics.`);
      return DEFAULT_METRICS;
    }

    const json = (await res.json()) as any;
    const userData = json?.data?.user;

    if (!userData) {
      return DEFAULT_METRICS;
    }

    const repos = userData.repositories?.nodes || [];
    const totalRepos = userData.repositories?.totalCount || repos.length;
    const langTotals: Record<string, number> = {};

    for (const repo of repos) {
      const edges = repo.languages?.edges || [];
      for (const edge of edges) {
        const name = edge.node.name;
        const size = edge.size || 0;
        langTotals[name] = (langTotals[name] || 0) + size;
      }
    }

    const totalLangBytes = Object.values(langTotals).reduce((acc, curr) => acc + curr, 0);
    const sortedLangs = Object.entries(langTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const calculatedLanguages =
      sortedLangs.length > 0 && totalLangBytes > 0
        ? sortedLangs.map(([name, size], index) => ({
            name,
            percentage: Math.max(1, Math.round((size / totalLangBytes) * 100)),
            color: PALETTE[index] || "#52525b"
          }))
        : DEFAULT_METRICS.languages;

    const contrib = userData.contributionsCollection || {};
    const totalContributions =
      (contrib.totalCommitContributions || 0) +
      (contrib.restrictedContributionsCount || 0) +
      (contrib.totalPullRequestContributions || 0) +
      (contrib.totalIssueContributions || 0);

    return {
      ...DEFAULT_METRICS,
      totalRepos: totalRepos > 0 ? totalRepos : DEFAULT_METRICS.totalRepos,
      totalContributions: totalContributions > 0 ? totalContributions : DEFAULT_METRICS.totalContributions,
      languages: calculatedLanguages
    };
  } catch (error) {
    console.warn("Error fetching GitHub metrics:", error);
    return DEFAULT_METRICS;
  }
}
