import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkLimit(request: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.config.keyGenerator ? 
      this.config.keyGenerator(request) : 
      this.getDefaultKey(request)
    
    const now = Date.now()
    const windowStart = now - this.config.windowMs
    const resetTime = now + this.config.windowMs

    const entry = rateLimitStore.get(key)
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: this.config.maxRequests - 1, resetTime }
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)
    
    return { 
      allowed: true, 
      remaining: this.config.maxRequests - entry.count, 
      resetTime: entry.resetTime 
    }
  }

  private getDefaultKey(request: NextRequest): string {
    // Use IP address as default key
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : 
               request.headers.get('x-real-ip') || 
               'unknown'
    return `rate_limit:${ip}`
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  // General API rate limiting: 100 requests per 15 minutes
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  }),
  
  // Code scanning: 20 scans per minute
  codeScan: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyGenerator: (request) => {
      const userId = request.headers.get('x-user-id')
      return `code_scan:${userId || 'anonymous'}`
    }
  }),
  
  // Color updates: 10 updates per minute
  colorUpdate: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (request) => {
      const userId = request.headers.get('x-user-id')
      return `color_update:${userId || 'anonymous'}`
    }
  })
}

export function createRateLimitResponse(remaining: number, resetTime: number) {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded',
      remaining,
      resetTime: new Date(resetTime).toISOString()
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString(),
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
      }
    }
  )
}
