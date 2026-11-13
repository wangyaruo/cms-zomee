'use client'

import { getTranslation } from '@payloadcms/translations'
import { Button, useConfig, useDocumentInfo, useListQuery, useLocale, useSelection, useTranslation } from '@payloadcms/ui'
import type { BeforeListTableClientProps, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { useEffect, useState, type SyntheticEvent } from 'react'
import './media-references.css'

type Selection = { mode: 'ids'; ids: (number | string)[] }
  | { mode: 'query'; where?: Where; search?: string }
type ReferenceState = 'published' | 'draft' | 'trash' | 'history' | 'release' | 'current'
type Reference = {
  kind: 'collection' | 'global'
  collection?: string
  id?: number | string
  global?: string
  title: string
  fields: { path: string; label: string }[]
  states: ReferenceState[]
}
type Report = {
  targetCount: number
  totalReferences: number
  restrictedReferences: number
  references: Reference[]
  displayLimit: number
  checkedAt: string
}
type Check = { key: string } & ({ status: 'loading' | 'error' } | { status: 'ready'; report: Report })

function MediaReferencesPanel({ selection }: { selection: Selection }) {
  const { config } = useConfig()
  const { code: locale } = useLocale()
  const { i18n } = useTranslation()
  const language = i18n.language
  const text = (zh: string, en: string) => language.startsWith('zh') ? zh : en
  const [expanded, setExpanded] = useState(false)
  const [check, setCheck] = useState<Check | null>(null)
  const [attempt, setAttempt] = useState(0)
  const apiRoute = config.routes.api
  const requestBody = JSON.stringify({ selection, locale })
  const requestKey = JSON.stringify([apiRoute, language, requestBody])
  const current = check?.key === requestKey ? check : null
  const report = current?.status === 'ready' ? current.report : null
  const loading = expanded && (!current || current.status === 'loading')

  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    setCheck({ key: requestKey, status: 'loading' })
    void (async () => {
      try {
        const response = await fetch(formatAdminURL({ apiRoute, path: '/media-references' }), {
          method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Accept-Language': language }, body: requestBody,
        })
        if (!response.ok) throw new Error('Reference check failed')
        const result = await response.json() as Report
        if (!controller.signal.aborted) setCheck({ key: requestKey, status: 'ready', report: result })
      } catch {
        if (!controller.signal.aborted) setCheck({ key: requestKey, status: 'error' })
      }
    })()
    return () => controller.abort()
  }, [apiRoute, attempt, expanded, language, requestBody, requestKey])

  const label = (reference: Reference) => {
    if (reference.kind === 'global') {
      const source = config.globals.find((item) => item.slug === reference.global)
      return source ? getTranslation(source.label, i18n) : reference.global
    }
    const source = config.collections.find((item) => item.slug === reference.collection)
    return source ? getTranslation(source.labels.singular, i18n) : reference.collection
  }
  const link = (reference: Reference) => formatAdminURL({ adminRoute: config.routes.admin, path:
    reference.kind === 'global'
      ? `/globals/${encodeURIComponent(reference.global!)}?locale=${encodeURIComponent(locale)}`
      : `/collections/${encodeURIComponent(reference.collection!)}/${encodeURIComponent(reference.id!)}?locale=${encodeURIComponent(locale)}`,
  })
  const states: Record<ReferenceState, string> = {
    published: text('已发布', 'Published'), draft: text('草稿', 'Draft'), trash: text('回收站', 'Trash'),
    history: text('历史版本', 'Saved versions'), release: text('发布快照', 'Release snapshot'), current: text('当前内容', 'Current content'),
  }
  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => setExpanded(event.currentTarget.open)

  return <details className="media-references" onToggle={onToggle}>
    <summary className="media-references__heading">{text('图片引用与删除保护', 'Image references and deletion protection')}</summary>
    <div className="media-references__body" aria-busy={loading}>
      <p>{text('检查各语言已保存的内容、草稿、回收站、历史版本和发布快照。有引用的图片不能删除。',
        'Checks saved content in every language, drafts, trash, saved versions and release snapshots. Referenced images cannot be deleted.')}</p>
      <p>{text('原站来源路径相同也会计入关联。未保存的修改及 CMS 外部手动使用的图片无法自动确认。',
        'Matching original asset paths also count as references. Unsaved changes and manual uses outside the CMS cannot be checked automatically.')}</p>
      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="media-references__status">{text('正在检查引用…', 'Checking references…')}</p>}
        {current?.status === 'error' && <div>
          <p>{text('引用检查失败。请重新检查后再删除。', 'The reference check failed. Retry before deleting.')}</p>
          <Button type="button" buttonStyle="secondary" size="small" margin={false} onClick={() => setAttempt((value) => value + 1)}>
            {text('重新检查', 'Retry check')}
          </Button>
        </div>}
        {report && <p className="media-references__status">{text(
          `已检查 ${report.targetCount} 张图片，发现 ${report.totalReferences} 条引用来源。`,
          `Images checked: ${report.targetCount}; referring records: ${report.totalReferences}.`,
        )}</p>}
      </div>
      {report && <>
        <p>{report.totalReferences > 0
          ? text('请先处理以下引用。历史版本和发布快照保留的引用也会阻止删除；批量删除时，被引用的图片会保留。',
            'Review the references below. Saved versions and release snapshots also prevent deletion. Bulk deletion keeps referenced images.')
          : text('本次未发现已保存的引用。删除前请再核对 CMS 外部的图片用途。',
            'No saved references were found. Check uses outside the CMS before deleting.')}</p>
        {report.restrictedReferences > 0 && <p>{text(
          `其中 ${report.restrictedReferences} 条引用无权查看详情，请联系管理员处理。`,
          `Details of ${report.restrictedReferences} referring records are restricted. Contact an administrator for help.`,
        )}</p>}
        {report.references.length > 0 && <ul className="media-references__list">
          {report.references.map((reference) => <li key={`${reference.kind}:${reference.global || reference.collection}:${reference.id ?? ''}`}>
            <a className="media-references__record" href={link(reference)}>{reference.title}</a>
            <p className="media-references__meta"><span>{label(reference)}</span><span>{reference.states.map((state) => states[state]).join(' / ')}</span></p>
            <p className="media-references__fields">{text('引用字段：', 'Referenced in: ')}{reference.fields.map((field) => field.label).join(text('、', ', '))}</p>
          </li>)}
        </ul>}
        {report.totalReferences - report.restrictedReferences > report.references.length && <p>{text(
          `当前展示 ${report.references.length} 条可查看引用（最多 ${report.displayLimit} 条），删除保护会检查全部引用。`,
          `Showing ${report.references.length} accessible references (up to ${report.displayLimit}). Deletion protection checks every reference.`,
        )}</p>}
        <div className="media-references__refresh">
          <p>{text('检查时间：', 'Checked: ')}<time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString(language)}</time>
            {text('。更新内容后请重新检查。', '. Check again after saving content.')}</p>
          <Button type="button" buttonStyle="secondary" size="small" margin={false} onClick={() => setAttempt((value) => value + 1)}>
            {text('重新检查', 'Refresh check')}
          </Button>
        </div>
      </>}
    </div>
  </details>
}

export function DocumentMediaReferences() {
  const { id, collectionSlug } = useDocumentInfo()
  if (id == null || collectionSlug !== 'media') return null
  return <MediaReferencesPanel selection={{ mode: 'ids', ids: [id] }} />
}

export function ListMediaReferences({ collectionSlug }: BeforeListTableClientProps) {
  const { count, selectAll, selectedIDs } = useSelection()
  const { query } = useListQuery()
  if (collectionSlug !== 'media' || !count) return null
  const selection: Selection = selectAll === 'allAvailable'
    ? { mode: 'query', where: query.where, search: query.search }
    : { mode: 'ids', ids: selectedIDs }
  return <MediaReferencesPanel selection={selection} />
}
