import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './styles.css'
import { getInterfaceLanguage } from '../../i18n/server'
import { InterfaceLanguageProvider } from '../../components/InterfaceLanguageProvider'

export const metadata: Metadata = {
  title: 'ZOMEEX CMS',
  description: 'Content operations for the ZOMEEX website',
  robots: { index: false, follow: false },
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const language = await getInterfaceLanguage()
  return <html lang={language === 'zh' ? 'zh-CN' : 'en'}><body><InterfaceLanguageProvider language={language}>{children}</InterfaceLanguageProvider></body></html>
}
