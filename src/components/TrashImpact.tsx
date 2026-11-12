'use client'

import { getTranslation } from '@payloadcms/translations'
import { Button, useConfig, useDocumentInfo, useListQuery, useLocale, useSelection, useTranslation } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { BeforeListTableClientProps, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import './trash-impact.css'

type ImpactSelection = { mode: 'ids'; ids: (number | string)[] }
  | { mode: 'query'; where?: Where; search?: string }

type ImpactReference = {
  collection: string
  id: number | string
  title: string
  fields: { path: string; label: string }[]
  states: ('draft' | 'published')[]
}

type ImpactReport = {
  collection: string
  targetCount: number
  totalReferences: number
  references: ImpactReference[]
  displayLimit: number
  checkedAt: string
}

type CheckState = { key: string } & (
  { status: 'loading' | 'error' }
  | { status: 'ready'; report: ImpactReport }
)

function TrashImpactPanel({ collection, selection }: { collection: string; selection: ImpactSelection }) {
  const { config } = useConfig()
  const { code: locale } = useLocale()
  const { i18n } = useTranslation()
  const chinese = i18n.language.startsWith('zh')
  const text = (zh: string, en: string) => chinese ? zh : en
  const [expanded, setExpanded] = useState(false)
  const [check, setCheck] = useState<CheckState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestBody = JSON.stringify({ collection, selection, locale })
  const apiRoute = config.routes.api
  const language = i18n.language
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
        const response = await fetch(formatAdminURL({ apiRoute, path: '/content-trash-impact' }), {
          method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
          body: requestBody,
        })
        if (!response.ok) throw new Error('Impact check failed')
        const result = await response.json() as ImpactReport
        if (!controller.signal.aborted) setCheck({ key: requestKey, status: 'ready', report: result })
      } catch {
        if (!controller.signal.aborted) setCheck({ key: requestKey, status: 'error' })
      }
    })()
    return () => controller.abort()
  }, [apiRoute, attempt, expanded, language, requestBody, requestKey])

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => setExpanded(event.currentTarget.open)
  const collectionLabel = (slug: string) => {
    const source = config.collections.find((item) => item.slug === slug)
    return source ? getTranslation(source.labels.singular, i18n) : slug
  }

  return <details className="trash-impact" onToggle={onToggle}>
    <summary className="trash-impact__heading">
      {text('移入回收站前的直接引用', 'Direct references before moving to trash')}
    </summary>
    <div className="trash-impact__body" aria-busy={loading}>
      <p className="trash-impact__scope">
        {text('检查最近保存的草稿和当前已发布内容中的直接引用。未保存的修改、间接引用和已保存的发布快照不在本次检查范围内。',
          'Checks direct references in the latest saved drafts and current published content. Unsaved changes, indirect references and saved release snapshots are outside this check.')}
      </p>
      <p className="trash-impact__scope">
        {text('网址检查支持以 / 开头的站内链接；绝对网址需先在站点设置中填写官网正式地址。',
          'URL checks include site links starting with /. Set the website URL in Site Settings to check absolute URLs.')}
      </p>
      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="trash-impact__status">{text('正在检查引用…', 'Checking references…')}</p>}
        {current?.status === 'error' && <div className="trash-impact__error">
          <p>{text('引用检查失败。请重试后再确认影响范围。', 'The reference check failed. Retry to review the affected content.')}</p>
          <Button type="button" buttonStyle="secondary" size="small" margin={false} onClick={() => setAttempt((value) => value + 1)}>
            {text('重新检查', 'Retry check')}
          </Button>
        </div>}
        {report && <p className="trash-impact__status">
          {text(`已检查 ${report.targetCount} 条内容，发现 ${report.totalReferences} 条内容直接引用。`,
            `Items checked: ${report.targetCount}; directly referencing records: ${report.totalReferences}.`)}
        </p>}
      </div>
      {report && <>
        {report.totalReferences === 0 && <p>
          {text('本次检查未发现直接引用。请同时核对手动填写的网址链接。',
            'No direct references were found in this check. Also review any manually entered URL links.')}
        </p>}
        {report.references.length > 0 && <ul className="trash-impact__references">
          {report.references.map((reference) => <li key={`${reference.collection}:${reference.id}`}>
            <a className="trash-impact__record" href={formatAdminURL({
              adminRoute: config.routes.admin,
              path: `/collections/${encodeURIComponent(reference.collection)}/${encodeURIComponent(reference.id)}?locale=${encodeURIComponent(locale)}`,
            })}>{reference.title}</a>
            <p className="trash-impact__meta">
              <span>{collectionLabel(reference.collection)}</span>
              <span>{reference.states.map((state) => state === 'published'
                ? text('已发布', 'Published') : text('草稿', 'Draft')).join(' / ')}</span>
            </p>
            <p className="trash-impact__fields">
              {text('引用字段：', 'Referenced in: ')}{reference.fields.map((field) => field.label).join(text('、', ', '))}
            </p>
          </li>)}
        </ul>}
        {report.totalReferences > report.references.length && <p>
          {text(`当前显示 ${report.references.length} / ${report.totalReferences} 条引用内容（最多显示 ${report.displayLimit} 条）。`,
            `Showing ${report.references.length} of ${report.totalReferences} referring records (up to ${report.displayLimit}).`)}
        </p>}
        <div className="trash-impact__refresh">
          <p>
            {text('检查时间：', 'Checked: ')}
            <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString(language)}</time>
            {text('。更新关联后请重新检查。', '. Check again after updating relationships.')}
          </p>
          <Button type="button" buttonStyle="secondary" size="small" margin={false}
            onClick={() => setAttempt((value) => value + 1)}>{text('重新检查', 'Refresh check')}</Button>
        </div>
      </>}
    </div>
  </details>
}

export function DocumentTrashImpact() {
  const { id, collectionSlug, isTrashed, hasTrashPermission } = useDocumentInfo()
  if (!id || !collectionSlug || isTrashed || !hasTrashPermission) return null
  return <TrashImpactPanel collection={collectionSlug} selection={{ mode: 'ids', ids: [id] }} />
}

export function ListTrashImpact({ collectionSlug, hasTrashPermission }: BeforeListTableClientProps) {
  const { count, selectAll, selectedIDs } = useSelection()
  const { query } = useListQuery()
  const pathname = usePathname()
  const trashPath = `/collections/${encodeURIComponent(collectionSlug)}/trash`
  const inTrash = query.trash === true || query.trash === 'true' || pathname?.endsWith(trashPath)
  if (!hasTrashPermission || !count || inTrash) return null
  const selection: ImpactSelection = selectAll === 'allAvailable'
    ? { mode: 'query', where: query.where, search: query.search }
    : { mode: 'ids', ids: selectedIDs }
  return <TrashImpactPanel collection={collectionSlug} selection={selection} />
}
