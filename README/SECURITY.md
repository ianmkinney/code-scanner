# ZYN Scanner - Security Architecture

## 🔒 Overview

The ZYN Scanner application implements a multi-layered security architecture to protect user data and prevent abuse. This document outlines the security measures implemented across authentication, authorization, rate limiting, and data protection.

## 🛡️ Security Layers

### 1. Row Level Security (RLS)
**Location**: `security/rls-policies.sql`

RLS provides database-level security by restricting data access based on user context.

#### Implementation:
- **Enabled on all tables**: `users` and `scanned_codes`
- **User-specific policies**: Users can only access their own data
- **Granular permissions**: Separate policies for INSERT, SELECT, UPDATE, DELETE

#### Benefits:
- **Database-level protection**: Even if API keys are compromised, users can only access their own data
- **Zero-trust architecture**: Every query is validated against user permissions
- **Automatic enforcement**: No need to remember to add security checks in application code

### 2. API Authentication
**Location**: `src/lib/auth.ts`

JWT-based authentication for API endpoints with user verification.

#### Implementation:
- **JWT token validation**: Verifies user identity from authorization headers
- **Database user lookup**: Ensures user exists in our system
- **Error handling**: Comprehensive error messages for different failure scenarios

#### Security Features:
- **Token expiration**: Automatic token invalidation
- **User verification**: Double-check user exists in database
- **Secure headers**: Proper authorization header parsing

### 3. Rate Limiting
**Location**: `src/lib/rate-limit.ts`

Multi-tier rate limiting to prevent abuse and ensure fair usage.

#### Rate Limits:
- **General API**: 100 requests per 15 minutes
- **Code Scanning**: 20 scans per minute per user
- **Color Updates**: 10 updates per minute per user

#### Implementation:
- **In-memory store**: Fast lookups with automatic cleanup
- **Per-user limits**: Different limits for different operations
- **Graceful degradation**: Clear error messages with retry information

#### Benefits:
- **DDoS protection**: Prevents overwhelming the server
- **Fair usage**: Ensures resources are available for all users
- **Cost control**: Prevents runaway API usage

## 🔧 API Security Features

### Enhanced API Routes
**Location**: `src/app/api/`

#### Security Measures:
1. **Authentication**: JWT token validation
2. **Rate limiting**: Per-endpoint rate limits
3. **Input validation**: Comprehensive data validation
4. **Error handling**: Secure error messages
5. **Logging**: Detailed security event logging

#### Example Security Flow:
```typescript
// 1. Rate limiting check
const rateLimit = await rateLimiters.colorUpdate.checkLimit(request)
if (!rateLimit.allowed) {
  return createRateLimitResponse(rateLimit.remaining, rateLimit.resetTime)
}

// 2. Authentication
const { user, error: authError } = await authenticateRequest(request)
if (authError || !user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}

// 3. Input validation
const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
if (!colorRegex.test(color)) {
  return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
}

// 4. Secure database operation
const { data, error } = await supabase
  .from('users')
  .update({ color })
  .eq('id', user.id) // RLS ensures user can only update their own record
  .select()
```

## 🔐 Environment Security

### Environment Variables
```bash
# Client-side (public - can be exposed)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Server-side (private - never exposed)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Security Best Practices:
- **Service Role Key**: Never exposed to client, used only in API routes
- **Anon Key**: Limited permissions, used for read operations
- **Environment separation**: Clear distinction between public and private keys

## 📊 Security Monitoring

### Logging Strategy
- **Authentication events**: Login attempts, token validation
- **Rate limiting**: When limits are exceeded
- **API errors**: Database errors, validation failures
- **Security violations**: Unauthorized access attempts

### Monitoring Points:
1. **Failed authentication attempts**
2. **Rate limit violations**
3. **Database access patterns**
4. **API response times**
5. **Error rates by endpoint**

## 🚨 Security Incident Response

### Immediate Actions:
1. **Check logs** for suspicious activity
2. **Review rate limiting** effectiveness
3. **Verify RLS policies** are working
4. **Monitor database** for unusual access patterns

### Escalation:
1. **High error rates** → Check rate limiting configuration
2. **Authentication failures** → Review token validation
3. **Database errors** → Verify RLS policies
4. **Performance issues** → Check rate limiting impact

## 🔄 Security Updates

### Regular Maintenance:
- **Review rate limits** based on usage patterns
- **Update RLS policies** as needed
- **Monitor authentication** token expiration
- **Audit API access** patterns

### Future Enhancements:
- **Redis integration** for distributed rate limiting
- **Advanced authentication** (OAuth, SAML)
- **Security headers** (CORS, CSP)
- **Request signing** for additional verification

## 📋 Security Checklist

### Deployment Checklist:
- [ ] RLS policies applied to all tables
- [ ] Service role key secured in environment
- [ ] Rate limiting configured appropriately
- [ ] Authentication working for all protected endpoints
- [ ] Input validation implemented
- [ ] Error handling secure (no sensitive data leaked)
- [ ] Logging configured for security events

### Monitoring Checklist:
- [ ] Rate limiting metrics tracked
- [ ] Authentication success/failure rates monitored
- [ ] Database access patterns reviewed
- [ ] API response times within acceptable limits
- [ ] Error rates below threshold

## 🎯 Security Benefits

### Data Protection:
- **User data isolation**: RLS ensures users only see their own data
- **Secure API access**: Authentication prevents unauthorized access
- **Input validation**: Prevents malicious data injection

### System Protection:
- **DDoS mitigation**: Rate limiting prevents abuse
- **Resource management**: Fair usage policies
- **Performance stability**: Prevents system overload

### Compliance:
- **Data privacy**: User data properly isolated
- **Access control**: Proper authentication and authorization
- **Audit trail**: Comprehensive logging for compliance

---

*This security architecture provides multiple layers of protection while maintaining usability and performance. Regular monitoring and updates ensure continued security effectiveness.*
