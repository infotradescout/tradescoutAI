# PHASE 5: Mobile Packaging - PWA, Mobile Build, Push

## 1. Progressive Web App (PWA)
- Add `manifest.json` and service worker to enable installability and offline support
- Use Workbox or Vite PWA plugin for service worker generation
- Test with Lighthouse for PWA compliance

## 2. Mobile Build
- Use React Native or Capacitor to wrap the web app for iOS/Android
- Share codebase where possible (API, business logic)
- Publish to App Store/Google Play as needed

## 3. Push Notifications
- Integrate web push (VAPID, Firebase Cloud Messaging)
- For native, use Expo or Firebase SDKs

## 4. Implementation Steps
- Add PWA manifest and service worker to `client/public/`
- Configure Vite or Webpack for PWA
- Scaffold mobile wrapper if native app needed
- Integrate push notification service

## 5. Best Practices
- Test on multiple devices and browsers
- Use HTTPS for all PWA features
- Monitor push delivery and opt-in rates
