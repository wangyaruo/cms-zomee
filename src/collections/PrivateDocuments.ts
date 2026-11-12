import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roles'
import { label } from '../i18n/shared'
import { enforceUploadLimits } from './uploadLimits'

export const PrivateDocuments: CollectionConfig = {
  slug: 'private-documents',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'filename', 'updatedAt'], group: 'System', description: label('Files up to 50 MiB. Only administrators can access this library.', '单个文件最大 50 MiB，仅管理员可访问此文件库。') },
  hooks: { beforeOperation: [enforceUploadLimits] },
  upload: {
    staticDir: 'private-documents',
    pasteURL: false,
    mimeTypes: ['application/pdf', 'application/postscript', 'application/illustrator', 'application/zip', 'application/x-zip-compressed', 'text/plain'],
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'projectReference', type: 'text', admin: { description: 'Internal project or inquiry reference. Never included in public snapshots.' } },
  ],
}
