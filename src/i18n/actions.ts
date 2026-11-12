'use server'

import { cookies } from 'next/headers'
import type { InterfaceLanguage } from './shared'

export async function setInterfaceLanguage(language: InterfaceLanguage) {
  if (language !== 'en' && language !== 'zh') throw new Error('Unsupported interface language')
  ;(await cookies()).set('payload-lng', language, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}
