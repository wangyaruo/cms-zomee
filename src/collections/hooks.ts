import type { CollectionBeforeChangeHook } from 'payload'
import { canPublish } from '../lib/validation'

/** Editors can prepare drafts, but only reviewers and administrators can publish. */
export const guardPublishing: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  const role = req.user?.role
  if (!role) throw new Error('Authentication is required.')
  if (operation === 'create' && !data.slug) throw new Error('A stable slug is required.')
  if (data._status === 'published' && !canPublish(role)) {
    throw new Error('Only a reviewer or administrator can publish content.')
  }
  return data
}
