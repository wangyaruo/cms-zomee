import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Content' },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media'),
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
  ],
}
