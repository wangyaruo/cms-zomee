import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { richTextFromEditorial, richTextFromFaqBlocks, richTextFromParagraphs } from '../src/lib/lexical'

const sourceFile = path.resolve(process.env.ORIGINAL_CONTENT_FILE || 'import/original-content.json')
const publicDir = path.resolve(process.env.ORIGINAL_PUBLIC_DIR || '../zomme-index/public')
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
const resourceIds = new Map<string, string | number>()
const supportedImage = /\.(jpe?g|png|webp|avif)$/i
const requiredImages = new Set<string>([
  ...source.products.map((item: any) => item.image),
  ...source.posts.map((item: any) => item.image),
])
const missing = [...requiredImages].filter((src) => !supportedImage.test(src) || !existsSync(path.join(publicDir, src)))
if (missing.length) throw new Error(`Missing or unsupported required images:\n${missing.join('\n')}`)

async function findBy(collection: any, field: string, value: string) {
  const result = await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, locale: 'all' as any, overrideAccess: true, user: admin, showHiddenFields: true })
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
  const galleryDetails: any[] = []
  for (const [index, detail] of (product.galleryDetails ?? []).entries()) {
    const src = product.gallery?.[index] || product.image
    galleryDetails.push({ title: detail.title, description: detail.description,
      image: supportedImage.test(src) ? await importMedia(src, detail.title || product.name, detail.titleZh || product.nameZh) : undefined })
  }
  const optionGroups: any[] = []
  for (const group of product.optionGroups ?? []) {
    const choices = []
    for (const choice of group.choices ?? []) {
      const src = choice.image || choice.src || choice.images?.[0]
      choices.push({ value: choice.value, label: choice.value, note: choice.note || '', customInquiry: Boolean(choice.custom),
        image: src && supportedImage.test(src) ? await importMedia(src, choice.value, choice.valueZh || choice.value) : undefined })
    }
    optionGroups.push({ key: group.id, label: group.label, choices })
  }
  const doc = await upsert('products', 'slug', product.slug, {
    name: product.name, slug: product.slug, sku: product.sku || undefined,
    summary: product.description || '', description: richTextFromParagraphs(product.description ? [product.description] : []),
    image: await importMedia(product.image, product.name, product.nameZh), gallery,
    categories: (product.categories ?? []).map((slug: string) => categoryIds.get(slug)).filter(Boolean),
    specs: (product.specs ?? []).map((spec: any) => ({ label: spec.label, value: spec.value })),
    options: optionGroups,
    heroTitle: product.heroTitle, heroIntro: product.heroIntro, quoteLabel: product.quoteLabel, dielineLabel: product.dielineLabel,
    detailTitle: product.detailTitle, detailParagraphs: (product.detailParagraphs ?? []).join('\n'), galleryDetails,
    badges: (product.badges ?? []).map((item: any) => ({ label: item.label, tone: item.tone })),
    assurance: (product.assurance ?? []).map((item: any) => ({ icon: item.icon, label: item.label })),
    highlights: (product.highlights ?? []).map((item: any) => ({ icon: item.icon, label: item.label })),
    customOptionsTitle: product.customOptionsTitle, customOptionsIntro: product.customOptionsIntro,
    customOptions: (product.customOptions ?? []).map((item: any) => ({ name: item.name, description: item.description })),
    featureCard: product.featureCard ? { title: product.featureCard.title, body: product.featureCard.body, diagram: product.featureCard.diagram,
      items: (product.featureCard.items ?? []).map((item: any) => ({ title: item.title, body: item.body })) } : undefined,
    compliance: product.compliance ? { title: product.compliance.title, body: product.compliance.body,
      capabilities: (product.compliance.capabilities ?? []).map((item: any) => ({ title: item.title, body: item.body })) } : undefined,
    closingCta: product.closingCta ? { title: product.closingCta.title, body: product.closingCta.body,
      quoteLabel: product.closingCta.quoteLabel, secondaryLabel: product.closingCta.secondaryLabel, secondaryRequest: product.closingCta.secondaryRequest } : undefined,
    faqs: (product.productFaqs ?? []).map((faq: any) => faqIds.get(faq.id)).filter(Boolean),
    seo: { title: product.seoTitle, description: product.seoDescription, robots: indexable ? 'index' : 'noindex' },
    contentStatus: status, sourceData: product, _status: 'published',
  }, {
    name: product.nameZh || product.name, summary: product.descriptionZh || product.description || '',
    description: richTextFromParagraphs(product.descriptionZh ? [product.descriptionZh] : []),
    specs: (product.specs ?? []).map((spec: any) => ({ label: spec.labelZh || spec.label, value: spec.valueZh || spec.value })),
    options: (product.optionGroups ?? []).map((group: any, groupIndex: number) => ({
      key: group.id, label: group.labelZh || group.label,
      choices: (group.choices ?? []).map((choice: any, choiceIndex: number) => ({ value: choice.value, label: choice.valueZh || choice.value,
        note: choice.noteZh || choice.note || '', customInquiry: Boolean(choice.custom), image: optionGroups[groupIndex]?.choices[choiceIndex]?.image })),
    })),
    heroTitle: product.heroTitleZh || product.heroTitle, heroIntro: product.heroIntroZh || product.heroIntro,
    quoteLabel: product.quoteLabelZh || product.quoteLabel, dielineLabel: product.dielineLabelZh || product.dielineLabel,
    detailTitle: product.detailTitleZh || product.detailTitle, detailParagraphs: (product.detailParagraphsZh ?? product.detailParagraphs ?? []).join('\n'),
    galleryDetails: (product.galleryDetails ?? []).map((item: any, index: number) => ({ title: item.titleZh || item.title, description: item.descriptionZh || item.description, image: galleryDetails[index]?.image })),
    badges: (product.badges ?? []).map((item: any) => ({ label: item.labelZh || item.label, tone: item.tone })),
    assurance: (product.assurance ?? []).map((item: any) => ({ icon: item.icon, label: item.labelZh || item.label })),
    highlights: (product.highlights ?? []).map((item: any) => ({ icon: item.icon, label: item.labelZh || item.label })),
    customOptionsTitle: product.customOptionsTitleZh || product.customOptionsTitle, customOptionsIntro: product.customOptionsIntroZh || product.customOptionsIntro,
    customOptions: (product.customOptions ?? []).map((item: any) => ({ name: item.nameZh || item.name, description: item.descriptionZh || item.description })),
    featureCard: product.featureCard ? { title: product.featureCard.titleZh || product.featureCard.title, body: product.featureCard.bodyZh || product.featureCard.body, diagram: product.featureCard.diagram,
      items: (product.featureCard.items ?? []).map((item: any) => ({ title: item.titleZh || item.title, body: item.bodyZh || item.body })) } : undefined,
    compliance: product.compliance ? { title: product.compliance.titleZh || product.compliance.title, body: product.compliance.bodyZh || product.compliance.body,
      capabilities: (product.compliance.capabilities ?? []).map((item: any) => ({ title: item.titleZh || item.title, body: item.bodyZh || item.body })) } : undefined,
    closingCta: product.closingCta ? { title: product.closingCta.titleZh || product.closingCta.title, body: product.closingCta.bodyZh || product.closingCta.body,
      quoteLabel: product.closingCta.quoteLabelZh || product.closingCta.quoteLabel, secondaryLabel: product.closingCta.secondaryLabelZh || product.closingCta.secondaryLabel, secondaryRequest: product.closingCta.secondaryRequest } : undefined,
    seo: { title: product.seoTitleZh || product.seoTitle, description: product.seoDescriptionZh || product.seoDescription, robots: indexable ? 'index' : 'noindex' },
  })
  const dual = (en: any, zh: any) => ({ en, zh: zh || en })
  await payload.update({ collection: 'products', id: doc.id, locale: 'all' as any, overrideAccess: true, user: admin,
    data: {
      specs: (product.specs ?? []).map((item: any) => ({ label: dual(item.label, item.labelZh), value: dual(item.value, item.valueZh) })),
      options: (product.optionGroups ?? []).map((group: any, groupIndex: number) => ({ key: group.id, label: dual(group.label, group.labelZh),
        choices: (group.choices ?? []).map((choice: any, choiceIndex: number) => ({ value: choice.value, label: dual(choice.value, choice.valueZh),
          note: dual(choice.note || '', choice.noteZh || choice.note || ''), customInquiry: Boolean(choice.custom), image: optionGroups[groupIndex]?.choices[choiceIndex]?.image })) })),
      badges: (product.badges ?? []).map((item: any) => ({ label: dual(item.label, item.labelZh), tone: item.tone })),
      galleryDetails: (product.galleryDetails ?? []).map((item: any, index: number) => ({ title: dual(item.title, item.titleZh), description: dual(item.description, item.descriptionZh), image: galleryDetails[index]?.image })),
      assurance: (product.assurance ?? []).map((item: any) => ({ icon: item.icon, label: dual(item.label, item.labelZh) })),
      highlights: (product.highlights ?? []).map((item: any) => ({ icon: item.icon, label: dual(item.label, item.labelZh) })),
      customOptions: (product.customOptions ?? []).map((item: any) => ({ name: dual(item.name, item.nameZh), description: dual(item.description, item.descriptionZh) })),
      featureCard: product.featureCard ? { title: dual(product.featureCard.title, product.featureCard.titleZh), body: dual(product.featureCard.body, product.featureCard.bodyZh), diagram: product.featureCard.diagram,
        items: (product.featureCard.items ?? []).map((item: any) => ({ title: dual(item.title, item.titleZh), body: dual(item.body, item.bodyZh) })) } : undefined,
      compliance: product.compliance ? { title: dual(product.compliance.title, product.compliance.titleZh), body: dual(product.compliance.body, product.compliance.bodyZh),
        capabilities: (product.compliance.capabilities ?? []).map((item: any) => ({ title: dual(item.title, item.titleZh), body: dual(item.body, item.bodyZh) })) } : undefined,
      closingCta: product.closingCta ? { title: dual(product.closingCta.title, product.closingCta.titleZh), body: dual(product.closingCta.body, product.closingCta.bodyZh),
        quoteLabel: dual(product.closingCta.quoteLabel, product.closingCta.quoteLabelZh), secondaryLabel: dual(product.closingCta.secondaryLabel, product.closingCta.secondaryLabelZh), secondaryRequest: product.closingCta.secondaryRequest } : undefined,
    } as any })
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
  const doc = await upsert('resources', 'slug', item.slug, {
    title: item.title.en, slug: item.slug, summary: item.summary.en, kind: item.kind,
    heroImage: hero ? await importMedia(hero, item.title.en, item.title.zh) : undefined,
    seo: { title: item.title.en, description: item.summary.en, robots: 'index' }, sourceData: item.sourceData, _status: 'published',
  }, { title: item.title.zh, summary: item.summary.zh, seo: { title: item.title.zh, description: item.summary.zh, robots: 'index' } })
  resourceIds.set(item.slug, doc.id)
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

