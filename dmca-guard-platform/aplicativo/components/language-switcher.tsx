'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const locales = ['en', 'pt']

export function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  
  // Get current locale from pathname
  const currentLocale = pathname.startsWith('/en') ? 'en' : 'pt'
  
  const switchLanguage = (newLocale: string) => {
    let newPath = pathname
    
    // Remove current locale prefix if it exists
    if (pathname.startsWith('/en')) {
      newPath = pathname.slice(3) || '/'
    }
    
    // Add new locale prefix if it's not the default (pt)
    if (newLocale === 'en') {
      newPath = `/en${newPath}`
    }
    
    router.push(newPath)
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
          <span className="hidden sm:inline">{getLanguageName(currentLocale)}</span>
          <span className="sm:hidden">{getLanguageFlag(currentLocale)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchLanguage(locale)}
            className={`gap-2 ${currentLocale === locale ? 'bg-muted' : ''}`}
          >
            <span>{getLanguageFlag(locale)}</span>
            <span>{getLanguageName(locale)}</span>
            {currentLocale === locale && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}