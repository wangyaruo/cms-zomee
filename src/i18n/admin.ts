import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { label } from './shared'

const fields: Record<string, string> = {
  name: '名称', title: '标题', slug: '网址标识', sku: '产品编号（SKU）', summary: '简介',
  description: '详细描述', image: '图片', gallery: '产品图库', categories: '产品分类',
  specs: '产品规格', label: '显示文字', value: '值', options: '选项组', key: '标识',
  choices: '可选项', note: '备注', customInquiry: '需要定制询价', heroTitle: '首屏标题',
  heroIntro: '首屏介绍', quoteLabel: '询价按钮文字', dielineLabel: '刀模按钮文字',
  detailTitle: '详情标题', detailParagraphs: '详情段落', badges: '标签', tone: '样式',
  galleryDetails: '图库说明', assurance: '服务保障', icon: '图标', highlights: '产品亮点',
  customOptionsTitle: '定制选项标题', customOptionsIntro: '定制选项介绍', customOptions: '定制选项',
  featureCard: '结构说明', body: '正文', diagram: '结构图', items: '条目', compliance: '合规信息',
  capabilities: '服务能力', closingCta: '底部行动引导', secondaryLabel: '次要按钮文字',
  secondaryRequest: '次要按钮请求标识', documents: '关联文件', relatedProducts: '相关产品',
  faqs: '常见问题', sourceData: '原始数据', contentStatus: '内容完整度', sortOrder: '排序',
  intro: '介绍', heroImage: '主图', parent: '上级分类', seo: '搜索优化（SEO）',
  robots: '搜索收录', excerpt: '摘要', topic: '主题', author: '作者', publishedAt: '发布日期',
  modifiedAt: '修订日期', featured: '推荐文章', tags: '标签', tag: '标签文字',
  stableKey: '固定标识', question: '问题', answer: '回答', products: '关联产品',
  category: '分类', displayLocations: '显示位置', relatedPosts: '相关文章', reviewedAt: '审核日期',
  alt: '图片替代文字', caption: '图片说明', credit: '来源或署名', sourcePath: '来源路径',
  role: '角色', contentHash: '内容校验值', counts: '内容数量', snapshot: '内容快照',
  createdBy: '创建人', layout: '页面布局', canvasUrl: '画布地址', applications: '关联应用场景',
  kind: '资源类型', href: '链接地址', order: '排序', children: '子菜单', revision: '修订日期',
  path: '页面路径', pageType: '页面类型', sections: '页面区块', linkLabel: '链接文字',
  linkHref: '链接地址', locale: '文件语言', resource: '所属资源', documentType: '文件类型',
  dieline: '刀模信息', preview: '预览图', dimensions: '尺寸', unit: '单位', format: '文件格式',
  version: '版本号', lastUpdated: '更新日期', usageNotes: '使用说明', usage: '用途',
  confirmedForPublication: '已确认可以公开发布', projectReference: '内部项目或询盘编号',
  companyName: '公司名称', email: '邮箱', phone: '联系电话', whatsapp: 'WhatsApp', logo: '公司标志',
  wechatQrImage: '微信二维码', inquiryEndpoint: '询盘接口地址', canonicalBaseUrl: '官网正式地址',
  defaultSeo: '默认搜索优化', defaultShareImage: '默认分享图片', socialLinks: '社交链接', url: '网址',
}

const englishNames: Record<string, string> = {
  sku: 'SKU', seo: 'SEO', faqs: 'FAQs', alt: 'Alternative text', href: 'Link URL',
  sourceData: 'Original data', locale: 'File language', robots: 'Search indexing',
}

const phrases: Record<string, string> = {
  Content: '内容管理', Administration: '系统管理', System: '内部资料', Product: '产品信息',
  'PDP Content': '产品详情内容', Relationships: '关联内容', SEO: '搜索优化（SEO）',
  Specification: '规格', Specifications: '产品规格', 'Option group': '选项组', 'Option groups': '选项组',
  'Editable section': '可编辑区块', 'Editable sections': '可编辑区块', 'Site Settings': '站点设置',
  Administrator: '管理员', Reviewer: '审核员', Editor: '编辑',
  'Incomplete source data': '资料待完善', 'Ready for review': '待审核', 'Legacy demo': '历史演示内容',
  'Index, follow': '允许搜索引擎收录', 'Noindex, follow': '不允许搜索引擎收录',
  'Checklist / public document': '清单或公开文件', 'Downloadable dieline': '可下载刀模',
  'Stable URL identifier. Use lowercase letters, numbers and hyphens.': '稳定的网址标识，只能使用小写英文字母、数字和连字符。',
  'Source SKUs are indexed but not forced unique; legacy duplicates are preserved.': '产品编号用于检索；保留原站已有的重复编号，不强制唯一。',
  'One paragraph per line.': '每行填写一个段落。',
  'Unmapped original PDP fields retained for the frontend adapter.': '保留尚未映射的原站产品详情数据，供官网读取。',
  'Original editorial modules retained for the frontend adapter.': '保留原站文章模块数据，供官网读取。',
  'Permanent ID used by FAQ schema and product references.': '用于常见问题结构化数据与产品关联的固定标识。',
  'Only set after the answer has actually been reviewed.': '确认回答已经审核后，再填写审核日期。',
  'Original asset path used for idempotent migration.': '原站文件路径，用于避免重复导入。',
  'Stable dataset path, for example homeSystem.packagingSystemIntro or qualityFramework.0.': '区块的固定数据路径，例如 homeSystem.packagingSystemIntro 或 qualityFramework.0。',
  'Complete structured page datasets retained for lossless frontend integration.': '保留完整的原站页面数据，供官网读取。',
  'Complete legal sections, paragraphs, lists and contact data.': '保留完整的法律条款、段落、列表与联系方式。',
  'Complete original application structure retained for lossless frontend rendering.': '保留完整的原站应用场景数据，供官网渲染。',
  'Complete original solution structure retained for lossless frontend rendering.': '保留完整的原站解决方案数据，供官网渲染。',
  'Complete original resource structure retained for lossless frontend rendering.': '保留完整的原站资源数据，供官网渲染。',
  'Internal project or inquiry reference. Never included in public snapshots.': '内部项目或询盘编号，不会出现在公开内容快照中。',
  'Leave empty until the actual production domain is confirmed.': '正式域名确定前请留空。',
}

