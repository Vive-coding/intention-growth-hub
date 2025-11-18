# Landing Page Integration Guide

## Overview

This guide covers integrating a Framer landing page with the GoodHabit app for soft launch.

## Recommended Approach: Framer External Landing Page

### Architecture

```
goodhabit.ai (Framer landing page)
   ↓
   Sign In/Sign Up buttons →
   ↓
goodhabit.ai/auth (app authentication pages)
   ↓
goodhabit.ai/chat (main app)
```

### Benefits

1. **Design Freedom**: Framer provides full visual control without code
2. **Fast Iteration**: Update marketing copy and design without deployments
3. **SEO Control**: Framer handles SEO optimization automatically
4. **Performance**: Framer sites are highly optimized
5. **A/B Testing**: Easy to test different landing page variants

### Risks & Mitigation

#### Risk 1: SEO Split

**Issue**: Search engines might index both Framer and app separately

**Mitigation**:
- Set canonical URLs pointing to Framer landing page
- Use consistent metadata across both
- Submit sitemap that prioritizes landing page
- Use `noindex` on app pages that shouldn't be indexed

#### Risk 2: Authentication Flow Complexity

**Issue**: Users need to navigate from Framer → app for auth

**Mitigation**:
- Deep link directly to `/auth/signin` or `/auth/signup`
- Preserve UTM parameters across the transition
- Use clear CTA buttons ("Get Started" → direct to signup)
- Consider Framer embed of sign-up form (advanced)

#### Risk 3: Subdomain vs Path Routing

**Issue**: Deciding between `app.goodhabit.ai` vs `goodhabit.ai/app`

**Mitigation**:

**Option A: Path-based (Recommended)**
- Landing: `goodhabit.ai/` (Framer)
- Auth: `goodhabit.ai/auth/*` (App)
- App: `goodhabit.ai/chat`, `goodhabit.ai/focus`, etc. (App)

**Pros**: Single domain, simpler cookies, better SEO
**Cons**: More complex routing configuration

**Option B: Subdomain-based**
- Landing: `goodhabit.ai` (Framer)
- App: `app.goodhabit.ai` (App)

**Pros**: Clear separation, easier to configure
**Cons**: Cookie complications, split SEO authority

**Recommended: Option A (Path-based)**

#### Risk 4: Cookie & Session Management

**Issue**: Cookies might not persist across Framer → app transition

**Mitigation**:
- Set cookies with `domain=.goodhabit.ai` for path-based
- Use session tokens passed via URL if needed (one-time use)
- Test thoroughly in incognito mode
- Handle auth state on app load

#### Risk 5: Analytics Split

**Issue**: User journey splits across Framer and app analytics

**Mitigation**:
- Add same Google Analytics ID to both Framer and app
- Track custom events for landing → app transition
- Use UTM parameters to track source
- Set up conversion tracking for sign-ups

### Implementation Steps

#### Step 1: Create Framer Landing Page

1. Design landing page in Framer
2. Key sections to include:
   - Hero with clear value proposition
   - Social proof (testimonials if available)
   - Features/benefits
   - Pricing (if applicable)
   - CTA buttons ("Get Started", "Sign Up")
3. Add tracking (Google Analytics, Facebook Pixel, etc.)
4. Optimize for mobile

#### Step 2: Configure Domain Routing

**If using path-based routing:**

1. Point `goodhabit.ai` DNS to Framer (A record or CNAME)
2. Configure Framer to serve root path only
3. Set up reverse proxy or routing rules:
   ```nginx
   # Example Nginx config
   location / {
     proxy_pass https://framer-site.framer.app;
   }
   
   location /auth {
     proxy_pass https://your-app-server.com;
   }
   
   location ~ ^/(chat|focus|goals|profile) {
     proxy_pass https://your-app-server.com;
   }
   ```

**If using subdomain routing:**

1. Point `goodhabit.ai` DNS to Framer
2. Point `app.goodhabit.ai` DNS to your app server
3. Configure SSL certificates for both

#### Step 3: Update App Authentication Pages

1. Ensure `/auth/signin` and `/auth/signup` are clean, standalone pages
2. Add back button to landing page: "← Back to Home"
3. After successful auth, redirect to `/chat` or onboarding flow
4. Handle UTM parameters:
   ```typescript
   // Example: Preserve UTM params through auth flow
   const utmParams = new URLSearchParams(window.location.search);
   localStorage.setItem('utm_params', utmParams.toString());
   
   // After successful auth:
   const savedUtm = localStorage.getItem('utm_params');
   analytics.identify(userId, { acquisitionParams: savedUtm });
   ```

#### Step 4: Configure Framer CTA Buttons

