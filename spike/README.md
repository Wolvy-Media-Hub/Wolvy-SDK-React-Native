# Spike: React Native host

App id `net.wolvy.spike.reactnative`. React Native 0.85.3 (new architecture, like Wolvy Player); the same native view as a legacy view manager (`<WolvySpikeView embedUrl="…" />`) through the new architecture's interop layer. Android only.

The three spikes share one native view, `SpikePlayerView` (Kotlin): it calls `https://wolvy.net/api/app_render_video` with the app's package name, plays the DASH manifest with Widevine through Media3 1.11 on a secure `SurfaceView` (CDN token and session id as headers, as Wolvy Player does), and shows the Widevine level, the decoder Media3 picked (`.secure` = hardware path), the resolution, frames drawn and errors. **Copy report** copies that without any token. The window has `FLAG_SECURE`.

Input: the `embed_url` from `POST /v1/videos/{id}/playback-tokens` (`https://embed.wolvy.stream/{video}/{base64 account}?vt=…`). The app id must be on the account's Allowed apps.

**Not the SDK.** A throwaway test bench for phase 3, step 1 of the SDK plan: can hardware-protected (Widevine L1) video be shown in this kind of app? The SDK itself comes next, in `Wolvy-SDK-Android`.

Build (Node 20+, JDK 17, Android SDK 36, NDK 27.1): `npm ci && cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`. Native code: `android/app/src/main/java/net/wolvy/spike/`.
