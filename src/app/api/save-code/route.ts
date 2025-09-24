import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimiters, createRateLimitResponse } from '@/lib/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await rateLimiters.codeScan.checkLimit(request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.remaining, rateLimit.resetTime)
    }

    // Authentication (optional for code scanning)
    const { user } = await authenticateRequest(request)
    // Note: We allow anonymous code scanning, but associate with user if authenticated

    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    // Validate code format (basic validation)
    if (typeof code !== 'string' || code.length < 3 || code.length > 50) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const insertPayload: { code: string; user_id?: string } = { code }
    if (user) insertPayload.user_id = user.id

    const { data, error } = await supabase
      .from('scanned_codes')
      .insert(insertPayload)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save code' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: data[0],
      remaining: rateLimit.remaining 
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
