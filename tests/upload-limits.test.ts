import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { crc32 } from 'node:zlib'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import { APIError, buildConfig, createLocalReq, getPayload, type CollectionConfig, type File } from 'payload'
import sharp from 'sharp'
import { Documents } from '../src/collections/Documents'
import { Media } from '../src/collections/Media'
import { PrivateDocuments } from '../src/collections/PrivateDocuments'
import { Users } from '../src/collections/Users'
import {
  DOCUMENT_MAX_BYTES, enforceUploadLimits, MEDIA_MAX_BYTES, MAX_IMAGE_PIXELS,
  MAX_IMAGE_SIDE, uploadRequestLimits,
} from '../src/collections/uploadLimits'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2S0AAAAASUVORK5CYII=', 'base64')
const status = (expected: number) => (error: unknown) => error instanceof APIError && error.status === expected
const file = (data: Buffer, name = 'fixture.png', mimetype = 'image/png', size = data.length): File => ({
  data, name, mimetype, size,
})

function dimensions(width: number, height: number) {
  // Header-only metadata keeps this rejection fixture tiny; the hook must reject it before decoding.
  const result = Buffer.from(png)
  result.writeUInt32BE(width, 16)
  result.writeUInt32BE(height, 20)
  result.writeUInt32BE(crc32(result.subarray(12, 29)), 29)
  return result
}

function animationDimensions(animation: Buffer, width: number, height: number) {
  const result = Buffer.from(animation)
  for (let offset = 12; offset < result.length;) {
    const tag = result.toString('ascii', offset, offset + 4)
    const length = result.readUInt32LE(offset + 4)
    if (tag === 'VP8X') {
      result.writeUIntLE(width - 1, offset + 12, 3)
      result.writeUIntLE(height - 1, offset + 15, 3)
    } else if (tag === 'ANMF') {
      result.writeUIntLE(width - 1, offset + 14, 3)
      result.writeUIntLE(height - 1, offset + 17, 3)
    }
    offset += 8 + length + length % 2
  }
  return result
}

