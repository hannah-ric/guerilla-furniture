# Blueprint Buddy - Deployment Guide

## 🚀 Quick Deploy Options

### Deploy to Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hannah-ric/guerilla-furniture)

### Deploy to Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hannah-ric/guerilla-furniture)

## Manual Deployment

### Prerequisites
- Node.js 18+ installed
- OpenAI API key
- (Optional) Supabase account for database

### Environment Variables
Create a `.env` file in the root directory:

```env
# Required
VITE_OPENAI_API_KEY=sk-...your-openai-key...

# Optional (for full features)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Build for Production

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Preview the build locally
npm run preview
```

### Deploy to Vercel (CLI)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, then add environment variables:
vercel env add VITE_OPENAI_API_KEY
```

### Deploy to Netlify (CLI)

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --dir=dist --prod

# Add environment variables in Netlify dashboard
```

## Production Considerations

### 1. API Key Security
- **Never commit API keys** to git
- Use environment variables
- Consider implementing a backend proxy for API calls

### 2. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
// In your API service
const rateLimiter = new Map();
const RATE_LIMIT = 10; // requests per minute

function checkRateLimit(userId: string): boolean {
  // Implementation
}
```

### 3. Cost Management
- Monitor OpenAI API usage
- Set billing alerts
- Consider caching frequent requests

### 4. Database Setup (Supabase)

```bash
# If using Supabase
cd supabase
npx supabase init
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### 5. Custom Domain

#### Vercel
1. Go to your project settings
2. Add domain under "Domains"
3. Update DNS records

#### Netlify
1. Go to Site settings > Domain management
2. Add custom domain
3. Update DNS records

## Monitoring

### Recommended Services
- **Error Tracking**: Sentry
- **Analytics**: Plausible or Simple Analytics
- **Uptime**: UptimeRobot

### Basic Error Tracking Setup

```typescript
// In src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
});
```

## Performance Optimization

### 1. Enable Caching Headers
```typescript
// vercel.json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 2. Optimize Bundle Size
```bash
# Analyze bundle
npm run build -- --report

# Consider lazy loading
const Designer = lazy(() => import('./pages/Designer'));
```

## Backup & Recovery

### Database Backups
If using Supabase:
- Enable Point-in-Time Recovery
- Set up daily backups
- Test restore procedures

### Code Backups
- Use GitHub releases for stable versions
- Tag deployments
- Keep deployment history

## Going Live Checklist

- [ ] Environment variables configured
- [ ] API keys secured
- [ ] Rate limiting implemented
- [ ] Error tracking setup
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Database migrations run
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place
- [ ] Terms of Service and Privacy Policy added

## Support

- **Issues**: https://github.com/hannah-ric/guerilla-furniture/issues
- **Discussions**: https://github.com/hannah-ric/guerilla-furniture/discussions 