import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import { APIError, buildConfig, createLocalReq, getPayload } from 'payload'
import sharp from 'sharp'
import { Categories } from '../src/collections/Categories'
import { Documents } from '../src/collections/Documents'
import { Faqs } from '../src/collections/Faqs'
import { LegalPages } from '../src/collections/LegalPages'
import { Media } from '../src/collections/Media'
import { NavigationMenus } from '../src/collections/NavigationMenus'
import { Pages } from '../src/collections/Pages'
import { Posts } from '../src/collections/Posts'
import { Products } from '../src/collections/Products'
import { SitePages } from '../src/collections/SitePages'
import { Users } from '../src/collections/Users'
import { withContentTrash } from '../src/collections/contentTrash'
import { Applications, Resources, Solutions } from '../src/collections/structured'
import { collectTrashImpact } from '../src/endpoints/trashImpact'
import { SiteSettings } from '../src/globals/SiteSettings'

const status = (expected: number) => (error: unknown) => error instanceof APIError && error.status === expected
const textAnswer = {
  root: { type: 'root', version: 1, direction: 'ltr' as const, format: '' as const, indent: 0,
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'BODY_MUST_NOT_LEAVE_THE_REPORT', version: 1 }] }],
  },
}

test('trash impact checks current references, permissions and the complete selection', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-trash-impact-'))
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const cms = payload = await getPayload({ config: buildConfig({
    collections: [Users, { ...Media, upload: { disableLocalStorage: true } },
      { ...Documents, upload: { disableLocalStorage: true } }, Pages,
      ...[Categories, Products, Posts, Faqs, Applications, Solutions, Resources,
        NavigationMenus, LegalPages, SitePages].map(withContentTrash)],
    globals: [SiteSettings],
    localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
    i18n: { supportedLanguages: { en, zh }, fallbackLanguage: 'en' },
    editor: lexicalEditor(),
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'content.db')}` } }),
    secret: 'temporary-secret-for-trash-impact-tests', sharp,
    typescript: { autoGenerate: false },
  }) })
  const makeUser = async (role: 'admin' | 'reviewer' | 'editor') => ({
    ...await cms.create({ collection: 'users', data: {
      email: `${role}@example.test`, password: 'test-password-only', name: role, role,
    } }),
    collection: 'users' as const,
  })
  const admin = await makeUser('admin')
  const reviewer = await makeUser('reviewer')
  const editor = await makeUser('editor')
  const request = () => createLocalReq({ user: reviewer }, cms)
  const review = { overrideAccess: false, user: reviewer, depth: 0 }
  const published = { _status: 'published' as const, seo: { robots: 'index' as const } }
  const target = await cms.create({ ...review, collection: 'categories', data: {
    ...published, name: 'Target packaging', slug: 'target-packaging',
  } })
  const child = await cms.create({ ...review, collection: 'categories', data: {
    ...published, name: 'Child packaging', slug: 'child-packaging', parent: target.id,
  } })
  const image = await cms.create({ ...review, collection: 'media', data: { alt: 'Test image' }, file: {
    data: await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer(),
    name: 'impact-test.png', mimetype: 'image/png', size: 92,
  } })
  const productData = (slug: string) => ({
    ...published, name: slug, slug, image: image.id, categories: [target.id], contentStatus: 'ready' as const,
    sourceData: { marker: 'HIDDEN_BODY_MUST_NOT_LEAVE_THE_REPORT', href: '/products?category=target-packaging' },
  })
  const product = await cms.create({ ...review, collection: 'products', data: productData('published-reference') })
  await cms.update({ ...review, collection: 'products', id: product.id, draft: true,
    data: { _status: 'draft', categories: [] },
  })
  const draftProduct = await cms.create({ ...review, collection: 'products', draft: true,
    data: { ...productData('draft-reference'), _status: 'draft' },
  })
  const archived = await cms.create({ ...review, collection: 'products', data: productData('archived-reference') })
  await cms.update({ ...review, collection: 'products', id: archived.id,
    data: { deletedAt: new Date().toISOString() },
  })
  const faq = await cms.create({ ...review, collection: 'faqs', data: {
    _status: 'published', stableKey: 'impact-category-faq', question: 'Category question',
    answer: textAnswer, categories: [target.id], category: 'products', displayLocations: ['library'],
  } })
  await cms.update({ ...review, collection: 'faqs', id: faq.id, locale: 'zh', data: {
    _status: 'published', question: '分类引用问题', answer: textAnswer,
  } })
  const navigation = (name: string, href: string) => cms.create({ ...review, collection: 'navigation-menus', data: {
    _status: 'published', name, slug: name, items: [{ label: name, href }],
  } })
  const categoryLink = await navigation('category-link', '/zh/products/?category=target-packaging#details')
  const outsideLink = await navigation('external-category-link', 'https://external.example/products?category=target-packaging')
  await cms.update({ ...review, collection: 'categories', id: target.id, draft: true, data: {
    _status: 'draft', slug: 'target-packaging-pending',
  } })
  const pendingLink = await navigation('pending-category-link', '/products?category=target-packaging-pending')

  const input = { collection: 'categories', selection: { mode: 'ids' as const, ids: [target.id] }, locale: 'zh' }
  for (const user of [undefined, editor]) {
    await assert.rejects(collectTrashImpact(await createLocalReq({ user }, cms), input), status(403))
  }
  await assert.rejects(collectTrashImpact(await request(), {
    ...input, collection: 'private-documents',
  }), status(400))
  await assert.rejects(collectTrashImpact(await request(), {
    ...input, selection: { mode: 'ids', ids: [] },
  }), status(400))
  await assert.rejects(collectTrashImpact(await request(), {
    ...input, selection: { mode: 'ids', ids: [999999] },
  }), status(404))

  const report = await collectTrashImpact(await request(), input)
  const source = (collection: string, id: number | string) => report.references.find((item) => item.collection === collection && item.id === id)
  assert.equal(report.targetCount, 1)
  assert.ok(source('categories', child.id)?.fields.some(({ path }) => path === 'parent'))
  assert.deepEqual(source('products', product.id)?.states, ['published'],
    'a new draft removing the relation must not hide its published main record')
  assert.deepEqual(source('products', draftProduct.id)?.states, ['draft'])
  assert.equal(source('products', archived.id), undefined)
  assert.equal(source('faqs', faq.id)?.title, '分类引用问题')
  assert.ok(source('navigation-menus', categoryLink.id), 'published target URLs remain relevant after changing the draft slug')
  assert.ok(source('navigation-menus', pendingLink.id), 'the latest target slug is checked too')
  assert.equal(source('navigation-menus', outsideLink.id), undefined, 'external URLs with a matching path are not internal references')
  assert.equal(report.totalReferences, report.references.length)
  assert.doesNotMatch(JSON.stringify(report), /BODY_MUST_NOT_LEAVE_THE_REPORT|sourceData|password/)
  const selectedTogether = await collectTrashImpact(await request(), {
    ...input, selection: { mode: 'ids', ids: [target.id, child.id] },
  })
  assert.equal(selectedTogether.targetCount, 2)
  assert.ok(!selectedTogether.references.some((item) => item.collection === 'categories' && item.id === child.id),
    'references within the same archive selection do not count as affected remaining content')
  assert.equal((await collectTrashImpact(await createLocalReq({ user: admin }, cms), input)).targetCount, 1)

  const resource = await cms.create({ ...review, collection: 'resources', data: {
    ...published, title: 'Download resource', slug: 'download-resource', kind: 'checklist',
    sourceData: {},
  } })
  const documentData = Buffer.from('Temporary document fixture')
  const document = await cms.create({ ...review, collection: 'documents', draft: true,
    data: { _status: 'draft', title: 'Referenced checklist', sourcePath: '/test/checklist.txt', locale: 'en', resource: resource.id },
    file: { data: documentData, name: 'checklist.txt', mimetype: 'text/plain', size: documentData.length },
  })
  const resourceReport = await collectTrashImpact(await request(), {
    collection: 'resources', selection: { mode: 'ids', ids: [resource.id] },
  })
  assert.ok(resourceReport.references.some((item) => item.collection === 'documents' && item.id === document.id),
    'public documents are checked even though they are not a recycle-bin target collection')

  const solution = await cms.create({ ...review, collection: 'solutions', data: {
    ...published, title: 'Linked solution', slug: 'linked-solution',
    sourceData: { card: { href: { en: '/products/published-reference', zh: '/zh/products/published-reference/#details' } } },
  } })
  const page = await cms.create({ ...review, collection: 'pages', data: {
    _status: 'published', title: 'Linked visual page', slug: 'linked-visual-page',
    layout: { content: [{ type: 'Hero', props: { href: '/zh/products/published-reference#details' } }] },
  } })
  const post = await cms.create({ ...review, collection: 'posts', data: {
    ...published, title: 'Legacy metadata only', slug: 'legacy-metadata-only', excerpt: 'No active product links',
    topic: 'design', author: 'Test Author', image: image.id, body: textAnswer,
    sourceData: { href: '/products/published-reference' },
  } })

  const linkedFaq = await cms.create({ ...review, collection: 'faqs', data: {
    _status: 'published', stableKey: 'impact-richtext-faq', question: 'Linked product question',
    category: 'products', displayLocations: ['library'],
    answer: { root: { ...textAnswer.root, children: [{ type: 'paragraph', version: 1, children: [{
      type: 'link', version: 3, format: '', indent: 0, direction: 'ltr',
      fields: { linkType: 'internal', doc: { relationTo: 'products', value: product.id }, newTab: false },
      children: [{ type: 'text', version: 1, text: 'Product information' }],
    }] }] } },
  } })
  const productReport = await collectTrashImpact(await request(), {
    collection: 'products', selection: { mode: 'ids', ids: [product.id] },
  })
  assert.ok(productReport.references.some((item) => item.collection === 'faqs' && item.id === linkedFaq.id),
    'Lexical internal links are direct references too')
  assert.ok(productReport.references.some((item) => item.collection === 'solutions' && item.id === solution.id),
    'explicit localized links in exported structured data are checked')
  assert.ok(productReport.references.some((item) => item.collection === 'pages' && item.id === page.id),
    'visual page action links are checked')
  assert.ok(!productReport.references.some((item) => item.collection === 'posts' && item.id === post.id),
    'legacy product and post metadata removed from snapshots must not create false references')

  await cms.updateGlobal({ ...review, slug: 'site-settings', data: { canonicalBaseUrl: 'https://www.example.test' } })
  const absoluteLink = await navigation('canonical-category-link', 'https://www.example.test/en/products?category=target-packaging')
  const misleadingHost = await navigation('other-origin-category-link', 'https://www.example.test.evil.test/products?category=target-packaging')
  const canonicalReport = await collectTrashImpact(await request(), input)
  assert.ok(canonicalReport.references.some((item) => item.collection === 'navigation-menus' && item.id === absoluteLink.id))
  assert.ok(!canonicalReport.references.some((item) => item.collection === 'navigation-menus' && item.id === misleadingHost.id))

  for (let index = 0; index < 31; index += 1) {
    await cms.create({ ...review, collection: 'categories', data: {
      ...published, name: `Bulk scope ${index}`, slug: `bulk-scope-${index}`,
    } })
  }
  const lastPageReference = await navigation('bulk-last-page-link', '/products?category=bulk-scope-30')
  const queryReport = await collectTrashImpact(await request(), {
    collection: 'categories', selection: {
      mode: 'query', where: { _status: { equals: 'published' } }, search: 'Bulk scope',
    },
  })
  assert.equal(queryReport.targetCount, 31, 'all matching targets are checked across list pages')
  assert.ok(queryReport.references.some((item) => item.collection === 'navigation-menus' && item.id === lastPageReference.id))
  assert.equal(queryReport.totalReferences, 1)

  for (let index = 0; index < 101; index += 1) {
    await navigation(`overflow-reference-${index}`, '/products?category=bulk-scope-0')
  }
  const longReport = await collectTrashImpact(await request(), {
    collection: 'categories', selection: { mode: 'ids', ids: [(await cms.find({
      ...review, collection: 'categories', where: { slug: { equals: 'bulk-scope-0' } },
    })).docs[0].id] },
  })
  assert.equal(longReport.totalReferences, 101, 'source records beyond the first database page are counted')
  assert.equal(longReport.displayLimit, 50)
  assert.equal(longReport.references.length, 50, 'a limited detail list must preserve the complete impact count')
})
