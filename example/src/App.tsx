/**
 * The Wolvy React Native SDK's example: paste the embed_url that your server gets from
 * POST /v1/videos/{id}/playback-tokens and press Play. In a real app the three values come from
 * your own server, and the viewer token is never made in the app.
 */
import { useRef, useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import {
  WolvyPlayer,
  videoFromEmbedUrl,
  type WolvyPlayerHandle,
  type WolvyVideo,
} from '@wolvy/react-native';

export default function App() {
  const player = useRef<WolvyPlayerHandle>(null);
  const [text, setText] = useState('');
  const [video, setVideo] = useState<WolvyVideo | undefined>();
  const [log, setLog] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const add = (line: string) =>
    setLog((l) =>
      [`${new Date().toISOString().slice(11, 19)}  ${line}`, ...l].slice(0, 200)
    );

  const play = () => {
    try {
      // A real app passes a tokenProvider: (v) => myServer.freshViewerToken(v.videoId)
      setVideo(videoFromEmbedUrl(text));
      add(`load ${text.split('?')[0]}`);
    } catch (e) {
      add(`not an embed URL with a viewer token: ${(e as Error).message}`);
    }
  };

  const tryCall = async (label: string, fn: () => Promise<unknown>) => {
    try {
      const r = await fn();
      add(r === undefined ? label : `${label} → ${JSON.stringify(r)}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      add(`${label}: ${err.code} ${err.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {!fullscreen && (
        <View>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="embed_url from your server (https://embed.wolvy.stream/…?vt=…)"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <Button title="Play" onPress={play} />
            <Button
              title="Pause"
              onPress={() => tryCall('pause()', () => player.current!.pause())}
            />
            <Button
              title="Progress"
              onPress={() =>
                tryCall('getProgress()', () => player.current!.getProgress())
              }
            />
            <Button
              title="+10 s"
              onPress={() =>
                tryCall('seek', async () =>
                  player.current!.seek(
                    (await player.current!.getState()).currentTime + 10
                  )
                )
              }
            />
          </View>
        </View>
      )}
      <WolvyPlayer
        ref={player}
        style={fullscreen ? styles.full : styles.player}
        video={video}
        onReady={(s) => add(`ready, ${Math.round(s.duration)} s`)}
        onPlay={(t) => add(`play at ${t.toFixed(1)}`)}
        onPause={(t) => add(`pause at ${t.toFixed(1)}`)}
        onEnded={() => add('ended')}
        onSeeked={(t) => add(`seeked to ${t.toFixed(1)}`)}
        onProgress={(p) => add(`progress ${p.percent} % (${p.seconds} s)`)}
        onQualityChange={(q) =>
          add(
            `quality ${JSON.stringify(q.available)}, picked ${q.selected ?? 'auto'}, playing ${q.playing}`
          )
        }
        onCaptionsChange={(a) => add(`captions ${a ?? 'off'}`)}
        onRateChange={(r) => add(`speed ${r}`)}
        onError={(e) => add(`error ${e.code} (${e.reason}): ${e.message}`)}
        onFullscreenChange={(f) => {
          setFullscreen(f);
          add(`fullscreen ${f}`);
        }}
      />
      {!fullscreen && (
        <ScrollView style={styles.log}>
          {log.map((l, i) => (
            <Text key={i} selectable style={styles.line}>
              {l}
            </Text>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  input: {
    color: '#fff',
    borderColor: '#555',
    borderWidth: 1,
    margin: 8,
    padding: 8,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  full: { flex: 1, backgroundColor: '#000' },
  log: { flex: 1, padding: 8 },
  line: { color: '#ccc', fontSize: 11 },
});
