import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface AuthenticatedUser {
  id: string
  name: string
  color?: string
}

export async function authenticateRequest(request: NextRequest): Promise<{ user: AuthenticatedUser | null, error: string | null }> {
  try {
    // Get the user ID from headers (simplified for demo)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return { user: null, error: 'Missing user ID' }
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user details from our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, color')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return { user: null, error: 'User not found in database' }
    }

    return { 
      user: {
        id: userData.id,
        name: userData.name,
        color: userData.color
      }, 
      error: null 
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

export function createAuthHeaders(userId: string): HeadersInit {
  return {
    'X-User-ID': userId,
    'Content-Type': 'application/json'
  }
}
