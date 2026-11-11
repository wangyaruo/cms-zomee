import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { richTextFromEditorial, richTextFromFaqBlocks, richTextFromParagraphs } from '../src/lib/lexical'

const sourceFile = path.resolve(process.env.ORIGINAL_CONTENT_FILE || 'import/original-content.json')
const publicDir = path.resolve(process.env.ORIGINAL_PUBLIC_DIR || '../public')
const overwrite = process.argv.includes('--overwrite')
const source = JSON.parse(await readFile(sourceFile, 'utf8'))
const payload = await getPayload({ config })
const admins = await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 1, overrideAccess: true })
const admin = admins.docs[0]
if (!admin) throw new Error('Run npm run seed before importing content.')

const stats = { created: 0, skipped: 0, updated: 0, media: 0 }
const mediaIds = new Map<string, string | number>()
const categoryIds = new Map<string, string | number>()
const productIds = new Map<string, string | number>()
const faqIds = new Map<string, string | number>()
const applicationIds = new Map<string, string | number>()
const supportedImage = /\.(jpe?g|png|webp|avif)$/i
const requiredImages = new Set<string>([
  ...source.products.map((item: any) => item.image),
  ...source.posts.map((item: any) => item.image),
])
const missing = [...requiredImages].filter((src) => !supportedImage.test(src) || !existsSync(path.join(publicDir, src)))
if (missing.length) throw new Error(`Missing or unsupported required images:\n${missing.join('\n')}`)

async function findBy(collection: any, field: string, value: string) {
  const result = await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, locale: 'all', overrideAccess: true, user: admin, showHiddenFields: true })
  return result.docs[0]
}

async function upsert(collection: any, identityField: string, identity: string, data: any, translations?: any) {
  const existing = await findBy(collection, identityField, identity)
  if (existing && !overwrite) { stats.skipped++; return existing }
  const args: any = { collection, data, locale: 'en', overrideAccess: true, user: admin, depth: 0, draft: data._status !== 'published' }
  const doc: any = existing
    ? await payload.update({ ...args, id: existing.id })
    : await payload.create(args)
  if (translations) {
    await payload.update({ collection, id: doc.id, data: translations, locale: 'zh', overrideAccess: true, user: admin, depth: 0, draft: data._status !== 'published' })
  }
  if (existing) stats.updated++; else stats.created++
  return doc
}

async function importMedia(src: string, alt: string, altZh?: string) {
  if (mediaIds.has(src)) return mediaIds.get(src)!
  const existing = await findBy('media', 'sourcePath', src)
  if (existing) { mediaIds.set(src, existing.id); return existing.id }
  const doc = await payload.create({
    collection: 'media', data: { alt, sourcePath: src }, filePath: path.join(publicDir, src),
    locale: 'en', overrideAccess: true, user: admin,
  })
  if (altZh && altZh !== alt) await payload.update({ collection: 'media', id: doc.id, data: { alt: altZh }, locale: 'zh', overrideAccess: true, user: admin })
  mediaIds.set(src, doc.id)
  stats.media++
  if (stats.media % 25 === 0) console.log(`Imported ${stats.media} media assets…`)
  return doc.id
}

for (const category of source.categories.filter((item: any) => !item.parentSlug)) {
  const doc = await upsert('categories', 'slug', category.slug, {
    name: category.name, slug: category.slug, intro: category.intro || '', sortOrder: category.sortOrder,
    heroImage: category.heroImage ? await importMedia(category.heroImage, category.name, category.nameZh) : undefined,
    seo: { title: category.seoTitle || category.name, description: category.seoDescription || category.intro || '', robots: 'index' },
    _status: 'published',
  }, { name: category.nameZh, intro: category.introZh || '', seo: { title: category.seoTitleZh || category.nameZh, description: category.seoDescriptionZh || category.introZh || '', robots: 'index' } })
  categoryIds.set(category.slug, doc.id)
}
for (const category of source.categories.filter((item: any) => item.parentSlug)) {
  const doc = await upsert('categories', 'slug', category.slug, {
    name: category.name, slug: category.slug, parent: categoryIds.get(category.parentSlug), sortOrder: category.sortOrder,
    seo: { title: category.name, description: category.intro || '', robots: 'index' }, _status: 'published',
  }, { name: category.nameZh, seo: { title: category.nameZh, description: category.introZh || '', robots: 'index' } })
  categoryIds.set(category.slug, doc.id)
}
console.log(`Categories ready: ${categoryIds.size}`)

