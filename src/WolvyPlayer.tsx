import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ElementRef,
} from 'react';
import {
  findNodeHandle,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import NativeModule from './NativeWolvyPlayerModule';
import NativeView from './WolvyPlayerViewNativeComponent';
import {
  checkVideo,
  parseEvent,
  toState,
  toWolvyError,
  WolvyError,
  type WolvyCaptions,
  type WolvyEvent,
  type WolvyProgress,
  type WolvyQualities,
  type WolvyState,
  type WolvyVideo,
  type WolvyVideoInfo,
} from './core';

/** What a ref to <WolvyPlayer> offers: the web Player API's methods. Promises reject with WolvyError. */
export interface WolvyPlayerHandle {
  load(video: WolvyVideo, autoplay?: boolean): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Returns the time jumped to. */
  seek(seconds: number): Promise<number>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  /** A height from getQualities(), or null for automatic. */
  setQuality(height: number | null): Promise<void>;
  /** A language from getCaptions(), or null to turn captions off. */
  setCaptions(language: string | null): Promise<void>;
  /** After an error: try again from where playback stopped. */
  retry(): Promise<void>;
  getState(): Promise<WolvyState>;
  getQualities(): Promise<WolvyQualities>;
  getCaptions(): Promise<WolvyCaptions>;
  getProgress(): Promise<WolvyProgress>;
  getVideoInfo(): Promise<WolvyVideoInfo | null>;
}

export interface WolvyPlayerProps extends ViewProps {
  /** Loaded when it changes (another video id or token). Or call ref.load(). */
  video?: WolvyVideo;
  /** Default true. */
  autoplay?: boolean;
  /** False for a bare player: draw your own controls with the ref's methods. */
  showControls?: boolean;
  onReady?: (state: WolvyState) => void;
  onPlay?: (currentTime: number) => void;
  onPause?: (currentTime: number) => void;
  onEnded?: () => void;
  onSeeked?: (currentTime: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onProgress?: (progress: WolvyProgress) => void;
  onVolumeChange?: (volume: number, muted: boolean) => void;
  onRateChange?: (playbackRate: number) => void;
  onQualityChange?: (qualities: WolvyQualities) => void;
  onCaptionsChange?: (active: string | null) => void;
  /** The player's fullscreen button: your app resizes the view. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  onError?: (error: WolvyError) => void;
  /** Android only: the caption text to show now, for apps that draw their own captions. */
  onCaptionCue?: (text: string | null) => void;
  /** Every event, typed. */
  onEvent?: (event: WolvyEvent) => void;
}

/**
 * Wolvy's DRM-protected player (Widevine, the viewer watermark, screen-capture protection),
 * on the native Wolvy Android SDK. While it is on screen the app's whole window is protected
 * from capture. Android only in this version.
 */
export const WolvyPlayer = forwardRef<WolvyPlayerHandle, WolvyPlayerProps>(
  function WolvyPlayerComponent(props, ref) {
    const {
      video,
      autoplay = true,
      showControls = true,
      style,
      ...viewProps
    } = props;
    const native = useRef<ElementRef<typeof NativeView>>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    const videoRef = useRef<WolvyVideo | undefined>(undefined);

    const tag = useCallback((): number => {
      const t = native.current ? findNodeHandle(native.current) : null;
      if (t == null)
        throw new WolvyError(
          'not_ready',
          'The player view is not mounted yet.'
        );
      return t;
    }, []);

    const call = useCallback(
      async <T,>(fn: (viewTag: number) => Promise<T>): Promise<T> => {
        try {
          return await fn(tag());
        } catch (e) {
          throw toWolvyError(e);
        }
      },
      [tag]
    );

    const load = useCallback(
      async (v: WolvyVideo, play = true) => {
        checkVideo(v);
        videoRef.current = v;
        await call((t) =>
          NativeModule.load(
            t,
            v.videoId,
            v.accountId,
            v.viewerToken,
            v.tokenProvider != null,
            play
          )
        );
      },
      [call]
    );

    useImperativeHandle(
      ref,
      (): WolvyPlayerHandle => ({
        load,
        play: () => call((t) => NativeModule.play(t)),
        pause: () => call((t) => NativeModule.pause(t)),
        seek: (s) => call((t) => NativeModule.seek(t, s)),
        mute: () => call((t) => NativeModule.mute(t)),
        unmute: () => call((t) => NativeModule.unmute(t)),
        setVolume: (v) => call((t) => NativeModule.setVolume(t, v)),
        setPlaybackRate: (r) => call((t) => NativeModule.setPlaybackRate(t, r)),
        setQuality: (h) => call((t) => NativeModule.setQuality(t, h ?? -1)),
        setCaptions: (l) => call((t) => NativeModule.setCaptions(t, l ?? '')),
        retry: () => call((t) => NativeModule.retry(t)),
        getState: async () =>
          toState(JSON.parse(await call((t) => NativeModule.getState(t)))),
        getQualities: async () =>
          JSON.parse(
            await call((t) => NativeModule.getQualities(t))
          ) as WolvyQualities,
        getCaptions: async () =>
          JSON.parse(
            await call((t) => NativeModule.getCaptions(t))
          ) as WolvyCaptions,
        getProgress: async () =>
          JSON.parse(
            await call((t) => NativeModule.getProgress(t))
          ) as WolvyProgress,
        getVideoInfo: async () =>
          JSON.parse(
            await call((t) => NativeModule.getVideoInfo(t))
          ) as WolvyVideoInfo | null,
      }),
      [call, load]
    );

    // The `video` prop: load when another video or token is given.
    const videoKey = video
      ? `${video.videoId}:${video.accountId}:${video.viewerToken}`
      : '';
    useEffect(() => {
      if (!video) return;
      load(video, autoplay).catch((e: unknown) =>
        propsRef.current.onError?.(toWolvyError(e))
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoKey]);

    const onWolvyEvent = useCallback(
      (e: { nativeEvent: { name: string; data: string } }) => {
        const ev = parseEvent(e.nativeEvent.name, e.nativeEvent.data);
        if (!ev) return;
        const p = propsRef.current;
        p.onEvent?.(ev);
        switch (ev.name) {
          case 'ready':
            p.onReady?.(ev.state);
            break;
          case 'play':
            p.onPlay?.(ev.currentTime);
            break;
          case 'pause':
            p.onPause?.(ev.currentTime);
            break;
          case 'ended':
            p.onEnded?.();
            break;
          case 'seeked':
            p.onSeeked?.(ev.currentTime);
            break;
          case 'timeupdate':
            p.onTimeUpdate?.(ev.currentTime, ev.duration);
            break;
          case 'progress':
            p.onProgress?.(ev.progress);
            break;
          case 'volumechange':
            p.onVolumeChange?.(ev.volume, ev.muted);
            break;
          case 'ratechange':
            p.onRateChange?.(ev.playbackRate);
            break;
          case 'qualitychange':
            p.onQualityChange?.(ev.qualities);
            break;
          case 'captionschange':
            p.onCaptionsChange?.(ev.active);
            break;
          case 'fullscreenchange':
            p.onFullscreenChange?.(ev.fullscreen);
            break;
          case 'error':
            p.onError?.(ev.error);
            break;
          case 'captioncue':
            p.onCaptionCue?.(ev.text);
            break;
        }
      },
      []
    );

    const onTokenRequest = useCallback(
      async (e: { nativeEvent: { requestId: number; videoId: string } }) => {
        const { requestId } = e.nativeEvent;
        let viewTag: number;
        try {
          viewTag = tag();
        } catch {
          return;
        }
        const v = videoRef.current;
        const provider = v?.tokenProvider;
        if (!v || !provider) {
          NativeModule.resolveViewerToken(
            viewTag,
            requestId,
            '',
            'No token provider.'
          );
          return;
        }
        try {
          const token = await provider(v);
          if (token) videoRef.current = { ...v, viewerToken: token };
          NativeModule.resolveViewerToken(viewTag, requestId, token ?? '', '');
        } catch (err) {
          NativeModule.resolveViewerToken(
            viewTag,
            requestId,
            '',
            err instanceof Error ? err.message : 'The token provider failed.'
          );
        }
      },
      [tag]
    );

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      return (
        <View style={[styles.unsupported, style]} {...viewProps}>
          <Text style={styles.unsupportedText}>
            The Wolvy player runs on Android and iOS.
          </Text>
        </View>
      );
    }
    return (
      <NativeView
        ref={native}
        style={style}
        {...viewProps}
        showControls={showControls}
        onWolvyEvent={onWolvyEvent}
        onTokenRequest={onTokenRequest}
      />
    );
  }
);

const styles = StyleSheet.create({
  unsupported: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  unsupportedText: { color: '#fff' },
});

WolvyPlayer.displayName = 'WolvyPlayer';
