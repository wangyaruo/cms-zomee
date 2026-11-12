import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { contentTrashCollections } from '../src/collections/contentTrash'

const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100'
const email = process.env.CMS_BOOTSTRAP_EMAIL
const password = process.env.CMS_BOOTSTRAP_PASSWORD
assert(email && password, 'Bootstrap credentials are required for the smoke test.')
const suffix = Date.now().toString(36)
const created: { collection: string; id: string }[] = []

async function api(path: string, options: RequestInit = {}, cookie = '') {
  const headers = new Headers(options.headers)
  if (cookie) headers.set('Authorization', `JWT ${cookie}`)
  const response = await fetch(`${base}/api${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

async function login(loginEmail: string, loginPassword: string) {
  const { response, body } = await api('/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  })
  assert.equal(response.status, 200, 'Administrator login must succeed.')
  assert(body.token, 'Login must issue an API token.')
  return body.token as string
}

async function main() {
  const admin = await login(email!, password!)
  console.log('PASS administrator login')
  const currentUser = await api('/users/me', {}, admin)
  console.log('Authenticated role:', currentUser.body.user?.role)

  const unauthorized = await fetch(`${base}/api/snapshot`)
  assert.equal(unauthorized.status, 401)
  console.log('PASS snapshot rejects anonymous requests')

  const image = await readFile(new URL('../../zomme-index/public/favicon.png', import.meta.url))
  const form = new FormData()
  form.append('file', new Blob([image], { type: 'image/png' }), 'cms-smoke.png')
  form.append('_payload', JSON.stringify({ alt: 'CMS smoke test image' }))
  const media = await api('/media', { method: 'POST', body: form }, admin)
  assert.equal(media.response.status, 201, JSON.stringify(media.body))
  created.push({ collection: 'media', id: media.body.doc.id })
  console.log('PASS media upload')

  const editorEmail = `editor-${suffix}@example.com`
  const editorPassword = `editor-${suffix}-password`
  const editor = await api('/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: editorEmail, password: editorPassword, name: 'Smoke Editor', role: 'editor' }),
  }, admin)
  assert.equal(editor.response.status, 201)
  created.push({ collection: 'users', id: editor.body.doc.id })
  const editorCookie = await login(editorEmail, editorPassword)

  const category = await api('/categories?locale=en', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Category', slug: `smoke-${suffix}`, _status: 'draft' }),
  }, editorCookie)
  assert.equal(category.response.status, 201, JSON.stringify(category.body))
  const categoryId = category.body.doc.id
  created.push({ collection: 'categories', id: categoryId })
  console.log('PASS editor creates a draft')

  const denied = await api(`/categories/${categoryId}?locale=en`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _status: 'published' }),
  }, editorCookie)
  assert(denied.response.status >= 400, 'Editor publication must be rejected.')
  console.log('PASS editor cannot publish')

  const published = await api(`/categories/${categoryId}?locale=en`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _status: 'published' }),
  }, admin)
  assert.equal(published.response.status, 200, JSON.stringify(published.body))
  console.log('PASS administrator publishes')

  const product = await api('/products?locale=en', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Product', slug: `smoke-product-${suffix}`, image: media.body.doc.id,
      categories: [categoryId], _status: 'published', contentStatus: 'ready',
    }),
  }, admin)
  assert.equal(product.response.status, 201, JSON.stringify(product.body))
  created.push({ collection: 'products', id: product.body.doc.id })
  console.log('PASS product with media and category relationship')

  const snapshot = await api('/snapshot', { headers: { Authorization: `Bearer ${process.env.SNAPSHOT_TOKEN}` } })
  assert.equal(snapshot.response.status, 200, JSON.stringify(snapshot.body))
  assert(snapshot.body.content.categories.some((item: { id: string }) => String(item.id) === String(categoryId)))
  assert(snapshot.body.content.products.some((item: { id: string }) => String(item.id) === String(product.body.doc.id)))
  console.log('PASS snapshot contains published records only')
}

main().finally(async () => {
  const admin = email && password ? await login(email!, password!) : ''
  for (const item of created.reverse()) {
    if (!admin) continue
    const options: RequestInit = contentTrashCollections.has(item.collection) ? {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    } : { method: 'DELETE' }
    const { response } = await api(`/${item.collection}/${item.id}`, options, admin)
    assert(response.ok, `Could not clean up ${item.collection} test record (${response.status}).`)
  }
  console.log('Smoke test content moved to trash; temporary account and media removed.')
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
