import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="shell">
      <p className="eyebrow">ZOMEEX / CONTENT OPERATIONS</p>
      <h1>One source of truth<br />for every published page.</h1>
      <p className="intro">Manage products, categories, articles, FAQs and media. Review drafts before anything reaches the public website.</p>
      <div className="actions">
        <Link className="primary" href="/admin">Open CMS dashboard <span aria-hidden="true">↗</span></Link>
        <a className="secondary" href="/api/snapshot">Snapshot API <small>Server token required</small></a>
      </div>
      <section className="status" aria-label="CMS capabilities">
        <article><strong>01</strong><h2>Structured content</h2><p>Purpose-built fields instead of editable JSON blobs.</p></article>
        <article><strong>02</strong><h2>Drafts & roles</h2><p>Editors prepare content. Reviewers control publication.</p></article>
        <article><strong>03</strong><h2>17 locales</h2><p>Localized fields with English fallback and RTL support.</p></article>
      </section>
    </main>
  )
}
