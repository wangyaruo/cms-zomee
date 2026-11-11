import assert from 'node:assert/strict'

const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100'
const login = await fetch(`${base}/api/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.CMS_BOOTSTRAP_EMAIL, password: process.env.CMS_BOOTSTRAP_PASSWORD }) })
assert.equal(login.status, 200)
const { token } = await login.json()
const headers = { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' }
const layout = {
  root: { props: { title: 'Canvas smoke test' } },
  content: [
    { type: 'Hero', props: { id: 'hero-test', title: 'Canvas packaging proof', body: 'A real block rendered by Puck.', image: '', label: 'Start now', href: '/contact', align: 'left' } },
    { type: 'FeatureGrid', props: { id: 'features-test', title: 'Three capabilities', items: [{ title: 'Structure', body: 'Fit review' }, { title: 'Artwork', body: 'Print review' }] } },
    { type: 'Faq', props: { id: 'faq-test', title: 'Questions', items: [{ question: 'Is this rendered?', answer: 'Yes, from the saved layout.' }] } },
  ],
}
const response = await fetch(`${base}/api/pages`, { method: 'POST', headers, body: JSON.stringify({ title: 'Canvas smoke test', slug: 'canvas-smoke-test', layout, _status: 'published' }) })
if (response.status !== 201) throw new Error(await response.text())
const page = await response.json()
const id = page.doc?.id || page.id
try {
  const preview = await fetch(`${base}/preview/canvas-smoke-test`)
  assert.equal(preview.status, 200)
  const html = await preview.text()
  assert.match(html, /Canvas packaging proof/)
  assert.match(html, /Three capabilities/)
  assert.match(html, /Yes, from the saved layout/)
  const editor = await fetch(`${base}/canvas/${id}`)
  assert.equal(editor.status, 200)
  console.log(`PASS visual page ${id}: saved layout renders on the preview route`)
} finally {
  const cleanup = await fetch(`${base}/api/pages/${id}`, { method: 'DELETE', headers })
  assert.equal(cleanup.status, 200)
}
process.exit(0)
