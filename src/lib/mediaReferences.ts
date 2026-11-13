import { APIError, type CollectionSlug, type Field, type GlobalSlug, type PayloadRequest } from 'payload'

type Data = Record<string, unknown>
export type MediaID = number | string
export type MediaReferenceState = 'published' | 'draft' | 'trash' | 'history' | 'release' | 'current'
export type MediaReference = {
  kind: 'collection' | 'global'
  collection?: string
  id?: MediaID
  global?: string
  title: string
  fields: { path: string; label: string }[]
  states: MediaReferenceState[]
}

export const isObject = (value: unknown): value is Data => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const idOf = (value: unknown): MediaID | undefined => typeof value === 'string' || typeof value === 'number'
  ? value : isObject(value) ? idOf(value.id) : undefined

export function localizedLabel(value: unknown, language: string, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (isObject(value)) {
    for (const candidate of [value[language], value.en, value.zh, ...Object.values(value)]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
  }
  return fallback
}

function mediaMatcher(req: PayloadRequest, targets: Data[], website: unknown) {
  const origins = new Set<string>()
  for (const base of [req.payload.config.serverURL, website]) {
    try { if (typeof base === 'string' && /^https?:\/\//i.test(base)) origins.add(new URL(base).origin) } catch { /* Only configured valid origins are trusted. */ }
  }
  const pathOf = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const valueText = value.trim()
    const relative = valueText.startsWith('/') && !valueText.startsWith('//') && !valueText.includes('\\')
    if (!relative && !/^https?:\/\//i.test(valueText)) return undefined
    try {
      const url = new URL(valueText, 'https://media-check.invalid')
      if (!relative && !origins.has(url.origin)) return undefined
      return decodeURIComponent(url.pathname)
    } catch { return undefined }
  }
  const ids = new Set(targets.map((target) => String(target.id)))
  const paths = new Set<string>()
  const addPath = (value: unknown) => { const pathname = pathOf(value); if (pathname) paths.add(pathname) }
  const addFile = (value: unknown) => {
    if (!isObject(value)) return
    addPath(value.url)
    if (typeof value.filename === 'string') addPath(`${req.payload.config.routes.api}/media/file/${encodeURIComponent(value.filename)}`)
  }
  for (const target of targets) {
    addFile(target)
    addPath(target.thumbnailURL)
    addPath(target.sourcePath)
    if (isObject(target.sizes)) for (const size of Object.values(target.sizes)) addFile(size)
  }
  const matchesURL = (value: unknown) => { const pathname = pathOf(value); return Boolean(pathname && paths.has(pathname)) }
  const matchesID = (value: unknown) => ids.has(String(idOf(value)))
  const taggedOrURL = (value: unknown): boolean => {
    if (typeof value === 'string') return matchesURL(value)
    if (Array.isArray(value)) return value.some(taggedOrURL)
    if (!isObject(value)) return false
    // Lexical uploads, relationships and internal links carry their own collection namespace.
    if (value.relationTo === 'media' && matchesID(value.value)) return true
    return Object.values(value).some(taggedOrURL)
  }
  return { matchesID, taggedOrURL }
}

function fieldsMatching(req: PayloadRequest, data: unknown, fields: Field[], matches: ReturnType<typeof mediaMatcher>,
  language: string, collection?: string, prefix = '', followPopulated = false, level = 0): MediaReference['fields'] {
  if (!isObject(data) || level > 12) return []
  const found = new Map<string, string>()
  const locales = req.payload.config.localization ? req.payload.config.localization.localeCodes : []
  const append = (entries: MediaReference['fields']) => { for (const entry of entries) found.set(entry.path, entry.label) }
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const named = 'name' in tab && tab.name
        append(fieldsMatching(req, named ? data[named] : data, tab.fields, matches, language,
          collection, named ? `${prefix}${named}.` : prefix, followPopulated, level + 1))
      }
      continue
    }
    if (!('name' in field)) {
      if ('fields' in field) append(fieldsMatching(req, data, field.fields, matches, language, collection, prefix, followPopulated, level + 1))
      continue
    }
    if (field.name === 'sourceData' && ['products', 'posts'].includes(collection || '')) continue
    const fieldPath = `${prefix}${field.name}`
    const label = localizedLabel('label' in field ? field.label : undefined, language, field.name)
    const value = data[field.name]
    const values = 'localized' in field && field.localized && isObject(value)
      ? Object.entries(value).filter(([key]) => locales.includes(key)).map(([, localized]) => localized) : [value]
    for (const item of values) {
      if (field.type === 'upload' || field.type === 'relationship') {
        const entries = Array.isArray(item) ? item : [item]
        for (const entry of entries) {
          const polymorphic = Array.isArray(field.relationTo)
          const relation = polymorphic && isObject(entry) ? entry.relationTo : field.relationTo
          const related = polymorphic && isObject(entry) ? entry.value : entry
          if (relation === 'media' && matches.matchesID(related)) found.set(fieldPath, label)
          else if (followPopulated && typeof relation === 'string' && isObject(related)) {
            const relatedConfig = req.payload.collections[relation as CollectionSlug]?.config
            if (relatedConfig) append(fieldsMatching(req, related, relatedConfig.fields, matches, language,
              relation, `${fieldPath}.`, true, level + 1))
          }
        }
      } else if (['json', 'richText', 'text', 'textarea'].includes(field.type) && matches.taggedOrURL(item)) {
        found.set(fieldPath, label)
      }
      if ('fields' in field) {
        for (const row of Array.isArray(item) ? item : [item]) {
          append(fieldsMatching(req, row, field.fields, matches, language, collection, `${fieldPath}.`, followPopulated, level + 1))
        }
      } else if (field.type === 'blocks' && Array.isArray(item)) {
        for (const block of item) {
          if (!isObject(block)) continue
          const blockConfig = field.blocks.find((candidate) => typeof candidate !== 'string' && candidate.slug === block.blockType)
          if (blockConfig && typeof blockConfig !== 'string') append(fieldsMatching(req, block, blockConfig.fields, matches,
            language, collection, `${fieldPath}.`, followPopulated, level + 1))
        }
      }
    }
  }
  return [...found].map(([path, label]) => ({ path, label }))
}