const options: Record<string, string> = {
  index: '允许收录', noindex: '不允许收录', admin: '管理员', reviewer: '审核员', editor: '编辑',
  incomplete: '资料待完善', ready: '待审核', demo: '演示内容', products: '产品', customization: '定制',
  compliance: '合规', quality: '质量', pricing: '价格', production: '生产', shipping: '物流', ordering: '下单',
  home: '首页', category: '分类页', product: '产品页', application: '应用场景', solution: '解决方案',
  about: '关于我们', blog: '博客', resources: '资源中心', library: '问题库', materials: '材料',
  design: '设计', 'buyers-guides': '采购指南', sourcing: '采购', guide: '指南', checklist: '清单',
  dielines: '刀模', finder: '包装选型', download: '下载', contact: '联系我们', company: '公司介绍',
  process: '项目流程', dieline: '刀模', 'flexible-pouches': '软包装袋', 'boxes-cartons': '纸盒与纸箱',
  'labels-sleeves': '标签与套标', 'other-formats': '其他形式', reference: '参考用途',
  'production-version': '生产版本', en: '英文', zh: '中文', mm: '毫米（mm）', cm: '厘米（cm）', in: '英寸（in）',
}

const englishOptions: Record<string, string> = {
  en: 'English', zh: 'Chinese', mm: 'Millimeters (mm)', cm: 'Centimeters (cm)', in: 'Inches (in)',
}

const collections: Record<string, [string, string, string, string]> = {
  users: ['User', 'Users', '用户', '用户'], media: ['Media file', 'Media', '媒体文件', '媒体库'],
  categories: ['Category', 'Categories', '产品分类', '产品分类'], products: ['Product', 'Products', '产品', '产品'],
  posts: ['Blog post', 'Blog posts', '博客文章', '博客文章'], faqs: ['FAQ', 'FAQs', '常见问题', '常见问题'],
  releases: ['Release', 'Releases', '发布版本', '发布版本'], pages: ['Visual page', 'Visual pages', '可视化页面', '可视化页面'],
  applications: ['Application', 'Applications', '应用场景', '应用场景'], solutions: ['Solution', 'Solutions', '解决方案', '解决方案'],
  resources: ['Resource', 'Resources', '资源', '资源中心'], 'navigation-menus': ['Navigation menu', 'Navigation menus', '导航菜单', '导航菜单'],
  'legal-pages': ['Legal page', 'Legal pages', '法律条款', '法律条款'], 'site-pages': ['Site page', 'Site pages', '固定页面', '固定页面'],
  documents: ['Public document', 'Public documents', '公开文件', '公开文件'],
  'private-documents': ['Private document', 'Private documents', '私有文件', '私有文件'],
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase())
}

function translate<T>(value: T): T | { en: string; zh: string } {
  return typeof value === 'string' && phrases[value] ? label(value, phrases[value]) : value
}

/** Localize presentation metadata only; field names, stored values and schema stay intact. */
export function localizeFields(input: Field[]): Field[] {
  return input.map((field): Field => {
    const result = { ...field }
    if ('name' in result && result.name && result.label !== false) {
      result.label = result.label ? translate(result.label) : label(englishNames[result.name] || humanize(result.name), fields[result.name] || humanize(result.name))
    } else if ('label' in result) result.label = translate(result.label)
    if (result.admin && 'description' in result.admin && result.admin.description) {
      result.admin = { ...result.admin, description: translate(result.admin.description) }
    }
    if ('fields' in result) result.fields = localizeFields(result.fields)
    if (result.type === 'tabs') {
      result.tabs = result.tabs.map((tab) => {
        const localizedTab = { ...tab }
        localizedTab.fields = localizeFields(tab.fields)
        if (localizedTab.label) localizedTab.label = translate(localizedTab.label)
        return localizedTab
      })
    }
    if (result.type === 'array' && result.labels) {
      result.labels = { singular: translate(result.labels.singular), plural: translate(result.labels.plural) }
    }
    if (result.type === 'select' || result.type === 'radio') {
      result.options = result.options.map((option) => {
        if (typeof option !== 'string') return { ...option, label: translate(option.label) }
        return { value: option, label: label(englishOptions[option] || humanize(option), options[option] || option) }
      })
    }
    return result
  })
}

export function localizeCollection(config: CollectionConfig): CollectionConfig {
  const names = collections[config.slug]
  return {
    ...config,
    ...(names ? { labels: { singular: label(names[0], names[2]), plural: label(names[1], names[3]) } } : {}),
    admin: { ...config.admin, group: translate(config.admin?.group) },
    fields: localizeFields(config.fields),
  }
}

export function localizeGlobal(config: GlobalConfig): GlobalConfig {
  return { ...config, label: translate(config.label), admin: { ...config.admin, group: translate(config.admin?.group) }, fields: localizeFields(config.fields) }
}
