import type { CollectionConfig } from 'payload'
import { isEditor, isReviewer, publishedOrEditor } from '../access/roles'
import { guardPublishing } from './hooks'
import { enforceUploadLimits } from './uploadLimits'
import { label } from '../i18n/shared'
import { uploadedFileHeaders } from './svgUploads'

export const Documents: CollectionConfig = {
  slug: 'documents', admin: { useAsTitle: 'title', defaultColumns: ['title', 'sourcePath', '_status'], group: 'Content', description: label('Files up to 50 MiB. SVG uploads are disabled.', '单个文件最大 50 MiB，不支持上传 SVG。') },
  upload: { staticDir: 'documents', pasteURL: false, modifyResponseHeaders: uploadedFileHeaders, mimeTypes: ['application/pdf', 'application/postscript', 'application/illustrator', 'application/zip', 'application/x-zip-compressed', 'text/plain'] },
  versions: { drafts: true, maxPerDoc: 20 }, access: { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isReviewer },
  hooks: { beforeOperation: [enforceUploadLimits], beforeChange: [guardPublishing] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'sourcePath', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'locale', type: 'select', options: ['en', 'zh'], required: true },
    { name: 'resource', type: 'relationship', relationTo: 'resources' },
    { name: 'documentType', type: 'select', required: true, defaultValue: 'checklist', options: [
      { label: 'Checklist / public document', value: 'checklist' }, { label: 'Downloadable dieline', value: 'dieline' },
    ], index: true },
    { name: 'dieline', type: 'group', admin: { condition: (data) => data?.documentType === 'dieline' }, fields: [
      { name: 'category', type: 'select', required: true, options: ['flexible-pouches', 'boxes-cartons', 'labels-sleeves', 'other-formats'] },
      { name: 'preview', type: 'upload', relationTo: 'media', required: true },
      { name: 'dimensions', type: 'text', required: true },
      { name: 'unit', type: 'select', required: true, defaultValue: 'mm', options: ['mm', 'cm', 'in'] },
      { name: 'format', type: 'select', required: true, options: ['AI', 'PDF', 'EPS', 'ZIP'] },
      { name: 'version', type: 'text', required: true },
      { name: 'lastUpdated', type: 'date', required: true },
      { name: 'usageNotes', type: 'textarea', required: true, localized: true },
      { name: 'usage', type: 'select', required: true, defaultValue: 'reference', options: ['reference', 'production-version'] },
      { name: 'confirmedForPublication', type: 'checkbox', defaultValue: false },
    ] },
  ],
}
