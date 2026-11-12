'use client'

import { useTranslation } from '@payloadcms/ui'
import LanguageButtons from './LanguageButtons'

export default function AdminLanguageSwitcher() {
  const { i18n, switchLanguage } = useTranslation()
  return <LanguageButtons language={i18n.language.startsWith('zh') ? 'zh' : 'en'} onChange={async (language) => { await switchLanguage?.(language) }} />
}
