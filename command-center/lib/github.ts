type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
};

type GitHubPullRequest = {
  id: number;
  number: number;
  title: string;
  user?: { login?: string | null } | null;
  html_url: string;
  updated_at: string;
};

type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: {
      name?: string | null;
      date?: string | null;
    };
  };
};

class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

class GitHubRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    throw new MissingEnvError(
      "GitHub configuration missing. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO."
    );
  }

  return { token, owner, repo };
}

async function fetchFromGitHub<T>(path: string): Promise<T> {
  const { token, owner, repo } = getConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "re-group-command-center"
    },
    cache: "no-store" // avoid caching stale responses; TASK-004 can add caching
  });

  if (!res.ok) {
    throw new GitHubRequestError(`GitHub request failed (${res.status})`, res.status);
  }

  return (await res.json()) as T;
}

export async function getOpenPullRequests(): Promise<GitHubPullRequest[]> {
  return fetchFromGitHub<GitHubPullRequest[]>("/pulls?state=open&per_page=50&sort=updated");
}

export async function getRecentCommits(
  limit = 5
): Promise<GitHubCommit[]> {
  return fetchFromGitHub<GitHubCommit[]>(`/commits?per_page=${limit}`);
}

export { MissingEnvError, GitHubRequestError };
