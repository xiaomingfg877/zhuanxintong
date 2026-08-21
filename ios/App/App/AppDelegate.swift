import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 配置 AVAudioSession：使用纯 playback 类别（不带 mixWithOthers）
        // 这样 iOS 才会真正激活我们的音频会话，绕过静音开关
        configureAudioSession()
        // 应用启动时禁用息屏（专注时不希望屏幕熄灭）
        // 注意：可根据需要通过 UserDefault 控制
        UIApplication.shared.isIdleTimerDisabled = true
        return true
    }

    /// 配置音频会话为播放模式（绕过静音开关，独占音频）
    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // 使用纯 .playback 类别（不带 mixWithOthers），强制独占音频会话
            // 这样 iOS 会真正激活我们的音频会话，确保 WebView 中的白噪音能播放
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true, options: [])
            // 额外确保：再次激活
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("AVAudioSession config failed: \(error)")
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // 应用进入非活动状态时保持音频会话激活
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // 后台模式：由于配置了 audio 背景模式，可继续播放
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // 回到前台时重新激活音频会话
        configureAudioSession()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // 应用激活时强制重新激活音频会话（关键：每次回到前台都必须重新激活）
        configureAudioSession()
        // 确保息屏仍然禁用
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // 应用终止
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
