import Link from "next/link";

export default function PullRequestsPage() {
  const placeholder = [
    { id: "123", title: "Example PR", status: "Coming soon" },
    { id: "456", title: "Another PR", status: "Coming soon" }
  ];

  return (
    <section>
      <h1>Pull Requests</h1>
      <p className="muted">This page will list open PRs once GitHub integration is added.</p>
      {placeholder.map((pr) => (
        <article key={pr.id} className="card">
          <h2>{pr.title}</h2>
          <p className="muted">{pr.status}</p>
          <Link href={`/prs/${pr.id}`}>View detail</Link>
        </article>
      ))}
    </section>
  );
}
