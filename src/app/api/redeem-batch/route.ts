import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimiters, createRateLimitResponse } from '@/lib/rate-limit'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ZYN Rewards API endpoint
const ZYN_REDEEM_URL = 'https://us.zyn.com/rewardsblock/redeemcode/'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (more lenient for batch operations)
    const rateLimit = await rateLimiters.codeScan.checkLimit(request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.remaining, rateLimit.resetTime)
    }

    // Authentication
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user } = await authenticateRequest(request)
    // Note: user is available for future use if needed

    const { codeIds } = await request.json()
    
    if (!Array.isArray(codeIds) || codeIds.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid code IDs' }, { status: 400 })
    }

    if (codeIds.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 codes can be redeemed at once' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get codes to redeem
    const { data: codesToRedeem, error: fetchError } = await supabase
      .from('scanned_codes')
      .select('id, code, redeemed, redemption_error')
      .in('id', codeIds)
    
    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 })
    }

    if (!codesToRedeem || codesToRedeem.length === 0) {
      return NextResponse.json({ error: 'No codes found' }, { status: 404 })
    }

    // Filter out already redeemed codes
    const unredeemedCodes = (codesToRedeem as Array<{ id: string; code: string; redeemed: boolean; redemption_error?: string }>).filter((code) => !code.redeemed)
    
    if (unredeemedCodes.length === 0) {
      return NextResponse.json({ 
        error: 'All selected codes have already been redeemed',
        alreadyRedeemed: true 
      }, { status: 400 })
    }

    const results = []
    const successfulRedeemed = []
    const failedRedeemed = []

    // Process each code
    for (const codeData of unredeemedCodes) {
      try {
        const zynResponse = await fetch(ZYN_REDEEM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://us.zyn.com',
            'Referer': 'https://us.zyn.com/ZYNRewards/',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: `code=${encodeURIComponent(codeData.code.trim())}`
        });

        let zynResult;
        const responseText = await zynResponse.text();
        
        try {
          zynResult = JSON.parse(responseText);
        } catch {
          console.error('ZYN API returned non-JSON response:', responseText.substring(0, 200));
          zynResult = {
            success: false,
            error: 'Invalid response from ZYN rewards service',
            rawResponse: responseText.substring(0, 100)
          };
        }
        
        if (zynResponse.ok && zynResult.success !== false) {
          // Successful redemption
          const { error: updateError } = await supabase
            .from('scanned_codes')
            .update({
              redeemed: true,
              redeemed_at: new Date().toISOString(),
              redemption_error: null
            })
            .eq('id', codeData.id)
          
          if (updateError) {
            console.error('Database update error:', updateError)
          }

          successfulRedeemed.push({
            id: codeData.id,
            code: codeData.code,
            zynResponse: zynResult
          })

          results.push({
            id: codeData.id,
            code: codeData.code,
            success: true,
            message: 'Redeemed successfully'
          })
          
        } else {
          // Failed redemption
          const errorMessage = zynResult.message || zynResult.error || 'Redemption failed'
          
          const { error: updateError } = await supabase
            .from('scanned_codes')
            .update({
              redemption_error: errorMessage,
              redeemed_at: new Date().toISOString()
            })
            .eq('id', codeData.id)
          
          if (updateError) {
            console.error('Database update error:', updateError)
          }

          failedRedeemed.push({
            id: codeData.id,
            code: codeData.code,
            error: errorMessage,
            zynResponse: zynResult
          })

          results.push({
            id: codeData.id,
            code: codeData.code,
            success: false,
            error: errorMessage
          })
        }
        
      } catch (fetchError) {
        console.error('ZYN API error for code:', codeData.code, fetchError)
        
        // Update database with network error
        await supabase
          .from('scanned_codes')
          .update({
            redemption_error: 'Network error connecting to ZYN rewards',
            redeemed_at: new Date().toISOString()
          })
          .eq('id', codeData.id)

        failedRedeemed.push({
          id: codeData.id,
          code: codeData.code,
          error: 'Network error connecting to ZYN rewards'
        })

        results.push({
          id: codeData.id,
          code: codeData.code,
          success: false,
          error: 'Network error connecting to ZYN rewards'
        })
      }

      // Add small delay between requests to be respectful to ZYN's API
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      success: successfulRedeemed.length > 0,
      message: `Processed ${results.length} codes: ${successfulRedeemed.length} successful, ${failedRedeemed.length} failed`,
      results,
      successful: successfulRedeemed,
      failed: failedRedeemed,
      summary: {
        total: results.length,
        successful: successfulRedeemed.length,
        failed: failedRedeemed.length
      },
      remaining: rateLimit.remaining
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
