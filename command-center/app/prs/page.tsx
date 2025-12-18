import Link from "next/link";
import { getOpenPullRequests, MissingEnvError, GitHubRequestError } from "../../lib/github";

export default async function PullRequestsPage() {
  let error: string | null = null;
  let prs: Awaited<ReturnType<typeof getOpenPullRequests>> = [];

  try {
    prs = await getOpenPullRequests();
  } catch (err) {
    if (err instanceof MissingEnvError) {
      error = err.message;
    } else if (err instanceof GitHubRequestError) {
      error = `GitHub request failed (${err.status}). Check token and repo access.`;
    } else {
      error = "Unable to load pull requests.";
    }
  }

  return (
    <section>
      <h1>Pull Requests</h1>
      <p className="muted">Open PRs from GitHub (read-only).</p>

      {error ? (
        <p className="muted">{error}</p>
      ) : prs.length === 0 ? (
        <p className="muted">No open pull requests.</p>
      ) : (
        prs.map((pr) => (
          <article key={pr.id} className="card">
            <h2>{pr.title}</h2>
            <p className="muted">
              #{pr.number} by {pr.user?.login ?? "unknown"} — updated {new Date(pr.updated_at).toLocaleString()}
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <Link href={`/prs/${pr.number}`}>View detail</Link>
              <a href={pr.html_url} target="_blank" rel="noreferrer">
                Open in GitHub
              </a>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
