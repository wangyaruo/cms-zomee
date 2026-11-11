import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'
import { isValidSlug } from '../lib/validation'

export const LegalPages: CollectionConfig = {
  slug: 'legal-pages', admin: { useAsTitle: 'title', defaultColumns: ['title', 'revision', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 50 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, validate: (value: unknown) => isValidSlug(value) || 'Use lowercase letters, numbers and hyphens.' },
    { name: 'revision', type: 'date', required: true },
    { name: 'intro', type: 'textarea', localized: true },
    { name: 'sourceData', type: 'json', required: true, admin: { hidden: true, description: 'Complete legal sections, paragraphs, lists and contact data.' } },
    { name: 'seo', type: 'group', fields: [
      { name: 'title', type: 'text', localized: true },
      { name: 'description', type: 'textarea', localized: true },
      { name: 'robots', type: 'select', options: ['index', 'noindex'], defaultValue: 'index' },
    ] },
  ],
}
