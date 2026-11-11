import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'
import { isValidSlug } from '../lib/validation'

export const SitePages: CollectionConfig = {
  slug: 'site-pages', admin: { useAsTitle: 'title', defaultColumns: ['title', 'pageType', 'path', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 50 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, validate: (value: unknown) => isValidSlug(value) || 'Use lowercase letters, numbers and hyphens.' },
    { name: 'path', type: 'text', required: true, unique: true },
    { name: 'pageType', type: 'select', required: true, options: ['home', 'about', 'contact', 'company', 'process', 'quality'] },
    { name: 'summary', type: 'textarea', localized: true },
    { name: 'sourceData', type: 'json', required: true, admin: { hidden: true, description: 'Complete structured page datasets retained for lossless frontend integration.' } },
    { name: 'seo', type: 'group', fields: [
      { name: 'title', type: 'text', localized: true },
      { name: 'description', type: 'textarea', localized: true },
      { name: 'robots', type: 'select', options: ['index', 'noindex'], defaultValue: 'index' },
    ] },
  ],
}
