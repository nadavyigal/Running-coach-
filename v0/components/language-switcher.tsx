'use client'

import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  language: 'en' | 'he'
  onChange: (lang: 'en' | 'he') => void
  variant?: 'default' | 'dark'
  className?: string
}

export function LanguageSwitcher({
  language,
  onChange,
  variant = 'default',
  className,
}: LanguageSwitcherProps) {
  const handleChange = (newLang: 'en' | 'he') => {
    if (newLang !== language) {
      onChange(newLang)

      // Track analytics event
      try {
        if (window.gtag) {
          window.gtag('event', 'language_changed', {
            from_language: language,
            to_language: newLang,
            location: 'language_switcher',
          })
        }
      } catch (e) {
        // Silently fail if analytics not available
      }
    }
  }

  const buttonStyles = {
    default: {
      idle: 'border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400',
      active: 'border-emerald-500 text-emerald-600 font-medium',
    },
    dark: {
      idle: 'border-white/10 text-white/60 hover:text-white/90 hover:border-white/20',
      active: 'border-emerald-400 text-emerald-400 font-medium',
    },
  }

  const styles = buttonStyles[variant]

  return (
    <div className={cn('flex items-center gap-1 rounded-full border border-gray-300 dark:border-white/10 p-1', className)}>
      <button
        onClick={() => handleChange('en')}
        className={cn(
          'px-3 py-1 rounded-lg text-sm transition-all font-medium',
          language === 'en' ? styles.active : styles.idle
        )}
        aria-label="Switch to English"
      >
        English
      </button>
      <button
        onClick={() => handleChange('he')}
        className={cn(
          'px-3 py-1 rounded-lg text-sm transition-all font-hebrew',
          language === 'he' ? styles.active : styles.idle
        )}
        aria-label="Switch to Hebrew"
      >
        עברית
      </button>
    </div>
  )
}
