/**
 * Phase 3, step 1 of the Wolvy SDK plan: does hardware-protected (Widevine L1) video show
 * inside a React Native view? Paste the embed_url from POST /v1/videos/{id}/playback-tokens
 * and press Play. The native view (SpikePlayerView) reports what it did; "Copy report" copies it.
 */
import React, { useState } from 'react';
import { Button, StatusBar, StyleSheet, TextInput, View, requireNativeComponent, ViewProps } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type SpikeProps = ViewProps & { embedUrl: string };
const WolvySpikeView = requireNativeComponent<SpikeProps>('WolvySpikeView');

export default function App() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Paste the embed_url from the API (https://embed.wolvy.stream/…?vt=…)"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="Play" onPress={() => setUrl(text.trim() + (text.trim() === url ? ' ' : ''))} />
        <View style={styles.player}>{url ? <WolvySpikeView style={StyleSheet.absoluteFill} embedUrl={url.trim()} key={url} /> : null}</View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  input: { color: '#fff', borderColor: '#555', borderWidth: 1, margin: 8, padding: 8, borderRadius: 6 },
  player: { flex: 1, backgroundColor: '#000' },
});