function recordStates(data: Data, historical = false): MediaReferenceState[] {
  const states: MediaReferenceState[] = historical ? ['history']
    : [data._status === 'published' ? 'published' : data._status === 'draft' ? 'draft' : 'current']
  if (data.deletedAt) states.push('trash')
  return states
}

/** Privileged integrity scan; callers must redact inaccessible record details before returning it. */
export async function scanMediaReferences(req: PayloadRequest, targets: Data[], stopAtFirst = false) {
  const result = new Map<string, MediaReference>()
  if (!targets.length) return result
  const settingsConfig = req.payload.config.globals.find(({ slug }) => slug === 'site-settings')
  const settings = settingsConfig ? await req.payload.findGlobal({
    slug: 'site-settings', draft: true, depth: 0, locale: 'all', showHiddenFields: true, overrideAccess: true, req,
  }) : undefined
  const matches = mediaMatcher(req, targets, settings?.canonicalBaseUrl)
  const language = req.i18n.language
  const locale = typeof req.locale === 'string' && req.locale !== 'all' ? req.locale : 'en'
  const add = (source: Omit<MediaReference, 'fields' | 'states'>, fields: MediaReference['fields'], states: MediaReferenceState[]) => {
    if (!fields.length) return
    const key = source.kind === 'global' ? `global/${source.global}` : `${source.collection}/${source.id}`
    const previous = result.get(key)
    if (!previous) result.set(key, { ...source, fields, states })
    else {
      for (const field of fields) if (!previous.fields.some(({ path }) => path === field.path)) previous.fields.push(field)
      for (const state of states) if (!previous.states.includes(state)) previous.states.push(state)
    }
  }
  for (const config of req.payload.config.collections) {
    // Editing locks and admin preferences are not content dependencies.
    if (config.auth || config.slug.startsWith('payload-') || ['media', 'releases'].includes(config.slug)) continue
    const collection = config.slug as CollectionSlug
    const titleField = config.admin.useAsTitle || 'id'
    const inspect = (data: Data, id: MediaID, historical = false) => add({
      kind: 'collection', collection, id, title: localizedLabel(data[titleField], locale, `#${id}`),
    }, fieldsMatching(req, data, config.fields, matches, language, collection), recordStates(data, historical))
    for (let page = 1; ; page += 1) {
      const sources = await req.payload.find({ collection, draft: false, trash: true, locale: 'all', depth: 0,
        showHiddenFields: true, overrideAccess: true, req, limit: 100, page, sort: 'id' })
      for (const source of sources.docs as unknown as Data[]) {
        const id = idOf(source.id)
        if (id !== undefined) inspect(source, id)
        if (stopAtFirst && result.size) return result
      }
      if (!sources.hasNextPage) break
    }
    if (config.versions) {
      for (let page = 1; ; page += 1) {
        const versions = await req.payload.findVersions({ collection, trash: true, locale: 'all', depth: 0,
          showHiddenFields: true, overrideAccess: true, req, limit: 100, page, sort: '-updatedAt' })
        for (const wrapper of versions.docs as unknown as Data[]) {
          const id = idOf(wrapper.parent)
          if (id !== undefined && isObject(wrapper.version)) inspect(wrapper.version, id, wrapper.latest !== true)
          if (stopAtFirst && result.size) return result
        }
        if (!versions.hasNextPage) break
      }
    }
  }
  for (const config of req.payload.config.globals) {
    const slug = config.slug as GlobalSlug
    const source = { kind: 'global' as const, global: slug,
      title: localizedLabel(config.label, language, config.slug) }
    const current = await req.payload.findGlobal({ slug, draft: false, locale: 'all', depth: 0,
      showHiddenFields: true, overrideAccess: true, req })
    add(source, fieldsMatching(req, current, config.fields, matches, language), recordStates(current as unknown as Data))
    if (stopAtFirst && result.size) return result
    if (config.versions) {
      for (let page = 1; ; page += 1) {
        const versions = await req.payload.findGlobalVersions({ slug, locale: 'all', depth: 0,
          showHiddenFields: true, overrideAccess: true, req, limit: 100, page, sort: '-updatedAt' })
        for (const wrapper of versions.docs as unknown as Data[]) {
          if (isObject(wrapper.version)) add(source, fieldsMatching(req, wrapper.version, config.fields, matches, language),
            recordStates(wrapper.version, wrapper.latest !== true))
          if (stopAtFirst && result.size) return result
        }
        if (!versions.hasNextPage) break
      }
    }
  }
  if (req.payload.collections.releases) {
    for (let page = 1; ; page += 1) {
      const releases = await req.payload.find({ collection: 'releases', locale: 'all', depth: 0,
        showHiddenFields: true, overrideAccess: true, req, limit: 100, page, sort: 'id' })
      for (const release of releases.docs) {
        const snapshot = release.snapshot
        if (!isObject(snapshot)) continue
        let referenced = false
        if (isObject(snapshot.content)) {
          for (const [collection, entries] of Object.entries(snapshot.content)) {
            const config = req.payload.collections[collection as CollectionSlug]?.config
            if (!config || !Array.isArray(entries)) continue
            if (entries.some((data) => fieldsMatching(req, data, config.fields, matches, language, collection, '', true).length)) {
              referenced = true
              break
            }
          }
        }
        if (!referenced && settingsConfig) referenced = fieldsMatching(req, snapshot.settings, settingsConfig.fields, matches, language, undefined, '', true).length > 0
        if (referenced) add({ kind: 'collection', collection: 'releases', id: release.id, title: String(release.name) },
          [{ path: 'snapshot', label: language.startsWith('zh') ? '发布快照' : 'Release snapshot' }], ['release'])
        if (stopAtFirst && result.size) return result
      }
      if (!releases.hasNextPage) break
    }
  }
  return result
}

