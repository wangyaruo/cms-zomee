import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'
import { isReviewer } from '../access/roles'
import { copy } from '../i18n/shared'
import { canPublish } from '../lib/validation'

export const contentTrashCollections = new Set([
  'categories', 'products', 'posts', 'faqs', 'applications', 'solutions',
  'resources', 'navigation-menus', 'legal-pages', 'site-pages',
])

const applyTrashOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation === 'create') {
    const sourceID = args.duplicateFromID
    if (typeof sourceID === 'string' || typeof sourceID === 'number') {
      // Payload's duplication reads the latest version directly. Check the live row first.
      await req.payload.findByID({
        collection: args.collection.config.slug, id: sourceID,
        depth: 0, overrideAccess: args.overrideAccess ?? false, req,
      })
    }
    if (args.data) delete args.data.deletedAt
    return
  }

  if (operation !== 'update') return
  delete req.context.restoringContentFromTrash
  const data = args.data as { deletedAt?: unknown; _status?: unknown } | undefined
  // The normal admin form includes this hidden field even on active documents.
  // Only the native restore action opts into reading the trash.
  if (data?.deletedAt === null && args.trash !== true) delete data.deletedAt
  if (!data || !Object.hasOwn(data, 'deletedAt')) {
    // The admin allows opening a trashed record, but it must be restored before editing.
    args.trash = false
    return
  }
  if (!args.overrideAccess && !canPublish(req.user?.role)) {
    throw new APIError(copy(req.i18n.language,
      'Only a reviewer or administrator can move content to or restore it from trash.',
      '只有审核员或管理员可以移入回收站或恢复内容。'), 403)
  }

  const restoring = data.deletedAt === null
  req.context.restoringContentFromTrash = restoring
  // Write both the main row and the newest revision, even for a draft request.
  Object.assign(args, {
    trash: restoring, draft: false, autosave: false,
    publishAllLocales: false, unpublishAllLocales: false, publishSpecificLocale: undefined,
    data: restoring
      ? { deletedAt: null, _status: data._status === 'published' ? 'published' : 'draft' }
      : { deletedAt: new Date().toISOString() },
  })
}

const guardTrashHistory: CollectionBeforeChangeHook = ({ context, data, originalDoc, req }) => {
  if (context.restoringContentFromTrash && !originalDoc?.deletedAt) {
    throw new APIError(copy(req.i18n.language, 'This record is not in the trash.', '这条记录不在回收站中。'), 409)
  }
  if (context.isRestoringVersion && data.deletedAt) {
    throw new APIError(copy(req.i18n.language,
      'This version was moved to trash. Choose an earlier version to restore.',
      '这个历史版本已移入回收站，请选择更早的版本恢复。'), 409)
  }
  return data
}

export function withContentTrash(config: CollectionConfig): CollectionConfig {
  return {
    ...config,
    trash: true,
    access: {
      ...config.access,
      // Payload checks delete access for both actions. Only a move to trash supplies deletedAt.
      delete: (args) => typeof args.data?.deletedAt === 'string' && isReviewer(args),
    },
    hooks: {
      ...config.hooks,
      beforeOperation: [applyTrashOperation, ...(config.hooks?.beforeOperation ?? [])],
      beforeChange: [guardTrashHistory, ...(config.hooks?.beforeChange ?? [])],
    },
  }
}
