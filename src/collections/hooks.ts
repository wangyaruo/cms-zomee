import type { CollectionBeforeChangeHook } from 'payload'
import { canPublish } from '../lib/validation'

/** Editors can prepare drafts, but only reviewers and administrators can publish. */
export const guardPublishing: CollectionBeforeChangeHook = ({ data, req }) => {
  const role = req.user?.role
  if (!role) throw new Error('Authentication is required.')
  if (data._status === 'published' && !canPublish(role)) {
    throw new Error('Only a reviewer or administrator can publish content.')
  }
  return data
}

export const requirePublishedFaqAnswer: CollectionBeforeChangeHook = ({ data }) => {
  if (data._status === 'published' && !data.answer?.root?.children?.length) {
    throw new Error('An answer is required before publishing a FAQ.')
  }
  return data
}
