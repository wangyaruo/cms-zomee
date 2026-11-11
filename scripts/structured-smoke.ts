import assert from 'node:assert/strict'

const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100'
const response = await fetch(`${base}/api/snapshot`, { headers: { Authorization: `Bearer ${process.env.SNAPSHOT_TOKEN}` } })
assert.equal(response.status, 200)
const snapshot = await response.json()
const expected = { applications: 7, solutions: 6, resources: 6, 'navigation-menus': 2, 'legal-pages': 2, 'site-pages': 7, documents: 8 }
for (const [collection, count] of Object.entries(expected)) {
  assert.equal(snapshot.content[collection]?.length, count, `${collection} count`)
}
assert(snapshot.content.applications[0].sourceData.requirements?.length, 'Application requirements must survive')
assert(snapshot.content.solutions[0].sourceData.sections?.length, 'Solution sections must survive')
assert(snapshot.content.resources.find((item: any) => item.slug === 'artwork-preparation')?.sourceData.artworkHero, 'Resource modules must survive')
assert(snapshot.content['legal-pages'][0].sourceData.sections?.length, 'Legal sections must survive')
assert.equal(snapshot.settings.email, 'info@zomeeco.com')
assert(snapshot.settings.logo?.url, 'Site logo must be an imported media relation')
assert(snapshot.settings.wechatQrImage?.url, 'WeChat QR must be an imported media relation')
assert(snapshot.content.documents.every((item: any) => item.url?.endsWith('.pdf')), 'Every document must expose its PDF URL')
assert(snapshot.content['site-pages'].find((item: any) => item.slug === 'home')?.sourceData.homeSystem, 'Home structured data must survive')
console.log('PASS all structured collections, source data and site settings')
process.exit(0)
