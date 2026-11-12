import type { CollectionConfig, PayloadRequest } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'
import { isValidSlug } from '../lib/validation'
import { validationCopy } from '../i18n/shared'

export const SitePages: CollectionConfig = {
  slug: 'site-pages', admin: { useAsTitle: 'title', defaultColumns: ['title', 'pageType', 'path', '_status'], group: 'Content' },
  versions: { drafts: true, maxPerDoc: 50 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, validate: (value: unknown, { req }: { req: PayloadRequest }) => isValidSlug(value) || validationCopy(req.i18n.language).slug },
    { name: 'path', type: 'text', required: true, unique: true },
    { name: 'pageType', type: 'select', required: true, options: ['home', 'about', 'contact', 'company', 'process', 'quality'] },
    { name: 'summary', type: 'textarea', localized: true },
    { name: 'sections', type: 'array', labels: { singular: 'Editable section', plural: 'Editable sections' }, fields: [
      { name: 'sourcePath', type: 'text', required: true, admin: { description: 'Stable dataset path, for example homeSystem.packagingSystemIntro or qualityFramework.0.' } },
      { name: 'title', type: 'text', localized: true },
      { name: 'body', type: 'textarea', localized: true },
      { name: 'image', type: 'upload', relationTo: 'media' },
      { name: 'linkLabel', type: 'text', localized: true },
      { name: 'linkHref', type: 'text' },
      { name: 'items', type: 'array', fields: [
        { name: 'label', type: 'text', localized: true },
        { name: 'body', type: 'textarea', localized: true },
      ] },
    ] },
    { name: 'sourceData', type: 'json', required: true, admin: { hidden: true, description: 'Complete structured page datasets retained for lossless frontend integration.' } },
    { name: 'seo', type: 'group', fields: [
      { name: 'title', type: 'text', localized: true },
      { name: 'description', type: 'textarea', localized: true },
      { name: 'robots', type: 'select', options: ['index', 'noindex'], defaultValue: 'index' },
    ] },
  ],
}
