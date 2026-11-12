import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { APIError, buildConfig, getPayload } from 'payload'
import { Categories } from '../src/collections/Categories'
import { Documents } from '../src/collections/Documents'
import { Faqs } from '../src/collections/Faqs'
import { Media } from '../src/collections/Media'
import { Posts } from '../src/collections/Posts'
import { Products } from '../src/collections/Products'
import { Users } from '../src/collections/Users'
import { Applications, Resources, Solutions } from '../src/collections/structured'
import { isValidSlug } from '../src/lib/validation'

test('copying published content creates independent, localized drafts', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-duplicate-'))
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  payload = await getPayload({ config: buildConfig({
    collections: [Users, { ...Media, upload: { disableLocalStorage: true } }, Categories, Products,
      Posts, Faqs, Applications, Solutions, Resources, { ...Documents, upload: { disableLocalStorage: true } }],
    localization: { locales: ['en', 'zh', 'fr'], defaultLocale: 'en' },
    editor: lexicalEditor(),
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'content.db')}` } }),
    secret: 'temporary-secret-for-duplicate-regression-test',
    typescript: { autoGenerate: false },
  }) })

  const admin = await payload.create({ collection: 'users', data: {
    email: 'reviewer@example.test', password: 'test-password-only', name: 'Reviewer', role: 'reviewer',
  } })
  const editor = await payload.create({ collection: 'users', data: {
    email: 'editor@example.test', password: 'test-password-only', name: 'Editor', role: 'editor',
  } })
  const publish = { depth: 0, user: admin, locale: 'en' as const }
  const published = { _status: 'published' as const, seo: { robots: 'index' as const } }
  const date = '2026-01-10T00:00:00.000Z'
  const media = await payload.create({ ...publish, collection: 'media', data: { alt: 'Fixture image' },
    file: {
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2S0AAAAASUVORK5CYII=', 'base64'),
      name: 'fixture.png', mimetype: 'image/png', size: 68,
    },
  })
  const parent = await payload.create({ ...publish, collection: 'categories', data: {
    ...published, name: 'Parent category', slug: 'parent-category',
  } })
  const category = await payload.create({ ...publish, collection: 'categories', data: {
    ...published, name: 'Original category', slug: 'original-category', parent: parent.id, heroImage: media.id,
  } })
  const product = await payload.create({ ...publish, collection: 'products', data: {
    ...published, name: 'Original product', slug: 'original-product', image: media.id, categories: [category.id],
    sku: 'ORIGINAL-001', contentStatus: 'ready', sourceData: { slug: 'legacy-product' },
    specs: [{ label: 'Material', value: 'Paper' }],
  } })
  await payload.update({ ...publish, collection: 'products', id: product.id, locale: 'zh', data: {
    ...published, name: '原产品', specs: [{ id: product.specs?.[0]?.id, label: '材料', value: '纸' }],
  } })
  await payload.update({ ...publish, collection: 'products', id: product.id, locale: 'fr', data: {
    ...published, name: 'Produit original', specs: [{ id: product.specs?.[0]?.id, label: 'Matière', value: 'Papier' }],
  } })
  const post = await payload.create({ ...publish, collection: 'posts', data: {
    ...published, title: 'Original article', slug: 'original-article', topic: 'materials', author: 'Author',
    excerpt: 'Summary', image: media.id,
    body: { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
      children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Article text', version: 1 }] }],
    } },
    relatedProducts: [product.id], featured: true, publishedAt: date, modifiedAt: date,
    sourceData: { slug: 'legacy-article' },
  } })
  const application = await payload.create({ ...publish, collection: 'applications', data: {
    ...published, title: 'Original application', slug: 'original-application', products: [product.id],
    sourceData: { slug: 'legacy-application' },
  } })
  const solution = await payload.create({ ...publish, collection: 'solutions', data: {
    ...published, title: 'Original solution', slug: 'original-solution', products: [product.id],
    applications: [application.id], sourceData: { slug: 'legacy-solution' },
  } })

  const copy = { user: editor, overrideAccess: false, depth: 0, showHiddenFields: true, draft: true }
  await assert.rejects(payload.duplicate({ ...copy, user: undefined, collection: 'products', id: product.id }),
    (error) => error instanceof APIError && error.status === 403)

  const productCopy = await payload.duplicate({ ...copy, collection: 'products', id: product.id, locale: 'zh' })
  const secondCopy = await payload.duplicate({ ...copy, collection: 'products', id: product.id, locale: 'fr' })
  const categoryCopy = await payload.duplicate({ ...copy, collection: 'categories', id: category.id })
  const postCopy = await payload.duplicate({ ...copy, collection: 'posts', id: post.id })
  const applicationCopy = await payload.duplicate({ ...copy, collection: 'applications', id: application.id })
  const solutionCopy = await payload.duplicate({ ...copy, user: admin, collection: 'solutions', id: solution.id,
    draft: false, data: { _status: 'published', slug: 'invalid slug', title: 'Unexpected override' },
  })
  for (const [source, duplicate] of [[product, productCopy], [category, categoryCopy], [post, postCopy],
    [application, applicationCopy], [solution, solutionCopy]]) {
    assert.notEqual(duplicate.id, source.id)
    assert.equal(duplicate._status, 'draft')
    assert.ok(isValidSlug(duplicate.slug) && duplicate.slug.startsWith(`${source.slug}-copy-`))
  }
  assert.notEqual(secondCopy.slug, productCopy.slug)
  assert.equal(productCopy.name, '原产品')
  assert.equal(secondCopy.name, 'Produit original')
  assert.equal(productCopy.specs?.[0]?.label, '材料')
  assert.notEqual(productCopy.specs?.[0]?.id, product.specs?.[0]?.id)
  assert.deepEqual(productCopy.categories, [category.id])
  assert.equal(productCopy.image, media.id)
  assert.ok(!productCopy.sku)
  assert.equal(productCopy.contentStatus, 'incomplete')
  assert.equal(productCopy.sourceData ?? null, null)
  assert.equal(categoryCopy.parent, parent.id)
  assert.equal(categoryCopy.heroImage, media.id)
  assert.deepEqual(postCopy.body, post.body)
  assert.deepEqual(postCopy.relatedProducts, [product.id])
  assert.equal(postCopy.featured, false)
  assert.equal(postCopy.publishedAt ?? null, null)
  assert.equal(postCopy.modifiedAt ?? null, null)
  assert.equal(postCopy.sourceData ?? null, null)
  assert.deepEqual(applicationCopy.products, [product.id])
  assert.deepEqual(applicationCopy.sourceData, {})
  assert.equal(solutionCopy.title, solution.title)
  assert.deepEqual(solutionCopy.applications, [application.id])
  assert.deepEqual(solutionCopy.sourceData, {})

  const englishCopy = await payload.findByID({ ...publish, collection: 'products', id: productCopy.id, draft: true })
  assert.equal(englishCopy.name, product.name)
  assert.equal(englishCopy.specs?.[0]?.value, 'Paper')
  const frenchCopy = await payload.findByID({ ...publish, collection: 'products', id: productCopy.id,
    locale: 'fr', fallbackLocale: false, draft: true,
  })
  assert.equal(frenchCopy.name, 'Produit original')
  assert.equal(frenchCopy.specs?.[0]?.value, 'Papier')
  const original = await payload.findByID({ ...publish, collection: 'products', id: product.id, showHiddenFields: true })
  assert.equal(original._status, 'published')
  assert.equal(original.slug, product.slug)
  assert.equal(original.sku, product.sku)
  assert.deepEqual(original.sourceData, product.sourceData)
})
