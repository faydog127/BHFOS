import { getOpenPullRequests, getRecentCommits, MissingEnvError, GitHubRequestError } from "../lib/github";

export default async function HomePage() {
  let prCount = 0;
  let commits: Awaited<ReturnType<typeof getRecentCommits>> = [];
  let error: string | null = null;

  try {
    const [prs, recent] = await Promise.all([getOpenPullRequests(), getRecentCommits(5)]);
    prCount = prs.length;
    commits = recent;
  } catch (err) {
    if (err instanceof MissingEnvError) {
      error = err.message;
    } else if (err instanceof GitHubRequestError) {
      error = `GitHub request failed (${err.status}). Check token and repo access.`;
    } else {
      error = "Unable to load data from GitHub.";
    }
  }

  return (
    <section className="card">
      <h1>Re-Group Command Center</h1>
      <p className="muted">Read-only status. GitHub data only; approvals/actions come later.</p>

      {error ? (
        <p className="muted">{error}</p>
      ) : (
        <>
          <p>
            Open PRs: <strong>{prCount}</strong>
          </p>
          <h2>Recent commits</h2>
          {commits.length === 0 ? (
            <p className="muted">No commits found.</p>
          ) : (
            <ul>
              {commits.map((commit) => (
                <li key={commit.sha}>
                  <strong>{commit.commit.message.split("\n")[0]}</strong>{" "}
                  <span className="muted">({commit.commit.author?.name ?? "unknown"})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
