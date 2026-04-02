# Mobile Build & Push Setup (PHASE 5)

## 1. PWA
- `manifest.json` and `service-worker.js` are in `client/public/`
- Test installability and offline support with Chrome DevTools > Lighthouse

## 2. Native Mobile Build
- Use [Capacitor](https://capacitorjs.com/) or [React Native](https://reactnative.dev/) to wrap the web app
- Example (Capacitor):
  ```sh
  npm install @capacitor/core @capacitor/cli
  npx cap init
  npx cap add android
  npx cap add ios
  npx cap copy
  npx cap open android # or ios
  ```
- Publish to App Store/Google Play as needed

## 3. Push Notifications
- Use Firebase Cloud Messaging (FCM) for web and native push
- Service worker scaffold: `firebase-messaging-sw.js`
- Integrate FCM in your React app and backend for push delivery

## 4. Best Practices
- Test on multiple devices and browsers
- Use HTTPS for all PWA features
- Monitor push delivery and opt-in rates
