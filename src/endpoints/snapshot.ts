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
    const content: Record<string, unknown> = {}
    for (const collection of collections) {
      const result = await req.payload.find({
        collection,
        depth: 2,
        draft: false,
        locale: 'all',
        pagination: false,
        req,
      })
      content[collection] = result.docs
    }
    const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 2, draft: false, locale: 'all', req })
    const origin = req.headers.get('origin')
    const allowed = (process.env.SNAPSHOT_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
    const headers: Record<string, string> = { 'Cache-Control': 'private, no-store', Vary: 'Origin' }
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
    return Response.json({ version: new Date().toISOString(), content, settings }, { headers })
  },
}
