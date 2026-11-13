import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

if (process.argv.length !== 3) throw new Error('Usage: node scripts/migrate-usernames.mjs <existing-sqlite-file>')

const filename = resolve(process.argv[2])
if (!statSync(filename).isFile()) throw new Error('Choose an existing CMS SQLite database.')
const url = pathToFileURL(filename)
url.searchParams.set('mode', 'rw')
const db = new DatabaseSync(url)

try {
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('BEGIN IMMEDIATE')
  try {
    const columns = db.prepare('PRAGMA table_info(users)').all()
    if (!columns.some(({ name }) => name === 'email')) throw new Error('CMS users table is missing.')
    if (!columns.some(({ name }) => name === 'username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT')
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username)')
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
} finally {
  db.close()
}

console.log('CMS username column and unique index are ready.')