/** Only titles from an access-checked current record are used in reports. */
export async function visibleMediaReference(req: PayloadRequest, reference: MediaReference, locale: string): Promise<MediaReference | null> {
  try {
    if (reference.kind === 'global' && reference.global) {
      await req.payload.findGlobal({ slug: reference.global as GlobalSlug, depth: 0, draft: true,
        overrideAccess: false, req })
      if (reference.states.includes('history')) {
        const versions = await req.payload.findGlobalVersions({ slug: reference.global as GlobalSlug, depth: 0,
          overrideAccess: false, req, limit: 1 })
        if (!versions.totalDocs) return null
      }
      return reference
    }
    const collection = reference.collection as CollectionSlug
    const titleField = req.payload.collections[collection].config.admin.useAsTitle || 'id'
    const visible = await req.payload.findByID({ collection, id: reference.id!, draft: true, trash: true,
      depth: 0, locale: 'all', overrideAccess: false, req }) as unknown as Data
    if (reference.states.includes('history')) {
      const versions = await req.payload.findVersions({ collection, trash: true, depth: 0,
        overrideAccess: false, req, where: { parent: { equals: reference.id } }, limit: 1 })
      if (!versions.totalDocs) return null
    }
    return { ...reference, title: localizedLabel(visible[titleField], locale, `#${reference.id}`) }
  } catch (error) {
    if (error instanceof APIError && [403, 404].includes(error.status)) return null
    throw error
  }
}
