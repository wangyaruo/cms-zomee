import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { isValidSlug } from '../lib/validation'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 30 },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, validate: (value: unknown) => isValidSlug(value) || 'Use lowercase letters, numbers and hyphens.' },
    { name: 'layout', type: 'json', required: true, admin: { hidden: true } },
    { name: 'canvasUrl', type: 'text', admin: { readOnly: true }, hooks: { beforeValidate: [({ data }) => data?.id ? `/canvas/${data.id}` : '/canvas'] } },
  ],
}
