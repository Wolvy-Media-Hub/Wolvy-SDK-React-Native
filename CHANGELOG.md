# Changelog

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
