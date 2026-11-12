import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { APIError, type CollectionBeforeOperationHook, type Config, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { copy } from '../i18n/shared'

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
export const MAX_IMAGE_SIDE = 12_000

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

function uploadError(req: PayloadRequest, en: string, zh: string, status = 400): never {
  throw new APIError(copy(req.i18n.language, en, zh), status)
}

function checkBytes(req: PayloadRequest, bytes: number, media: boolean) {
  const limit = media ? MEDIA_MAX_BYTES : DOCUMENT_MAX_BYTES
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    uploadError(req, 'The uploaded file could not be read. Choose the file again.', '无法读取上传文件，请重新选择文件。')
  }
  if (bytes > limit) {
    uploadError(req, media ? 'Images must be 10 MiB or smaller.' : 'Files must be 50 MiB or smaller.',
      media ? '图片不能超过 10 MiB。' : '文件不能超过 50 MiB。', 413)
  }
}

async function checkImage(req: PayloadRequest, source: Buffer | string) {
  let metadata: sharp.Metadata
  try {
    // Metadata reads the image header. Inspect every frame without decoding a full raster.
    metadata = await sharp(source, { animated: true, limitInputPixels: false }).metadata()
  } catch {
    uploadError(req, 'The image could not be read. Upload a valid image file.', '无法读取图片，请上传有效的图片文件。')
  }
  const { width, height, pageHeight, pages } = metadata
  if (!positiveInteger(width) || !positiveInteger(height)
    || (pageHeight !== undefined && !positiveInteger(pageHeight))
    || (pages !== undefined && !positiveInteger(pages))) {
    uploadError(req, 'The image dimensions could not be read. Choose another image.', '无法读取图片尺寸，请更换图片。')
  }
  if (width > MAX_IMAGE_PIXELS / height) {
    uploadError(req, 'Images must contain no more than 40 million pixels in total, including animation frames.',
      '图片总像素不能超过 4000 万，动画按全部帧合计。', 413)
  }
  if (width > MAX_IMAGE_SIDE || (pageHeight ?? height) > MAX_IMAGE_SIDE) {
    uploadError(req, 'Image width and height must each be 12,000 pixels or smaller.',
      '图片宽度和高度均不能超过 12000 像素。', 413)
  }
}

async function validateSource(req: PayloadRequest, source: Buffer | string, media: boolean) {
  let bytes: number
  try {
    if (typeof source === 'string') {
      const info = await stat(source)
      if (!info.isFile()) throw new Error('Not a file')
      bytes = info.size
    } else {
      bytes = source.length
    }
  } catch {
    uploadError(req, 'The uploaded file could not be read. Choose the file again.', '无法读取上传文件，请重新选择文件。')
  }
  checkBytes(req, bytes, media)
  if (media) await checkImage(req, source)
  return bytes
}

function fileEdits(req: PayloadRequest, data: Record<string, unknown>) {
  const edits = record(req.query?.uploadEdits) ? req.query.uploadEdits : undefined
  return {
    resize: Boolean(edits?.crop || edits?.heightInPixels || edits?.widthInPixels),
    fromQuery: Boolean(edits?.focalPoint),
    focalPoint: edits?.focalPoint
      ? record(edits.focalPoint) ? edits.focalPoint : {}
      : data.focalX && data.focalY ? { x: data.focalX, y: data.focalY } : undefined,
  }
}

function reprocessesStoredFile(edits: ReturnType<typeof fileEdits>, data: Record<string, unknown>, doc: Record<string, unknown>) {
  if (edits.resize) return true
  const point = edits.focalPoint
  if (!point) return false
  const differs = (reference: Record<string, unknown>) =>
    point.x !== (Object.hasOwn(reference, 'focalX') ? reference.focalX : false)
    || point.y !== (Object.hasOwn(reference, 'focalY') ? reference.focalY : false)
  // Payload compares query focal points to submitted data, so query-only requests can reprocess
  // a file. Also validate changes to stored focal points made through a data-only request.
  return differs(doc) || (edits.fromQuery && differs(data))
}

