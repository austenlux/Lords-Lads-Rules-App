#import <Foundation/Foundation.h>

@class RCTBridge;

NS_ASSUME_NONNULL_BEGIN

/**
 * Bridge delegate that sets up the TurboModule manager so custom TurboModules
 * (e.g. VoiceAssistant) are registered and TurboModuleRegistry.get() can find them.
 * Use this when not using RCTAppDelegate so that TurboModules still work.
 */
@interface RCTBridgeDelegateWithTurboModules : NSObject

/** Block called to get the JS bundle URL. Required. */
@property (nonatomic, copy) NSURL * _Nullable (^bundleURLBlock)(void);

- (instancetype)initWithBundleURLBlock:(NSURL * _Nullable (^)(void))block;

@end

/**
 * Creates an RCTBridge with TurboModule support. Use from Swift instead of
 * RCTBridge(delegate:) so the ObjC delegate’s protocol conformance is used.
 */
#if defined(__cplusplus)
extern "C" {
#endif
RCTBridge *RCTCreateBridgeWithTurboModules(NSURL * _Nullable bundleURL, NSDictionary * _Nullable launchOptions);
#if defined(__cplusplus)
}
#endif

NS_ASSUME_NONNULL_END
