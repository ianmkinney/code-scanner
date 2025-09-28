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

    // Authentication
    const { user } = await authenticateRequest(request)

    const { codeId, isRedeemed } = await request.json()
    
    if (!codeId) {
      return NextResponse.json({ error: 'Missing code ID' }, { status: 400 })
    }

    if (typeof isRedeemed !== 'boolean') {
      return NextResponse.json({ error: 'Invalid redemption status' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify the code exists and belongs to the user (if authenticated)
    const { data: existingCode, error: fetchError } = await supabase
      .from('scanned_codes')
      .select('id, code, user_id, redeemed, redemption_error')
      .eq('id', codeId)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch code' }, { status: 500 })
    }

    if (!existingCode) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 })
    }

    // If user is authenticated, verify they own this code
    if (user && existingCode.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to code' }, { status: 403 })
    }

    // Update the redemption status
    const updateData = {
      redeemed: isRedeemed,
      redeemed_at: isRedeemed ? new Date().toISOString() : null,
      redemption_error: isRedeemed ? null : existingCode.redemption_error // Clear error if marking as redeemed
    }

    const { data: updatedCode, error: updateError } = await supabase
      .from('scanned_codes')
      .update(updateData)
      .eq('id', codeId)
      .select()
      .single()
    
    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json({ error: 'Failed to update redemption status' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Code ${isRedeemed ? 'marked as redeemed' : 'marked as unredeemed'}`,
      data: updatedCode,
      remaining: rateLimit.remaining 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
