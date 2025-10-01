import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestion, user_id } = body;

    // Validate input
    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Suggestion text is required' },
        { status: 400 }
      );
    }

    if (suggestion.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Suggestion text is too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Insert suggestion into database
    const { data, error } = await supabase
      .from('suggestions')
      .insert({
        suggestion: suggestion.trim(),
        user_id: user_id || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save suggestion' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        suggestion: data.suggestion,
        created_at: data.created_at
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
