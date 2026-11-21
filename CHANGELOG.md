# Changelog

## 0.3.0

- **App protection**, from the Wolvy Android SDK 0.2.0 and iOS SDK 0.2.0. When the account sets up protection for the app (dashboard: Settings → Protection → Allowed apps → Protection), the app proves it is genuine before playback: on Android with the customer's own Google Play Integrity, on iOS with Apple's App Attest. A proven app signs its requests and plays like Wolvy Player. Without the setup, or when the proof fails, it plays as before, unless the account only allows proven apps. There's nothing to code.
- `WolvyState.attested` (in `onReady` and `getState()`). New error reasons: `attestation_required`, `device_compromised` (Android, `device_not_supported`), `app_not_genuine`, `attestation_failed`.
- iOS core copy: Wolvy-SDK-iOS 0.2.0 (`ios/CORE_VERSION`).

## 0.2.0

- **iOS**: the same JavaScript API on the Wolvy iOS SDK 0.1.0 (AVPlayer and FairPlay): a Fabric view and a TurboModule in Objective-C++ over a Swift player. iOS 15.1 or later, CocoaPods.
- The Wolvy iOS SDK's sources are carried in the package (`ios/CORE_VERSION`), since CocoaPods trunk takes no new pods.
- `setQuality` on iOS sets a ceiling; captions, chapters, the watermark, fullscreen and the token provider work as on Android.
- The example app has an iOS app (UIScene life cycle, required by the iOS 27 SDK).

## 0.1.0

First release of `@wolvy/react-native`.

- `<WolvyPlayer>` (a Fabric component) on the Wolvy Android SDK 0.1.0: Wolvy's Widevine playback in your own app, with the viewer watermark and screen-capture protection.
- The web Player API's methods on a ref (`WolvyPlayerHandle`), its events as props (`onReady`, `onProgress`, `onError`…) and its error codes.
- Short viewer tokens: `video.tokenProvider` is asked for a fresh token from your server before one expires and once if Wolvy refuses it.
- Android only, React Native 0.85 or later with the new architecture. Keep `<WolvyPlayer>` mounted: the player lives in the component.
- Apache License 2.0.
