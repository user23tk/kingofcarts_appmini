# Security Documentation

Security features and best practices for King of Carts.

## Features

### Rate Limiting
- Hourly, daily, and burst limits
- Configurable per environment
- Automatic reset mechanisms

### Anti-Replay Protection
- Callback deduplication
- 5-minute expiry window
- Prevents double-processing

### PP Validation
- Server-side validation
- Audit logging
- Anti-cheat measures

### Webhook Security
- Secret token validation
- Content-type checking
- Request origin validation

## Best Practices

1. Always validate user input
2. Use admin client for privileged operations
3. Never expose service role key to client
4. Monitor audit logs regularly
5. Keep rate limits enabled in production
