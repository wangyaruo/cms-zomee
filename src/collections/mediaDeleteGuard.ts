import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { copy } from '../i18n/shared'
import { scanMediaReferences } from '../lib/mediaReferences'

/** Runs before Payload deletes either the database row or its original/derived files. */
export const guardMediaDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const media = await req.payload.findByID({ collection: 'media', id, depth: 0, locale: 'all', overrideAccess: true, req })
  // Integrity checks deliberately also apply to privileged Local API deletes.
  const references = await scanMediaReferences(req, [media as unknown as Record<string, unknown>], true)
  if (references.size) throw new APIError(copy(req.i18n.language,
    'This media file is still referenced by content, retained history, or a saved release and cannot be deleted. Review its references first.',
    '此媒体仍被内容、保留的历史版本或发布快照引用，无法删除。请先查看引用位置。'), 409)
}