for (const faq of source.faqs) {
  const english = faq.answerBlocks?.length ? richTextFromFaqBlocks(faq.answerBlocks) : richTextFromParagraphs(faq.answer ? [faq.answer] : [])
  const chinese = faq.answerBlocksZh?.length ? richTextFromFaqBlocks(faq.answerBlocksZh) : richTextFromParagraphs(faq.answerZh ? [faq.answerZh] : [])
  const publish = faq.status === 'published' && Boolean(faq.answer)
  const doc = await upsert('faqs', 'stableKey', faq.id, {
    stableKey: faq.id, question: faq.question, answer: english, sortOrder: faq.sortOrder || 0,
    category: faq.category || 'products', displayLocations: faq.displayLocations || ['library'],
    reviewedAt: faq.lastReviewed || undefined, _status: publish ? 'published' : 'draft',
  }, { question: faq.questionZh || faq.question, answer: chinese })
  faqIds.set(faq.id, doc.id)
}
console.log(`FAQs ready: ${faqIds.size}`)

for (const product of source.products) {
  const indexable = !product.demo && !product.placeholder && product.catalogEntry?.status !== 'pending'
  const status = product.catalogEntry?.status === 'pending' ? 'incomplete' : product.demo ? 'demo' : 'ready'
  const gallery = []
  for (const src of product.gallery ?? []) {
    if (supportedImage.test(src) && existsSync(path.join(publicDir, src))) gallery.push(await importMedia(src, product.name, product.nameZh))
  }
  const doc = await upsert('products', 'slug', product.slug, {
    name: product.name, slug: product.slug, sku: product.sku || undefined,
    summary: product.description || '', description: richTextFromParagraphs(product.description ? [product.description] : []),
    image: await importMedia(product.image, product.name, product.nameZh), gallery,
    categories: (product.categories ?? []).map((slug: string) => categoryIds.get(slug)).filter(Boolean),
    specs: (product.specs ?? []).map((spec: any) => ({ label: spec.label, value: spec.value })),
    options: (product.optionGroups ?? []).map((group: any) => ({
      key: group.id, label: group.label,
      choices: (group.choices ?? []).map((choice: any) => ({ value: choice.value, label: choice.value, note: choice.note || '', customInquiry: Boolean(choice.custom) })),
    })),
    faqs: (product.productFaqs ?? []).map((faq: any) => faqIds.get(faq.id)).filter(Boolean),
    seo: { title: product.seoTitle, description: product.seoDescription, robots: indexable ? 'index' : 'noindex' },
    contentStatus: status, sourceData: product, _status: 'published',
  }, {
    name: product.nameZh || product.name, summary: product.descriptionZh || product.description || '',
    description: richTextFromParagraphs(product.descriptionZh ? [product.descriptionZh] : []),
    specs: (product.specs ?? []).map((spec: any) => ({ label: spec.labelZh || spec.label, value: spec.valueZh || spec.value })),
    options: (product.optionGroups ?? []).map((group: any) => ({
      key: group.id, label: group.labelZh || group.label,
      choices: (group.choices ?? []).map((choice: any) => ({ value: choice.value, label: choice.valueZh || choice.value, note: choice.noteZh || choice.note || '', customInquiry: Boolean(choice.custom) })),
    })),
    seo: { title: product.seoTitleZh || product.seoTitle, description: product.seoDescriptionZh || product.seoDescription, robots: indexable ? 'index' : 'noindex' },
  })
  productIds.set(product.slug, doc.id)
}
console.log(`Products ready: ${productIds.size}`)

for (const product of source.products) {
  const relatedProducts = (product.relatedSlugs ?? []).map((slug: string) => productIds.get(slug)).filter(Boolean)
  if (!relatedProducts.length) continue
  const options = (product.optionGroups ?? []).map((group: any) => ({
    key: group.id, label: group.label,
    choices: (group.choices ?? []).map((choice: any) => ({ value: choice.value, label: choice.value, note: choice.note || '', customInquiry: Boolean(choice.custom) })),
  }))
  const specs = (product.specs ?? []).map((spec: any) => ({ label: spec.label, value: spec.value }))
  await payload.update({ collection: 'products', id: productIds.get(product.slug)!, data: { relatedProducts, options, specs }, locale: 'en', overrideAccess: true, user: admin, draft: false })
}
for (const faq of source.faqs) {
  const productsForFaq = (faq.relatedProductSlugs ?? []).map((slug: string) => productIds.get(slug)).filter(Boolean)
  if (!productsForFaq.length) continue
  await payload.update({ collection: 'faqs', id: faqIds.get(faq.id)!, data: { products: productsForFaq }, locale: 'en', overrideAccess: true, user: admin, draft: faq.status !== 'published' })
}

