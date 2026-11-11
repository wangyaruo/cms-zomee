import { createHash } from 'node:crypto'
import type { Endpoint } from 'payload'
import { canPublish } from '../lib/validation'
import { captureSnapshot, snapshotResponse } from './snapshot'

/** Creates an immutable published-content release. Draft previews cannot become releases. */
export const createReleaseEndpoint: Endpoint = {
  path: '/release-actions/create',
  method: 'post',
  handler: async (req) => {
    const auth = await req.payload.auth({ headers: req.headers, req })
    const user = auth.user
    if (!user || !canPublish(user.role)) return snapshotResponse(req, { error: 'Reviewer permission required' }, 403)
    let input: { name?: string; note?: string } = {}
    try { input = await req.json?.() ?? {} } catch { /* Empty body uses the generated release name. */ }
    const snapshot = await captureSnapshot(req, false)
    const contentHash = createHash('sha256').update(JSON.stringify({ content: snapshot.content, settings: snapshot.settings })).digest('hex')
    const counts = Object.fromEntries(Object.entries(snapshot.content).map(([key, value]) => [key, (value as unknown[]).length]))
    const existing = await req.payload.find({ collection: 'releases', where: { contentHash: { equals: contentHash } }, limit: 1, overrideAccess: true, req })
    if (existing.docs[0]) return snapshotResponse(req, { id: existing.docs[0].id, name: existing.docs[0].name, contentHash, counts, unchanged: true })
    const name = input.name?.trim() || `Published content ${snapshot.version}`
    const release = await req.payload.create({
      collection: 'releases', overrideAccess: true, req,
      data: { name, note: input.note || '', contentHash, counts, snapshot, createdBy: user.id },
    })
    return snapshotResponse(req, { id: release.id, name: release.name, contentHash, counts, unchanged: false }, 201)
  },
}
