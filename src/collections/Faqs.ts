import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { sortOrderField } from './fields'
import { guardPublishing, requirePublishedFaqAnswer } from './hooks'

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  admin: { useAsTitle: 'question', defaultColumns: ['question', 'sortOrder', '_status'], group: 'Content' },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 30 },
  hooks: { beforeChange: [guardPublishing, requirePublishedFaqAnswer] },
  fields: [
    { name: 'stableKey', type: 'text', required: true, unique: true, admin: { description: 'Permanent ID used by FAQ schema and product references.' } },
    { name: 'question', type: 'text', required: true, localized: true },
    { name: 'answer', type: 'richText', localized: true },
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true },
    { name: 'reviewedAt', type: 'date', admin: { description: 'Only set after the answer has actually been reviewed.' } },
    sortOrderField,
  ],
}
