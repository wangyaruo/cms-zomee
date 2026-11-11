import type { Endpoint } from 'payload'

const collections = ['categories', 'products', 'posts', 'faqs'] as const

/** Read-only, server-to-server export. Drafts and user records are never included. */
export const snapshotEndpoint: Endpoint = {
  path: '/snapshot',
  method: 'get',
  handler: async (req) => {
    const expected = process.env.SNAPSHOT_TOKEN
    if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const preview = new URL(req.url || '', 'http://localhost').searchParams.get('preview') === '1'
    const requested = new URL(req.url || '', 'http://localhost').searchParams.get('collections')?.split(',')
    const selected = requested?.length ? collections.filter((collection) => requested.includes(collection)) : collections
    const content: Record<string, unknown> = {}
    for (const collection of selected) {
      const result = await req.payload.find({
        collection,
        depth: 1,
        draft: true,
        locale: 'all',
        pagination: false,
        overrideAccess: true,
        req,
      })
      content[collection] = result.docs.filter((doc) => preview || doc._status === 'published').map((doc) => {
        const publicDoc = { ...doc } as Record<string, unknown>
        delete publicDoc.sourceData
        return publicDoc
      })
    }
    const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 2, draft: preview, locale: 'all', overrideAccess: true, req })
    const origin = req.headers.get('origin')
    const allowed = (process.env.SNAPSHOT_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
    const headers: Record<string, string> = { 'Cache-Control': 'private, no-store', Vary: 'Origin' }
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
    return Response.json({ version: new Date().toISOString(), content, settings }, { headers })
  },
}
