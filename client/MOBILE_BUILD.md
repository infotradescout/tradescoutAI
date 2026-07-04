# TradeScout Mobile Build

## Current repo state
- Web install surface exists at `/install`.
- PWA metadata lives in `client/public/manifest.json` and `client/public/site.webmanifest`.
- Native Capacitor config lives in `capacitor.config.ts`.
- Native shells are checked in under `android/` and `ios/`.
- TradeScout launcher and splash assets are branded from the repo logo sources.

## Daily commands
```sh
npm run mobile:web
npx cap sync
npm run mobile:open:android
npm run mobile:open:ios
```

## What `mobile:web` does
- Builds the production web bundle into `dist/public`.
- Regenerates sitemap artifacts as part of the normal app build.
- Produces the web assets that Capacitor copies into Android and iOS.

## Android workflow
1. Install a JDK and Android Studio.
2. Set `JAVA_HOME`.
3. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
4. Run `npx cap sync`.
5. Open `android/` in Android Studio or run `npx cap open android`.
6. Build signed release artifacts from Android Studio for Play Store submission.

## iOS workflow
1. Use a macOS machine with Xcode installed.
2. Install CocoaPods.
3. Run `npx cap sync`.
4. Open `ios/App/App.xcworkspace` in Xcode.
5. Configure signing and bundle distribution.
6. Archive and submit through App Store Connect.

## Push and native integrations
- Web push still uses the existing browser flow.
- Native push will need platform credentials and plugins before store submission.
- Do not add native-only permissions until the related feature is actually wired end to end.

## Current local blockers on this Windows machine
- `java` is not installed or not on `PATH`.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset.
- `adb` is unavailable.
- CocoaPods and `xcodebuild` are unavailable here, so iOS packaging must finish on macOS.
