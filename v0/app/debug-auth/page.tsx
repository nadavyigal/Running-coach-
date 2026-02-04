'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function DebugAuthPage() {
  const [results, setResults] = useState<string[]>([])
  const [testing, setTesting] = useState(false)

  const addResult = (msg: string) => {
    setResults(prev => [...prev, `${new Date().toISOString().slice(11, 19)} - ${msg}`])
  }

  const runTests = async () => {
    setTesting(true)
    setResults([])

    // Test 1: Check environment variables
    addResult('Test 1: Checking environment variables...')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      addResult('FAIL: NEXT_PUBLIC_SUPABASE_URL is not set or is placeholder')
    } else {
      addResult(`OK: Supabase URL: ${supabaseUrl.substring(0, 40)}...`)
    }

    if (!anonKey || anonKey.includes('placeholder')) {
      addResult('FAIL: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set or is placeholder')
    } else {
      addResult(`OK: Anon key set: ${anonKey.substring(0, 20)}...`)
    }

    // Test 2: Create Supabase client
    addResult('Test 2: Creating Supabase client...')
    try {
      const supabase = createClient()
      addResult('OK: Supabase client created')

      // Test 3: Try to get session (tests basic connectivity)
      addResult('Test 3: Testing basic connectivity (getSession)...')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        addResult(`FAIL: getSession error: ${sessionError.message}`)
      } else {
        addResult(`OK: getSession successful (session: ${sessionData.session ? 'exists' : 'none'})`)
      }

      // Test 4: Check auth health endpoint
      addResult('Test 4: Checking Supabase auth health...')
      try {
        const healthUrl = `${supabaseUrl}/auth/v1/health`
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'apikey': anonKey || '',
          }
        })

        if (response.ok) {
          addResult(`OK: Auth health check passed (status: ${response.status})`)
        } else {
          addResult(`WARN: Auth health check returned status: ${response.status}`)
        }
      } catch (healthError) {
        addResult(`FAIL: Auth health check failed: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`)
      }

      // Test 5: Check CORS by making a preflight-triggering request
      addResult('Test 5: Testing CORS (signup endpoint preflight)...')
      try {
        const signupUrl = `${supabaseUrl}/auth/v1/signup`
        const response = await fetch(signupUrl, {
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type,apikey,authorization',
          }
        })

        const corsHeader = response.headers.get('access-control-allow-origin')
        if (corsHeader) {
          addResult(`OK: CORS preflight passed. Allowed origin: ${corsHeader}`)
        } else {
          addResult(`WARN: No CORS headers in response (status: ${response.status})`)
        }
      } catch (corsError) {
        addResult(`FAIL: CORS preflight failed: ${corsError instanceof Error ? corsError.message : 'Unknown error'}`)
      }

    } catch (err) {
      addResult(`FAIL: Error creating client: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    addResult('--- Tests complete ---')
    setTesting(false)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>
      <p className="text-sm text-gray-600 mb-4">
        Current origin: {typeof window !== 'undefined' ? window.location.origin : 'server-side'}
      </p>

      <Button onClick={runTests} disabled={testing} className="mb-4">
        {testing ? 'Running tests...' : 'Run Diagnostic Tests'}
      </Button>

      <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
        {results.length === 0 ? (
          <p className="text-gray-500">Click &quot;Run Diagnostic Tests&quot; to start</p>
        ) : (
          results.map((r, i) => (
            <div key={i} className={r.includes('FAIL') ? 'text-red-400' : r.includes('WARN') ? 'text-yellow-400' : ''}>
              {r}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>This page helps diagnose Supabase connectivity issues.</p>
        <p>Look for any FAIL messages that indicate the problem.</p>
      </div>
    </div>
  )
}
