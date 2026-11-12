'use client'

import { useTranslation } from '@payloadcms/ui'
import { copy } from '../i18n/shared'

export default function CanvasLink() {
  const { i18n } = useTranslation()
  const language = i18n.language
  return <section style={{ margin: '0 0 28px', padding: '20px 24px', border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)' }}>
    <h2 style={{ marginTop: 0 }}>{copy(language, 'Visual page canvas', '可视化页面画布')}</h2>
    <p>{copy(language, 'Drag content blocks, edit their properties and preview desktop or mobile pages.', '拖拽页面区块、编辑内容，并预览桌面和手机效果。')}</p>
    <p>{copy(language, 'Interface language and content language are separate. Select the content language at the top of each editing page.', '界面语言与内容语言分别设置。编辑产品或文章时，请在编辑页顶部选择中文或英文内容。')}</p>
    <a href="/canvas" style={{ display: 'inline-block', padding: '10px 16px', background: 'var(--theme-success-500)', color: 'var(--theme-elevation-0)', textDecoration: 'none' }}>{copy(language, 'Open visual canvas', '打开页面画布')}</a>
  </section>
}
