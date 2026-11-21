#import "WolvyPlayerModule.h"

#import <WolvyPlayerSpec/WolvyPlayerSpec.h>

#if __has_include(<WolvyReactNative/WolvyReactNative-Swift.h>)
#import <WolvyReactNative/WolvyReactNative-Swift.h>
#else
#import "WolvyReactNative-Swift.h"
#endif

/// Runs one command on the <WolvyPlayer> with this view tag. Rejections carry the web Player API's
/// error code, the message and, in userInfo, the reason, as on Android.
static void WolvyRun(double viewTag, NSString *command, NSDictionary *args,
                     RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject)
{
  WolvyRNPlayer *player = [WolvyRNPlayer find:(NSInteger)viewTag];
  if (player == nil) {
    reject(@"destroyed", @"The player view is not mounted.", nil);
    return;
  }
  [player run:command
         args:args
      resolve:^(id result) {
        resolve(result);
      }
       reject:^(NSString *code, NSString *message, NSString *reason) {
         NSDictionary *info = reason != nil ? @{@"reason" : reason} : @{};
         reject(code, message, [NSError errorWithDomain:@"net.wolvy.player" code:0 userInfo:info]);
       }];
}

@interface WolvyPlayerModule () <NativeWolvyPlayerModuleSpec>
@end

@implementation WolvyPlayerModule

RCT_EXPORT_MODULE()

// The Wolvy core is main-thread only.
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)load:(double)viewTag
             videoId:(NSString *)videoId
           accountId:(double)accountId
         viewerToken:(NSString *)viewerToken
    hasTokenProvider:(BOOL)hasTokenProvider
            autoplay:(BOOL)autoplay
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"load",
           @{
             @"videoId" : videoId,
             @"accountId" : @(accountId),
             @"viewerToken" : viewerToken,
             @"hasTokenProvider" : @(hasTokenProvider),
             @"autoplay" : @(autoplay)
           },
           resolve, reject);
}

- (void)play:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"play", @{}, resolve, reject);
}

- (void)pause:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"pause", @{}, resolve, reject);
}

- (void)seek:(double)viewTag seconds:(double)seconds resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"seek", @{@"seconds" : @(seconds)}, resolve, reject);
}

- (void)mute:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"mute", @{}, resolve, reject);
}

- (void)unmute:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"unmute", @{}, resolve, reject);
}

- (void)setVolume:(double)viewTag volume:(double)volume resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"setVolume", @{@"volume" : @(volume)}, resolve, reject);
}

- (void)setPlaybackRate:(double)viewTag rate:(double)rate resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"setPlaybackRate", @{@"rate" : @(rate)}, resolve, reject);
}

- (void)setQuality:(double)viewTag height:(double)height resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"setQuality", @{@"height" : @(height)}, resolve, reject);
}

- (void)setCaptions:(double)viewTag language:(NSString *)language resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"setCaptions", @{@"language" : language}, resolve, reject);
}

- (void)retry:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"retry", @{}, resolve, reject);
}

- (void)getState:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"getState", @{}, resolve, reject);
}

- (void)getQualities:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"getQualities", @{}, resolve, reject);
}

- (void)getCaptions:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"getCaptions", @{}, resolve, reject);
}

- (void)getProgress:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"getProgress", @{}, resolve, reject);
}

- (void)getVideoInfo:(double)viewTag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  WolvyRun(viewTag, @"getVideoInfo", @{}, resolve, reject);
}

- (void)resolveViewerToken:(double)viewTag requestId:(double)requestId token:(NSString *)token error:(NSString *)error
{
  [[WolvyRNPlayer find:(NSInteger)viewTag] resolveToken:(NSInteger)requestId token:token error:error];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeWolvyPlayerModuleSpecJSI>(params);
}

@end
