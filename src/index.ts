import { fetchProfileData } from "./github-client.ts";
import { refreshCard } from "./refresh.ts";

refreshCard({ root: process.cwd(), fetchData: () => fetchProfileData() }).catch((err) => {
  console.error("Error generating profile card:", err);
  process.exit(1);
});
