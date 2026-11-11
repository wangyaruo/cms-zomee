import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Products } from './collections/Products'
import { Posts } from './collections/Posts'
import { Faqs } from './collections/Faqs'
import { Releases } from './collections/Releases'
import { Pages } from './collections/Pages'
import { Applications, Resources, Solutions } from './collections/structured'
import { NavigationMenus } from './collections/NavigationMenus'
import { LegalPages } from './collections/LegalPages'
import { SitePages } from './collections/SitePages'
import { Documents } from './collections/Documents'
import { PrivateDocuments } from './collections/PrivateDocuments'
import { SiteSettings } from './globals/SiteSettings'
import { snapshotEndpoint } from './endpoints/snapshot'
import { createReleaseEndpoint } from './endpoints/releases'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const databaseUrl = process.env.DATABASE_URL || 'file:./data/zomeex-cms.db'
if (databaseUrl === 'file:./data/zomeex-cms.db') {
  mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — ZOMEEX CMS', description: 'ZOMEEX website content management' },
    components: { beforeDashboard: ['/components/CanvasLink'] },
  },
  editor: lexicalEditor(),
  collections: [Users, Media, Categories, Products, Posts, Faqs, Releases, Pages, Applications, Solutions, Resources, NavigationMenus, LegalPages, SitePages, Documents, PrivateDocuments],
  globals: [SiteSettings],
  endpoints: [snapshotEndpoint, createReleaseEndpoint],
  localization: {
    defaultLocale: 'en',
    fallback: true,
    locales: [
      { label: 'English', code: 'en' }, { label: '中文', code: 'zh', rtl: false },
      { label: 'Afrikaans', code: 'af' }, { label: 'العربية', code: 'ar', rtl: true },
      { label: 'বাংলা', code: 'bn' }, { label: 'Dansk', code: 'da' },
      { label: 'Nederlands', code: 'nl' }, { label: 'Français', code: 'fr' },
      { label: 'Deutsch', code: 'de' }, { label: 'Italiano', code: 'it' },
      { label: '日本語', code: 'ja' }, { label: '한국어', code: 'ko' },
      { label: 'Bahasa Melayu', code: 'ms' }, { label: 'Português', code: 'pt' },
      { label: 'Русский', code: 'ru' }, { label: 'Español', code: 'es' },
      { label: 'ไทย', code: 'th' },
    ],
  },
  db: sqliteAdapter({ client: { url: databaseUrl }, push: process.env.PAYLOAD_DB_PUSH !== 'false' }),
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100',
  cors: (process.env.SNAPSHOT_ALLOWED_ORIGINS || 'http://localhost:5273').split(','),
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3100'],
})
