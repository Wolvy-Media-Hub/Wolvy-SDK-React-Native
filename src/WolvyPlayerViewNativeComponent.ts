import {
  codegenNativeComponent,
  type CodegenTypes,
  type ViewProps,
} from 'react-native';

export interface NativeProps extends ViewProps {
  showControls?: CodegenTypes.WithDefault<boolean, true>;
  /** Every player event: its web name and its data as JSON. */
  onWolvyEvent?: CodegenTypes.DirectEventHandler<
    Readonly<{ name: string; data: string }>
  >;
  /** The native player needs a fresh viewer token; answer with resolveViewerToken. */
  onTokenRequest?: CodegenTypes.DirectEventHandler<
    Readonly<{ requestId: CodegenTypes.Int32; videoId: string }>
  >;
}

export default codegenNativeComponent<NativeProps>('WolvyPlayerView');
