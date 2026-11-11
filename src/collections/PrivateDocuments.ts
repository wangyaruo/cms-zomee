import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const PrivateDocuments: CollectionConfig = {
  slug: 'private-documents',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'filename', 'updatedAt'], group: 'System' },
  upload: {
    staticDir: 'private-documents',
    mimeTypes: ['application/pdf', 'application/postscript', 'application/illustrator', 'application/zip', 'application/x-zip-compressed', 'text/plain'],
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'projectReference', type: 'text', admin: { description: 'Internal project or inquiry reference. Never included in public snapshots.' } },
  ],
}
