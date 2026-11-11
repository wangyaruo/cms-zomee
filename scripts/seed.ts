import { getPayload } from 'payload'
import config from '../src/payload.config'

async function seed() {
  const email = process.env.CMS_BOOTSTRAP_EMAIL
  const password = process.env.CMS_BOOTSTRAP_PASSWORD
  if (!email || !password || password.length < 12) {
    throw new Error('Set CMS_BOOTSTRAP_EMAIL and a CMS_BOOTSTRAP_PASSWORD of at least 12 characters.')
  }
  const payload = await getPayload({ config })
  const existing = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  if (existing.totalDocs > 0) {
    console.log('An administrator already exists; no account was changed.')
    process.exit(0)
  }
  await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email, password, name: 'Site Administrator', role: 'admin' },
  })
  console.log(`Created the initial administrator: ${email}`)
  process.exit(0)
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
