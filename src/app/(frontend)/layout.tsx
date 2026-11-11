import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './styles.css'

export const metadata: Metadata = {
  title: 'ZOMEEX CMS',
  description: 'Content operations for the ZOMEEX website',
  robots: { index: false, follow: false },
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
