'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { emptyLayout } from '../../../canvas/config'
import '../../../canvas/canvas.css'

export default function CanvasListPage() {
  const router = useRouter()
  const [pages, setPages] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    const response = await fetch('/api/pages?limit=100&draft=true', { credentials: 'include' })
    if (response.status === 401 || response.status === 403) { router.push('/admin?redirect=/canvas'); return }
    const result = await response.json()
    setPages(result.docs || [])
  }
  useEffect(() => { void load() }, [])
  const create = async () => {
    setError('')
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '')
    if (!title.trim() || !slug) { setError('Enter a page title first.'); return }
    const response = await fetch('/api/pages', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, slug, layout: emptyLayout, _status: 'draft' }) })
    if (!response.ok) { setError((await response.json()).errors?.[0]?.message || 'Could not create page'); return }
    const page = await response.json()
    router.push(`/canvas/${page.doc?.id || page.id}`)
  }
  return <main className="canvas-list"><h1>Visual pages</h1><p>Drag blocks, edit content and preview the result on desktop or mobile.</p><div className="canvas-toolbar"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New page title" /><button className="primary" onClick={create}>Create page</button><Link href="/admin">CMS admin</Link></div>{error && <p role="alert">{error}</p>}<table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th></tr></thead><tbody>{pages.map((page) => <tr key={page.id} onClick={() => router.push(`/canvas/${page.id}`)} style={{ cursor: 'pointer' }}><td>{page.title}</td><td>/{page.slug}</td><td>{page._status}</td><td>{new Date(page.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></main>
}