async function validateStoredFile(req: PayloadRequest, directory: string, doc: Record<string, unknown>, media: boolean) {
  if (typeof doc.filename !== 'string' || !doc.filename) return
  if (doc.filename !== path.basename(doc.filename) || doc.filename.includes('\\')) {
    uploadError(req, 'The stored file path is invalid.', '原文件路径无效。')
  }
  let root: string
  let source: string
  try {
    root = await realpath(directory)
    source = await realpath(path.resolve(root, doc.filename))
  } catch {
    uploadError(req, 'The original file could not be read. Upload the file again.', '无法读取原文件，请重新上传文件。')
  }
  const relative = path.relative(root, source)
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    uploadError(req, 'The stored file path is invalid.', '原文件路径无效。')
  }
  await validateSource(req, source, media)
}

export const enforceUploadLimits: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return
  const config = args.collection.config
  if (!['media', 'documents', 'private-documents'].includes(config.slug)) return
  const media = config.slug === 'media'
  const data: Record<string, unknown> = record(args.data) ? args.data as Record<string, unknown> : {}
  const duplicateID = operation === 'create' ? args.duplicateFromID : undefined
  const file = req.file
  // Payload ignores req.file during duplication and reads the stored source instead.
  if (file && duplicateID == null) {
    if ('truncated' in file && file.truncated) {
      uploadError(req, 'The uploaded file was truncated. Choose a smaller file.', '上传文件不完整，请选择更小的文件。', 413)
    }
    if (!file.tempFilePath && !Buffer.isBuffer(file.data)) {
      uploadError(req, 'The uploaded file could not be read. Choose the file again.', '无法读取上传文件，请重新选择文件。')
    }
    file.size = await validateSource(req, file.tempFilePath || file.data, media)
    return
  }
  if (operation === 'create' && typeof data.url === 'string' && data.url) {
    uploadError(req, 'Upload the local file instead of importing a file URL.', '请上传本地文件，不支持通过网址导入文件。')
  }

  const edits = fileEdits(req, data)
  const reprocessing = operation === 'update' && (edits.resize || Boolean(edits.focalPoint))
  if (duplicateID == null && !reprocessing) return
  const upload = config.upload
  if (!upload) return
  const directory = upload.staticDir || config.slug
  const updateID = 'id' in args && (typeof args.id === 'string' || typeof args.id === 'number') ? args.id : undefined
  const readOptions = {
    collection: config.slug, depth: 0, draft: true, req,
    overrideAccess: args.overrideAccess ?? false,
    select: { filename: true, ...(media ? { focalX: true as const, focalY: true as const } : {}) } as const,
  }
  const validateUpdate = async (source: unknown) => {
    const doc = source as Record<string, unknown>
    if (reprocessesStoredFile(edits, data, doc)) await validateStoredFile(req, directory, doc, media)
  }
  if (typeof duplicateID === 'string' || typeof duplicateID === 'number') {
    const doc = await req.payload.findByID({ ...readOptions, id: duplicateID })
    await validateStoredFile(req, directory, doc as unknown as Record<string, unknown>, media)
  } else if (operation === 'update' && updateID != null) {
    const doc = await req.payload.findByID({ ...readOptions, id: updateID })
    await validateUpdate(doc)
  } else if (operation === 'update' && args.where) {
    const sources = await req.payload.find({ ...readOptions, where: args.where, pagination: false })
    for (const doc of sources.docs) {
      await validateUpdate(doc)
    }
  }
}

export const uploadRequestLimits: Config['upload'] = {
  abortOnLimit: true,
  // Busboy emits its limit event when bytes equal the limit, so allow the boundary byte here.
  limits: { fileSize: DOCUMENT_MAX_BYTES + 1 },
  requestSizeLimit: DOCUMENT_MAX_BYTES + 2 * 1024 * 1024,
  limitHandler: ({ request }) => {
    const language = request.headers.get('accept-language')?.trim().toLowerCase() || 'zh'
    throw new APIError(copy(language,
      'Files must be 50 MiB or smaller. Images must be 10 MiB or smaller.',
      '文件不能超过 50 MiB，媒体图片不能超过 10 MiB。'), 413)
  },
}
