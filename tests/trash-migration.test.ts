import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const migration = fileURLToPath(new URL('../scripts/migrate-content-trash.mjs', import.meta.url))
const mainTables = [
  'categories', 'products', 'posts', 'faqs', 'applications', 'solutions', 'resources',
  'navigation_menus', 'legal_pages', 'site_pages',
]
const tables = mainTables.flatMap((table) => [table, `_${table}_v`])

async function fixture(t: TestContext, createTables = tables) {
  const directory = await mkdtemp(join(tmpdir(), 'zomeex-trash-migration-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const filename = join(directory, 'CMS content.sqlite')
  const db = new DatabaseSync(filename)
  try {
    for (const table of createTables) {
      db.exec(`CREATE TABLE "${table}" (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`)
      db.prepare(`INSERT INTO "${table}" VALUES (1, ?)`).run(table)
    }
  } finally {
    db.close()
  }
  return filename
}

function run(filename: string) {
  return spawnSync(process.execPath, [migration, filename], { encoding: 'utf8' })
}

test('trash schema migration preserves existing records and can run twice', async (t) => {
  const filename = await fixture(t)
  const first = run(filename)
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /Added 20 columns and 20 indexes/)
  const second = run(filename)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /Added 0 columns and 0 indexes/)

  const db = new DatabaseSync(filename, { readOnly: true })
  try {
    for (const table of tables) {
      const column = table.startsWith('_') ? 'version_deleted_at' : 'deleted_at'
      const index = table.startsWith('_') ? `${table}_version_version_deleted_at_idx` : `${table}_deleted_at_idx`
      const record = db.prepare(`SELECT * FROM "${table}" WHERE id = 1`).get()
      assert.equal(record?.name, table)
      assert.equal(record?.[column], null)
      assert.equal(db.prepare(`PRAGMA index_info("${index}")`).get()?.name, column)
    }
  } finally {
    db.close()
  }
})

test('trash schema migration rejects missing tables or conflicts without applying changes', async (t) => {
  const incomplete = await fixture(t, tables.slice(0, -1))
  const missing = run(incomplete)
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /Expected CMS tables are missing: _site_pages_v/)

  const incompatible = await fixture(t)
  const db = new DatabaseSync(incompatible)
  try {
    db.exec('ALTER TABLE "_site_pages_v" ADD COLUMN version_deleted_at INTEGER')
    const conflict = run(incompatible)
    assert.equal(conflict.status, 1)
    assert.match(conflict.stderr, /Unexpected schema for _site_pages_v\.version_deleted_at/)
    assert.equal(db.prepare('PRAGMA table_info("categories")').all().some(({ name }) => name === 'deleted_at'), false)
    assert.equal(db.prepare('SELECT name FROM "categories" WHERE id = 1').get()?.name, 'categories')
  } finally {
    db.close()
  }

  const absent = `${incomplete}.missing`
  assert.equal(run(absent).status, 1)
  assert.equal(existsSync(absent), false)
})