for (const post of source.posts) {
  await upsert('posts', 'slug', post.slug, {
    title: post.title, slug: post.slug, excerpt: post.excerpt,
    body: richTextFromEditorial(post.editorial, 'en'), topic: post.topic, author: post.editorial.author.name,
    publishedAt: post.date, modifiedAt: post.modifiedDate || undefined,
    image: await importMedia(post.image, post.title, post.titleZh), featured: Boolean(post.featured),
    tags: (post.tags ?? []).map((tag: string) => ({ tag })),
    relatedProducts: (post.editorial.relatedProducts ?? []).map((item: any) => productIds.get(item.slug)).filter(Boolean),
    seo: { title: post.title, description: post.excerpt, robots: post.editorial.status === 'published' ? 'index' : 'noindex' },
    sourceData: post, _status: 'published',
  }, {
    title: post.titleZh, excerpt: post.excerptZh, body: richTextFromEditorial(post.editorial, 'zh'),
    tags: (post.tagsZh ?? []).map((tag: string) => ({ tag })),
    seo: { title: post.titleZh, description: post.excerptZh, robots: post.editorial.status === 'published' ? 'index' : 'noindex' },
  })
}

for (const item of source.applications ?? []) {
  const doc = await upsert('applications', 'slug', item.slug, {
    title: item.title.en, slug: item.slug, summary: item.description.en, heroImage: item.image ? await importMedia(item.image, item.title.en, item.title.zh) : undefined,
    products: (item.products ?? []).map((entry: any) => productIds.get(entry.productSlug)).filter(Boolean),
    faqs: (item.faqIds ?? []).map((id: string) => faqIds.get(id)).filter(Boolean),
    seo: { title: item.title.en, description: item.description.en, robots: 'index' }, sourceData: item, _status: 'published',
  }, { title: item.title.zh, summary: item.description.zh, seo: { title: item.title.zh, description: item.description.zh, robots: 'index' } })
  applicationIds.set(item.slug, doc.id)
}

for (const item of source.solutions ?? []) {
  await upsert('solutions', 'slug', item.slug, {
    title: item.h1.en, slug: item.slug, summary: item.summary.en, heroImage: item.image ? await importMedia(item.image, item.h1.en, item.h1.zh) : undefined,
    products: (item.productSlugs ?? []).map((slug: string) => productIds.get(slug)).filter(Boolean),
    applications: (item.applicationSlugs ?? []).map((slug: string) => applicationIds.get(slug)).filter(Boolean),
    seo: { title: item.seoTitle.en, description: item.metaDescription.en, robots: 'index' }, sourceData: item, _status: 'published',
  }, { title: item.h1.zh, summary: item.summary.zh, seo: { title: item.seoTitle.zh, description: item.metaDescription.zh, robots: 'index' } })
}

for (const item of source.resources ?? []) {
  const hero = item.sourceData.artworkImages?.hero || item.sourceData.materialImages?.hero
  await upsert('resources', 'slug', item.slug, {
    title: item.title.en, slug: item.slug, summary: item.summary.en, kind: item.kind,
    heroImage: hero ? await importMedia(hero, item.title.en, item.title.zh) : undefined,
    seo: { title: item.title.en, description: item.summary.en, robots: 'index' }, sourceData: item.sourceData, _status: 'published',
  }, { title: item.title.zh, summary: item.summary.zh, seo: { title: item.title.zh, description: item.summary.zh, robots: 'index' } })
}

for (const menu of source.navigationMenus ?? []) {
  const localizeItems = (locale: 'en' | 'zh') => menu.items.map((item: any) => ({
    ...item, label: item.label[locale], children: (item.children ?? []).map((child: any) => ({ ...child, label: child.label[locale] })),
  }))
  await upsert('navigation-menus', 'slug', menu.slug,
    { name: menu.name, slug: menu.slug, items: localizeItems('en'), _status: 'published' },
    { items: localizeItems('zh') })
}

for (const document of source.legalPages ?? []) {
  await upsert('legal-pages', 'slug', document.slug, {
    title: document.title.en, slug: document.slug, revision: document.revision, intro: document.intro.en,
    seo: { title: document.title.en, description: document.intro.en, robots: 'index' }, sourceData: document, _status: 'published',
  }, { title: document.title.zh, intro: document.intro.zh, seo: { title: document.title.zh, description: document.intro.zh, robots: 'index' } })
}

await payload.updateGlobal({
  slug: 'site-settings', overrideAccess: true, user: admin,
  data: { companyName: source.siteSettings.companyName, email: source.siteSettings.email,
    phone: source.siteSettings.phone, whatsapp: source.siteSettings.phone, inquiryEndpoint: '/api/inquiry' },
})

for (const faq of source.faqs) {
  const id = faqIds.get(faq.id)
  if (!id) continue
  await payload.update({
    collection: 'faqs', id, overrideAccess: true, user: admin, draft: false,
    data: { products: (faq.relatedProductSlugs ?? []).map((slug: string) => productIds.get(slug)).filter(Boolean) },
  })
}

console.log(`Import complete: ${JSON.stringify(stats)}`)
process.exit(0)
