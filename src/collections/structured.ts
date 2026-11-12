import type { CollectionConfig, Field, PayloadRequest } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'
import { isValidSlug } from '../lib/validation'
import { validationCopy } from '../i18n/shared'

const baseFields = (collection: string, sourceDataDefault?: Record<string, unknown>): Field[] => [
  { name: 'title', type: 'text', required: true, localized: true },
  { name: 'slug', type: 'text', required: true, unique: true, validate: (value: unknown, { req }: { req: PayloadRequest }) => isValidSlug(value) || validationCopy(req.i18n.language).slug },
  { name: 'summary', type: 'textarea', localized: true },
  { name: 'heroImage', type: 'upload', relationTo: 'media' },
  { name: 'sourceData', type: 'json', required: true, defaultValue: sourceDataDefault, admin: { hidden: true, description: `Complete original ${collection} structure retained for lossless frontend rendering.` } },
  { name: 'seo', type: 'group', fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'robots', type: 'select', options: ['index', 'noindex'], defaultValue: 'index' },
  ] },
]

export const Applications: CollectionConfig = {
  slug: 'applications', admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 30 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [...baseFields('application', {}),
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'faqs', type: 'relationship', relationTo: 'faqs', hasMany: true },
  ],
}

export const Solutions: CollectionConfig = {
  slug: 'solutions', admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 30 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [...baseFields('solution'),
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'applications', type: 'relationship', relationTo: 'applications', hasMany: true },
  ],
}

export const Resources: CollectionConfig = {
  slug: 'resources', admin: { useAsTitle: 'title', defaultColumns: ['title', 'kind', 'slug', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 30 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [...baseFields('resource'),
    { name: 'kind', type: 'select', required: true, options: ['guide', 'checklist', 'compliance', 'dielines', 'finder', 'download'] },
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
  ],
}
