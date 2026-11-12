import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { label } from '../i18n/shared'
import { enforceUploadLimits } from './uploadLimits'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Content', description: label(
    'Images: up to 10 MiB, 40 million total pixels across all frames, and 12,000 pixels per side in each frame.',
    '图片最大 10 MiB，所有帧合计不超过 4000 万像素，单帧任一边不超过 12000 像素。',
  ) },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  hooks: { beforeOperation: [enforceUploadLimits] },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media'),
    pasteURL: false,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
    imageSizes: [
      { name: 'thumbnail', width: 320, height: 240, position: 'centre' },
      { name: 'card', width: 800, height: undefined },
      { name: 'hero', width: 1600, height: undefined },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    { name: 'alt', type: 'text', required: true, localized: true },
    { name: 'caption', type: 'text', localized: true },
    { name: 'credit', type: 'text' },
    { name: 'sourcePath', type: 'text', unique: true, admin: { readOnly: true, description: 'Original asset path used for idempotent migration.' } },
  ],
}
