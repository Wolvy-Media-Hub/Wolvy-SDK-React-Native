// node --test (Node 22.6+ runs TypeScript by stripping types). Pure logic only: no React Native.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkVideo,
  decodeBase64,
  parseEvent,
  toWolvyError,
  videoFromEmbedUrl,
  WolvyError,
  WOLVY_ERROR_CODES,
  WOLVY_PLAYBACK_RATES,
} from '../core.ts';

test('reads the embed_url that the API returns', () => {
  const v = videoFromEmbedUrl(
    'https://embed.wolvy.stream/a1b2c3d4e5f60718293a/NDI=?vt=eyJ2aWQiOiJ1In0.sig%2B'
  );
  assert.equal(v.videoId, 'a1b2c3d4e5f60718293a');
  assert.equal(v.accountId, 42);
  assert.equal(v.viewerToken, 'eyJ2aWQiOiJ1In0.sig+');
  assert.equal(
    videoFromEmbedUrl('https://embed.wolvy.stream/v1/NDI?vt=x').accountId,
    42
  ); // unpadded
  assert.equal(
    videoFromEmbedUrl('https://embed.wolvy.stream/v1/NDI%3D?a=1&vt=x')
      .accountId,
    42
  );
});

test('keeps the token provider', () => {
  const provider = async () => 'fresh';
  assert.equal(
    videoFromEmbedUrl('https://embed.wolvy.stream/v1/NDI=?vt=x', provider)
      .tokenProvider,
    provider
  );
});

test('refuses URLs without the three values', () => {
  for (const url of [
    'https://embed.wolvy.stream/v1/NDI=',
    'https://embed.wolvy.stream/v1?vt=x',
    'https://embed.wolvy.stream/v1/bm90IGEgbnVtYmVy?vt=x',
    'not a url',
  ]) {
    assert.throws(
      () => videoFromEmbedUrl(url),
      (e: unknown) => e instanceof WolvyError && e.code === 'invalid_argument',
      url
    );
  }
  assert.throws(() =>
    checkVideo({ videoId: 'bad id!', accountId: 1, viewerToken: 't' })
  );
  assert.throws(() =>
    checkVideo({ videoId: 'v', accountId: 1.5, viewerToken: 't' })
  );
  assert.throws(() =>
    checkVideo({ videoId: 'v', accountId: 1, viewerToken: ' ' })
  );
});

test('base64, standard and URL-safe, padded or not', () => {
  assert.equal(decodeBase64('NDI='), '42');
  assert.equal(decodeBase64('NDI'), '42');
  assert.equal(decodeBase64('aGk_'), 'hi?');
  assert.equal(decodeBase64('aGk/'), 'hi?');
  assert.equal(decodeBase64('N'), null);
  assert.equal(decodeBase64('N!I='), null);
});

test('parses every native event', () => {
  assert.deepEqual(
    parseEvent('progress', '{"percent":90.5,"seconds":108,"duration":120}'),
    {
      name: 'progress',
      progress: { percent: 90.5, seconds: 108, duration: 120 },
    }
  );
  assert.deepEqual(
    parseEvent(
      'qualitychange',
      '{"available":[480,360],"selected":null,"playing":480}'
    ),
    {
      name: 'qualitychange',
      qualities: { available: [480, 360], selected: null, playing: 480 },
    }
  );
  assert.deepEqual(parseEvent('captionschange', '{"active":null}'), {
    name: 'captionschange',
    active: null,
  });
  assert.deepEqual(parseEvent('ended', '{}'), { name: 'ended' });
  const e = parseEvent(
    'error',
    '{"code":"device_not_supported","message":"needs L1","reason":"hardware_drm_required"}'
  );
  if (!e || e.name !== 'error') throw new Error('expected an error event');
  assert.ok(e.error instanceof WolvyError);
  assert.equal(e.error.code, 'device_not_supported');
  assert.equal(e.error.reason, 'hardware_drm_required');
  assert.equal(parseEvent('nope', '{}'), null);
  assert.equal(parseEvent('play', 'not json'), null);
});

test('native rejections become WolvyError', () => {
  const e = toWolvyError({
    code: 'playback_error',
    message: 'no',
    userInfo: { reason: 'app_not_allowed' },
  });
  assert.equal(e.code, 'playback_error');
  assert.equal(e.reason, 'app_not_allowed');
  assert.equal(
    toWolvyError({ code: 'something_else', message: 'x' }).code,
    'failed'
  );
  assert.equal(toWolvyError(null).code, 'failed');
});

test('codes and speeds match the web Player API', () => {
  assert.deepEqual(
    [...WOLVY_ERROR_CODES],
    [
      'network_error',
      'playback_error',
      'device_not_supported',
      'not_ready',
      'invalid_argument',
      'destroyed',
      'failed',
    ]
  );
  assert.deepEqual([...WOLVY_PLAYBACK_RATES], [0.5, 0.75, 1, 1.25, 1.5, 2]);
});

test('the ready state carries attested (app protection)', () => {
  const proven = parseEvent(
    'ready',
    '{"currentTime":0,"duration":81.5,"paused":true,"muted":false,"volume":1,"playbackRate":1,"attested":true}'
  );
  assert.equal(proven?.name, 'ready');
  assert.equal(proven?.name === 'ready' && proven.state.attested, true);
  assert.equal(proven?.name === 'ready' && proven.state.duration, 81.5);
  // An older native side sends no attested: false, never undefined.
  const older = parseEvent(
    'ready',
    '{"currentTime":0,"duration":10,"paused":true,"muted":false,"volume":1,"playbackRate":1}'
  );
  assert.equal(older?.name === 'ready' && older.state.attested, false);
});
