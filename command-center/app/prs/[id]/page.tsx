interface Props {
  params: { id: string };
}

export default function PullRequestDetailPage({ params }: Props) {
  return (
    <section className="card">
      <h1>PR Detail</h1>
      <p>ID: {params.id}</p>
      <p className="muted">Placeholder detail. GitHub data will render here in a later task.</p>
    </section>
  );
}
