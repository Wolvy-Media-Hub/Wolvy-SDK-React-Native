#import "WolvyPlayerComponentView.h"

#import <react/renderer/components/WolvyPlayerSpec/ComponentDescriptors.h>
#import <react/renderer/components/WolvyPlayerSpec/EventEmitters.h>
#import <react/renderer/components/WolvyPlayerSpec/Props.h>
#import <react/renderer/components/WolvyPlayerSpec/RCTComponentViewHelpers.h>

#if __has_include(<WolvyReactNative/WolvyReactNative-Swift.h>)
#import <WolvyReactNative/WolvyReactNative-Swift.h>
#else
#import "WolvyReactNative-Swift.h"
#endif

using namespace facebook::react;

@interface WolvyPlayerComponentView () <RCTWolvyPlayerViewViewProtocol>
@end

/// Glue only: the player is WolvyRNPlayer (Swift), shown as this component's content. Its events
/// go to JavaScript through the codegen event emitter; the TurboModule finds it by React tag.
@implementation WolvyPlayerComponentView {
  WolvyRNPlayer *_player;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<WolvyPlayerViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled
{
  // The view holds a player and its state: it is never handed to another <WolvyPlayer>.
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const WolvyPlayerViewProps>();
    _props = defaultProps;

    _player = [[WolvyRNPlayer alloc] initWithFrame:frame];
    __weak WolvyPlayerComponentView *weakSelf = self;
    _player.onEvent = ^(NSString *name, NSString *data) {
      [weakSelf emitEvent:name data:data];
    };
    _player.onTokenRequest = ^(NSInteger requestId, NSString *videoId) {
      [weakSelf emitTokenRequest:requestId videoId:videoId];
    };
    self.contentView = _player;
  }
  return self;
}

- (void)setTag:(NSInteger)tag
{
  [super setTag:tag];
  _player.reactTag = tag;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<WolvyPlayerViewProps const>(props);
  _player.showControls = newProps.showControls;
  [super updateProps:props oldProps:oldProps];
}

- (void)emitEvent:(NSString *)name data:(NSString *)data
{
  if (!_eventEmitter) {
    return;
  }
  std::static_pointer_cast<WolvyPlayerViewEventEmitter const>(_eventEmitter)
      ->onWolvyEvent({.name = std::string(name.UTF8String), .data = std::string(data.UTF8String)});
}

- (void)emitTokenRequest:(NSInteger)requestId videoId:(NSString *)videoId
{
  if (!_eventEmitter) {
    return;
  }
  std::static_pointer_cast<WolvyPlayerViewEventEmitter const>(_eventEmitter)
      ->onTokenRequest({.requestId = (int)requestId, .videoId = std::string(videoId.UTF8String)});
}

- (void)dealloc
{
  // The component was unmounted: stop and free the player.
  [_player releasePlayer];
}

@end
