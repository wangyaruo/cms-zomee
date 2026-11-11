import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { CanvasRenderer } from '../../../../canvas/Renderer'

export const dynamic = 'force-dynamic'

export default async function CanvasPreviewPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ device?: string }> }) {
  const { slug } = await params
  const { device } = await searchParams
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, draft: true, limit: 1, overrideAccess: true })
  const page = result.docs[0]
  if (!page) notFound()
  if (page._status !== 'published') {
    const auth = await payload.auth({ headers: await headers() })
    if (!auth.user) redirect(`/admin?redirect=/preview/${slug}`)
  }
  return <CanvasRenderer data={page.layout} device={device === 'mobile' ? 'mobile' : 'desktop'} />
}
