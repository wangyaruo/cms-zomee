import type { Config, Field } from '@measured/puck'
import type { CSSProperties, ReactNode } from 'react'
import type { InterfaceLanguage } from '../i18n/shared'

const text = (label: string) => ({ type: 'text' as const, label })
const textarea = (label: string) => ({ type: 'textarea' as const, label })
const link = (label = 'Link URL') => ({ type: 'text' as const, label, placeholder: '/contact' })
const button = (label = 'Button', href = '/contact') => <a className="canvas-button" href={href}>{label}</a>

export type CanvasProps = {
  Hero: { title: string; body: string; image: string; label: string; href: string; align: 'left' | 'center' }
  RichText: { title: string; body: string }
  ProductCards: { title: string; items: { name: string; image: string; href: string }[] }
  FeatureGrid: { title: string; items: { title: string; body: string }[] }
  Media: { image: string; alt: string; caption: string }
  Faq: { title: string; items: { question: string; answer: string }[] }
  Cta: { title: string; body: string; label: string; href: string }
  Spacer: { height: number }
}

export const emptyLayout = { content: [], root: { props: { title: 'Untitled page' } } }

export const canvasConfig: Config<CanvasProps> = {
  components: {
    Hero: {
      label: 'Hero',
      defaultProps: { title: 'Packaging built around your product', body: 'Coordinate structure, materials, artwork and production in one project.', image: '', label: 'Discuss your project', href: '/contact', align: 'left' },
      fields: { title: text('Title'), body: textarea('Body'), image: text('Image URL'), label: text('Button label'), href: link(), align: { type: 'select', label: 'Alignment', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] } },
      render: ({ title, body, image, label, href, align }) => <section className={`canvas-hero canvas-align-${align}`}><div><p className="canvas-eyebrow">ZOMEEX PACKAGING</p><h1>{title}</h1><p>{body}</p>{button(label, href)}</div>{image && <img src={image} alt="" />}</section>,
    },
    RichText: {
      label: 'Rich text', defaultProps: { title: 'Section title', body: 'Add the information your customer needs here.' },
      fields: { title: text('Title'), body: textarea('Body') },
      render: ({ title, body }) => <section className="canvas-section canvas-narrow"><h2>{title}</h2>{body.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>,
    },
    ProductCards: {
      label: 'Product cards', defaultProps: { title: 'Packaging options', items: [{ name: 'Product name', image: '', href: '/products' }] },
      fields: { title: text('Title'), items: { type: 'array', getItemSummary: (item: any) => item.name || 'Product', arrayFields: { name: text('Product name'), image: text('Image URL'), href: link('Product URL') } } },
      render: ({ title, items }) => <section className="canvas-section"><h2>{title}</h2><div className="canvas-card-grid">{items.map((item, index) => <a className="canvas-product-card" href={item.href} key={index}>{item.image ? <img src={item.image} alt="" /> : <div className="canvas-image-placeholder">PRODUCT IMAGE</div>}<h3>{item.name}</h3><span>View product →</span></a>)}</div></section>,
    },
    FeatureGrid: {
      label: 'Feature grid', defaultProps: { title: 'Project support', items: [{ title: 'Structure', body: 'Review fit and product protection.' }, { title: 'Artwork', body: 'Coordinate print and finishing.' }, { title: 'Production', body: 'Confirm agreed project checkpoints.' }] },
      fields: { title: text('Title'), items: { type: 'array', getItemSummary: (item: any) => item.title || 'Feature', arrayFields: { title: text('Feature title'), body: textarea('Feature body') } } },
      render: ({ title, items }) => <section className="canvas-section canvas-tint"><h2>{title}</h2><div className="canvas-feature-grid">{items.map((item, index) => <article key={index}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>,
    },
    Media: {
      label: 'Media', defaultProps: { image: '', alt: 'Packaging reference', caption: '' },
      fields: { image: text('Image URL'), alt: text('Alternative text'), caption: text('Caption') },
      render: ({ image, alt, caption }) => <figure className="canvas-media">{image ? <img src={image} alt={alt} /> : <div className="canvas-image-placeholder">MEDIA</div>}{caption && <figcaption>{caption}</figcaption>}</figure>,
    },
    Faq: {
      label: 'FAQ', defaultProps: { title: 'Frequently asked questions', items: [{ question: 'What information is needed?', answer: 'Share product dimensions, artwork, quantity and target market.' }] },
      fields: { title: text('Title'), items: { type: 'array', getItemSummary: (item: any) => item.question || 'Question', arrayFields: { question: text('Question'), answer: textarea('Answer') } } },
      render: ({ title, items }) => <section className="canvas-section canvas-narrow"><h2>{title}</h2>{items.map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>,
    },
    Cta: {
      label: 'Call to action', defaultProps: { title: 'Start your packaging project', body: 'Tell us about your product and project requirements.', label: 'Request a quote', href: '/contact' },
      fields: { title: text('Title'), body: textarea('Body'), label: text('Button label'), href: link() },
      render: ({ title, body, label, href }) => <section className="canvas-cta"><h2>{title}</h2><p>{body}</p>{button(label, href)}</section>,
    },
    Spacer: {
      label: 'Spacer', defaultProps: { height: 48 }, fields: { height: { type: 'number', label: 'Height (px)', min: 8, max: 240 } },
      render: ({ height }) => <div style={{ height } as CSSProperties} aria-hidden="true" />,
    },
  },
}

const editorLabels: Record<string, string> = {
  Hero: '首屏区块', 'Rich text': '文本区块', 'Product cards': '产品卡片', 'Feature grid': '特色网格',
  Media: '图片区块', FAQ: '常见问题', 'Call to action': '行动引导', Spacer: '留白',
  Title: '标题', Body: '正文', 'Image URL': '图片地址', 'Button label': '按钮文字', 'Link URL': '链接地址',
  Alignment: '对齐方式', Left: '左对齐', Center: '居中', Items: '条目', 'Product name': '产品名称',
  'Product URL': '产品链接', 'Feature title': '特色标题', 'Feature body': '特色说明',
  'Alternative text': '图片替代文字', Caption: '图片说明', Question: '问题', Answer: '回答',
  'Height (px)': '高度（像素）', Product: '产品', Feature: '特色',
}

/** Translate editor metadata without rewriting saved page copy. */
export function getCanvasConfig(language: InterfaceLanguage): Config<CanvasProps> {
  if (language === 'en') return canvasConfig
  const translate = (value: string) => editorLabels[value] || value
  const localize = (field: Field, name: string): Field => {
    const result = { ...field, label: translate(field.label || (name === 'items' ? 'Items' : name)) }
    if (result.type === 'array') {
      const summary = result.getItemSummary
      result.arrayFields = Object.fromEntries(Object.entries(result.arrayFields).map(([key, value]) => [key, localize(value, key)]))
      if (summary) result.getItemSummary = (item, index) => translate(summary(item, index))
    }
    if (result.type === 'select' || result.type === 'radio') result.options = result.options.map((option) => ({ ...option, label: translate(option.label) }))
    return result
  }
  return {
    ...canvasConfig,
    components: Object.fromEntries(Object.entries(canvasConfig.components).map(([key, component]) => [key, {
      ...component, label: translate(component.label || key),
      fields: Object.fromEntries(Object.entries(component.fields || {}).map(([name, field]) => [name, localize(field, name)])),
    }])) as Config<CanvasProps>['components'],
  }
}

export function CanvasShell({ children }: { children: ReactNode }) {
  return <main className="canvas-page">{children}</main>
}
