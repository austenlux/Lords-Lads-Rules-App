#import "RCTVoiceAssistant.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>
#import "LordsandLadsRules-Swift.h"

@interface RCTVoiceAssistant () <VoiceAssistantEventDelegate>
@end

@implementation RCTVoiceAssistant {
  VoiceAssistantSwift *_swiftModule;
}

RCT_EXPORT_MODULE(VoiceAssistant)

- (instancetype)init {
  self = [super init];
  if (self) {
    _swiftModule = [[VoiceAssistantSwift alloc] init];
    _swiftModule.eventDelegate = self;
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// MARK: - NativeVoiceAssistantSpec

- (void)checkModelStatus:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  NSString *status = [_swiftModule checkModelStatus];
  resolve(status);
}

- (void)downloadModel:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
  [_swiftModule downloadModelWithResolve:^(NSString *result) {
    resolve(result);
  } reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

- (void)startListening:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
  [_swiftModule startListeningWithResolve:^(NSString *result) {
    resolve(result);
  } reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

- (void)stopListening {
  [_swiftModule stopListening];
}

- (void)askQuestion:(NSString *)fullPrompt
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  [_swiftModule askQuestionWithFullPrompt:fullPrompt resolve:^(NSString *result) {
    resolve(result);
  } reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

- (void)speak:(NSString *)text {
  [_swiftModule speakWithText:text];
}

- (void)stopSpeaking {
  [_swiftModule stopSpeaking];
}

- (void)stopAssistant {
  [_swiftModule stopAssistant];
}

- (void)getAvailableVoices:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject {
  [_swiftModule getAvailableVoicesWithResolve:^(NSString *result) {
    resolve(result);
  } reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

- (void)setVoice:(NSString *)voiceId {
  [_swiftModule setVoiceWithVoiceId:voiceId];
}

- (void)setThinkingSoundEnabled:(BOOL)enabled {
  [_swiftModule setThinkingSoundEnabledWithEnabled:enabled];
}

- (void)markSpeechQueueComplete {
  [_swiftModule markSpeechQueueComplete];
}

- (void)invalidate {
  [_swiftModule invalidate];
  [super invalidate];
}

// MARK: - VoiceAssistantEventDelegate

- (void)onSpeechPartialResults:(NSString *)value {
  [self emitOnSpeechPartialResults:@{@"value": value ?: @""}];
}

- (void)onSpeechFinalResults:(NSString *)value {
  [self emitOnSpeechFinalResults:@{@"value": value ?: @""}];
}

- (void)onAIChunkReceived:(NSString *)chunk {
  [self emitOnAIChunkReceived:@{@"chunk": chunk ?: @""}];
}

- (void)onDownloadProgress:(double)bytesDownloaded {
  [self emitOnDownloadProgress:@{@"bytesDownloaded": @(bytesDownloaded)}];
}

- (void)onTTSFinished {
  [self emitOnTTSFinished:@{@"status": @"done"}];
}

// MARK: - TurboModule

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeVoiceAssistantSpecJSI>(params);
}

@end
