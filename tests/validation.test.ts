import assert from 'node:assert/strict'
import test from 'node:test'
import { canPublish, isValidSlug } from '../src/lib/validation'

test('accepts stable public slugs', () => {
  assert.equal(isValidSlug('child-resistant-pouches'), true)
  assert.equal(isValidSlug('product-01'), true)
})

test('rejects unsafe or unstable slugs', () => {
  for (const slug of ['', 'Product One', '/products/test', '-leading', 'double--dash', 'trailing-']) {
    assert.equal(isValidSlug(slug), false)
  }
})

test('only reviewers and administrators can publish', () => {
  assert.equal(canPublish('editor'), false)
  assert.equal(canPublish('reviewer'), true)
  assert.equal(canPublish('admin'), true)
  assert.equal(canPublish(undefined), false)
})
