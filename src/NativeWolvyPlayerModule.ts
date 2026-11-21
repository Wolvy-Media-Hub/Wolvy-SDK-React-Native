import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * The commands of one <WolvyPlayer>, by its view tag. Getters answer JSON strings.
 * Promises reject with the web Player API's error codes.
 */
export interface Spec extends TurboModule {
  load(
    viewTag: number,
    videoId: string,
    accountId: number,
    viewerToken: string,
    hasTokenProvider: boolean,
    autoplay: boolean
  ): Promise<void>;
  play(viewTag: number): Promise<void>;
  pause(viewTag: number): Promise<void>;
  seek(viewTag: number, seconds: number): Promise<number>;
  mute(viewTag: number): Promise<void>;
  unmute(viewTag: number): Promise<void>;
  setVolume(viewTag: number, volume: number): Promise<void>;
  setPlaybackRate(viewTag: number, rate: number): Promise<void>;
  /** -1 = automatic. */
  setQuality(viewTag: number, height: number): Promise<void>;
  /** '' = off. */
  setCaptions(viewTag: number, language: string): Promise<void>;
  retry(viewTag: number): Promise<void>;
  getState(viewTag: number): Promise<string>;
  getQualities(viewTag: number): Promise<string>;
  getCaptions(viewTag: number): Promise<string>;
  getProgress(viewTag: number): Promise<string>;
  /** 'null' before the video is loaded. */
  getVideoInfo(viewTag: number): Promise<string>;
  /** The answer to an onTokenRequest: a token, or '' with an error message. */
  resolveViewerToken(
    viewTag: number,
    requestId: number,
    token: string,
    error: string
  ): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WolvyPlayerModule');
