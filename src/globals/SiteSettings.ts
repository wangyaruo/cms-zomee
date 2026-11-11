import type { GlobalConfig } from 'payload'
import { isEditor, isReviewer } from '../access/roles'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  admin: { group: 'Administration' },
  access: { read: isEditor, update: isReviewer },
  versions: { drafts: true, max: 20 },
  fields: [
    { name: 'companyName', type: 'text', required: true, defaultValue: 'ZOMEEX LIMITED' },
    { name: 'email', type: 'email', required: true, defaultValue: 'info@zomeeco.com' },
    { name: 'phone', type: 'text', defaultValue: '+86 136 9193 5217' },
    { name: 'whatsapp', type: 'text', defaultValue: '+8613691935217' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'wechatQrImage', type: 'upload', relationTo: 'media' },
    { name: 'inquiryEndpoint', type: 'text', defaultValue: '/api/inquiry', required: true },
    { name: 'canonicalBaseUrl', type: 'text', admin: { description: 'Leave empty until the actual production domain is confirmed.' } },
    { name: 'defaultSeo', type: 'group', fields: [
      { name: 'title', type: 'text', localized: true },
      { name: 'description', type: 'textarea', localized: true },
    ] },
    { name: 'defaultShareImage', type: 'upload', relationTo: 'media' },
    {
      name: 'socialLinks', type: 'array', maxRows: 10,
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true, validate: (value: unknown) => typeof value === 'string' && /^https:\/\//.test(value) ? true : 'Use an https URL.' },
      ],
    },
  ],
}
