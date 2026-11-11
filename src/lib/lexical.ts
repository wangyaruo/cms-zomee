export type LexicalNode = Record<string, unknown>

export function textNode(text: string, format = 0): LexicalNode {
  return { type: 'text', detail: 0, format, mode: 'normal', style: '', text, version: 1 }
}

export function paragraph(text: string): LexicalNode {
  return { type: 'paragraph', children: text ? [textNode(text)] : [], direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '' }
}

export function richText(children: LexicalNode[]) {
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

export function richTextFromParagraphs(paragraphs: string[]) {
  return richText(paragraphs.filter(Boolean).map(paragraph))
}

function inlineNodes(content: { text: string; href?: string }[]): LexicalNode[] {
  return content.map((part) => part.href
    ? { type: 'link', children: [textNode(part.text)], direction: 'ltr', format: '', indent: 0, version: 1,
      fields: { url: part.href, newTab: true, linkType: 'custom' } }
    : textNode(part.text))
}

export function richTextFromFaqBlocks(blocks: { type: string; content?: readonly { text: string; href?: string }[]; items?: readonly (readonly { text: string; href?: string }[])[] }[]) {
  const children = blocks.map((block) => block.type === 'list'
    ? { type: 'list', children: (block.items ?? []).map((item) => ({
      type: 'listitem', children: inlineNodes([...item]), direction: 'ltr', format: '', indent: 0, version: 1, value: 1,
    })), direction: 'ltr', format: '', indent: 0, version: 1, listType: 'bullet', start: 1, tag: 'ul' }
    : { ...paragraph(''), children: inlineNodes([...(block.content ?? [])]) })
  return richText(children)
}

type EditorialText = { en: string; zh: string }
export function richTextFromEditorial(editorial: { takeaways?: EditorialText[]; sections?: { title: EditorialText; paragraphs: EditorialText[]; bullets?: EditorialText[] }[] }, locale: 'en' | 'zh' = 'en') {
  const children: LexicalNode[] = []
  for (const takeaway of editorial.takeaways ?? []) children.push(paragraph(`• ${takeaway[locale]}`))
  for (const section of editorial.sections ?? []) {
    children.push({ ...paragraph(''), type: 'heading', tag: 'h2', children: [textNode(section.title[locale])] })
    for (const item of section.paragraphs) children.push(paragraph(item[locale]))
    for (const bullet of section.bullets ?? []) children.push(paragraph(`• ${bullet[locale]}`))
  }
  return richText(children)
}
