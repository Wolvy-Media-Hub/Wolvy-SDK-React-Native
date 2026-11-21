# Wolvy React Native SDK (`@wolvy/react-native`)

**In development (0.1.0). Not published yet** (npm, organisation `@wolvy`). Android only in this version; iOS comes with the iOS SDK. React Native 0.85 and the new architecture (a Fabric component and a TurboModule).

Plays Wolvy's DRM-protected video in React Native apps with the viewer watermark, screen-capture protection and the account's quality rules, and the same methods and events as Wolvy's web Player API. Built on the [Wolvy Android SDK](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Android): this package holds no playback logic of its own.

- Your app's package name must be on your account's **Allowed apps** (Wolvy dashboard → Settings → Protection).
- The viewer token is signed on **your server** (`POST /v1/videos/{id}/playback-tokens`, or the [PHP](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-PHP) and [Node.js](https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Node) SDKs). Keep it short-lived and give a `tokenProvider`.

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
- **The whole window is protected** from screenshots and recordings while the player is on screen (FLAG_SECURE).
- **Quality** follows Wolvy's licence server: hardware DRM gets every quality, software DRM 480p and below, and nothing at all when the account has App-Only on.
- **Fullscreen**: the player's button calls `onFullscreenChange`; your app resizes the view (the example shows how).

## Develop

Until the Android SDK is on Maven Central, build it into your local Maven repository first, and keep `mavenLocal()` in the app's repositories (the example does):

```bash
git clone https://github.com/Wolvy-Media-Hub/Wolvy-SDK-Android && cd Wolvy-SDK-Android && ./gradlew :wolvy-player:publishToMavenLocal
```

Then `yarn install`, `yarn lint`, `yarn typecheck`, `yarn test`, and `cd example/android && ./gradlew assembleRelease`. Add `net.wolvy.player.reactnative.example` to a test account's Allowed apps. `spike/` (on its own branch) is the phase 3 step 1 test app.

## Licence

Apache License 2.0 ([LICENSE](LICENSE)).
