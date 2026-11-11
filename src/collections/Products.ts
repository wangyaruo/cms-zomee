import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access/roles'
import { seoFields, slugField, sortOrderField } from './fields'
import { guardPublishing } from './hooks'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'sku', 'slug', '_status', 'updatedAt'], group: 'Content' },
  access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isEditor },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 50 },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Product',
          fields: [
            { name: 'name', type: 'text', required: true, localized: true },
            slugField,
            { name: 'sku', type: 'text', index: true, admin: { description: 'Source SKUs are indexed but not forced unique; legacy duplicates are preserved.' } },
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'description', type: 'richText', localized: true },
            { name: 'image', type: 'upload', relationTo: 'media', required: true },
            { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
            {
              name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true,
              filterOptions: () => ({ _status: { equals: 'published' } }),
            },
            {
              name: 'specs', type: 'array', labels: { singular: 'Specification', plural: 'Specifications' },
              fields: [
                { name: 'label', type: 'text', required: true, localized: true },
                { name: 'value', type: 'text', required: true, localized: true },
              ],
            },
            {
              name: 'options', type: 'array', labels: { singular: 'Option group', plural: 'Option groups' },
              fields: [
                { name: 'key', type: 'text', required: true },
                { name: 'label', type: 'text', required: true, localized: true },
                {
                  name: 'choices', type: 'array', required: true,
                  fields: [
                    { name: 'value', type: 'text', required: true },
                    { name: 'label', type: 'text', required: true, localized: true },
                    { name: 'note', type: 'text', localized: true },
                    { name: 'image', type: 'upload', relationTo: 'media' },
                    { name: 'customInquiry', type: 'checkbox', defaultValue: false },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'PDP Content',
          fields: [
            { name: 'heroTitle', type: 'text', localized: true },
            { name: 'heroIntro', type: 'textarea', localized: true },
            { name: 'quoteLabel', type: 'text', localized: true },
            { name: 'dielineLabel', type: 'text', localized: true },
            { name: 'detailTitle', type: 'text', localized: true },
            { name: 'detailParagraphs', type: 'textarea', localized: true, admin: { description: 'One paragraph per line.' } },
            { name: 'badges', type: 'array', fields: [
              { name: 'label', type: 'text', localized: true },
              { name: 'tone', type: 'text' },
            ] },
            { name: 'galleryDetails', type: 'array', fields: [
              { name: 'image', type: 'upload', relationTo: 'media' },
              { name: 'title', type: 'text', localized: true },
              { name: 'description', type: 'textarea', localized: true },
            ] },
            { name: 'assurance', type: 'array', fields: [
              { name: 'icon', type: 'text', required: true },
              { name: 'label', type: 'text', localized: true },
            ] },
            { name: 'highlights', type: 'array', fields: [
              { name: 'icon', type: 'text', required: true },
              { name: 'label', type: 'text', localized: true },
            ] },
            { name: 'customOptionsTitle', type: 'text', localized: true },
            { name: 'customOptionsIntro', type: 'textarea', localized: true },
            { name: 'customOptions', type: 'array', fields: [
              { name: 'name', type: 'text', localized: true },
              { name: 'description', type: 'textarea', localized: true },
            ] },
            { name: 'featureCard', type: 'group', fields: [
              { name: 'title', type: 'text', localized: true },
              { name: 'body', type: 'textarea', localized: true },
              { name: 'diagram', type: 'text' },
              { name: 'items', type: 'array', fields: [
                { name: 'title', type: 'text', localized: true },
                { name: 'body', type: 'textarea', localized: true },
              ] },
            ] },
            { name: 'compliance', type: 'group', fields: [
              { name: 'title', type: 'text', localized: true },
              { name: 'body', type: 'textarea', localized: true },
              { name: 'capabilities', type: 'array', fields: [
                { name: 'title', type: 'text', localized: true },
                { name: 'body', type: 'textarea', localized: true },
              ] },
            ] },
            { name: 'closingCta', type: 'group', fields: [
              { name: 'title', type: 'text', localized: true },
              { name: 'body', type: 'textarea', localized: true },
              { name: 'quoteLabel', type: 'text', localized: true },
              { name: 'secondaryLabel', type: 'text', localized: true },
              { name: 'secondaryRequest', type: 'text' },
            ] },
            { name: 'documents', type: 'relationship', relationTo: 'documents', hasMany: true },
          ],
        },
        {
          label: 'Relationships',
          fields: [
            { name: 'relatedProducts', type: 'relationship', relationTo: 'products', hasMany: true },
            { name: 'faqs', type: 'relationship', relationTo: 'faqs', hasMany: true },
            { name: 'sourceData', type: 'json', admin: { hidden: true, description: 'Unmapped original PDP fields retained for the frontend adapter.' } },
          ],
        },
        { label: 'SEO', fields: [seoFields] },
      ],
    },
    { name: 'contentStatus', type: 'select', required: true, defaultValue: 'incomplete', options: [
      { label: 'Incomplete source data', value: 'incomplete' },
      { label: 'Ready for review', value: 'ready' },
      { label: 'Legacy demo', value: 'demo' },
    ], admin: { position: 'sidebar' } },
    sortOrderField,
  ],
}
