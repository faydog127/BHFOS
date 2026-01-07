import Link from "next/link";

const docs = [
  { slug: "current-sprint", title: "Current Sprint", note: "Placeholder link" },
  { slug: "decision-sample", title: "Decision Doc", note: "Placeholder link" }
];

export default function ReGroupDocsPage() {
  return (
    <section>
      <h1>Re-Group Docs</h1>
      <p className="muted">This page will list markdown docs from the repo.</p>
      {docs.map((doc) => (
        <article key={doc.slug} className="card">
          <h2>{doc.title}</h2>
          <p className="muted">{doc.note}</p>
          <Link href={`/re-group/${doc.slug}`}>Open</Link>
        </article>
      ))}
    </section>
  );
}
