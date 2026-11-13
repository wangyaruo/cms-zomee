import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import { APIError, buildConfig, createLocalReq, getPayload, type CollectionConfig } from 'payload'
import sharp from 'sharp'
import { isEditor } from '../src/access/roles'
import { Media } from '../src/collections/Media'
import { Releases } from '../src/collections/Releases'
import { Users } from '../src/collections/Users'
import { withContentTrash } from '../src/collections/contentTrash'
import { collectMediaReferences } from '../src/endpoints/mediaReferences'
import { SiteSettings } from '../src/globals/SiteSettings'

const status = (expected: number) => (error: unknown) => error instanceof APIError && error.status === expected
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const root = (children: { type: string; version: number; [key: string]: unknown }[]) => ({ root: {
  type: 'root', version: 1, direction: 'ltr' as const, format: '' as const, indent: 0, children,
} })

test('media references protect files, retained content and releases without exposing restricted details', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-media-references-'))
  const mediaDirectory = path.join(directory, 'media')
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const contentAccess = { read: isEditor, create: isEditor, update: isEditor, delete: isEditor }
  // Small schemas retain the production field names and storage shapes while isolating each reference channel.
  const products: CollectionConfig = withContentTrash({
    slug: 'products', admin: { useAsTitle: 'name' }, access: contentAccess,
    versions: { drafts: true, maxPerDoc: 20 }, fields: [
      { name: 'name', type: 'text', localized: true },
      { name: 'slug', type: 'text' },
      { name: 'image', type: 'upload', relationTo: 'media' },
      { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
      { name: 'sourceData', type: 'json' },
      { name: 'relatedProducts', type: 'relationship', relationTo: 'products', hasMany: true },
      { name: 'options', type: 'array', fields: [
        { name: 'choices', type: 'array', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
      ] },
    ],
  })
  const cms = payload = await getPayload({ config: buildConfig({
    collections: [Users, {
      ...Media, upload: { ...(typeof Media.upload === 'object' ? Media.upload : {}), staticDir: mediaDirectory },
    }, products, Releases,
    { slug: 'pages', admin: { useAsTitle: 'title' }, access: contentAccess,
      fields: [{ name: 'title', type: 'text' }, { name: 'layout', type: 'json' }] },
    { slug: 'site-pages', admin: { useAsTitle: 'title' }, access: contentAccess,
      fields: [{ name: 'title', type: 'text', localized: true }, { name: 'sourceData', type: 'json' }] },
    { slug: 'posts', admin: { useAsTitle: 'title' }, access: contentAccess,
      fields: [{ name: 'title', type: 'text' }, { name: 'sourceData', type: 'json' }] },
    { slug: 'faqs', admin: { useAsTitle: 'question' }, access: contentAccess,
      fields: [{ name: 'question', type: 'text', localized: true }, { name: 'answer', type: 'richText', localized: true }] }],
    globals: [SiteSettings],
    localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
    i18n: { supportedLanguages: { en, zh }, fallbackLanguage: 'en' },
    editor: lexicalEditor(), serverURL: 'https://cms.example.test',
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'content.db')}` } }),
    secret: 'isolated-secret-for-media-reference-tests', sharp,
    typescript: { autoGenerate: false },
  }) })
  const makeUser = async (role: 'admin' | 'editor' | 'reviewer') => ({
    ...await cms.create({ collection: 'users', data: {
      email: `${role}@example.test`, password: 'test-password-only', name: role, role,
    } }), collection: 'users' as const,
  })
  const admin = await makeUser('admin')
  const editor = await makeUser('editor')
  const reviewer = await makeUser('reviewer')
  const access = { user: admin, overrideAccess: false, depth: 0 }
  const request = async (user = admin, language = 'en') => {
    const req = await createLocalReq({ user }, cms)
    req.i18n.language = language
    return req
  }
  const input = (id: number | string) => ({ selection: { mode: 'ids' as const, ids: [id] }, locale: 'zh' })
  const report = async (id: number | string) => collectMediaReferences(await request(), input(id))
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#ced' } }).png().toBuffer()
  const tinyPng = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer()
  const media = (name: string, bytes = tinyPng) => cms.create({ ...access, collection: 'media', data: {
    alt: name, sourcePath: `/assets/${name}.png`,
  }, file: { name: `${name}.png`, data: bytes, mimetype: 'image/png', size: bytes.length } })
  const target = await media('referenced-original', png)
  const alternate = await media('alternate')
  const free = await media('unused-image')
  assert.ok(target.sizes?.thumbnail?.filename)

  const product = await cms.create({ ...access, collection: 'products', data: {
    name: 'Published image owner', slug: 'published-image-owner', contentStatus: 'ready',
    seo: { robots: 'index' }, image: target.id, _status: 'published',
  } })
  await cms.update({ ...access, collection: 'products', id: product.id, draft: true,
    data: { name: 'Latest draft removed image', image: alternate.id, _status: 'draft' } })
  const nested = await cms.create({ ...access, collection: 'products', draft: true, data: {
    name: 'Nested image owner', gallery: [target.id],
    options: [{ key: 'format', label: 'Format', choices: [{ value: 'pouch', label: 'Pouch', image: target.id }] }], _status: 'draft',
  } })
  await cms.update({ ...access, collection: 'products', id: nested.id, locale: 'zh', draft: true,
    data: { name: '多层图片引用', _status: 'draft' } })
  const trashed = await cms.create({ ...access, collection: 'products', data: {
    name: 'Trashed image owner', slug: 'trashed-image-owner', contentStatus: 'ready',
    seo: { robots: 'index' }, image: target.id, _status: 'published',
  } })
  await cms.update({ ...access, collection: 'products', id: trashed.id, data: { deletedAt: new Date().toISOString() } })
  const faq = await cms.create({ ...access, collection: 'faqs', data: {
    question: 'Localized rich text reference', stableKey: 'media-reference-faq', category: 'products',
    displayLocations: ['library'], answer: root([]),
  } })
  await cms.update({ ...access, collection: 'faqs', id: faq.id, locale: 'zh', data: {
    question: '中文富文本图片引用', answer: root([
      { type: 'upload', version: 3, relationTo: 'media', value: target.id, fields: {} },
      { type: 'paragraph', version: 1, children: [{ type: 'link', version: 3,
        fields: { linkType: 'internal', doc: { relationTo: 'media', value: target.id } },
        children: [{ type: 'text', version: 1, text: 'Image link' }] }] },
    ]),
  } })
  const layout = await cms.create({ ...access, collection: 'pages', data: {
    title: 'Canvas thumbnail reference', slug: 'canvas-thumbnail-reference', layout: { content: [{ type: 'Image', props: {
      src: `/api/media/file/${target.sizes!.thumbnail!.filename}?v=1#preview`,
    } }] },
  } })
  const originalPath = await cms.create({ ...access, collection: 'site-pages', data: {
    title: 'Imported source image', slug: 'imported-source-image', path: '/imported', pageType: 'home',
    sourceData: { hero: { image: target.sourcePath } },
  } })
  await cms.updateGlobal({ ...access, slug: 'site-settings', data: {
    logo: target.id, canonicalBaseUrl: 'https://www.example.test', _status: 'published',
  } })
  const absolute = await cms.create({ ...access, collection: 'pages', data: {
    title: 'Canonical image reference', slug: 'canonical-image-reference', layout: { image: `https://www.example.test${target.sourcePath}` },
  } })
  await cms.create({ ...access, collection: 'pages', data: {
    title: 'Unrelated values', slug: 'unrelated-values', layout: { id: free.id, orderId: free.id,
      image: `https://external.example/api/media/file/${free.filename}`,
      source: `https://www.example.test.evil.test${free.sourcePath}` },
  } })
  await cms.create({ ...access, collection: 'products', draft: true, data: {
    name: 'Ignored product migration copy', sourceData: { image: free.url },
  } })
  await cms.create({ ...access, collection: 'posts', draft: true, data: {
    title: 'Ignored article migration copy', sourceData: { image: free.sourcePath },
  } })
  await cms.create({ collection: 'payload-locked-documents', data: {
    document: { relationTo: 'media', value: free.id }, user: { relationTo: 'users', value: admin.id },
  } })

  const references = await report(target.id)
  const source = (collection: string, id: number | string) => references.references.find((ref) => ref.collection === collection && ref.id === id)
  assert.ok(source('products', product.id)?.states.includes('published'), 'a new draft must not hide the published image')
  assert.ok(source('products', nested.id)?.fields.some(({ path: field }) => field === 'options.choices.image'))
  assert.equal(source('products', nested.id)?.title, '多层图片引用')
  assert.ok(source('products', trashed.id)?.states.includes('trash'), 'restorable content must retain its images')
  assert.ok(source('faqs', faq.id), 'non-default language Lexical upload and internal link nodes are scanned')
  assert.ok(source('pages', layout.id), 'thumbnail URLs are references to their original media record')
  assert.ok(source('site-pages', originalPath.id), 'imported source paths are checked')
  assert.ok(source('pages', absolute.id), 'configured website origin is recognized')
  assert.ok(references.references.some((ref) => ref.kind === 'global' && ref.global === 'site-settings'))
  assert.equal((await report(free.id)).totalReferences, 0,
    'unrelated IDs, external URLs, excluded migration copies and editing locks are not content references')
  assert.doesNotMatch(JSON.stringify(references), /test-password|password|"snapshot"/)
  assert.equal((await collectMediaReferences(await request(reviewer), input(target.id))).targetCount, 1)
  await assert.rejects(collectMediaReferences(await createLocalReq({}, cms), input(target.id)), status(403))
  await assert.rejects(collectMediaReferences(await request(), { selection: { mode: 'ids', ids: [] } }), status(400))
  await assert.rejects(collectMediaReferences(await request(), input(999999)), status(404))

  const files = async () => Promise.all((await readdir(mediaDirectory)).sort().map(async (name) =>
    [name, hash(await readFile(path.join(mediaDirectory, name)))]))
  const before = await files()
  for (const language of ['en', 'zh']) {
    await assert.rejects(cms.delete({ ...access, req: await request(admin, language), collection: 'media', id: target.id }),
      (error) => status(409)(error) && (language === 'zh' ? /[\u4e00-\u9fff]/ : /[a-z]/i).test((error as Error).message))
  }
  await assert.rejects(cms.delete({ collection: 'media', id: target.id, overrideAccess: true }), status(409))
  assert.deepEqual(await files(), before, 'failed deletes preserve original and derived file bytes')
  assert.equal((await cms.findByID({ ...access, collection: 'media', id: target.id })).filename, target.filename)
  const normalFind = cms.find.bind(cms)
  cms.find = ((options: Parameters<typeof cms.find>[0]) => {
    if (options.collection === 'products') throw new Error('Simulated reference-store read failure')
    return normalFind(options)
  }) as typeof cms.find
  try {
    await assert.rejects(cms.delete({ ...access, collection: 'media', id: free.id }), /Simulated reference-store read failure/)
  } finally {
    cms.find = normalFind
  }
  assert.deepEqual(await files(), before, 'a failed integrity scan must leave even an unused file intact')
  assert.equal((await cms.findByID({ ...access, collection: 'media', id: free.id })).filename, free.filename)
  const bulk = await cms.delete({ ...access, collection: 'media', where: { id: { in: [target.id, free.id] } } })
  assert.equal(bulk.errors.length, 1)
  assert.equal(String(bulk.errors[0].id), String(target.id))
  assert.equal(bulk.docs.length, 1)
  assert.equal(bulk.docs[0].id, free.id)
  await assert.rejects(readFile(path.join(mediaDirectory, free.filename!)), { code: 'ENOENT' })
  assert.equal(hash(await readFile(path.join(mediaDirectory, target.filename!))), hash(png))

  const historical = await media('historical-only')
  const owner = await cms.create({ ...access, collection: 'products', data: {
    name: 'Historical owner', slug: 'historical-owner', contentStatus: 'ready',
    seo: { robots: 'index' }, image: historical.id, _status: 'published',
  } })
  await cms.update({ ...access, collection: 'products', id: owner.id, data: { image: alternate.id, _status: 'published' } })
  const historyReport = await report(historical.id)
  assert.ok(historyReport.references.some((ref) => ref.collection === 'products' && ref.id === owner.id && ref.states.includes('history')))
  await assert.rejects(cms.delete({ ...access, collection: 'media', id: historical.id }), status(409))
  const globalHistorical = await media('global-history-only')
  await cms.updateGlobal({ ...access, slug: 'site-settings', data: { defaultShareImage: globalHistorical.id, _status: 'published' } })
  await cms.updateGlobal({ ...access, slug: 'site-settings', data: { defaultShareImage: alternate.id, _status: 'published' } })
  assert.ok((await report(globalHistorical.id)).references.some((ref) => ref.kind === 'global' && ref.states.includes('history')))

  const released = await media('release-only')
  const release = await cms.create({ collection: 'releases', overrideAccess: true, data: {
    name: 'RESTRICTED_RELEASE_TITLE', contentHash: 'media-reference-fixture', createdBy: admin.id,
    snapshot: { content: { products: [{ id: 999, name: { en: 'SNAPSHOT_BODY_MUST_STAY_PRIVATE' }, image: released }] }, settings: {} },
  } })
  assert.ok((await report(released.id)).references.some((ref) => ref.collection === 'releases' && ref.id === release.id && ref.states.includes('release')))
  const editorReport = await collectMediaReferences(await request(editor), input(released.id))
  assert.equal(editorReport.totalReferences, 1)
  assert.equal(editorReport.restrictedReferences, 1)
  assert.equal(editorReport.references.length, 0)
  assert.doesNotMatch(JSON.stringify(editorReport), /RESTRICTED_RELEASE_TITLE|SNAPSHOT_BODY_MUST_STAY_PRIVATE|release-only|snapshot/)
  await assert.rejects(cms.delete({ collection: 'media', id: released.id, user: editor, overrideAccess: false }), status(409))

  const selected = []
  for (let index = 0; index < 31; index += 1) selected.push(await media(`bulk-media-scope-${index}`))
  await cms.create({ ...access, collection: 'pages', data: {
    title: 'Last selected item', slug: 'last-selected-item', layout: { image: selected[30].url },
  } })
  const selectedReport = await collectMediaReferences(await request(), { selection: { mode: 'query', search: 'bulk-media-scope-' } })
  assert.equal(selectedReport.targetCount, 31, 'list selection queries include targets beyond the first page')
  assert.equal(selectedReport.totalReferences, 1)
  for (let index = 0; index < 101; index += 1) {
    await cms.create({ ...access, collection: 'pages', data: {
      title: `Many image references ${index}`, slug: `many-image-references-${index}`, layout: { image: selected[0].url },
    } })
  }
  const many = await report(selected[0].id)
  assert.equal(many.totalReferences, 101, 'source pages beyond the database page boundary are counted')
  assert.equal(many.displayLimit, 50)
  assert.equal(many.references.length, 50, 'report truncation never changes the integrity count')
})
