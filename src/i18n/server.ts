import { cookies, headers } from 'next/headers'
import { extractHeaderLanguage } from '@payloadcms/translations'
import type { InterfaceLanguage } from './shared'

export async function getInterfaceLanguage(): Promise<InterfaceLanguage> {
  const saved = (await cookies()).get('payload-lng')?.value
  if (saved === 'en' || saved === 'zh') return saved
  const accepted = (await headers()).get('accept-language')
  return accepted && extractHeaderLanguage(accepted) === 'en' ? 'en' : 'zh'
}