test('uploads enforce real byte and image limits before replacing stored files', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zomeex-upload-limits-'))
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  t.after(async () => {
    await payload?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const isolated = (collection: CollectionConfig): CollectionConfig => ({
    ...collection,
    upload: {
      ...(typeof collection.upload === 'object' ? collection.upload : {}),
      staticDir: path.join(directory, collection.slug),
    },
  })
  const mediaConfig = isolated(Media)
  const documentsConfig = isolated(Documents)
  const privateConfig = isolated(PrivateDocuments)
  const cms = payload = await getPayload({ config: buildConfig({
    collections: [Users, mediaConfig, documentsConfig, privateConfig,
      { slug: 'resources', fields: [{ name: 'title', type: 'text' }] }],
    localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
    i18n: { supportedLanguages: { en, zh }, fallbackLanguage: 'en' },
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'content.db')}` } }),
    upload: uploadRequestLimits,
    secret: 'temporary-secret-for-upload-limits-tests', sharp,
    typescript: { autoGenerate: false },
  }) })
  const admin = {
    ...await cms.create({ collection: 'users', data: {
      email: 'admin@example.test', password: 'test-password-only', name: 'Test Admin', role: 'admin',
    } }),
    collection: 'users' as const,
  }
  const access = { overrideAccess: false, user: admin, depth: 0 }
  const hook = async (collection: 'media' | 'documents' | 'private-documents', upload: File & { truncated?: boolean }, language: 'en' | 'zh' = 'en') => {
    const req = await createLocalReq({ user: admin }, cms)
    req.file = upload
    req.i18n.language = language
    await enforceUploadLimits({
      collection: cms.collections[collection].config,
      context: req.context, req, operation: 'create', overrideAccess: false,
      args: { collection: cms.collections[collection], req, data: {}, overrideAccess: false },
    })
  }

  for (const config of [mediaConfig, documentsConfig, privateConfig]) {
    assert.equal(typeof config.upload === 'object' && config.upload.pasteURL, false)
  }
  const originalBytes = await sharp({ create: {
    width: 640, height: 480, channels: 3, background: '#eee',
  } }).png().toBuffer()
  const original = await cms.create({ ...access, collection: 'media', data: { alt: 'Original image' }, file: file(originalBytes) })
  assert.ok(original.filename)
  assert.ok(original.sizes?.thumbnail?.filename, 'normal uploads still produce thumbnails')
  const mediaDirectory = path.join(directory, 'media')
  const diskState = async () => {
    const names = (await readdir(mediaDirectory)).sort()
    return Promise.all(names.map(async (name) => [name,
      createHash('sha256').update(await readFile(path.join(mediaDirectory, name))).digest('hex')]))
  }
  const before = await diskState()
  const metadata = await cms.update({ ...access, collection: 'media', id: original.id, locale: 'zh', data: {
    alt: '中文图片说明', caption: '仅修改说明，无新文件',
  } })
  assert.equal(metadata.alt, '中文图片说明')
  assert.equal(metadata.filename, original.filename)
  assert.deepEqual(await diskState(), before, 'metadata-only changes do not rewrite image files')

  const tooManyPixels = dimensions(7000, 6000)
  const tooWide = dimensions(MAX_IMAGE_SIDE + 1, 1)
  assert.ok(7000 * 6000 > MAX_IMAGE_PIXELS)
  for (const bytes of [tooManyPixels, tooWide]) {
    await assert.rejects(cms.create({ ...access, collection: 'media', data: { alt: 'Must not exist' },
      file: file(bytes, 'oversized-dimensions.png'),
    }), status(413))
    await assert.rejects(cms.update({ ...access, collection: 'media', id: original.id,
      overwriteExistingFiles: true, data: { alt: 'Must not replace the original' },
      file: file(bytes, original.filename!),
    }), status(413))
  }
  await assert.rejects(cms.create({ ...access, collection: 'media', data: { alt: 'Broken upload' },
    file: file(Buffer.from('not an image')),
  }), status(400))
  assert.deepEqual(await diskState(), before, 'rejected creates and replacements leave every file and thumbnail intact')
  const unchanged = await cms.findByID({ ...access, collection: 'media', id: original.id, locale: 'zh' })
  assert.equal(unchanged.alt, '中文图片说明')
  assert.equal(unchanged.filename, original.filename)
  assert.deepEqual(unchanged.sizes, original.sizes)
  assert.equal((await cms.count({ ...access, collection: 'media' })).totalDocs, 1)

  // Historical oversized files may still receive metadata edits, but must not be decoded again.
  const originalPath = path.join(mediaDirectory, original.filename!)
  const storedBytes = await readFile(originalPath)
  await writeFile(originalPath, tooManyPixels)
  const beforeReprocess = await diskState()
  try {
    const focusedRequest = await createLocalReq({ user: admin }, cms)
    focusedRequest.query = { uploadEdits: { focalPoint: { x: 10, y: 10 } } }
    await assert.rejects(cms.update({ ...access, req: focusedRequest, collection: 'media', id: original.id,
      data: { focalX: 10, focalY: 10 },
    }), status(413))
    await assert.rejects(cms.update({ ...access, collection: 'media', id: original.id,
      data: { focalX: 10, focalY: 10 },
    }), status(413))
    await assert.rejects(cms.create({ ...access, collection: 'media', duplicateFromID: original.id,
      data: { alt: 'Small incoming file must not bypass the stored duplicate source' }, file: file(png),
    }), status(413))
    assert.deepEqual(await diskState(), beforeReprocess, 'rejected refocal operations do not overwrite stored images or thumbnails')
    const unchangedFocusRequest = await createLocalReq({ user: admin }, cms)
    unchangedFocusRequest.query = { uploadEdits: { focalPoint: { x: original.focalX, y: original.focalY } } }
    const sameFocus = await cms.update({ ...access, req: unchangedFocusRequest, collection: 'media', id: original.id,
      data: { focalX: original.focalX, focalY: original.focalY, credit: 'Metadata edit on a historical file' },
    })
    assert.equal(sameFocus.credit, 'Metadata edit on a historical file')
    assert.deepEqual(await diskState(), beforeReprocess)
  } finally {
    await writeFile(originalPath, storedBytes)
  }

  const sourcePath = path.join(directory, 'small-local.png')
  await writeFile(sourcePath, png)
  const fromPath = await cms.create({ ...access, collection: 'media', data: { alt: 'Local file' }, filePath: sourcePath })
  assert.ok(fromPath.filename)
  const oversizedPath = path.join(directory, 'large-dimensions.png')
  await writeFile(oversizedPath, tooManyPixels)
  await assert.rejects(cms.update({ ...access, collection: 'media', id: fromPath.id, data: { alt: 'Rejected file path' },
    filePath: oversizedPath,
  }), status(413))
  const temporaryFile = { ...file(Buffer.alloc(0), 'temporary.png', 'image/png', 1), tempFilePath: sourcePath }
  await hook('media', temporaryFile)
  assert.equal(temporaryFile.size, png.length, 'temporary uploads use the actual file on disk')
  const oversizedTemporaryPath = path.join(directory, 'large-temporary-upload.png')
  await writeFile(oversizedTemporaryPath, Buffer.alloc(0))
  await truncate(oversizedTemporaryPath, MEDIA_MAX_BYTES + 1)
  await assert.rejects(hook('media', {
    ...file(Buffer.alloc(0), 'large-temporary.png', 'image/png', 1), tempFilePath: oversizedTemporaryPath,
  }), status(413))
  const duplicate = await cms.duplicate({ ...access, collection: 'media', id: original.id })
  assert.notEqual(duplicate.id, original.id)
  assert.notEqual(duplicate.filename, original.filename)
  await assert.rejects(cms.create({ ...access, collection: 'media', data: {
    alt: 'Remote files are disabled', url: 'http://127.0.0.1:9/do-not-fetch.png', filename: 'do-not-fetch.png',
  } }), status(400))

  const publicBytes = Buffer.from('Temporary public document')
  const document = await cms.create({ ...access, collection: 'documents', draft: true, data: {
    _status: 'draft', title: 'Public document', sourcePath: '/test/public.txt', locale: 'en',
  }, file: file(publicBytes, 'public.txt', 'text/plain') })
  assert.ok(document.filename)
  const privateBytes = Buffer.from('Temporary private document')
  const privateDocument = await cms.create({ ...access, collection: 'private-documents', data: {
    title: 'Private document',
  }, file: file(privateBytes, 'private.txt', 'text/plain') })
  assert.ok(privateDocument.filename)

  const animation = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
    raw: { width: 1, height: 2, pageHeight: 1, channels: 3 },
  }).webp({ delay: [50, 50], loop: 0 }).toBuffer()
  await hook('media', file(animation, 'small-animation.webp', 'image/webp'))
  await hook('media', file(animationDimensions(animation, 1, 7000), 'stacked-height.webp', 'image/webp'))
  await assert.rejects(hook('media', file(animationDimensions(animation, 5000, 5000), 'too-many-frames.webp', 'image/webp')),
    status(413))
  await assert.rejects(hook('media', file(animationDimensions(animation, 1, MAX_IMAGE_SIDE + 1), 'too-tall-frame.webp', 'image/webp')),
    status(413))
  await assert.rejects(hook('media', { ...file(png), truncated: true }), status(413))

  // One shared allocation tests exact boundaries without storing large files or decoding a large image.
  const buffer = Buffer.alloc(DOCUMENT_MAX_BYTES + 1)
  png.copy(buffer)
  const boundaryImage = file(buffer.subarray(0, MEDIA_MAX_BYTES), 'boundary.png', 'image/png', 1)
  await hook('media', boundaryImage)
  assert.equal(boundaryImage.size, MEDIA_MAX_BYTES, 'stored file size is normalized from the actual buffer')
  for (const language of ['en', 'zh'] as const) {
    await assert.rejects(hook('media', file(buffer.subarray(0, MEDIA_MAX_BYTES + 1), 'too-large.png', 'image/png', 1), language),
      (error) => status(413)(error) && (language === 'zh' ? /[\u4e00-\u9fff]/ : /[a-z]/i).test((error as Error).message))
  }
  for (const collection of ['documents', 'private-documents'] as const) {
    await hook(collection, file(buffer.subarray(0, DOCUMENT_MAX_BYTES), 'boundary.txt', 'text/plain'))
    await assert.rejects(hook(collection, file(buffer, 'too-large.txt', 'text/plain', 1)), status(413))
  }
  const beforeLargeReplacement = await diskState()
  await assert.rejects(cms.update({ ...access, collection: 'media', id: original.id,
    data: { alt: 'Forged byte count' },
    file: file(buffer.subarray(0, MEDIA_MAX_BYTES + 1), original.filename!, 'image/png', 1),
  }), status(413))
  assert.deepEqual(await diskState(), beforeLargeReplacement)
})
