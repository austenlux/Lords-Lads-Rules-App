#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

static const NSInteger kSplashViewTag = 19740;

@interface NativeSplashScreen : NSObject <RCTBridgeModule>
@end

@implementation NativeSplashScreen

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

RCT_EXPORT_METHOD(dismiss) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *window = UIApplication.sharedApplication.windows.firstObject;
    UIView *splash = [window viewWithTag:kSplashViewTag];
    if (!splash) return;
    [UIView animateWithDuration:0.4
                     animations:^{ splash.alpha = 0; }
                     completion:^(BOOL finished) { [splash removeFromSuperview]; }];
  });
}

@end
