import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimiters, createRateLimitResponse } from '@/lib/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await rateLimiters.colorUpdate.checkLimit(request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.remaining, rateLimit.resetTime)
    }

    // Authentication
    const { user, error: authError } = await authenticateRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Authentication required' }, { status: 401 })
    }

    const { color } = await request.json()
    
    if (!color) {
      return NextResponse.json({ error: 'Missing color' }, { status: 400 })
    }

    // Validate color format (hex color)
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    if (!colorRegex.test(color)) {
      return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data, error } = await supabase
      .from('users')
      .update({ color })
      .eq('id', user.id)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update color' }, { status: 500 })
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
