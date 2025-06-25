import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import en from './en.json'
import pt from './pt.json'

const translations = { en, pt }

function getLocaleFromPathname(pathname: string): 'en' | 'pt' {
  if (pathname.startsWith('/en')) return 'en'
  return 'pt'
}

export function useTranslation() {
  const pathname = usePathname()
  const [locale, setLocale] = useState<'en' | 'pt'>('pt')

  useEffect(() => {
    const detectedLocale = getLocaleFromPathname(pathname)
    setLocale(detectedLocale)
  }, [pathname])
  
  const t = (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.')
    let value: any = translations[locale as keyof typeof translations]
    
    for (const k of keys) {
      value = value?.[k]
    }
    
    if (!value) {
      console.warn(`Translation missing for key: ${key}`)
      return key
    }
    
    // Replace parameters like {count} with actual values
    if (params) {
      return Object.entries(params).reduce(
        (str, [param, val]) => str.replace(`{${param}}`, String(val)),
        value
      )
    }
    
    return value
  }
  
  return { t, locale }
}

// Export types for better TypeScript support
export type TranslationKey = keyof typeof en
export type Locale = 'en' | 'pt'