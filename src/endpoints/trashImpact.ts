import { APIError, type CollectionSlug, type Endpoint, type Field, type PayloadRequest, type TypedLocale, type Where } from 'payload'
import { mergeListSearchAndWhere } from 'payload/shared'
import { contentTrashCollections } from '../collections/contentTrash'
import { canPublish } from '../lib/validation'

type RecordData = Record<string, unknown>
type ID = number | string
type ImpactInput = {
  collection: string
  selection: { mode: 'ids'; ids: ID[] } | { mode: 'query'; where?: Where; search?: string }
  locale?: string
}
type ImpactField = { path: string; label: string }
type ImpactReference = {
  collection: string
  id: ID
  title: string
  fields: ImpactField[]
  states: ('draft' | 'published')[]
}
type Rule = ImpactField & { kind: 'relationship' | 'richText' | 'links'; relationTo?: string | string[] }

const sourceCollections = [...contentTrashCollections, 'documents', 'pages'] as CollectionSlug[]
const displayLimit = 50
const object = (value: unknown): value is RecordData => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const idOf = (value: unknown): ID | undefined => typeof value === 'number' || typeof value === 'string'
  ? value : object(value) ? idOf(value.id) : undefined

function fieldLabel(label: unknown, fallback: string, language: string): string {
  if (typeof label === 'string') return label
  if (object(label)) {
    const translated = label[language] || label.en || label.zh
    if (typeof translated === 'string') return translated
  }
  return fallback
}

function rulesFor(fields: Field[], language: string, prefix = ''): Rule[] {
  const rules: Rule[] = []
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) rules.push(...rulesFor(tab.fields, language,
        'name' in tab ? `${prefix}${tab.name}.` : prefix))
      continue
    }
    const path = 'name' in field ? `${prefix}${field.name}` : prefix.replace(/\.$/, '')
    const label = fieldLabel('label' in field ? field.label : undefined,
      'name' in field ? field.name : path, language)
    if (field.type === 'relationship') {
      rules.push({ path, label, kind: 'relationship', relationTo: field.relationTo })
    } else if (field.type === 'richText') {
      rules.push({ path, label, kind: 'richText' })
    } else if ('name' in field && (['sourceData', 'layout'].includes(field.name)
      || ['href', 'linkHref'].includes(field.name))) {
      rules.push({ path, label, kind: 'links' })
    }
    if ('fields' in field) rules.push(...rulesFor(field.fields, language,
      'name' in field ? `${path}.` : prefix))
  }
  return rules
}

function atPath(value: unknown, path: string[]): unknown[] {
  if (!path.length) return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => atPath(entry, path))
  if (!object(value)) return []
  const [key, ...remaining] = path
  return atPath(value[key], remaining)
}

function relationshipMatches(value: unknown, relationTo: string | string[] | undefined,
  targetCollection: string, ids: Set<string>): boolean {
  if (Array.isArray(value)) return value.some((entry) => relationshipMatches(entry, relationTo, targetCollection, ids))
  if (Array.isArray(relationTo)) {
    return object(value) && value.relationTo === targetCollection
      && ids.has(String(idOf(value.value)))
  }
  return relationTo === targetCollection && ids.has(String(idOf(value)))
}

function localizedText(value: unknown, locale: string): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (object(value)) {
    for (const text of [value[locale], value.en, ...Object.values(value)]) {
      if (typeof text === 'string' && text.trim()) return text
    }
  }
  return undefined
}

