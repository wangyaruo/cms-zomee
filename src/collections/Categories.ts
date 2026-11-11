import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { seoFields, slugField, sortOrderField } from './fields'
import { guardPublishing } from './hooks'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'parent', 'sortOrder', '_status'], group: 'Content' },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 30 },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField,
    { name: 'intro', type: 'textarea', localized: true },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'parent', type: 'relationship', relationTo: 'categories', admin: { position: 'sidebar' } },
    sortOrderField,
    seoFields,
  ],
}
