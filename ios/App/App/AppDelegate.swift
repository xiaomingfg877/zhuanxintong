import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 配置 AVAudioSession：使用 playback 类别，绕过 iOS 静音开关
        // 这样白噪音即使手机处于静音模式也能正常播放
        configureAudioSession()
        return true
    }

    /// 配置音频会话为播放模式（绕过静音开关）
    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // playback: 即使静音开关打开也能播放
            // mixWithOthers: 1，允许和其他应用混音（避免打断用户当前听的音乐）
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true, options: [])
        } catch {
            // 配置失败时静默处理，Web 端会兜底处理
            print("AVAudioSession config failed: \(error)")
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // 应用进入非活动状态时保持音频会话
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // 后台模式：由于配置了 audio 背景模式，可继续播放
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // 回到前台时重新激活音频会话
        configureAudioSession()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // 应用激活时确保音频会话可用
        configureAudioSession()
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
