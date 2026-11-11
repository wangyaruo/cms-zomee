import assert from 'node:assert/strict'
import test from 'node:test'
import { richTextFromEditorial, richTextFromFaqBlocks, richTextFromParagraphs } from '../src/lib/lexical'

test('plain product descriptions become valid rich text', () => {
  const result: any = richTextFromParagraphs(['First paragraph', 'Second paragraph'])
  assert.equal(result.root.children.length, 2)
  assert.equal(result.root.children[0].children[0].text, 'First paragraph')
})

test('FAQ lists and links are preserved', () => {
  const result: any = richTextFromFaqBlocks([
    { type: 'paragraph', content: [{ text: 'Read the ', }, { text: 'guide', href: 'https://example.com' }] },
    { type: 'list', items: [[{ text: 'First item' }], [{ text: 'Second item' }]] },
  ])
  assert.equal(result.root.children[0].children[1].type, 'link')
  assert.equal(result.root.children[1].children.length, 2)
})

test('editorial conversion selects the requested locale', () => {
  const editorial = {
    takeaways: [{ en: 'English takeaway', zh: '中文要点' }],
    sections: [{ title: { en: 'English title', zh: '中文标题' }, paragraphs: [{ en: 'English body', zh: '中文正文' }] }],
  }
  const result: any = richTextFromEditorial(editorial, 'zh')
  assert.equal(result.root.children[0].children[0].text, '• 中文要点')
  assert.equal(result.root.children[1].children[0].text, '中文标题')
  assert.equal(result.root.children[2].children[0].text, '中文正文')
})
