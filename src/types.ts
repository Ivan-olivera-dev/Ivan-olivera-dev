export interface SystemMetrics {
  username: string;
  name: string;
  role: string;
  location: string;
  website: string;
  cardUrl: string;
  summaryLines: [string, string, string];
  environment: string;
  totalRepos: number;
  totalContributions: number;
  languages: Array<{
    name: string;
    percentage: number;
    color: string;
  }>;
  currentWork: Array<{
    title: string;
    subtitle: string;
  }>;
}

export interface RenderOptions {
  width?: number;
  height?: number;
}
