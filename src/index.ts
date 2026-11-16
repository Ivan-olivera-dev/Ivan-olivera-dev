import { fetchProfileData } from "./github-client.ts";
import { fetchCommitTimestamps } from "./habits.ts";
import { PROFILE } from "./profile.ts";
import { refreshCard } from "./refresh.ts";

refreshCard({
  root: process.cwd(),
  fetchData: () => fetchProfileData(),
  fetchHabits: () => fetchCommitTimestamps(PROFILE.username)
}).catch((err) => {
  console.error("Error generating profile card:", err);
  process.exit(1);
});
