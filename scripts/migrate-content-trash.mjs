import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

const contentTables = [
  'categories', 'products', 'posts', 'faqs', 'applications', 'solutions', 'resources',
  'navigation_menus', 'legal_pages', 'site_pages',
]

const changes = contentTables.flatMap((table) => [
  { table, column: 'deleted_at', index: `${table}_deleted_at_idx` },
  { table: `_${table}_v`, column: 'version_deleted_at', index: `_${table}_v_version_version_deleted_at_idx` },
])

function migrate(filename) {
  const path = resolve(filename)
  if (!statSync(path).isFile()) throw new Error('The database path must point to an existing SQLite file.')

  const url = pathToFileURL(path)
  // SQLite must refuse to open a missing file even if it vanishes after statSync.
  url.searchParams.set('mode', 'rw')
  const db = new DatabaseSync(url)
  let addedColumns = 0
  let addedIndexes = 0

  try {
    db.exec('PRAGMA busy_timeout = 5000')
    db.exec('BEGIN IMMEDIATE')
    try {
      const tableNames = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map(({ name }) => name))
      const missing = changes.filter(({ table }) => !tableNames.has(table)).map(({ table }) => table)
      if (missing.length) throw new Error(`Expected CMS tables are missing: ${missing.join(', ')}`)

      for (const { table, column, index } of changes) {
        const existingColumn = db.prepare(`PRAGMA table_info("${table}")`).all().find(({ name }) => name === column)
        if (!existingColumn) {
          db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" TEXT`)
          addedColumns += 1
        } else if (existingColumn.type.toUpperCase() !== 'TEXT' || existingColumn.notnull) {
          throw new Error(`Unexpected schema for ${table}.${column}; expected nullable TEXT.`)
        }

        const existingIndex = db.prepare(`PRAGMA index_list("${table}")`).all().find(({ name }) => name === index)
        if (!existingIndex) {
          db.exec(`CREATE INDEX "${index}" ON "${table}" ("${column}")`)
          addedIndexes += 1
        } else {
          const indexedColumns = db.prepare(`PRAGMA index_info("${index}")`).all()
          if (existingIndex.unique || existingIndex.partial || indexedColumns.length !== 1 || indexedColumns[0].name !== column) {
            throw new Error(`Unexpected definition for ${index}.`)
          }
        }
      }

      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } finally {
    db.close()
  }

  console.log(`Content trash schema ready. Added ${addedColumns} columns and ${addedIndexes} indexes.`)
}

if (process.argv.length !== 3 || process.argv[2].startsWith('-')) {
  console.error('Usage: node scripts/migrate-content-trash.mjs <existing-sqlite-file>')
  process.exitCode = 2
} else {
  try {
    migrate(process.argv[2])
  } catch (error) {
    console.error(`Content trash migration failed: ${error.message}`)
    process.exitCode = 1
  }
}
