import { APIError, type Endpoint, type PayloadRequest, type Where } from 'payload'
import { mergeListSearchAndWhere } from 'payload/shared'
import { copy } from '../i18n/shared'
import { isObject, scanMediaReferences, visibleMediaReference, type MediaReference } from '../lib/mediaReferences'

export async function collectMediaReferences(req: PayloadRequest, rawInput: unknown) {
  const error = (en: string, zh: string, status = 400): never => { throw new APIError(copy(req.i18n.language, en, zh), status) }
  if (!req.user || !['admin', 'reviewer', 'editor'].includes(req.user.role)) error('Please log in to check media references.', '请登录后查看媒体引用。', 403)
  if (!isObject(rawInput) || !isObject(rawInput.selection)) error('Choose media records to check.', '请选择需要检查的媒体文件。')
  const input = rawInput as Record<string, unknown>
  const selection = input.selection as Record<string, unknown>
  const localization = req.payload.config.localization
  const locale = input.locale ?? (req.locale !== 'all' ? req.locale : undefined) ?? (localization ? localization.defaultLocale : 'en')
  if (typeof locale !== 'string' || (localization && !localization.localeCodes.includes(locale))) error('Invalid content locale.', '内容语言无效。')
  let selectedIDs: string[] | undefined
  let where: Where = {}
  if (selection.mode === 'ids') {
    if (!Array.isArray(selection.ids) || !selection.ids.length || selection.ids.some((id) =>
      !(typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
      && !(typeof id === 'string' && id.trim() && id.length <= 128))) error('Provide valid media IDs.', '请提供有效的媒体编号。')
    selectedIDs = [...new Set((selection.ids as (string | number)[]).map(String))]
    where = { id: { in: selectedIDs } }
  } else if (selection.mode === 'query') {
    if ((selection.where !== undefined && !isObject(selection.where))
      || (selection.search !== undefined && typeof selection.search !== 'string')) error('Invalid media list query.', '媒体列表筛选无效。')
    where = mergeListSearchAndWhere({ collectionConfig: req.payload.collections.media.config,
      where: structuredClone((selection.where || {}) as Where), search: String(selection.search || '') })
  } else error('Choose media records or a list query.', '请选择媒体文件或列表筛选。')
  const selected = await req.payload.find({ collection: 'media', where, pagination: false, depth: 0,
    locale: 'all', overrideAccess: false, req })
  if (selectedIDs && selected.docs.length !== selectedIDs.length) error('Some media files are unavailable. Refresh and try again.', '部分媒体文件不可用，请刷新后重试。', 404)
  const references = await scanMediaReferences(req, selected.docs as unknown as Record<string, unknown>[])
  const visible: MediaReference[] = []
  let restrictedReferences = 0
  for (const reference of references.values()) {
    const item = await visibleMediaReference(req, reference, locale as string)
    if (item) { if (visible.length < 50) visible.push(item) }
    else restrictedReferences += 1
  }
  return { targetCount: selected.docs.length, totalReferences: references.size, restrictedReferences,
    references: visible, displayLimit: 50, checkedAt: new Date().toISOString() }
}

export const mediaReferencesEndpoint: Endpoint = {
  path: '/media-references', method: 'post',
  handler: async (req) => {
    const headers = { 'Cache-Control': 'private, no-store' }
    try {
      let input: unknown
      try { input = await req.json?.() } catch { throw new APIError(copy(req.i18n.language, 'Invalid JSON request.', '请求格式无效。'), 400) }
      return Response.json(await collectMediaReferences(req, input), { headers })
    } catch (error) {
      if (error instanceof APIError) return Response.json({ error: error.message }, { status: error.status, headers })
      throw error
    }
  },
}
