import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'

export const NavigationMenus: CollectionConfig = {
  slug: 'navigation-menus', admin: { useAsTitle: 'name', group: 'Content' },
  versions: { drafts: true, maxPerDoc: 20 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeChange: [guardPublishing] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'items', type: 'array', fields: [
      { name: 'label', type: 'text', required: true, localized: true },
      { name: 'href', type: 'text', required: true },
      { name: 'order', type: 'number', defaultValue: 0 },
      { name: 'children', type: 'array', fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'href', type: 'text', required: true },
        { name: 'order', type: 'number', defaultValue: 0 },
      ] },
    ] },
  ],
}
