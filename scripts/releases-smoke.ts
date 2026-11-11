import assert from 'node:assert/strict'

const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100'
const login = await fetch(`${base}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.CMS_BOOTSTRAP_EMAIL, password: process.env.CMS_BOOTSTRAP_PASSWORD }),
})
assert.equal(login.status, 200)
const { token } = await login.json()
const releaseResponse = await fetch(`${base}/api/release-actions/create`, {
  method: 'POST', headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Migration baseline', note: 'Verified imported public content before frontend deployment.' }),
})
if (![200, 201].includes(releaseResponse.status)) throw new Error(await releaseResponse.text())
const release = await releaseResponse.json()
assert(release.id && release.contentHash)
assert.equal(release.counts.products, 226)
assert.equal(release.counts.posts, 51)

const snapshotResponse = await fetch(`${base}/api/snapshot?release=${release.id}`, {
  headers: { Authorization: `Bearer ${process.env.SNAPSHOT_TOKEN}` },
})
assert.equal(snapshotResponse.status, 200)
const snapshot = await snapshotResponse.json()
assert.equal(snapshot.version, String(release.id))
assert.equal(snapshot.release.contentHash, release.contentHash)
assert.equal(snapshot.content.products.length, 226)
assert.equal(Object.hasOwn(snapshot.content.products[0], 'sourceData'), false)

const filteredResponse = await fetch(`${base}/api/snapshot?release=${release.id}&collections=products,posts`, {
  headers: { Authorization: `Bearer ${process.env.SNAPSHOT_TOKEN}` },
})
const filtered = await filteredResponse.json()
assert.deepEqual(Object.keys(filtered.content).sort(), ['posts', 'products'])

const repeated = await fetch(`${base}/api/release-actions/create`, {
  method: 'POST', headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' }, body: '{}',
})
assert.equal(repeated.status, 200)
const duplicate = await repeated.json()
assert.equal(duplicate.id, release.id)
assert.equal(duplicate.unchanged, true)
console.log(`PASS immutable release ${release.id}; repeated capture deduplicated`)
process.exit(0)
