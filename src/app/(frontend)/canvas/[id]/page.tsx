'use client'

import '@measured/puck/puck.css'
import { Puck } from '@measured/puck'
import type { Data } from '@measured/puck'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCanvasConfig } from '../../../../canvas/config'
import EditorChrome, { LocalizedArrayField } from '../../../../canvas/EditorChrome'
import { InterfaceLanguageSwitcher, useInterfaceLanguage } from '../../../../components/InterfaceLanguageProvider'
import { copy } from '../../../../i18n/shared'
import '../../../../canvas/canvas.css'

type SaveStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'published' | 'unsaved'

export default function VisualCanvasEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const language = useInterfaceLanguage()
  const t = (en: string, zh: string) => copy(language, en, zh)
  const [data, setData] = useState<Data>()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<SaveStatus>('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dataRef = useRef(data)
  const titleRef = useRef(title)
  const slugRef = useRef(slug)
  const languageRef = useRef(language)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  dataRef.current = data
  titleRef.current = title
  slugRef.current = slug
  languageRef.current = language
  const config = useMemo(() => getCanvasConfig(language), [language])
  const overrides = useMemo(() => ({ fieldTypes: { array: LocalizedArrayField }, actionBar: () => <></> }), [])

  useEffect(() => {
    let active = true
    fetch(`/api/pages/${params.id}?draft=true`, { credentials: 'include' }).then(async (response) => {
      if (response.status === 401 || response.status === 403) { router.push(`/admin?redirect=/canvas/${params.id}`); return null }
      if (!response.ok) throw new Error()
      return response.json()
    }).then((page) => {
      if (!page || !active) return
      setData(page.layout)
      setTitle(page.title)
      setSlug(page.slug)
      setStatus('ready')
    }).catch(() => { if (active) setError(copy(languageRef.current, 'Could not load this page. Reload to try again.', '页面加载失败，请刷新后重试。')) })
    return () => { active = false; if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [params.id, router])

  const save = async (nextStatus = 'draft', nextData = dataRef.current) => {
    if (!nextData) return false
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setError('')
    setStatus('saving')
    setSaving(true)
    try {
      const response = await fetch(`/api/pages/${params.id}?draft=true`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleRef.current, slug: slugRef.current, layout: nextData, _status: nextStatus }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        setError(result.errors?.[0]?.message || copy(languageRef.current, 'Save failed. Check your permission and try again.', '保存失败，请检查账号权限后重试。'))
        setStatus('unsaved')
        return false
      }
      setStatus(nextStatus === 'published' ? 'published' : 'saved')
      return true
    } catch {
      setError(copy(languageRef.current, 'Could not connect. Your changes are still here; try saving again.', '连接失败，当前修改仍保留在页面中，请重新保存。'))
      setStatus('unsaved')
      return false
    } finally { setSaving(false) }
  }

  const change = (next: Data) => {
    dataRef.current = next
    setData(next)
    setStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void save('draft', next) }, 900)
  }
  const messages: Record<SaveStatus, string> = {
    loading: t('Loading canvas…', '正在加载画布…'), ready: t('Draft changes save automatically', '草稿修改会自动保存'),
    saving: t('Saving…', '正在保存…'), saved: t('Saved', '已保存'), published: t('Published', '已发布'), unsaved: t('Unsaved changes', '有尚未保存的修改'),
  }
  if (!data) return <main className="canvas-message"><InterfaceLanguageSwitcher /><p role={error ? 'alert' : 'status'}>{error || messages[status]}</p></main>
  return <div className="canvas-workspace"><div className="canvas-toolbar">
    <Link href="/canvas">{t('Pages', '页面列表')}</Link>
    <label className="canvas-title-label">{t('Page title', '页面标题')}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <span className="canvas-status">/{slug}</span><span className="spacer" />
    <InterfaceLanguageSwitcher />
    <span className="canvas-status" role="status">{messages[status]}</span>
    <button disabled={saving} onClick={() => void save()}>{t('Save draft', '保存草稿')}</button>
    <Link href={`/preview/${slug}`} target="_blank" rel="noopener noreferrer">{t('Preview', '预览')}</Link>
    <button className="primary" disabled={saving} onClick={async () => { if (await save('published')) router.push(`/preview/${slug}`) }}>{t('Publish page', '发布页面')}</button>
  </div>{error && <p className="canvas-error" role="alert">{error}</p>}<div className="canvas-editor"><Puck key={language} config={config} data={data} onChange={change} overrides={overrides}><EditorChrome /></Puck></div></div>
}
