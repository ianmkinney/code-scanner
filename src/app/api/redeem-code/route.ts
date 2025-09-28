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
    // Rate limiting
    const rateLimit = await rateLimiters.codeScan.checkLimit(request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.remaining, rateLimit.resetTime)
    }

    // Authentication
    const { user } = await authenticateRequest(request)
    // Note: We allow anonymous redemption but associate with user if authenticated

    const { codeId, code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    // Validate code format (basic validation)
    if (typeof code !== 'string' || code.length < 3 || code.length > 50) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check if code is already redeemed
    let existingCode = null;
    if (codeId) {
      const { data: codeData } = await supabase
        .from('scanned_codes')
        .select('id, code, redeemed, redemption_error')
        .eq('id', codeId)
        .maybeSingle()
      
      if (codeData) {
        existingCode = codeData;
        if (codeData.redeemed) {
          return NextResponse.json({ 
            error: 'Code already redeemed',
            alreadyRedeemed: true 
          }, { status: 400 })
        }
      }
    }

    // Check for development mode (simulate redemption for testing)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const simulateRedemption = isDevelopment && code.startsWith('TEST');
    
    if (simulateRedemption) {
      console.log('🧪 Development mode: Simulating successful redemption for test code:', code);
      
      // Update database with simulated success
      const updateData = {
        redeemed: true,
        redeemed_at: new Date().toISOString(),
        redemption_error: null
      };

      let updatedCode = null;
      
      if (codeId && existingCode) {
        const { data, error } = await supabase
          .from('scanned_codes')
          .update(updateData)
          .eq('id', codeId)
          .select()
          .single();
        
        if (error) {
          console.error('Database update error:', error);
        } else {
          updatedCode = data;
        }
      } else {
        const insertPayload = { 
          code: code.trim(), 
          user_id: user?.id || null,
          ...updateData
        };
        
        const { data, error } = await supabase
          .from('scanned_codes')
          .insert(insertPayload)
          .select()
          .single();
        
        if (error) {
          console.error('Database insert error:', error);
        } else {
          updatedCode = data;
        }
      }

      return NextResponse.json({ 
        success: true,
        message: 'Code redeemed successfully! (Simulated)',
        data: updatedCode,
        simulated: true,
        remaining: rateLimit.remaining 
      });
    }

    // Attempt to redeem with ZYN Rewards
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
        body: `code=${encodeURIComponent(code.trim())}`
      });

      let zynResult;
      const responseText = await zynResponse.text();
      
      try {
        zynResult = JSON.parse(responseText);
      } catch {
        console.error('ZYN API returned non-JSON response:', responseText.substring(0, 200));
        // Handle HTML response (likely an error page)
        zynResult = {
          success: false,
          error: 'Invalid response from ZYN rewards service',
          rawResponse: responseText.substring(0, 100)
        };
      }
      
      if (zynResponse.ok && zynResult.success !== false) {
        // Successful redemption
        const updateData = {
          redeemed: true,
          redeemed_at: new Date().toISOString(),
          redemption_error: null
        };

        let updatedCode = null;
        
        if (codeId && existingCode) {
          // Update existing code
          const { data, error } = await supabase
            .from('scanned_codes')
            .update(updateData)
            .eq('id', codeId)
            .select()
            .single();
          
          if (error) {
            console.error('Database update error:', error);
          } else {
            updatedCode = data;
          }
        } else {
          // Create new code record with redemption status
          const insertPayload = { 
            code: code.trim(), 
            user_id: user?.id || null,
            ...updateData
          };
          
          const { data, error } = await supabase
            .from('scanned_codes')
            .insert(insertPayload)
            .select()
            .single();
          
          if (error) {
            console.error('Database insert error:', error);
          } else {
            updatedCode = data;
          }
        }

        return NextResponse.json({ 
          success: true,
          message: 'Code redeemed successfully!',
          data: updatedCode,
          zynResponse: zynResult,
          remaining: rateLimit.remaining 
        });
        
        } else {
        // Failed redemption - check for common error patterns
        let errorMessage = 'Redemption failed';
        
        if (zynResult.error) {
          errorMessage = zynResult.error;
        } else if (zynResult.message) {
          errorMessage = zynResult.message;
        } else if (responseText.includes('Invalid code') || responseText.includes('invalid')) {
          errorMessage = 'Invalid reward code';
        } else if (responseText.includes('already') || responseText.includes('used')) {
          errorMessage = 'Code has already been redeemed';
        } else if (responseText.includes('expired')) {
          errorMessage = 'Code has expired';
        } else if (responseText.includes('<!DOCTYPE')) {
          errorMessage = 'ZYN rewards service is currently unavailable';
        }
        
        // Update database with failure
        if (codeId && existingCode) {
          await supabase
            .from('scanned_codes')
            .update({
              redemption_error: errorMessage,
              redeemed_at: new Date().toISOString()
            })
            .eq('id', codeId);
        }

        return NextResponse.json({ 
          success: false,
          error: errorMessage,
          zynResponse: zynResult,
          remaining: rateLimit.remaining 
        }, { status: 400 });
        
      }
    } catch (fetchError) {
      console.error('ZYN API error:', fetchError);
      
      // Update database with network error
      if (codeId && existingCode) {
        await supabase
          .from('scanned_codes')
          .update({
            redemption_error: 'Network error connecting to ZYN rewards',
            redeemed_at: new Date().toISOString()
          })
          .eq('id', codeId);
      }

      return NextResponse.json({ 
        success: false,
        error: 'Failed to connect to ZYN rewards service',
        remaining: rateLimit.remaining 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
