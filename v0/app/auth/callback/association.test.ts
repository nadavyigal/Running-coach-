import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('RunSmart universal-link association', () => {
  it('advertises the shipped iOS bundle and only the auth return surface', () => {
    const association = JSON.parse(
      readFileSync(
        join(process.cwd(), 'public/.well-known/apple-app-site-association'),
        'utf8',
      ),
    )
    const details = association.applinks.details[0]

    expect(details.appID).toBe('8VC4R5M425.com.runsmart.lite')
    expect(details.paths).toContain('/auth/callback')
    expect(details.paths).not.toContain('/')
  })
})
