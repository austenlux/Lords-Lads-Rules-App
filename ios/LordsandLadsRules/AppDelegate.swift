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
    rootView.backgroundColor = .clear

    let screen = UIScreen.main.bounds
    let darkBg = UIColor(red: 18/255, green: 18/255, blue: 18/255, alpha: 1)

    let container = UIView(frame: screen)
    container.backgroundColor = darkBg

    if let bgLogo = UIImage(named: "BgLogo") {
      let iv = UIImageView(image: bgLogo)
      iv.contentMode = .scaleAspectFit
      iv.frame = screen
      container.addSubview(iv)
    }

    let overlay = UIView(frame: screen)
    overlay.backgroundColor = UIColor(red: 18/255, green: 18/255, blue: 18/255, alpha: 0.7)
    container.addSubview(overlay)

    container.addSubview(rootView)
    rootView.frame = screen
    rootView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    window = UIWindow(frame: screen)
    let rootViewController = UIViewController()
    rootViewController.view = container
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()

    let screenSize = screen.size
    let splash = UIView(frame: screen)
    splash.tag = 19740
    splash.backgroundColor = darkBg
    if let logo = UIImage(named: "LaunchLogo") {
      let side = min(screenSize.width, screenSize.height) * 0.88
      let iv = UIImageView(image: logo)
      iv.contentMode = .scaleAspectFit
      iv.frame = CGRect(
        x: (screenSize.width - side) / 2,
        y: (screenSize.height - side) / 2,
        width: side,
        height: side
      )
      splash.addSubview(iv)
    }
    window?.addSubview(splash)

    return true
  }
} 