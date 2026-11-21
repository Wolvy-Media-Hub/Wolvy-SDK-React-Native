# Wolvy React Native SDK (`@wolvy/react-native`)

**0.3.0.** Android and iOS. React Native 0.85 and the new architecture (a Fabric component and a TurboModule).

Plays Wolvy's DRM-protected video in React Native apps with the viewer watermark, screen-capture protection and the account's quality rules, and the same methods and events as Wolvy's web Player API. Built on the [Wolvy Android SDK](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Android) (Widevine) and the [Wolvy iOS SDK](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-iOS) (FairPlay): this package holds no playback logic of its own, and the same JavaScript runs on both.

- Your app's package name (Android) and bundle id (iOS) must be on your account's **Allowed apps** (Wolvy dashboard → Settings → Protection), each with its platform.
- The viewer token is signed on **your server** (`POST /v1/videos/{id}/playback-tokens`, or the [PHP](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-PHP) and [Node.js](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Node) SDKs). Keep it short-lived and give a `tokenProvider`.

## Install

```bash
npm install @wolvy/react-native
```

React Native 0.85 or later with the new architecture.

- **Android:** the Wolvy Android SDK (`net.wolvy:wolvy-player`) comes from Maven Central with it. `minSdkVersion` 24.
- **iOS:** `cd ios && pod install`. iOS 15.1 or later. The Wolvy iOS SDK is inside the package (a pinned copy of its sources, see `ios/CORE_VERSION`): CocoaPods trunk takes no new pods. Apps built with the iOS 27 SDK must use the UIScene life cycle (the example's `AppDelegate.swift` shows the change to React Native's template).

## Use

```tsx
import { useRef } from 'react';
import { WolvyPlayer, type WolvyPlayerHandle } from '@wolvy/react-native';

export function Lesson({ videoId, accountId, token }: Props) {
  const player = useRef<WolvyPlayerHandle>(null);
  return (
    <WolvyPlayer
      ref={player}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      video={{
        videoId,
        accountId,
        viewerToken: token,
        tokenProvider: (v) => myServer.freshViewerToken(v.videoId), // signed on your server
      }}
      onProgress={(p) => { if (p.percent >= 90) markLessonComplete(); }}  // seconds actually watched
      onError={(e) => log(e.code, e.reason)}
    />
  );
}
```

`videoFromEmbedUrl(url)` reads the three values from the `embed_url` that the playback-tokens call returns.

| Ref (`WolvyPlayerHandle`) | |
|---|---|
| `load(video, autoplay?)` | Or the `video` prop |
| `play()`, `pause()`, `seek(seconds)`, `mute()`, `unmute()`, `setVolume(0..1)` | |
| `setPlaybackRate(rate)` | 0.5, 0.75, 1, 1.25, 1.5 or 2 |
| `setQuality(height or null)`, `setCaptions(language or null)` | null = automatic / off |
| `getState()`, `getQualities()`, `getCaptions()`, `getProgress()`, `getVideoInfo()` | |
| `retry()` | After an error |

| Props | |
|---|---|
| `video`, `autoplay` (default true), `showControls` (default true) | |
| `onReady`, `onPlay`, `onPause`, `onEnded`, `onSeeked`, `onTimeUpdate`, `onProgress`, `onVolumeChange`, `onRateChange`, `onQualityChange`, `onCaptionsChange`, `onFullscreenChange`, `onError`, `onCaptionCue`, `onEvent` (every event, typed) | |

Errors are `WolvyError` with the web codes (`network_error`, `playback_error`, `device_not_supported`, `not_ready`, `invalid_argument`, `destroyed`, `failed`) and a `reason` (`app_not_allowed`, `viewer_token_required`, `hardware_drm_required`…).

## Good to know

- **Keep `<WolvyPlayer>` mounted.** The native player lives in the component: if React unmounts it (for example, moving it into a `Modal` for fullscreen), playback starts again from the beginning. For fullscreen, change its style in place (the example shows how).
- **Screen capture.** Android: the whole window is protected from screenshots and recordings while the player is on screen (FLAG_SECURE). iOS: iOS keeps the FairPlay picture out of screenshots, recordings and mirroring by itself (the picture is black there).
- **Quality.** Android follows Wolvy's licence server: hardware DRM gets every quality, software DRM 480p and below, and nothing at all when the account has App-Only on. iOS has hardware DRM on every device; `setQuality` sets a ceiling there (AVPlayer adapts below it). FairPlay needs a real iPhone or iPad: the simulator shows the steps up to the licence only.
- **Fullscreen**: the player's button calls `onFullscreenChange`; your app resizes the view (the example shows how).
- **App protection.** Set it up once per app in the dashboard (Settings → Protection → Allowed apps → Protection):
  - **Android:** the app signing key's SHA-256 and your own Play Integrity keys;
  - **iOS:** your Apple team id.

  The app then proves it is genuine before playback, and plays like Wolvy Player (with App-Only on, also on Android phones without hardware DRM). Only your published app is proven: sideloaded or re-signed copies, rooted phones and emulators are refused. There's nothing to code. `state.attested` says whether it applies.

## Develop

Run `yarn install`, `yarn lint`, `yarn typecheck`, `yarn test`, and `cd example/android && ./gradlew assembleRelease` (Android) or `cd example/ios && pod install` then build `ReactNativeExample.xcworkspace` in Xcode (iOS; CocoaPods wants a UTF-8 locale, `export LANG=en_US.UTF-8`). Add `net.wolvy.player.reactnative.example` to a test account's Allowed apps, platform Android and platform iOS.

On iOS the native side is thin glue: `ios/WolvyPlayerComponentView.mm` (the Fabric view; codegen name `WolvyPlayerView`), `ios/WolvyPlayerModule.mm` (the TurboModule) and `ios/WolvyRNPlayer.swift` (the player). To update the Wolvy iOS SDK inside the package: `scripts/sync-ios-core.sh ../Wolvy-SDK-iOS` (a checkout at the wanted tag); CI checks the copy against the commit in `ios/CORE_VERSION`. `spike/` (on its own branch) is the phase 3 step 1 test app.

To try changes to the Wolvy Android SDK, build it into your local Maven repository and set `wolvy.useMavenLocal=true` in the app's `android/gradle.properties`:

```bash
git clone https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Android && cd Wolvy-SDK-Android && ./gradlew :wolvy-player:publishToMavenLocal
```

## Licence

Apache License 2.0 ([LICENSE](LICENSE)).
