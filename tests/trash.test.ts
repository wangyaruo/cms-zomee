import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { APIError, buildConfig, createLocalReq, getPayload, type Where } from 'payload'
import sharp from 'sharp'
import { Categories } from '../src/collections/Categories'
import { Documents } from '../src/collections/Documents'
import { Faqs } from '../src/collections/Faqs'
import { LegalPages } from '../src/collections/LegalPages'
import { Media } from '../src/collections/Media'
import { NavigationMenus } from '../src/collections/NavigationMenus'
import { Posts } from '../src/collections/Posts'
import { Products } from '../src/collections/Products'
import { SitePages } from '../src/collections/SitePages'
import { Users } from '../src/collections/Users'
import { withContentTrash } from '../src/collections/contentTrash'
import { Applications, Resources, Solutions } from '../src/collections/structured'
import { captureSnapshot } from '../src/endpoints/snapshot'
import { SiteSettings } from '../src/globals/SiteSettings'

const forbidden = (error: unknown) => error instanceof APIError && error.status === 403
const unavailable = (error: unknown) => error instanceof APIError && [403, 404].includes(error.status)
const deletionTime = (doc: object) => 'deletedAt' in doc ? doc.deletedAt ?? null : null

test('the content recycle bin preserves records and controls their visibility', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-trash-'))
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const contentCollections = [Categories, Products, Posts, Faqs, Applications, Solutions,
    Resources, NavigationMenus, LegalPages, SitePages]
  const cms = payload = await getPayload({ config: buildConfig({
    collections: [Users, { ...Media, upload: { disableLocalStorage: true } },
      { ...Documents, upload: { disableLocalStorage: true } }, ...contentCollections.map(withContentTrash)],
    globals: [SiteSettings],
    localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
    editor: lexicalEditor(),
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'content.db')}` } }),
    secret: 'temporary-secret-for-content-trash-tests',
    sharp,
    typescript: { autoGenerate: false },
  }) })
  const makeUser = (role: 'admin' | 'reviewer' | 'editor') => cms.create({ collection: 'users', data: {
    email: `${role}@example.test`, password: 'test-password-only', name: role, role,
  } })
  const admin = await makeUser('admin')
  const reviewer = await makeUser('reviewer')
  const editor = await makeUser('editor')
  const access = { overrideAccess: false, depth: 0, showHiddenFields: true }
  const review = { ...access, user: reviewer }
  const published = { _status: 'published' as const, seo: { robots: 'index' as const } }
  const archivedAt = new Date().toISOString()
  const category = await cms.create({ ...review, collection: 'categories', data: {
    ...published, name: 'Original packaging', slug: 'original-packaging', deletedAt: archivedAt,
  } })
  assert.equal(deletionTime(category), null, 'create cannot move a record straight to the recycle bin')
  await cms.update({ ...review, collection: 'categories', id: category.id, locale: 'zh', data: {
    ...published, name: '原始包装',
  } })
  await cms.update({ ...review, collection: 'categories', id: category.id, data: {
    ...published, name: category.name, deletedAt: null,
  } })
  const pendingCategory = await cms.update({ ...access, user: editor, collection: 'categories',
    id: category.id, draft: true, data: {
      _status: 'draft', name: 'Pending packaging', slug: 'pending-packaging', deletedAt: null,
    },
  })
  assert.equal(pendingCategory.name, 'Pending packaging', 'normal form saves keep their submitted changes')
  assert.equal((await cms.findByID({ ...review, collection: 'categories', id: category.id })).name, category.name)

  const faq = await cms.create({ ...review, collection: 'faqs', data: {
    _status: 'published', stableKey: 'trash-regression-answer', question: 'What is the archive answer?',
    answer: { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
      children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Archive test answer', version: 1 }] }],
    } },
    category: 'products', displayLocations: ['application'],
  } })
  const application = await cms.create({ ...review, collection: 'applications', data: {
    ...published, slug: 'archive-example-application', title: 'Archived application copy marker', faqs: [faq.id],
    sourceData: {},
  } })
  const solution = await cms.create({ ...review, collection: 'solutions', data: {
    ...published, slug: 'active-solution', title: 'Active solution', applications: [application.id], sourceData: {},
  } })
  const snapshot = async (preview: boolean) => captureSnapshot(await createLocalReq({}, cms), preview,
    ['categories', 'applications', 'solutions', 'faqs'])

  const originalVersions = await cms.findVersions({ ...review, collection: 'categories',
    where: { parent: { equals: category.id } },
  })
  assert.ok(originalVersions.docs.length > 0)

  await assert.rejects(cms.update({ ...access, user: editor, collection: 'categories', id: category.id,
    data: { deletedAt: archivedAt },
  }), forbidden)
  await assert.rejects(cms.delete({ ...access, user: admin, collection: 'categories', id: category.id }), forbidden)
  const archivedCategory = await cms.update({ ...review, collection: 'categories', id: category.id,
    draft: true, data: { deletedAt: archivedAt, name: 'Must not replace the original name' },
  })
  assert.equal(archivedCategory.name, pendingCategory.name, 'archiving preserves the latest unpublished draft')
  assert.equal(archivedCategory.slug, pendingCategory.slug, 'archiving also preserves nonlocalized draft fields')
  const categoryDeletionTime = deletionTime(archivedCategory)
  assert.ok(typeof categoryDeletionTime === 'string' && Number.isFinite(Date.parse(categoryDeletionTime)))
  for (const draft of [false, true]) {
    assert.equal((await cms.find({ ...review, collection: 'categories', draft })).docs.length, 0)
    await assert.rejects(cms.findByID({ ...review, collection: 'categories', id: category.id, draft }), unavailable)
    const inBin = await cms.findByID({ ...review, collection: 'categories', id: category.id, draft, trash: true })
    assert.equal(deletionTime(inBin), categoryDeletionTime)
  }
  await assert.rejects(cms.update({ ...access, user: editor, collection: 'categories', id: category.id,
    trash: true, data: { deletedAt: null, _status: 'draft' },
  }), forbidden)
  await assert.rejects(cms.update({ ...review, collection: 'categories', id: category.id, trash: true,
    data: { name: 'Forbidden edit while in recycle bin' },
  }), unavailable)
  await assert.rejects(cms.duplicate({ ...review, collection: 'categories', id: category.id, draft: true }), unavailable)
  await assert.rejects(cms.restoreVersion({ ...review, collection: 'categories', id: String(originalVersions.docs[0].id),
    draft: true,
  }), unavailable)
  await assert.rejects(cms.delete({ ...access, user: admin, collection: 'categories', id: category.id,
    trash: true,
  }), forbidden)

  await cms.update({ ...review, collection: 'applications', id: application.id, data: { deletedAt: archivedAt } })
  await cms.update({ ...review, collection: 'faqs', id: faq.id, data: { deletedAt: archivedAt } })
  for (const preview of [false, true]) {
    const { content } = await snapshot(preview)
    assert.deepEqual(content.categories, [])
    assert.deepEqual(content.applications, [])
    assert.deepEqual(content.faqs, [])
    assert.equal((content.solutions as { id: number }[])[0]?.id, solution.id)
    assert.doesNotMatch(JSON.stringify(content.solutions), /Archived application copy marker/,
      'an archived record must not reappear as an expanded relationship')
  }

  // Payload's admin restore submits a bulk update scoped to deleted records.
  const restoreWhere = (id: number | string): Where => ({ and: [{ id: { equals: id } }, { deletedAt: { exists: true } }] })
  const restored = await cms.update({ ...review, collection: 'categories', where: restoreWhere(category.id),
    trash: true, draft: true, data: { deletedAt: null },
  })
  assert.deepEqual(restored.errors, [])
  assert.equal(restored.docs[0]?.id, category.id)
  assert.equal(restored.docs[0]?._status, 'draft')
  const translated = await cms.findByID({ ...review, collection: 'categories', id: category.id, locale: 'zh', draft: true })
  assert.equal(translated.name, '原始包装')
  assert.equal(translated.slug, pendingCategory.slug)
  assert.equal(deletionTime(translated), null)
  assert.equal((await cms.findByID({ ...review, collection: 'categories', id: category.id, draft: true })).name,
    pendingCategory.name)
  const archivedVersions = await cms.findVersions({ ...review, collection: 'categories', trash: true,
    where: { parent: { equals: category.id }, 'version.deletedAt': { exists: true } },
  })
  assert.ok(archivedVersions.docs[0], 'archiving keeps the record history')
  await assert.rejects(cms.restoreVersion({ ...review, collection: 'categories',
    id: String(archivedVersions.docs[0].id),
  }), (error) => error instanceof APIError && error.status === 409)

  const publishedFaq = await cms.update({ ...review, collection: 'faqs', where: restoreWhere(faq.id),
    trash: true, data: { deletedAt: null, _status: 'published' },
  })
  assert.deepEqual(publishedFaq.errors, [])
  assert.equal(publishedFaq.docs[0]?.id, faq.id)
  assert.equal(publishedFaq.docs[0]?._status, 'published')
  assert.deepEqual(publishedFaq.docs[0]?.answer, faq.answer)
  await cms.update({ ...review, collection: 'applications', id: application.id, trash: true,
    data: { deletedAt: null, _status: 'published' },
  })
  const publicContent = (await snapshot(false)).content
  assert.deepEqual(publicContent.categories, [])
  assert.equal((publicContent.applications as { id: number }[])[0]?.id, application.id)
  assert.match(JSON.stringify(publicContent.solutions), /Archived application copy marker/)
  assert.equal(((await snapshot(true)).content.categories as { id: number }[])[0]?.id, category.id)
})
