import test from "node:test";
import assert from "node:assert/strict";
import { fetchProfileData } from "../src/github-client.ts";
import { PROFILE } from "../src/profile.ts";

test("fetchProfileData without a token keeps the static profile and reports stats as unavailable", async () => {
  const data = await fetchProfileData("Ivan-olivera-dev", "");

  assert.equal(data.name, PROFILE.name);
  assert.deepEqual(data.focus, PROFILE.focus);
  assert.deepEqual(data.stats, { repos: null, stars: null, followers: null, contributions: null });
  assert.deepEqual(data.languages, []);
});

test("fetchProfileData aggregates repos, stars, followers, contributions and language shares", async (t) => {
  const payload = {
    data: {
      user: {
        followers: { totalCount: 2 },
        repositories: {
          totalCount: 2,
          nodes: [
            { stargazerCount: 1, languages: { edges: [{ size: 600, node: { name: "TypeScript" } }] } },
            {
              stargazerCount: 2,
              languages: {
                edges: [
                  { size: 300, node: { name: "Python" } },
                  { size: 100, node: { name: "TypeScript" } }
                ]
              }
            }
          ]
        },
        contributionsCollection: { contributionCalendar: { totalContributions: 321 } }
      }
    }
  };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(payload), { status: 200 }));

  const data = await fetchProfileData("Ivan-olivera-dev", "token");

  assert.deepEqual(data.stats, { repos: 2, stars: 3, followers: 2, contributions: 321 });
  assert.deepEqual(data.languages, [
    { name: "TypeScript", percentage: 70 },
    { name: "Python", percentage: 30 }
  ]);
});

test("fetchProfileData falls back to unavailable stats when the API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("nope", { status: 502 }));
  t.mock.method(console, "warn", () => {});

  const data = await fetchProfileData("Ivan-olivera-dev", "token");

  assert.deepEqual(data.stats, { repos: null, stars: null, followers: null, contributions: null });
  assert.deepEqual(data.languages, []);
});
