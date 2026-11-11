import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const source = JSON.parse(await readFile(path.resolve(process.env.ORIGINAL_CONTENT_FILE || 'import/original-content.json'), 'utf8'))
const payload = await getPayload({ config })

for (const [collection, key, records, sourceKey] of [
  ['categories', 'slug', source.categories, 'slug'],
  ['products', 'slug', source.products, 'slug'],
  ['posts', 'slug', source.posts, 'slug'],
  ['faqs', 'stableKey', source.faqs, 'id'],
  ['applications', 'slug', source.applications, 'slug'],
  ['solutions', 'slug', source.solutions, 'slug'],
  ['resources', 'slug', source.resources, 'slug'],
  ['navigation-menus', 'slug', source.navigationMenus, 'slug'],
  ['legal-pages', 'slug', source.legalPages, 'slug'],
  ['site-pages', 'slug', source.sitePages, 'slug'],
  ['documents', 'sourcePath', source.documents, 'sourcePath'],
] as const) {
  for (const record of records) {
    const identity = record[sourceKey]
    const result = await payload.find({ collection, where: { [key]: { equals: identity } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
    assert.equal(result.totalDocs, 1, `${collection}/${identity} must exist exactly once`)
  }
  console.log(`PASS ${collection}: ${records.length} unique source records`)
}

for (const collection of ['applications', 'solutions', 'resources', 'legal-pages', 'site-pages'] as const) {
  const result = await payload.find({ collection, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  assert(result.docs[0]?.sourceData, `${collection} must retain complete source data`)
}
console.log('PASS structured page source data')

const products = await payload.find({ collection: 'products', pagination: false, depth: 1, locale: 'en', overrideAccess: true, showHiddenFields: true })
for (const product of products.docs) {
  assert(product.image, `${product.slug} requires an image`)
  const legacy = product.sourceData as any
  if (legacy.family === 'packaging') assert(product.categories?.length, `${product.slug} requires a category`)
  assert(product.sourceData, `${product.slug} must retain original PDP data`)
}
const sample = products.docs.find((product) => product.slug === '3-5g-child-resistant-mylar-bags')
assert(sample, 'The complex sample product must exist')
assert((sample.sourceData as any)?.optionGroups?.length, 'Complex product options must survive migration')
assert(sample.heroTitle, 'Complex PDP hero title must be editable')
assert(sample.galleryDetails?.length, 'Gallery captions must be editable')
assert(sample.assurance?.length && sample.highlights?.length, 'Assurance and highlights must be editable')
assert(sample.assurance[0].label && sample.customOptions[0]?.name, 'English PDP array content must be present')
assert(sample.customOptions?.length, 'Custom options must be editable')
assert(sample.featureCard?.items?.length, 'Feature card items must be editable')
assert(sample.compliance?.capabilities?.length, 'Compliance capabilities must be editable')
assert(sample.closingCta?.title, 'Closing CTA must be editable')
const sampleZh = await payload.findByID({ collection: 'products', id: sample.id, locale: 'zh', depth: 0, overrideAccess: true, showHiddenFields: true })
assert.equal(sampleZh.name, source.products.find((product: any) => product.slug === sample.slug).nameZh)
console.log('PASS product media, categories, source fields and Chinese content')

const posts = await payload.find({ collection: 'posts', pagination: false, depth: 0, overrideAccess: true })
for (const post of posts.docs) {
  const original = source.posts.find((item: any) => item.slug === post.slug)
  const expected = original.editorial.status === 'published' ? 'index' : 'noindex'
  assert.equal(post.seo?.robots, expected, `${post.slug} must preserve its original robots policy`)
}
console.log('PASS blog public visibility and robots boundaries')

const media = await payload.find({ collection: 'media', pagination: false, depth: 0, overrideAccess: true })
const sourcePaths = media.docs.map((item) => item.sourcePath).filter(Boolean)
assert.equal(new Set(sourcePaths).size, sourcePaths.length, 'Media source paths must be unique')
console.log(`PASS ${sourcePaths.length} deduplicated imported media assets`)
process.exit(0)
