# Facebook App Setup Guide for TradeScout

## Step 1: Access Facebook Developers Console

1. Go to **https://developers.facebook.com/**
2. Click **"Get Started"** (if first time) or **"My Apps"**
3. Sign in with your Facebook account

## Step 2: Create New Facebook App

1. Click **"Create App"** button
2. Choose **"Consumer"** as the app type
3. Fill in the app details:
   - **App Name**: `TradeScout` (or `TradeScout Auth`)
   - **App Contact Email**: Your business email
   - **Business Account**: Select if you have one (optional)
4. Click **"Create App"**

## Step 3: Configure Facebook Login

1. In your app dashboard, find **"Facebook Login"**
2. Click **"Set Up"** next to Facebook Login
3. Choose **"Web"** as the platform
4. Enter your site URL: `https://your-replit-url.replit.app`
5. Click **"Save"** and **"Continue"**

## Step 4: Configure OAuth Redirect URIs

1. In the left sidebar, click **"Facebook Login" → "Settings"**
2. Add these URLs to **"Valid OAuth Redirect URIs"**:
   ```
   https://your-replit-url.replit.app/auth/facebook/callback
   http://localhost:5000/auth/facebook/callback
   ```
3. Click **"Save Changes"**

## Step 5: Set Up App Domain

1. In the left sidebar, click **"Settings" → "Basic"**
2. Add your domain to **"App Domains"**:
   ```
   your-replit-url.replit.app
   localhost
   ```
3. Add **"Privacy Policy URL"** (required for public apps):
   ```
   https://your-replit-url.replit.app/privacy
   ```
   ⚠️ **Important**: Always use `/privacy` - this is the canonical URL
4. Add **"Terms of Service URL"**:
   ```
   https://your-replit-url.replit.app/terms
   ```
   ⚠️ **Important**: Always use `/terms` - this is the canonical URL

## Step 6: Get Your App Credentials

1. In **"Settings" → "Basic"**, you'll find:
   - **App ID** (This is your `FACEBOOK_APP_ID`)
   - **App Secret** (Click "Show" - this is your `FACEBOOK_APP_SECRET`)

2. Copy these values - you'll need them for Replit Secrets

## Step 7: Configure App Permissions

1. Go to **"App Review" → "Permissions and Features"**
2. Make sure these permissions are available:
   - `email` (should be approved by default)
   - `public_profile` (should be approved by default)

## Step 8: Set App to Development Mode

1. In **"Settings" → "Basic"**
2. Make sure **"App Mode"** is set to **"Development"**
3. Add test users under **"Roles" → "Test Users"** if needed
4. You can add up to 50 test users in development mode

## Step 9: Add Credentials to Replit

1. In your Replit project, go to the **Secrets** tab (🔒 icon)
2. Add these secrets:
   ```
   FACEBOOK_APP_ID = your_app_id_here
   FACEBOOK_APP_SECRET = your_app_secret_here
   ```
3. Click **"Add Secret"** for each one

## Step 10: Test the Integration

1. Restart your Replit application
2. Go to your contractor board
3. Click **"Quick Signup with Facebook"**
4. You should see Facebook's authorization dialog
5. Complete the flow and verify account creation

## Step 11: Production Preparation (For Later)

When ready to go live:

1. **App Review**: Submit for Facebook App Review
2. **Switch to Live Mode**: Change from Development to Live
3. **Update URLs**: Replace localhost with your production domain
4. **Privacy Policy**: Ensure your privacy policy covers Facebook data usage

## Common Configuration Settings

### Data Deletion Instructions (Required)
1. Go to **"Settings" → "Basic"**
2. Add **"Data Deletion Instructions URL"**:
   ```
   https://your-replit-url.replit.app/data-deletion
   ```

### Category Selection
1. Set **"Category"** to: **"Business"** or **"Utilities"**

### App Icon (Optional but Recommended)
1. Upload a 1024x1024 pixel app icon
2. This shows in the Facebook authorization dialog

## Troubleshooting

### Common Issues:

**"URL Not Allowed"**
- Check that your redirect URI exactly matches what's in Facebook settings
- Include both development and production URLs

**"App Not Available"**
- Make sure app is in Development mode
- Add yourself as a test user or app admin

**"Invalid App Secret"**
- Regenerate the app secret if needed
- Make sure you're copying the secret, not the app ID

**"OAuth Exception"**
- Verify the callback URL is exactly: `/auth/facebook/callback`
- Check that your domain is added to App Domains

## Security Best Practices

1. **Never share your App Secret publicly**
2. **Use HTTPS in production**
3. **Regularly rotate your App Secret**
4. **Monitor app usage in Facebook Analytics**
5. **Keep permissions minimal** (only request email and public_profile)

## Your Specific URLs to Use

Replace `your-replit-url` with your actual Replit URL:

- **OAuth Redirect URI**: `https://your-replit-url.replit.app/auth/facebook/callback`
- **App Domain**: `your-replit-url.replit.app`
- **Site URL**: `https://your-replit-url.replit.app`

Once you complete this setup and add the credentials to Replit Secrets, your Facebook authentication will be fully functional!