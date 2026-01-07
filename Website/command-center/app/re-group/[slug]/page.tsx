interface Props {
  params: { slug: string };
}

export default function ReGroupDocPage({ params }: Props) {
  return (
    <section className="card">
      <h1>Re-Group Doc</h1>
      <p>Slug: {params.slug}</p>
      <p className="muted">Placeholder content. Markdown rendering to be implemented in TASK-003.</p>
    </section>
  );
}
