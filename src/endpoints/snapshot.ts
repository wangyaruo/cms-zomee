import type { Endpoint, PayloadRequest } from 'payload'

const collections = ['categories', 'products', 'posts', 'faqs', 'applications', 'solutions', 'resources', 'navigation-menus', 'legal-pages', 'site-pages', 'documents'] as const

export function isSnapshotAuthorized(req: PayloadRequest) {
  const expected = process.env.SNAPSHOT_TOKEN
  return Boolean(expected && req.headers.get('authorization') === `Bearer ${expected}`)
}

export async function captureSnapshot(req: PayloadRequest, preview = false, selected: readonly (typeof collections)[number][] = collections) {
  const content: Record<string, unknown> = {}
  for (const collection of selected) {
    const result = await req.payload.find({
      collection, depth: 1, draft: true, locale: 'all', pagination: false, overrideAccess: true, req,
    })
    content[collection] = result.docs.filter((doc) => preview || doc._status === 'published').map((doc) => {
      const publicDoc = { ...doc } as Record<string, unknown>
      if (collection === 'products' || collection === 'posts') delete publicDoc.sourceData
      return publicDoc
    })
  }
  const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 2, draft: preview, locale: 'all', overrideAccess: true, req })
  return { version: new Date().toISOString(), content, settings }
}

export function snapshotResponse(req: PayloadRequest, data: unknown, status = 200) {
  const origin = req.headers.get('origin')
  const allowed = (process.env.SNAPSHOT_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store', Vary: 'Origin' }
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return Response.json(data, { status, headers })
}

/** Read-only, server-to-server export. Drafts and user records are never included. */
export const snapshotEndpoint: Endpoint = {
  path: '/snapshot',
  method: 'get',
  handler: async (req) => {
    if (!isSnapshotAuthorized(req)) return snapshotResponse(req, { error: 'Unauthorized' }, 401)
    const url = new URL(req.url || '', 'http://localhost')
    const releaseId = url.searchParams.get('release')
    const requested = url.searchParams.get('collections')?.split(',')
    const selected = requested?.length ? collections.filter((collection) => requested.includes(collection)) : collections
    if (releaseId) {
      const release = await req.payload.findByID({ collection: 'releases', id: releaseId, overrideAccess: true, showHiddenFields: true, req })
      const stored = release.snapshot as { content: Record<string, unknown> }
      const content = Object.fromEntries(selected.map((collection) => [collection, stored.content[collection] ?? []]))
      return snapshotResponse(req, { ...release.snapshot as object, content, version: String(release.id), release: { id: release.id, name: release.name, contentHash: release.contentHash } })
    }
    const preview = url.searchParams.get('preview') === '1'
    return snapshotResponse(req, await captureSnapshot(req, preview, selected))
  },
}
