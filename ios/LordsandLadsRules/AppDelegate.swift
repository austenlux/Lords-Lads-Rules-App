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

    let screenSize = screen.size
    let logoSide = min(screenSize.width, screenSize.height) * 0.88
    let logoFrame = CGRect(
      x: (screenSize.width - logoSide) / 2,
      y: (screenSize.height - logoSide) / 2,
      width: logoSide,
      height: logoSide
    )

    let container = UIView(frame: screen)
    container.backgroundColor = darkBg

    if let bgLogo = UIImage(named: "BgLogo") {
      let iv = UIImageView(image: bgLogo)
      iv.contentMode = .scaleAspectFit
      // BgLogo (1024x1024 square, circle fills edge-to-edge) renders larger than
      // LaunchLogo (1419x1393, more padding around circle) at the same frame size.
      let bgScale: CGFloat = 0.965
      let bgSide = logoSide * bgScale
      iv.frame = CGRect(
        x: (screenSize.width - bgSide) / 2,
        y: (screenSize.height - bgSide) / 2,
        width: bgSide,
        height: bgSide
      )
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

    let splash = UIView(frame: screen)
    splash.tag = 19740
    splash.backgroundColor = darkBg
    if let logo = UIImage(named: "LaunchLogo") {
      let iv = UIImageView(image: logo)
      iv.contentMode = .scaleAspectFit
      iv.frame = logoFrame
      splash.addSubview(iv)
    }
    window?.addSubview(splash)

    return true
  }
} 