const pageSectionPaths: Record<string, string[]> = {
  home: ['homeSystem.packagingSystemIntro', 'homeProcess.orderProcessIntro', 'homeDimensions.packagingGuidance'],
  about: ['aboutMedia.aboutImages.hero'],
  'quality-supplier': ['qualityFramework.0', 'qualityFramework.1', 'qualityFramework.2', 'qualityFramework.3', 'qualityFramework.4', 'qualityFramework.5', 'supplierCriteria.0', 'supplierCriteria.1', 'supplierCriteria.2', 'supplierCriteria.3'],
  'company-overview': ['companyInvitation', 'companyFacts.0', 'companyFacts.1', 'companyFacts.2', 'companyFacts.3'],
  'project-process': ['projectSteps.0', 'projectSteps.1', 'projectSteps.2', 'projectSteps.3', 'projectSteps.4'],
  contact: ['contactHeroImage'],
}
const valueAtPath = (source: any, sourcePath: string) => sourcePath.split('.').reduce((value, key) => value?.[key], source)
const sectionLocale = (section: any, locale: 'en' | 'zh') => ({ ...section,
  title: section.title?.[locale] || section.title?.en, body: section.body?.[locale] || section.body?.en,
  linkLabel: section.linkLabel?.[locale] || section.linkLabel?.en,
  items: section.items?.map((item: any) => ({ label: item.label?.[locale] || item.label?.en, body: item.body?.[locale] || item.body?.en })),
})
async function editablePageSections(page: any) {
  const sections = []
  for (const sourcePath of pageSectionPaths[page.slug] ?? []) {
    const value = valueAtPath(page.sourceData, sourcePath)
    if (value === undefined) continue
    const pair = (en: any, zh: any) => en || zh ? { en: en || zh, zh: zh || en } : undefined
    const imagePath = typeof value === 'string' && value.startsWith('/assets/') ? value : value.image
    sections.push({ sourcePath,
      title: pair(value.title?.en || value.name?.en || value.label?.en || (typeof value === 'string' ? page.title.en : undefined), value.title?.zh || value.name?.zh || value.label?.zh || (typeof value === 'string' ? page.title.zh : undefined)),
      body: pair(value.body?.en || value.description?.en || value.intro?.en || value.response?.en, value.body?.zh || value.description?.zh || value.intro?.zh || value.response?.zh),
      linkLabel: pair(value.cta?.en || value.action?.en, value.cta?.zh || value.action?.zh), linkHref: value.href,
      image: imagePath && supportedImage.test(imagePath) ? await importMedia(imagePath, page.title.en, page.title.zh) : undefined,
      items: Array.isArray(value.items) ? value.items.map((item: any) => ({ label: pair(item.label?.en || item.title?.en || item.name?.en, item.label?.zh || item.title?.zh || item.name?.zh), body: pair(item.body?.en || item.description?.en, item.body?.zh || item.description?.zh) })) : undefined,
    })
  }
  return sections
}

