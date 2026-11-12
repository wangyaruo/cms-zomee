import type { CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'
import { canPublish } from '../lib/validation'
import { copy } from '../i18n/shared'

/** Duplicating starts an independent draft, even if the API caller requests publication. */
export const duplicateAsDraft: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'create' && args.duplicateFromID != null) {
    return { ...args, draft: true, data: { _status: 'draft' } }
  }
}

/** Editors can prepare drafts, but only reviewers and administrators can publish. */
export const guardPublishing: CollectionBeforeChangeHook = ({ data, req }) => {
  const role = req.user?.role
  if (!role) throw new Error(copy(req.i18n.language, 'Please log in before saving content.', '请先登录，再保存内容。'))
  if (data._status === 'published' && !canPublish(role)) {
    throw new Error(copy(req.i18n.language, 'Only a reviewer or administrator can publish content.', '只有审核员或管理员可以发布内容。'))
  }
  return data
}

export const requirePublishedFaqAnswer: CollectionBeforeChangeHook = ({ data, req }) => {
  if (data._status === 'published' && !data.answer?.root?.children?.length) {
    throw new Error(copy(req.i18n.language, 'Add an answer before publishing this FAQ.', '请填写回答后再发布此常见问题。'))
  }
  return data
}
