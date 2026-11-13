import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    loginWithUsername: { allowEmailLogin: true, requireEmail: true, requireUsername: false },
    cookies: {
      secure: process.env.NODE_ENV === 'production' && process.env.CMS_COOKIE_SECURE !== 'false',
      sameSite: 'Lax',
    },
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
  },
  admin: { useAsTitle: 'email', group: 'Administration' },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    unlock: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Reviewer', value: 'reviewer' },
        { label: 'Editor', value: 'editor' },
      ],
    },
  ],
}
