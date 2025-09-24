# Security Implementation Guide

## 🚀 Quick Start

### 1. Database Setup (RLS Policies)

Run the RLS policies in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of security/rls-policies.sql
-- This will enable RLS and create all necessary policies
```

### 2. Environment Variables

Add these to your `.env.local`:

```bash
# Client-side (public - can be exposed)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Server-side (private - never exposed)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Get Service Role Key

1. Go to Supabase Dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (not the `anon` key)
4. Add it to your `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

## 🔧 Implementation Details

### Rate Limiting Configuration

The rate limiting system is configured in `src/lib/rate-limit.ts`:

```typescript
export const rateLimiters = {
  // General API: 100 requests per 15 minutes
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
  }),
  
  // Code scanning: 20 scans per minute per user
  codeScan: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyGenerator: (request) => {
      const userId = request.headers.get('x-user-id')
      return `code_scan:${userId || 'anonymous'}`
    }
  }),
  
  // Color updates: 10 updates per minute per user
  colorUpdate: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyGenerator: (request) => {
      const userId = request.headers.get('x-user-id')
      return `color_update:${userId || 'anonymous'}`
    }
  })
}
```

### Authentication Flow

The authentication system works as follows:

1. **Client sends request** with JWT token in Authorization header
2. **Server validates token** using Supabase auth
3. **Server looks up user** in database
4. **Server processes request** with authenticated user context

### RLS Policy Verification

To verify RLS is working:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'scanned_codes');

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'scanned_codes');
```

## 🧪 Testing Security

### 1. Test Rate Limiting

```bash
# Test color update rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/save-color \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your-token" \
    -d '{"color": "#ff0000"}'
done
# Should get rate limited after 10 requests
```

### 2. Test Authentication

```bash
# Test without authentication
curl -X POST http://localhost:3000/api/save-color \
  -H "Content-Type: application/json" \
  -d '{"color": "#ff0000"}'
# Should return 401 Unauthorized

# Test with invalid token
curl -X POST http://localhost:3000/api/save-color \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"color": "#ff0000"}'
# Should return 401 Unauthorized
```

### 3. Test RLS Policies

```sql
-- Test that users can only see their own data
-- (This should be done in Supabase SQL Editor with different user contexts)
SELECT * FROM users; -- Should only return current user's data
SELECT * FROM scanned_codes; -- Should only return current user's codes
```

## 🔍 Monitoring and Debugging

### Rate Limiting Headers

API responses include rate limiting information:

```json
{
  "success": true,
  "data": {...},
  "remaining": 8
}
```

Rate limit exceeded responses:

```json
{
  "error": "Rate limit exceeded",
  "remaining": 0,
  "resetTime": "2024-01-01T12:00:00.000Z"
}
```

### Console Logging

Security events are logged to the console:

```typescript
console.error('Authentication error:', error)
console.error('Database error:', error)
console.error('API error:', error)
```

### Database Logs

Check Supabase logs for:
- Authentication events
- Database access patterns
- RLS policy enforcement
- Error rates

## ⚠️ Common Issues

### 1. Rate Limiting Not Working

**Symptoms**: Requests not being rate limited
**Solutions**:
- Check if rate limiting is enabled in API routes
- Verify rate limit configuration
- Check console for rate limiting logs

### 2. Authentication Failures

**Symptoms**: All requests returning 401
**Solutions**:
- Verify JWT token format
- Check Supabase auth configuration
- Verify service role key is correct

### 3. RLS Policies Not Enforced

**Symptoms**: Users can see other users' data
**Solutions**:
- Verify RLS is enabled on tables
- Check policy definitions
- Test with different user contexts

### 4. Performance Issues

**Symptoms**: Slow API responses
**Solutions**:
- Check rate limiting impact
- Monitor database query performance
- Review authentication overhead

## 🔄 Maintenance

### Regular Tasks

1. **Monitor rate limiting effectiveness**
2. **Review authentication logs**
3. **Check RLS policy compliance**
4. **Update rate limits based on usage**
5. **Review security event logs**

### Updates

1. **Rate limit adjustments** based on usage patterns
2. **Authentication improvements** as needed
3. **RLS policy updates** for new features
4. **Security monitoring** enhancements

## 📊 Security Metrics

### Key Metrics to Monitor

1. **Rate limiting effectiveness**
   - Requests blocked per minute
   - Rate limit hit rate by endpoint

2. **Authentication success rate**
   - Successful logins vs failures
   - Token validation success rate

3. **Database access patterns**
   - Queries per user
   - Data access patterns

4. **API performance**
   - Response times
   - Error rates by endpoint

### Alerting Thresholds

- **Rate limit hits** > 10% of requests
- **Authentication failures** > 5% of attempts
- **API error rate** > 1%
- **Response time** > 2 seconds

---

*This guide provides step-by-step instructions for implementing and maintaining the security features. Regular monitoring and updates ensure continued security effectiveness.*
