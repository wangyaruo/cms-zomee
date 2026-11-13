import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import { APIError, buildConfig, createLocalReq, getPayload, type CollectionConfig, type File } from 'payload'
import sharp from 'sharp'
import { Documents } from '../src/collections/Documents'
import { Media } from '../src/collections/Media'
import { PrivateDocuments } from '../src/collections/PrivateDocuments'
import { Users } from '../src/collections/Users'
import { enforceUploadLimits } from '../src/collections/uploadLimits'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>'
const upload = (data: Buffer, name: string, mimetype: string): File => ({ data, name, mimetype, size: data.length })
const blocked = (error: unknown) => error instanceof APIError && error.status === 400 && /svg/i.test(error.message)
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')

test('SVG uploads cannot bypass the file policy and rejected replacements preserve originals', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-svg-uploads-'))
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const isolate = (collection: CollectionConfig): CollectionConfig => ({
    ...collection,
    upload: { ...(typeof collection.upload === 'object' ? collection.upload : {}), staticDir: path.join(directory, collection.slug) },
  })
  const cms = payload = await getPayload({ config: buildConfig({
    collections: [Users, isolate(Media), isolate(Documents), isolate(PrivateDocuments),
      { slug: 'resources', fields: [{ name: 'title', type: 'text' }] }],
    localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
    i18n: { supportedLanguages: { en, zh }, fallbackLanguage: 'en' },
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'test.db')}` } }),
    secret: 'isolated-secret-for-svg-upload-policy-tests', sharp,
    typescript: { autoGenerate: false },
  }) })
  const admin = { ...await cms.create({ collection: 'users', data: {
    email: 'svg-admin@example.test', password: 'test-password-only', name: 'SVG Test Admin', role: 'admin',
  } }), collection: 'users' as const }
  const access = { overrideAccess: false, user: admin, depth: 0 }
  const request = async (language: 'en' | 'zh' = 'en') => {
    const req = await createLocalReq({ user: admin }, cms)
    req.i18n.language = language
    return req
  }
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#bbb' } }).png().toBuffer()
  const original = await cms.create({ ...access, collection: 'media', data: { alt: 'Original raster' },
    file: upload(png, 'original.png', 'image/png'),
  })
  assert.ok(original.filename)
  assert.ok(original.sizes?.thumbnail?.filename)
  const mediaDirectory = path.join(directory, 'media')
  const diskState = async () => Promise.all((await readdir(mediaDirectory)).sort().map(async (name) =>
    [name, digest(await readFile(path.join(mediaDirectory, name)))]))
  const before = await diskState()
  const variants = [
    upload(Buffer.from(svg), 'vector.svg', 'image/svg+xml'),
    upload(Buffer.from(svg), 'disguised.png', 'image/png'),
    upload(gzipSync(svg), 'compressed.png', 'image/png'),
    upload(png, 'raster.SVG', 'image/png'),
    upload(png, 'raster.svgz', 'image/png'),
    upload(png, 'raster.png', 'image/svg+xml'),
    upload(png, 'raster.png', 'IMAGE/SVG+XML; charset=utf-8'),
    upload(Buffer.from('\ufeff<?xml version="1.0"?>\n<!-- imported artwork -->\n' + svg), 'xml.png', 'image/png'),
    upload(Buffer.from('<?xml version="1.0"?>\n<!--' + 'x'.repeat(70_000) + '-->\n' + svg), 'long-comment.png', 'image/png'),
    upload(Buffer.from('\ufeff<?xml version="1.0" encoding="UTF-16"?>' + svg, 'utf16le'), 'utf16.png', 'image/png'),
    upload(Buffer.from('\ufeff<?xml version="1.0" encoding="UTF-16"?>' + svg, 'utf16le').swap16(), 'utf16be.png', 'image/png'),
  ]
  for (const file of variants) {
    await assert.rejects(cms.create({ ...access, collection: 'media', data: { alt: 'Rejected SVG' }, file }), blocked)
  }
  for (const language of ['zh', 'en'] as const) {
    await assert.rejects(cms.update({ ...access, req: await request(language), collection: 'media', id: original.id,
      overwriteExistingFiles: true, data: { alt: 'Must not replace original' },
      file: upload(Buffer.from(svg), original.filename!, 'image/png'),
    }), (error) => blocked(error) && (language === 'zh' ? /[\u4e00-\u9fff]/ : /SVG/).test((error as Error).message))
  }
  assert.deepEqual(await diskState(), before)
  const unchanged = await cms.findByID({ ...access, collection: 'media', id: original.id })
  assert.equal(unchanged.alt, original.alt)
  assert.equal(unchanged.filename, original.filename)
  assert.equal(unchanged.updatedAt, original.updatedAt)
  assert.equal(unchanged.mimeType, original.mimeType)
  assert.equal(unchanged.filesize, original.filesize)
  assert.deepEqual(unchanged.sizes, original.sizes)
  assert.equal((await cms.count({ ...access, collection: 'media' })).totalDocs, 1)

  const svgPath = path.join(directory, 'disguised-local.png')
  await writeFile(svgPath, svg)
  await assert.rejects(cms.create({ ...access, collection: 'media', data: { alt: 'File path SVG' }, filePath: svgPath }), blocked)
  for (const collection of ['media', 'documents', 'private-documents'] as const) {
    const req = await request()
    req.file = { ...upload(png, 'temporary.png', 'image/png'), tempFilePath: svgPath }
    await assert.rejects(async () => enforceUploadLimits({
      collection: cms.collections[collection].config, context: req.context, operation: 'create', req, overrideAccess: false,
      args: { collection: cms.collections[collection], req, data: {}, overrideAccess: false },
    }), blocked)
  }

  const publicData = { _status: 'draft' as const, title: 'Public test document', sourcePath: '/tests/svg-policy.txt', locale: 'en' as const }
  const plainText = Buffer.from('Ordinary business document without embedded markup.')
  const document = await cms.create({ ...access, collection: 'documents', draft: true, data: publicData,
    file: upload(plainText, 'ordinary.txt', 'text/plain'),
  })
  const privateDocument = await cms.create({ ...access, collection: 'private-documents', data: { title: 'Private test document' },
    file: upload(plainText, 'ordinary.txt', 'text/plain'),
  })
  for (const collection of ['documents', 'private-documents'] as const) {
    const data = collection === 'documents' ? publicData : { title: 'Rejected SVG' }
    for (const bytes of [
      Buffer.from(svg),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H10V10Z"/></svg>'),
      Buffer.from('<vector:svg xmlns:vector="http://www.w3.org/2000/svg"><vector:rect width="10" height="10"/></vector:svg>'),
      Buffer.from('<!--' + 'x'.repeat(150_000) + '-->' + svg),
      Buffer.from('<?test ' + 'x'.repeat(150_000) + '?>' + svg),
      Buffer.from('\ufeff<?xml version="1.0" encoding="UTF-16"?>' + svg, 'utf16le'),
    ]) {
      await assert.rejects(cms.create({ ...access, collection, draft: true, data,
        file: upload(bytes, 'disguised-document.txt', 'text/plain'),
      }), blocked)
    }
    // Payload's document MIME allowlist must also reject compressed vectors disguised as text.
    await assert.rejects(cms.create({ ...access, collection, draft: true, data,
      file: upload(gzipSync(svg), 'compressed-document.txt', 'text/plain'),
    }), (error) => error instanceof APIError && error.status === 400)
    const existing = collection === 'documents' ? document : privateDocument
    const filename = existing.filename!
    const beforeFile = await readFile(path.join(directory, collection, filename))
    await assert.rejects(cms.update({ ...access, collection, id: existing.id, data,
      file: upload(Buffer.from(svg), filename, 'text/plain'),
    }), blocked)
    assert.equal(digest(await readFile(path.join(directory, collection, filename))), digest(beforeFile))
  }

  // Model a pre-policy SVG only in this disposable database; public reads and metadata remain usable.
  const legacy = await cms.create({ ...access, collection: 'media', data: { alt: 'Historical vector' },
    file: upload(png, 'legacy-seed.png', 'image/png'),
  })
  await writeFile(path.join(mediaDirectory, 'historical.svg'), svg)
  await cms.db.updateOne({ collection: 'media', id: legacy.id, data: {
    filename: 'historical.svg', mimeType: 'image/svg+xml', filesize: Buffer.byteLength(svg), width: 32, height: 32,
  } })
  const legacyBefore = await diskState()
  const translated = await cms.update({ ...access, collection: 'media', id: legacy.id, locale: 'zh', data: { alt: '历史矢量图说明' } })
  assert.equal(translated.alt, '历史矢量图说明')
  assert.equal(translated.filename, 'historical.svg')
  assert.equal((await cms.findByID({ ...access, collection: 'media', id: legacy.id })).filename, 'historical.svg')
  await assert.rejects(cms.duplicate({ ...access, collection: 'media', id: legacy.id }), blocked)
  await assert.rejects(cms.create({ ...access, collection: 'media', duplicateFromID: legacy.id,
    data: { alt: 'Ignored raster must not bypass a stored SVG source' }, file: upload(png, 'ignored.png', 'image/png'),
  }), blocked)
  const cropRequest = await request()
  cropRequest.query = { uploadEdits: { crop: { x: 0, y: 0, width: 16, height: 16 }, widthInPixels: 16, heightInPixels: 16 } }
  await assert.rejects(cms.update({ ...access, req: cropRequest, collection: 'media', id: legacy.id, data: {} }), blocked)
  assert.deepEqual(await diskState(), legacyBefore)
})
