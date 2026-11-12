export type InterfaceLanguage = 'en' | 'zh'

export const copy = (language: string, en: string, zh: string) => language.startsWith('zh') ? zh : en
export const label = (en: string, zh: string) => ({ en, zh })

export const validationCopy = (language: string) => ({
  slug: copy(language, 'Use lowercase letters, numbers and single hyphens only.', '网址标识只能使用小写英文字母、数字和单个连字符。'),
  https: copy(language, 'Enter a URL starting with https://.', '请输入以 https:// 开头的网址。'),
})
