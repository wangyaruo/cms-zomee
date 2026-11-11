import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'

export const Documents: CollectionConfig = {
  slug: 'documents', admin: { useAsTitle: 'title', defaultColumns: ['title', 'sourcePath', '_status'], group: 'Content' },
  upload: { staticDir: 'documents', mimeTypes: ['application/pdf'] },
  versions: { drafts: true, maxPerDoc: 20 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'sourcePath', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'locale', type: 'select', options: ['en', 'zh'], required: true },
    { name: 'resource', type: 'relationship', relationTo: 'resources' },
  ],
}
