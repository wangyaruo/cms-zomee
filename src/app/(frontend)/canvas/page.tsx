'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { emptyLayout } from '../../../canvas/config'
import { copy } from '../../../i18n/shared'
import { isValidSlug } from '../../../lib/validation'
import { InterfaceLanguageSwitcher, useInterfaceLanguage } from '../../../components/InterfaceLanguageProvider'
import '../../../canvas/canvas.css'

type PageSummary = { id: string | number; title: string; slug: string; _status: string; updatedAt: string }

export default function CanvasListPage() {
  const router = useRouter()
  const language = useInterfaceLanguage()
  const t = (en: string, zh: string) => copy(language, en, zh)
  const [pages, setPages] = useState<PageSummary[]>([])
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/pages?limit=100&draft=true', { credentials: 'include' }).then(async (response) => {
      if (response.status === 401 || response.status === 403) { router.push('/admin?redirect=/canvas'); return }
      if (!response.ok) throw new Error()
      const result = await response.json()
      if (active) setPages(result.docs || [])
    }).catch(() => { if (active) setError(copy(language, 'Could not load pages. Reload to try again.', '页面加载失败，请刷新后重试。')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [router, language])

  const create = async () => {
    setError('')
    const nextSlug = slug.trim() || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `page-${Date.now().toString(36)}`
    if (!title.trim()) { setError(t('Enter a page title first.', '请先填写页面标题。')); return }
    if (!isValidSlug(nextSlug)) { setError(t('Use lowercase letters, numbers and single hyphens for the URL slug.', '网址标识只能使用小写英文字母、数字和单个连字符。')); return }
    setCreating(true)
    try {
      const response = await fetch('/api/pages', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: nextSlug, layout: { ...emptyLayout, root: { props: { title: title.trim() } } }, _status: 'draft' }),
      })
      const page = await response.json()
      if (!response.ok) { setError(page.errors?.[0]?.message || t('Could not create page. Check your title and URL slug.', '页面创建失败，请检查标题和网址标识。')); return }
      router.push(`/canvas/${page.doc?.id || page.id}`)
    } catch { setError(t('Could not connect. Your entries have been kept; try again.', '连接失败，已保留填写内容，请重试。')) }
    finally { setCreating(false) }
  }

  return <main className="canvas-list">
    <InterfaceLanguageSwitcher />
    <h1>{t('Visual pages', '可视化页面')}</h1>
    <p>{t('Drag blocks, edit content and preview desktop or mobile pages.', '拖拽区块、编辑内容，并预览桌面和手机页面。')}</p>
    <form className="canvas-toolbar canvas-create" onSubmit={(event) => { event.preventDefault(); void create() }}>
      <label>{t('Page title', '页面标题')}<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>{t('URL slug (optional)', '网址标识（选填）')}<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="new-page" aria-describedby="slug-help" /></label>
      <button className="primary" type="submit" disabled={creating}>{creating ? t('Creating…', '正在创建…') : t('Create page', '创建页面')}</button>
      <Link href="/admin">{t('CMS dashboard', '返回后台')}</Link>
    </form>
    <p id="slug-help" className="canvas-status">{t('Use lowercase letters, numbers and hyphens. Leave empty to generate a URL automatically.', '网址标识使用小写英文字母、数字和连字符；留空时自动生成。')}</p>
    {error && <p role="alert">{error}</p>}
    <table><thead><tr><th>{t('Title', '标题')}</th><th>{t('URL', '网址')}</th><th>{t('Status', '状态')}</th><th>{t('Updated', '更新时间')}</th></tr></thead>
      <tbody>{pages.map((page) => <tr key={page.id}><td><Link href={`/canvas/${page.id}`}>{page.title}</Link></td><td>/{page.slug}</td><td>{page._status === 'published' ? t('Published', '已发布') : t('Draft', '草稿')}</td><td>{new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' }).format(new Date(page.updatedAt))}</td></tr>)}
        {!pages.length && <tr><td colSpan={4}>{loading ? t('Loading pages…', '正在加载页面…') : t('No pages yet. Create your first page above.', '还没有页面，可在上方创建第一个页面。')}</td></tr>}
      </tbody>
    </table>
  </main>
}
