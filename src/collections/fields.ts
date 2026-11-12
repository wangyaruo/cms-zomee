import { randomBytes } from 'node:crypto'
import type { Field, GroupField, PayloadRequest } from 'payload'
import { isValidSlug } from '../lib/validation'
import { validationCopy } from '../i18n/shared'

export const slugField: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  hooks: {
    beforeDuplicate: [({ value }) => `${isValidSlug(value) ? value : 'content'}-copy-${randomBytes(10).toString('hex')}`],
  },
  admin: { description: 'Stable URL identifier. Use lowercase letters, numbers and hyphens.' },
  validate: (value: unknown, { req }: { req: PayloadRequest }) => isValidSlug(value) || validationCopy(req.i18n.language).slug,
}

export const seoFields: GroupField = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: [
    { name: 'title', type: 'text', localized: true, maxLength: 200 },
    { name: 'description', type: 'textarea', localized: true, maxLength: 500 },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'robots',
      type: 'select',
      defaultValue: 'index',
      options: [
        { label: 'Index, follow', value: 'index' },
        { label: 'Noindex, follow', value: 'noindex' },
      ],
      required: true,
    },
  ],
}

export const sortOrderField: Field = {
  name: 'sortOrder',
  type: 'number',
  defaultValue: 0,
  admin: { position: 'sidebar' },
}
