import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { seoFields, slugField } from './fields'
import { duplicateAsDraft, guardPublishing } from './hooks'

export const Posts: CollectionConfig = {
  slug: 'posts',
  disableDuplicate: false,
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'topic', 'publishedAt', '_status', 'updatedAt'], group: 'Content' },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 50 },
  hooks: { beforeOperation: [duplicateAsDraft], beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField,
    { name: 'excerpt', type: 'textarea', required: true, localized: true },
    { name: 'body', type: 'richText', required: true, localized: true },
    { name: 'topic', type: 'select', required: true, options: ['compliance', 'materials', 'design', 'buyers-guides', 'sourcing'] },
    { name: 'author', type: 'text', required: true, defaultValue: 'Zomeex Packaging Team' },
    { name: 'publishedAt', type: 'date', hooks: { beforeDuplicate: [() => null] }, admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } } },
    { name: 'modifiedAt', type: 'date', hooks: { beforeDuplicate: [() => null] }, admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } } },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'featured', type: 'checkbox', defaultValue: false, hooks: { beforeDuplicate: [() => false] }, admin: { position: 'sidebar' } },
    { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text', required: true, localized: true }] },
    { name: 'relatedProducts', type: 'relationship', relationTo: 'products', hasMany: true },
    seoFields,
    { name: 'sourceData', type: 'json', hooks: { beforeDuplicate: [() => null] }, admin: { hidden: true, description: 'Original editorial modules retained for the frontend adapter.' } },
  ],
}
