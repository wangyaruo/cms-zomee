'use client'

import '@measured/puck/puck.css'
import { Puck } from '@measured/puck'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { canvasConfig } from '../../../../canvas/config'
import '../../../../canvas/canvas.css'

export default function VisualCanvasEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState('Loading canvas…')
  const dataRef = useRef(data)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  dataRef.current = data

  useEffect(() => {
    fetch(`/api/pages/${params.id}?draft=true`, { credentials: 'include' }).then(async (response) => {
      if (response.status === 401 || response.status === 403) { router.push(`/admin?redirect=/canvas/${params.id}`); return null }
      if (!response.ok) throw new Error('Could not load this page')
      return response.json()
    }).then((page) => {
      if (!page) return
      setData(page.layout)
      setTitle(page.title)
      setSlug(page.slug)
      setStatus('Draft changes save automatically')
    }).catch((error) => setStatus(error.message))
  }, [params.id, router])

  const save = async (nextStatus = 'draft', nextData = dataRef.current) => {
    if (!nextData) return
    setStatus('Saving…')
    const response = await fetch(`/api/pages/${params.id}?draft=true`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, layout: nextData, _status: nextStatus }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      setStatus(result.errors?.[0]?.message || 'Save failed. Check your permission.')
      return false
    }
    setStatus(nextStatus === 'published' ? 'Published. Open the preview to verify.' : 'Saved')
    return true
  }

  const change = (next: any) => {
    setData(next)
    setStatus('Unsaved changes…')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void save('draft', next) }, 900)
  }

  if (!data) return <p className="canvas-message">{status}</p>
  return <div className="canvas-workspace"><div className="canvas-toolbar"><Link href="/canvas">Pages</Link><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Page title" /><span className="canvas-status">/{slug}</span><span className="spacer" /><span className="canvas-status" role="status">{status}</span><button onClick={() => void save()}>Save draft</button><Link href={`/preview/${slug}`} target="_blank"><button type="button">Preview</button></Link></div><div className="canvas-editor"><Puck config={canvasConfig} data={data} onChange={change} onPublish={async (next) => { if (await save('published', next)) router.push(`/preview/${slug}`) }} /></div></div>
}
