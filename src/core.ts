// Types and pure logic of the React Native SDK (no 'react-native' import: unit-tested).

/** Gets a fresh viewer token from **your server** (never signed in the app). */
export type WolvyTokenProvider = (video: WolvyVideo) => Promise<string | null>;

/** The three values a playback needs, the same ones the embed URL and the deep link carry. */
export interface WolvyVideo {
  videoId: string;
  accountId: number;
  /** Signed on your server. Keep it short-lived and give a tokenProvider. */
  viewerToken: string;
  /** Asked for a fresh token when the one the player has expires within a minute, and once more if Wolvy refuses it. */
  tokenProvider?: WolvyTokenProvider;
}

export type WolvyErrorCode =
  | 'network_error'
  | 'playback_error'
  | 'device_not_supported'
  | 'not_ready'
  | 'invalid_argument'
  | 'destroyed'
  | 'failed';

export const WOLVY_ERROR_CODES: readonly WolvyErrorCode[] = [
  'network_error',
  'playback_error',
  'device_not_supported',
  'not_ready',
  'invalid_argument',
  'destroyed',
  'failed',
];

/** An error from the player: one of the web Player API's codes, and a reason (the server's code or the device's). */
export class WolvyError extends Error {
  readonly code: WolvyErrorCode;
  readonly reason: string | null;
  constructor(
    code: WolvyErrorCode,
    message: string,
    reason: string | null = null
  ) {
    super(message);
    this.name = 'WolvyError';
    this.code = code;
    this.reason = reason;
  }
}

export function errorCode(value: unknown): WolvyErrorCode {
  return WOLVY_ERROR_CODES.includes(value as WolvyErrorCode)
    ? (value as WolvyErrorCode)
    : 'failed';
}

/** A rejection from the native module (code, message, userInfo.reason) as a WolvyError. */
export function toWolvyError(e: unknown): WolvyError {
  if (e instanceof WolvyError) return e;
  const err = (e ?? {}) as {
    code?: unknown;
    message?: unknown;
    userInfo?: { reason?: unknown } | null;
  };
  const reason =
    typeof err.userInfo?.reason === 'string' ? err.userInfo.reason : null;
  return new WolvyError(
    errorCode(err.code),
    typeof err.message === 'string' ? err.message : 'The player failed.',
    reason
  );
}

export interface WolvyState {
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  /** The app proved itself to Wolvy for this video (app protection): it plays like Wolvy Player. */
  attested: boolean;
}

/** A state from the native side (an older one sends no attested). */
export function toState(d: Record<string, unknown>): WolvyState {
  const n = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    currentTime: n(d.currentTime),
    duration: n(d.duration),
    paused: d.paused === true,
    muted: d.muted === true,
    volume: n(d.volume, 1),
    playbackRate: n(d.playbackRate, 1),
    attested: d.attested === true,
  };
}
/** selected: the picked height, or null for automatic; playing: the height on screen. */
export interface WolvyQualities {
  available: number[];
  selected: number | null;
  playing: number | null;
}
export interface WolvyCaptionTrack {
  language: string;
  label: string;
}
export interface WolvyCaptions {
  available: WolvyCaptionTrack[];
  active: string | null;
}
/** Seconds actually played, each counted once: the same numbers as the web player. */
export interface WolvyProgress {
  percent: number;
  seconds: number;
  duration: number;
}
export interface WolvyVideoInfo {
  chapters: { start: number; end: number; title: string }[];
  moments: { timestamp: number; label: string }[];
  viewerId: string | null;
  /** 0xAARRGGBB, or null. */
  playerColor: number | null;
  poster: string | null;
}