for (const page of source.sitePages ?? []) {
  const sections = await editablePageSections(page)
  const doc = await upsert('site-pages', 'slug', page.slug, {
    title: page.title.en, slug: page.slug, path: page.path, pageType: page.pageType, summary: page.summary.en,
    seo: { title: page.title.en, description: page.summary.en, robots: 'index' }, sourceData: page.sourceData,
    sections: sections.map((section) => sectionLocale(section, 'en')), _status: 'published',
  }, { title: page.title.zh, summary: page.summary.zh, seo: { title: page.title.zh, description: page.summary.zh, robots: 'index' }, sections: sections.map((section) => sectionLocale(section, 'zh')) })
  await payload.update({ collection: 'site-pages', id: doc.id, locale: 'all' as any, overrideAccess: true, user: admin, data: { sections } as any })
}

for (const document of source.documents ?? []) {
  const filePath = path.join(publicDir, document.sourcePath)
  if (!existsSync(filePath)) throw new Error(`Missing document: ${document.sourcePath}`)
  const data: any = { title: document.title.en, sourcePath: document.sourcePath, description: document.description.en,
    locale: document.locale, resource: resourceIds.get(document.resourceSlug), _status: 'published' }
  const existing = await findBy('documents', 'sourcePath', document.sourcePath)
  const doc: any = existing
    ? await payload.update({ collection: 'documents', id: existing.id, data, locale: 'en', overrideAccess: true, user: admin })
    : await payload.create({ collection: 'documents', data, filePath, locale: 'en', overrideAccess: true, user: admin })
  await payload.update({ collection: 'documents', id: doc.id, locale: 'zh', overrideAccess: true, user: admin,
    data: { title: document.title.zh, description: document.description.zh } })
}

await payload.updateGlobal({
  slug: 'site-settings', overrideAccess: true, user: admin,
  data: { companyName: source.siteSettings.companyName, email: source.siteSettings.email,
    phone: source.siteSettings.phone, whatsapp: source.siteSettings.phone, inquiryEndpoint: '/api/inquiry',
    logo: await importMedia('/assets/legacy/zomee-logo.svg', 'ZOMEEX logo'),
    wechatQrImage: await importMedia(source.siteSettings.wechatQrImage, 'ZOMEEX WeChat QR code', 'ZOMEEX 微信二维码') },
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
