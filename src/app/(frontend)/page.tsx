import Link from 'next/link'
import { getInterfaceLanguage } from '../../i18n/server'
import { copy } from '../../i18n/shared'
import { InterfaceLanguageSwitcher } from '../../components/InterfaceLanguageProvider'

export default async function HomePage() {
  const language = await getInterfaceLanguage()
  return (
    <main className="shell">
      <InterfaceLanguageSwitcher />
      <h1>{copy(language, 'Manage your website content.', '管理官网的每一份内容。')}</h1>
      <p className="intro">{copy(language, 'Manage products, categories, articles, FAQs and media. Review drafts before anything reaches the public website.', '统一管理产品、分类、文章、常见问题和媒体文件。先保存草稿，再由审核人员确认发布。')}</p>
      <div className="actions">
        <Link className="primary" href="/admin">{copy(language, 'Open CMS dashboard', '进入内容管理后台')}</Link>
        <a className="secondary" href="/api/snapshot">{copy(language, 'Content snapshot API', '内容快照接口')} <small>{copy(language, 'Server token required', '需要服务端令牌')}</small></a>
      </div>
      <section className="status" aria-label={copy(language, 'CMS capabilities', '后台功能')}>
        <article><h2>{copy(language, 'Structured content', '结构化内容')}</h2><p>{copy(language, 'Edit content in clearly labeled forms.', '通过清晰的表单字段编辑内容。')}</p></article>
        <article><h2>{copy(language, 'Drafts and roles', '草稿与审核')}</h2><p>{copy(language, 'Editors prepare content. Reviewers control publication.', '编辑准备内容，审核员确认发布。')}</p></article>
        <article><h2>{copy(language, '17 content languages', '17 种内容语言')}</h2><p>{copy(language, 'Choose the language of each product or article separately from your interface language.', '独立选择产品或文章的内容语言，与后台界面语言互不影响。')}</p></article>
      </section>
    </main>
  )
}
