# Real Facebook App URLs for TradeScout

## Your Actual Deployment URLs

Based on your Replit environment, here are your REAL URLs for Facebook App registration:

### **Privacy Policy URL** (Required)
```
https://bb99ef68-07f3-4ff6-8777-53424138d9bd-00-1pdusyubsrg2x.spock.replit.dev/privacy
```

### **Terms of Service URL** (Required)
```
https://bb99ef68-07f3-4ff6-8777-53424138d9bd-00-1pdusyubsrg2x.spock.replit.dev/terms
```

### **OAuth Redirect URI** (Required)
```
https://bb99ef68-07f3-4ff6-8777-53424138d9bd-00-1pdusyubsrg2x.spock.replit.dev/auth/facebook/callback
```

### **App Domain** (Required)
```
bb99ef68-07f3-4ff6-8777-53424138d9bd-00-1pdusyubsrg2x.spock.replit.dev
```

## How to Use These URLs

1. **Go to** https://developers.facebook.com/
2. **Create New App** → Choose "Consumer" type
3. **Add Facebook Login** product
4. **In Facebook Login Settings:**
   - Valid OAuth Redirect URIs: Use the OAuth Redirect URI above
5. **In App Details:**
   - Privacy Policy URL: Use the Privacy Policy URL above
   - Terms of Service URL: Use the Terms URL above
6. **In App Domains:**
   - Add the App Domain above (without https://)

## Important Notes

- These URLs are your LIVE Replit deployment URLs
- They work right now and are accessible
- The privacy policy and terms pages are already live and working
- Once you get your App ID and App Secret from Facebook, add them to Replit Secrets

## Testing the URLs

You can test these URLs right now:
- Visit the privacy policy URL in your browser
- Visit the terms URL in your browser  
- Both should load your live privacy policy and terms pages

## Next Steps

1. Use these exact URLs in your Facebook App setup
2. Get your App ID and App Secret from Facebook
3. Add them to Replit Secrets as:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`
4. Facebook login will work immediately