In Framer, set button links to:
- Primary CTA: `https://goodhabit.ai/auth/signup?source=landing_hero`
- Secondary CTA: `https://goodhabit.ai/auth/signin`
- Feature CTAs: `https://goodhabit.ai/auth/signup?source=landing_features`

#### Step 5: Set Up Analytics Tracking

**Framer side:**
```javascript
// Add to Framer custom code
gtag('event', 'cta_click', {
  'button_location': 'hero',
  'destination': '/auth/signup'
});
```

**App side:**
```typescript
// Track landing page visits that convert
if (document.referrer.includes('goodhabit.ai') && isNewSignup) {
  analytics.track('Landing Page Conversion', {
    source: 'framer_landing',
    utm_params: getUTMParams()
  });
}
```

#### Step 6: Test End-to-End

1. **Desktop testing**:
   - Visit landing page
   - Click CTA
   - Complete sign-up
   - Verify redirect to app
   - Check cookies persist

2. **Mobile testing**:
   - Same flow on mobile devices
   - Test different browsers (Safari, Chrome)

3. **Analytics testing**:
   - Verify events tracked in GA
   - Check user journey in analytics
   - Confirm conversion attribution

### Content Strategy

#### Landing Page Content (Framer)

- **Hero**: Clear value prop in 6-8 words
- **Subheader**: Benefit-focused description (20-30 words)
- **Social Proof**: "Join 1,000+ users..." or testimonials
- **Features**: 3-4 key features with icons
- **CTA**: Action-oriented ("Start Your Journey", "Get Started Free")
- **Footer**: Links to Terms, Privacy, Contact

#### App Auth Pages

- **Minimal branding**: Logo + tagline only
- **Social proof**: Small trust badge or user count
- **Clear form**: Email, password, obvious submit button
- **Alternative**: "Already have an account? Sign in"

### SEO Considerations

#### Framer Landing Page

```html
<head>
  <title>GoodHabit - AI Life Coach for Goal Achievement</title>
  <meta name="description" content="Transform your goals into habits with personalized AI coaching. Track progress, stay accountable, and achieve more.">
  <meta name="keywords" content="life coach, AI coach, goal tracking, habit building, personal development">
  
  <!-- Open Graph -->
  <meta property="og:title" content="GoodHabit - AI Life Coach">
  <meta property="og:description" content="Transform your goals into habits with personalized AI coaching.">
  <meta property="og:image" content="https://goodhabit.ai/og-image.png">
  
  <!-- Canonical -->
  <link rel="canonical" href="https://goodhabit.ai">
</head>
```

#### App Pages

```html
<!-- Add to all app pages -->
<meta name="robots" content="noindex, nofollow">
```

### Monitoring & Optimization

#### Metrics to Track

1. **Landing Page**:
   - Page views
   - Bounce rate
   - Time on page
   - CTA click rate

2. **Conversion Funnel**:
   - Landing → Auth page (% who click CTA)
   - Auth page → Sign-up (% who complete form)
   - Sign-up → First chat (% who activate)

3. **Technical**:
   - Page load time
   - Mobile vs desktop conversion rates
   - Browser compatibility issues

#### A/B Testing Ideas

- Hero copy variations
- CTA button text ("Get Started" vs "Start Free" vs "Try It Now")
- Feature highlighting (which 3-4 features to show)
- Social proof placement
- Color scheme

### Cost Estimate

- **Framer**: $15-20/month (Site plan)
- **Custom domain**: Free (included in Framer)
- **SSL**: Free (Framer provides)
- **Analytics**: Free (Google Analytics)

**Total**: ~$15-20/month

### Alternative: React Internal Landing Page

If you prefer keeping everything in one codebase:

#### Pros
- Single deployment
- Consistent auth
- Easier analytics
- No routing complexity

#### Cons
- Requires developer time for updates
- Less design flexibility
- Deploy required for copy changes

#### Implementation

1. Create `/landing` route with marketing-focused design
2. Use Tailwind/components for layout
3. Link to existing `/auth/signin` and `/auth/signup`
4. Deploy as single app

### Recommendation

**For soft launch: Use Framer**

Reasons:
1. Faster to market (no dev time for landing page)
2. Easy iteration based on feedback
3. Professional design without custom code
4. Can always migrate to React later if needed
5. Lower initial investment

The path-based routing (`goodhabit.ai/` + `goodhabit.ai/auth/*`) provides the best balance of simplicity and functionality.

## Support & Resources

- Framer Docs: https://www.framer.com/docs/
- Framer SEO Guide: https://www.framer.com/academy/seo
- Domain routing examples: https://www.framer.com/help/custom-domain/


