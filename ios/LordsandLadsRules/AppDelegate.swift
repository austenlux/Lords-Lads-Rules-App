import UIKit
import React

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var bridge: RCTBridge?

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let bundleURL: URL?
    #if DEBUG
      bundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
    bridge = RCTCreateBridgeWithTurboModules(bundleURL, launchOptions as? [String: Any])
    guard let bridge = bridge else { return false }
    let rootView = RCTRootView(bridge: bridge, moduleName: "LordsandLadsRules", initialProperties: nil)
    
    if #available(iOS 13.0, *) {
      rootView.backgroundColor = UIColor(red: 18/255, green: 18/255, blue: 18/255, alpha: 1)
    } else {
      rootView.backgroundColor = UIColor(red: 18/255, green: 18/255, blue: 18/255, alpha: 1)
    }
    
    window = UIWindow(frame: UIScreen.main.bounds)
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()
    
    return true
  }
} 