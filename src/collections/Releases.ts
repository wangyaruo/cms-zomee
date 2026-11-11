import type { CollectionConfig } from 'payload'
import { isReviewer } from '../access/roles'

export const Releases: CollectionConfig = {
  slug: 'releases',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'contentHash', 'createdAt', 'createdBy'], group: 'Administration' },
  access: { read: isReviewer, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'note', type: 'textarea' },
    { name: 'contentHash', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'counts', type: 'json', admin: { readOnly: true } },
    { name: 'snapshot', type: 'json', required: true, admin: { hidden: true } },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', required: true, admin: { readOnly: true } },
  ],
}
