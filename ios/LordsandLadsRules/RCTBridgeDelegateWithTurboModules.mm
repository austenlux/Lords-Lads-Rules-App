#import "RCTBridgeDelegateWithTurboModules.h"
#import <React/RCTBridge.h>
#import <React/RCTBridgeDelegate.h>
#import <React/RCTCxxBridgeDelegate.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <ReactCommon/RCTTurboModuleManager.h>
#import <React/RCTSurfacePresenterBridgeAdapter.h>
#import <react/renderer/runtimescheduler/RuntimeScheduler.h>
#import <react/renderer/runtimescheduler/RuntimeSchedulerCallInvoker.h>

#import <React-RCTAppDelegate/RCTAppSetupUtils.h>

@interface RCTBridgeDelegateWithTurboModules () <RCTBridgeDelegate, RCTCxxBridgeDelegate, RCTTurboModuleManagerDelegate>
@end

@implementation RCTBridgeDelegateWithTurboModules

- (instancetype)initWithBundleURLBlock:(NSURL * _Nullable (^)(void))block {
  if (self = [super init]) {
    _bundleURLBlock = [block copy];
    // TurboModule is off by default; turn it on so TurboModuleRegistry.get() works.
    RCTEnableTurboModule(YES);
  }
  return self;
}

#pragma mark - RCTBridgeDelegate

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
  if (_bundleURLBlock) {
    return _bundleURLBlock() ?: [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  }
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
}

#pragma mark - RCTCxxBridgeDelegate

- (std::unique_ptr<facebook::react::JSExecutorFactory>)jsExecutorFactoryForBridge:(RCTBridge *)bridge {
  auto runtimeScheduler = std::make_shared<facebook::react::RuntimeScheduler>(RCTRuntimeExecutorFromBridge(bridge));
  std::shared_ptr<facebook::react::CallInvoker> callInvoker =
      std::make_shared<facebook::react::RuntimeSchedulerCallInvoker>(runtimeScheduler);
  RCTTurboModuleManager *turboModuleManager =
      [[RCTTurboModuleManager alloc] initWithBridge:bridge
                                           delegate:self
                                          jsInvoker:callInvoker];
  return RCTAppSetupDefaultJsExecutorFactory(bridge, turboModuleManager, runtimeScheduler);
}

#pragma mark - RCTTurboModuleManagerDelegate

- (Class)getModuleClassFromName:(const char *)name {
  // Return nil so RCTTurboModuleManager uses its fallback (getFallbackClassFromName + RCTGetModuleClasses).
  // That allows app TurboModules like RCTVoiceAssistant (exported as "VoiceAssistant") to be found.
  return nil;
}

- (id<RCTTurboModule>)getModuleInstanceFromClass:(Class)moduleClass {
  return nil;
}

@end

#pragma mark - Bridge factory (for Swift)

extern "C" RCTBridge *RCTCreateBridgeWithTurboModules(NSURL * _Nullable bundleURL, NSDictionary * _Nullable launchOptions) {
  RCTBridgeDelegateWithTurboModules *delegate =
      [[RCTBridgeDelegateWithTurboModules alloc] initWithBundleURLBlock:^NSURL * {
        return bundleURL ?: [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
      }];
  return [[RCTBridge alloc] initWithDelegate:delegate launchOptions:launchOptions];
}

