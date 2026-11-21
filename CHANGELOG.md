# Changelog

## 0.1.0

First release of `@wolvy/react-native`.

- `<WolvyPlayer>` (a Fabric component) on the Wolvy Android SDK 0.1.0: Wolvy's Widevine playback in your own app, with the viewer watermark and screen-capture protection.
- The web Player API's methods on a ref (`WolvyPlayerHandle`), its events as props (`onReady`, `onProgress`, `onError`…) and its error codes.
- Short viewer tokens: `video.tokenProvider` is asked for a fresh token from your server before one expires and once if Wolvy refuses it.
- Android only, React Native 0.85 or later with the new architecture. Keep `<WolvyPlayer>` mounted: the player lives in the component.
- Apache License 2.0.
