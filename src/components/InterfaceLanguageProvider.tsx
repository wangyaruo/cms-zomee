'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { InterfaceLanguage } from '../i18n/shared'
import { setInterfaceLanguage } from '../i18n/actions'
import LanguageButtons from './LanguageButtons'

const LanguageContext = createContext<InterfaceLanguage>('zh')
export const useInterfaceLanguage = () => useContext(LanguageContext)

export function InterfaceLanguageProvider({ language, children }: { language: InterfaceLanguage; children: ReactNode }) {
  return <LanguageContext value={language}>{children}</LanguageContext>
}

export function InterfaceLanguageSwitcher() {
  const language = useInterfaceLanguage()
  const router = useRouter()
  return <LanguageButtons language={language} onChange={async (value) => { await setInterfaceLanguage(value); router.refresh() }} />
}
