'use client'

import { useTransition } from 'react'
import { copy, type InterfaceLanguage } from '../i18n/shared'
import './language.css'

export default function LanguageButtons({ language, onChange }: { language: InterfaceLanguage; onChange: (language: InterfaceLanguage) => Promise<void> }) {
  const [pending, startTransition] = useTransition()
  return <div className="interface-language" aria-label={copy(language, 'Interface language', '界面语言')} aria-busy={pending}>
    <span>{copy(language, 'Interface language', '界面语言')}</span>
    <div role="group" aria-label={copy(language, 'Choose a language', '选择语言')}>
      {(['zh', 'en'] as const).map((value) => <button key={value} type="button" lang={value} aria-pressed={language === value} disabled={pending} onClick={() => startTransition(() => onChange(value))}>{value === 'zh' ? '中文' : 'English'}</button>)}
    </div>
  </div>
}
