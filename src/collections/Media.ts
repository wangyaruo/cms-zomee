import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { copy, label } from '../i18n/shared'
import { enforceUploadLimits } from './uploadLimits'
import { uploadedFileHeaders } from './svgUploads'
import { guardMediaDeletion } from './mediaDeleteGuard'

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Content', description: label(
    'PNG, JPEG, WebP, or AVIF only; SVG uploads are disabled. Up to 10 MiB, 40 million total pixels across all frames, and 12,000 pixels per side in each frame.',
    '支持 PNG、JPEG、WebP、AVIF，不支持上传 SVG。图片最大 10 MiB，所有帧合计不超过 4000 万像素，单帧任一边不超过 12000 像素。',
  ), components: { beforeListTable: ['/components/MediaReferences#ListMediaReferences'] } },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  hooks: { beforeOperation: [enforceUploadLimits], beforeDelete: [guardMediaDeletion] },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media'),
    pasteURL: false,
    mimeTypes: imageMimeTypes,
    modifyResponseHeaders: uploadedFileHeaders,
    imageSizes: [
      { name: 'thumbnail', width: 320, height: 240, position: 'centre' },
      { name: 'card', width: 800, height: undefined },
      { name: 'hero', width: 1600, height: undefined },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    { name: 'mediaReferences', type: 'ui', label: label('Image references', '图片引用'), admin: {
      disableListColumn: true, disableBulkEdit: true,
      components: { Field: '/components/MediaReferences#DocumentMediaReferences' },
    } },
    {
      name: 'mimeType', type: 'text', hasMany: false, admin: { hidden: true, readOnly: true },
      // Payload also validates stored MIME on ordinary metadata edits. Allow an unchanged
      // historical SVG value; beforeOperation still blocks every file upload/reprocessing path.
      validate: (value, { operation, previousValue, req }) => {
        if (!value || imageMimeTypes.includes(value)) return true
        if (operation === 'update' && !req.file && value === 'image/svg+xml' && previousValue === value) return true
        return copy(req.i18n.language, 'Unsupported image file type.', '不支持此图片文件类型。')
      },
    },
    { name: 'alt', type: 'text', required: true, localized: true },
    { name: 'caption', type: 'text', localized: true },
    { name: 'credit', type: 'text' },
    { name: 'sourcePath', type: 'text', unique: true, admin: { readOnly: true, description: 'Original asset path used for idempotent migration.' } },
  ],
}
