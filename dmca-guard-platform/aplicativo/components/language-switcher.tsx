'use client'

import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const router = useRouter()
  const { locale, locales, asPath } = router
  
  const switchLanguage = (newLocale: string) => {
    router.push(asPath, asPath, { locale: newLocale })
  }
  
  const getLanguageName = (locale: string) => {
    return {
      'en': 'English',
      'pt': 'Português'
    }[locale] || locale
  }
  
  const getLanguageFlag = (locale: string) => {
    return {
      'en': '🇺🇸',
      'pt': '🇧🇷'
    }[locale] || '🌐'
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{getLanguageName(locale || 'pt')}</span>
          <span className="sm:hidden">{getLanguageFlag(locale || 'pt')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales?.map((lng) => (
          <DropdownMenuItem
            key={lng}
            onClick={() => switchLanguage(lng)}
            className={`gap-2 ${locale === lng ? 'bg-muted' : ''}`}
          >
            <span>{getLanguageFlag(lng)}</span>
            <span>{getLanguageName(lng)}</span>
            {locale === lng && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}