function parseInput(input: unknown): ImpactInput {
  if (!object(input) || typeof input.collection !== 'string' || !contentTrashCollections.has(input.collection)) {
    throw new APIError('Choose a content collection that supports the recycle bin.', 400)
  }
  const selection = input.selection
  if (!object(selection) || !['ids', 'query'].includes(String(selection.mode))) {
    throw new APIError('Choose records or a list query to check.', 400)
  }
  if (input.locale !== undefined && typeof input.locale !== 'string') throw new APIError('Invalid content locale.', 400)
  if (selection.mode === 'ids') {
    if (!Array.isArray(selection.ids) || !selection.ids.length || selection.ids.some((id) =>
      !(typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
      && !(typeof id === 'string' && id.trim().length > 0 && id.length <= 128))) {
      throw new APIError('Provide valid record IDs.', 400)
    }
  } else if ((selection.where !== undefined && !object(selection.where))
    || (selection.search !== undefined && typeof selection.search !== 'string')) {
    throw new APIError('Invalid list query.', 400)
  }
  return input as ImpactInput
}

function linkMatcher(targetCollection: string, targets: RecordData[], canonicalBase: unknown, locales: Set<string>) {
  let canonicalOrigin: string | undefined
  try {
    if (typeof canonicalBase === 'string' && /^https?:\/\//i.test(canonicalBase)) canonicalOrigin = new URL(canonicalBase).origin
  } catch { /* Without a valid website origin, only root-relative links can be checked. */ }
  const parse = (value: unknown) => {
    if (typeof value !== 'string') return undefined
    try {
      const text = value.trim()
      const rootRelative = text.startsWith('/') && !text.startsWith('//') && !text.includes('\\')
      if (!rootRelative && (!/^https?:\/\//i.test(text) || !canonicalOrigin)) return undefined
      const url = new URL(text, 'https://cms-link-check.invalid')
      if (!rootRelative && url.origin !== canonicalOrigin) return undefined
      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
      if (segments[0] && locales.has(segments[0])) segments.shift()
      return { path: `/${segments.join('/')}`, category: url.searchParams.get('category') }
    } catch { return undefined }
  }
  const paths = new Set<string>()
  const categories = new Set<string>()
  const routePrefixes: Record<string, string> = {
    products: '/products/', posts: '/blog/', applications: '/applications/', solutions: '/solutions/',
    resources: '/resources/', 'legal-pages': '/',
  }
  for (const target of targets) {
    if (targetCollection === 'categories' && typeof target.slug === 'string') categories.add(target.slug)
    else {
      const href = targetCollection === 'site-pages' ? target.path
        : routePrefixes[targetCollection] && typeof target.slug === 'string'
          ? `${routePrefixes[targetCollection]}${target.slug}` : undefined
      const parsed = parse(href)
      if (parsed) paths.add(parsed.path)
    }
  }
  return (value: unknown): boolean => {
    const parsed = parse(value)
    return Boolean(parsed && (paths.has(parsed.path)
      || (parsed.path === '/products' && parsed.category && categories.has(parsed.category))))
  }
}

function containsLink(value: unknown, matches: (value: unknown) => boolean, locales: Set<string>, direct = false): boolean {
  if (typeof value === 'string') return direct && matches(value)
  if (Array.isArray(value)) return value.some((entry) => containsLink(entry, matches, locales, direct))
  if (!object(value)) return false
  return Object.entries(value).some(([key, entry]) =>
    containsLink(entry, matches, locales, ['href', 'linkHref', 'url', 'path'].includes(key)
      || (direct && locales.has(key))))
}

function richTextMatches(value: unknown, collection: string, ids: Set<string>, matches: (value: unknown) => boolean): boolean {
  if (Array.isArray(value)) return value.some((entry) => richTextMatches(entry, collection, ids, matches))
  if (!object(value)) return false
  if (value.type === 'relationship' && value.relationTo === collection && ids.has(String(idOf(value.value)))) return true
  if ((value.type === 'link' || value.type === 'autolink') && object(value.fields)) {
    const doc = value.fields.doc
    if (value.fields.linkType === 'internal' && object(doc) && doc.relationTo === collection
      && ids.has(String(idOf(doc.value)))) return true
    if (value.fields.linkType !== 'internal' && matches(value.fields.url)) return true
  }
  return Object.values(value).some((entry) => richTextMatches(entry, collection, ids, matches))
}

export async function collectTrashImpact(req: PayloadRequest, rawInput: unknown) {
  if (!req.user || !canPublish(req.user.role)) throw new APIError('Reviewer permission required.', 403)
  const input = parseInput(rawInput)
  const targetCollection = input.collection as CollectionSlug
  const targetConfig = req.payload.collections[targetCollection]?.config
  if (!targetConfig?.trash) throw new APIError('This collection does not support the recycle bin.', 400)
  const localization = req.payload.config.localization
  const locales = new Set(localization ? localization.localeCodes : [])
  const locale = input.locale || (typeof req.locale === 'string' && req.locale !== 'all' ? req.locale : undefined)
    || (localization ? localization.defaultLocale : 'en')
  if (localization && !locales.has(locale)) throw new APIError('Invalid content locale.', 400)
  const language = req.i18n.language
  const selectedIDs = input.selection.mode === 'ids' ? [...new Set(input.selection.ids.map(String))] : undefined
  const selectionWhere = input.selection.mode === 'ids'
    ? { id: { in: selectedIDs } } as Where
    : mergeListSearchAndWhere({ collectionConfig: targetConfig,
      search: input.selection.search || '', where: structuredClone(input.selection.where || {}) })
  const selected = await req.payload.find({
    collection: targetCollection, where: selectionWhere, draft: true, locale: locale as TypedLocale, depth: 0,
    pagination: false, overrideAccess: false, req,
    select: { id: true, slug: true, path: true },
  })
  if (selectedIDs && selected.docs.length !== selectedIDs.length) {
    throw new APIError('One or more selected records are unavailable. Refresh the list and try again.', 404)
  }
  const targets = selected.docs as unknown as RecordData[]
  const ids = new Set(targets.map((target) => String(target.id)))
  const result = new Map<string, ImpactReference>()
  if (ids.size) {
    const mainTargets = await req.payload.find({
      collection: targetCollection, where: { id: { in: [...ids] } }, draft: false, locale: 'all', depth: 0,
      pagination: false, overrideAccess: false, req, select: { id: true, slug: true, path: true },
    })
    const settings = req.payload.config.globals.some(({ slug }) => slug === 'site-settings') ? await req.payload.findGlobal({
      slug: 'site-settings', depth: 0, overrideAccess: false, req,
      select: { canonicalBaseUrl: true },
    }) : undefined
    const matchesLink = linkMatcher(input.collection,
      [...targets, ...mainTargets.docs as unknown as RecordData[]], settings?.canonicalBaseUrl, locales)
    for (const collection of sourceCollections) {
      const config = req.payload.collections[collection]?.config
      if (!config) continue
      // These migration copies are removed by captureSnapshot, so their links are not live references.
      const rules = rulesFor(config.fields, language).filter((rule) =>
        !(['products', 'posts'].includes(collection) && rule.path === 'sourceData'))
      const applicable = rules.filter((rule) => rule.kind !== 'relationship'
        || (Array.isArray(rule.relationTo) ? rule.relationTo.includes(input.collection) : rule.relationTo === input.collection))
      if (!applicable.length) continue
      const titleField = config.admin.useAsTitle || 'id'
      const select = Object.fromEntries(['id', '_status', 'deletedAt', titleField,
        ...applicable.map((rule) => rule.path.split('.')[0])].map((field) => [field, true as const]))
      for (const draft of [false, true]) {
        let page = 1
        let hasNextPage = true
        while (hasNextPage) {
          const sources = await req.payload.find({
            collection, draft, depth: 0, locale: 'all', overrideAccess: false, req,
            showHiddenFields: true, limit: 100, page, sort: 'id', select,
            ...(!draft ? { where: { _status: { equals: 'published' } } } : {}),
          })
          for (const source of sources.docs as unknown as RecordData[]) {
            const id = idOf(source.id)
            if (id === undefined || source.deletedAt || (collection === input.collection && ids.has(String(id)))) continue
            const fields = applicable.filter((rule) => atPath(source, rule.path.split('.')).some((value) => {
              if (rule.kind === 'relationship') return relationshipMatches(value, rule.relationTo, input.collection, ids)
              if (rule.kind === 'richText') return richTextMatches(value, input.collection, ids, matchesLink)
              return containsLink(value, matchesLink, locales, true)
            })).map(({ path, label }) => ({ path, label }))
            if (!fields.length) continue
            const key = `${collection}/${id}`
            const state = source._status === 'published' ? 'published' : 'draft'
            const previous = result.get(key)
            if (previous) {
              for (const field of fields) if (!previous.fields.some(({ path }) => path === field.path)) previous.fields.push(field)
              if (!previous.states.includes(state)) previous.states.push(state)
              if (draft) previous.title = localizedText(source[titleField], locale) || previous.title
            } else {
              result.set(key, { collection, id, title: localizedText(source[titleField], locale) || `#${id}`, fields, states: [state] })
            }
          }
          hasNextPage = sources.hasNextPage
          page += 1
        }
      }
    }
  }
  return { collection: input.collection, targetCount: ids.size, totalReferences: result.size,
    references: [...result.values()].slice(0, displayLimit), displayLimit, checkedAt: new Date().toISOString() }
}

export const contentTrashImpactEndpoint: Endpoint = {
  path: '/content-trash-impact',
  method: 'post',
  handler: async (req) => {
    const headers = { 'Cache-Control': 'private, no-store' }
    try {
      let input: unknown
      try { input = await req.json?.() } catch { throw new APIError('Invalid JSON request.', 400) }
      return Response.json(await collectTrashImpact(req, input), { headers })
    } catch (error) {
      if (error instanceof APIError) return Response.json({ error: error.message }, { status: error.status, headers })
      throw error
    }
  },
}