/** Every event, with the web Player API's names and data. */
export type WolvyEvent =
  | { name: 'ready'; state: WolvyState }
  | { name: 'play'; currentTime: number }
  | { name: 'pause'; currentTime: number }
  | { name: 'ended' }
  | { name: 'seeked'; currentTime: number }
  | { name: 'timeupdate'; currentTime: number; duration: number }
  | { name: 'progress'; progress: WolvyProgress }
  | { name: 'volumechange'; volume: number; muted: boolean }
  | { name: 'ratechange'; playbackRate: number }
  | { name: 'qualitychange'; qualities: WolvyQualities }
  | { name: 'captionschange'; active: string | null }
  | { name: 'fullscreenchange'; fullscreen: boolean }
  | { name: 'error'; error: WolvyError }
  | { name: 'captioncue'; text: string | null };

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Reads one native event (its name and its data as JSON). Null for an unknown name or bad JSON. */
export function parseEvent(name: string, json: string): WolvyEvent | null {
  let d: Record<string, unknown>;
  try {
    d = (JSON.parse(json) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
  switch (name) {
    case 'ready':
      return { name, state: toState(d) };
    case 'play':
    case 'pause':
    case 'seeked':
      return { name, currentTime: num(d.currentTime) };
    case 'ended':
      return { name };
    case 'timeupdate':
      return {
        name,
        currentTime: num(d.currentTime),
        duration: num(d.duration),
      };
    case 'progress':
      return {
        name,
        progress: {
          percent: num(d.percent),
          seconds: num(d.seconds),
          duration: num(d.duration),
        },
      };
    case 'volumechange':
      return { name, volume: num(d.volume), muted: d.muted === true };
    case 'ratechange':
      return { name, playbackRate: num(d.playbackRate, 1) };
    case 'qualitychange':
      return { name, qualities: d as unknown as WolvyQualities };
    case 'captionschange':
      return { name, active: typeof d.active === 'string' ? d.active : null };
    case 'fullscreenchange':
      return { name, fullscreen: d.fullscreen === true };
    case 'error':
      return {
        name,
        error: new WolvyError(
          errorCode(d.code),
          typeof d.message === 'string' ? d.message : '',
          typeof d.reason === 'string' ? d.reason : null
        ),
      };
    case 'captioncue':
      return { name, text: typeof d.text === 'string' ? d.text : null };
  }
  return null;
}

/** Throws WolvyError('invalid_argument') when a value is not usable. */
export function checkVideo(v: WolvyVideo): WolvyVideo {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v.videoId)) {
    throw new WolvyError(
      'invalid_argument',
      'videoId must be 1 to 64 letters, digits, "-" or "_".'
    );
  }
  if (!Number.isInteger(v.accountId) || v.accountId <= 0) {
    throw new WolvyError(
      'invalid_argument',
      'accountId must be a positive whole number.'
    );
  }
  if (typeof v.viewerToken !== 'string' || v.viewerToken.trim() === '') {
    throw new WolvyError(
      'invalid_argument',
      'viewerToken is required: sign it on your server.'
    );
  }
  return v;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard or URL-safe base64, padding optional, to text. Null when it is not base64. */
/* eslint-disable no-bitwise */
export function decodeBase64(input: string): string | null {
  const s = input
    .trim()
    .replace(/[=]+$/, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (s === '' || s.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(s)) return null;
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const c of s) {
    buffer = (buffer << 6) | B64.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}
/* eslint-enable no-bitwise */

/**
 * Reads the three values from the embed_url that POST /v1/videos/{id}/playback-tokens returns:
 * https://embed.wolvy.stream/{videoId}/{base64 accountId}?vt=…
 */
export function videoFromEmbedUrl(
  url: string,
  tokenProvider?: WolvyTokenProvider
): WolvyVideo {
  const m = /^https?:\/\/[^/]+\/([^/?#]+)\/([^/?#]+)\/?\?(.*)$/.exec(
    url.trim()
  );
  const vt = m ? new RegExp('(?:^|&)vt=([^&#]*)').exec(m[3] ?? '') : null;
  if (!m || !vt || !vt[1]) {
    throw new WolvyError(
      'invalid_argument',
      'Expected https://embed.wolvy.stream/{videoId}/{base64 accountId}?vt=…'
    );
  }
  const account = Number(decodeBase64(decodeURIComponent(m[2] ?? '')) ?? NaN);
  if (!Number.isInteger(account) || account <= 0) {
    throw new WolvyError(
      'invalid_argument',
      'The second part of the path is not a base64 account id.'
    );
  }
  return checkVideo({
    videoId: decodeURIComponent(m[1] ?? ''),
    accountId: account,
    viewerToken: decodeURIComponent(vt[1]),
    tokenProvider,
  });
}

/** The speeds the player offers: the only values setPlaybackRate accepts. */
export const WOLVY_PLAYBACK_RATES: readonly number[] = [
  0.5, 0.75, 1, 1.25, 1.5, 2,
];
