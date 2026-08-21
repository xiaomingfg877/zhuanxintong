# 专心通 iOS / Android 打包指南（免费版） - 中文版

>The English version is **under** this Chinese version.

本指南教你如何在 **Windows 电脑**上，不花一分钱，把「专心通」打包成真正的 iOS 应用（.ipa）和 Android 应用（.apk），安装到你的 iPhone / iPad / Android 手机上。

## 整体流程

### iOS：
```
SideStore 签名 → 装入 iPhone
```

### Android：
```
.apk 文件 → 直接安装到 Android 手机
```

| 步骤 | 工具 | 费用 |
|------|------|------|
| 1. 下载 .ipa / .apk | 浏览器 | 免费 |
| 2. 签名安装到手机 | iOS: SideStore + 免费 Apple ID / Android: 直接安装 | 免费 |

**注意**：免费 Apple ID 签名的 iOS App 有效期为 7 天，到期后需用 SideStore 重新签名。Android 的 APK 可以直接安装，无时间限制。

| 步骤 | 工具 | 费用 |
|------|------|------|
| 1. 下载 .ipa | 浏览器 | 免费 |
| 2. 签名安装到手机 | SideStore + 免费 Apple ID | 免费 |

**注意**：免费 Apple ID 签名的 App 有效期为 7 天，到期后需用 SideStore 重新签名。

---

## 第一步：用 SideStore 安装到 iPhone

### 1.1 准备工作

**确认你的 Apple ID 是免费的（非开发者账号）**，如果没有：
1. 访问 https://appleid.apple.com 注册免费 Apple ID
2. 在 iPhone 上登录：设置 → 通用 → 传输或还原 iPhone → 恢复

**在 iPhone 上开启开发者模式**：
- 设置 → 隐私与安全性 → 开发者模式 → 打开

### 1.2 安装 SideStore

SideStore 是 SideStore（AltStore 的 Windows 版本），用免费 Apple ID 签名安装 .ipa。

**方法 A：直接用 SideStore Installer（最简单）**
1. 下载 SideStore Installer：访问 https://sidestore.io 下载最新版
2. 用 iTunes 或 Apple 设备连接 iPhone
3. 运行 SideStore Installer，按提示操作
4. SideStore 会自动安装到 iPhone

**方法 B：手动安装 SideStore**
1. 在电脑上安装 [iTunes](https://www.apple.com/itunes/download/) 或 [Apple 设备组件](https://learn.microsoft.com/zh-cn/windows/client-management/install-apple-devices)
2. 下载 SideStore 最新版 .ipa：https://github.com/SideStore/SideStore/releases
3. 用 [Sideloadly](https://sideloadly.io)（Windows 上最好用的 sideloading 工具）安装 SideStore：
   - 下载 Sideloadly 并安装
   - 连接 iPhone
   - 打开 Sideloadly，拖入 SideStore.ipa
   - 输入 Apple ID 和密码
   - 点开始

### 1.3 用 SideStore 安装专心通

1. iPhone 上打开 **SideStore**
2. 用数据线连接 iPhone 和电脑
3. 确保 SideStore 的服务正在运行（Sideloadly 保持打开）
4. 在 SideStore 中：
   - 点左上角 +
   - 选择我们下载的 `zhuanxintong.ipa`
   - 点 Install
5. 等待安装完成

### 1.4 信任开发者证书
首次打开前需要：
- iPhone：设置 → 通用 → VPN与设备管理
- 找到你的 Apple ID 对应的开发者证书
- 点 **信任**

### 1.5 打开专心通
- 在主屏幕找到「专心通」图标
- 点击打开，即可使用

---

## 常见问题

**Q: 7 天后过期怎么办？**
A: 用 SideStore 重新签名即可。连接电脑，打开 Sideloadly，重新安装一次 .ipa 就行。或者在 SideStore 中启用自动重签名（Auto Resign）。

**Q: 能否用无线安装？**
A: SideStore 支持无线安装。在 SideStore 设置中开启 Wireless Sideloading，iPhone 和电脑连同一 WiFi 即可。

---

## 项目文件结构

```
zhuanxintong/
├── index.html              # 主页面
├── manifest.json           # PWA 配置
├── sw.js                   # Service Worker（离线缓存）
├── icon.svg                # App 图标
├── package.json            # Capacitor 依赖
├── capacitor.config.json   # Capacitor 配置
├── .gitignore
├── css/style.css           # 极简禅意样式
├── js/
│   ├── app.js              # 应用主逻辑
│   ├── timer.js            # 番茄钟（含循环+平滑圆环）
│   ├── sound.js            # 白噪音引擎
│   ├── tasks.js            # 任务清单
│   └── stats.js            # 专注统计
└── .github/workflows/
    └── build.yml           # GitHub Actions 编译工作流
```

---

# FocusLink iOS/Android Packaging Guide (Free Version) - English Version

This guide teaches you how to package "Zhuxintong" into a genuine iOS app (.ipa) and Android app (.apk) on a **Windows computer** without spending a dime, and install it on your iPhone, iPad, or Android phone.

## Overall Process

### iOS：
```
SideStore signature → Install on iPhone
```

### Android：
```
.apk file → directly install to Android phone
```

| Step | Tool | Cost |
|------|------|------|
| 1.  Download .ipa / .apk | Browser | Free |
| 2.  Install the signature to your phone | iOS: SideStore + Free Apple ID / Android: Direct Installation | Free |

**Note**: iOS Apps signed with a free Apple ID are valid for 7 days and require re-signing with SideStore upon expiration. Android APKs can be installed directly without any time limit.

| Step | Tool | Cost |
|------|------|------|
| 1.  Download .ipa | Browser | Free |
| 2.  Install the signature to your phone | SideStore + Free Apple ID | Free |

**Note**: Apps signed with a free Apple ID are valid for 7 days and need to be re-signed using SideStore upon expiration.

---

## Step 1: Install to iPhone using SideStore

### 1.1 Preparation

**Confirm that your Apple ID is a free one (not a developer account)**, if not:
1. Visit https://appleid.apple.com to register a free Apple ID
2. Log in on iPhone: Settings → General → Transfer or Restore iPhone → Restore

**Enable developer mode on iPhone**:
Settings → Privacy & Security → Developer Mode → Enable

### 1.2 Install SideStore

SideStore is the Windows version of SideStore (AltStore), which allows for the installation of .ipa files using a free Apple ID signature.

**Method A: Use SideStore Installer directly (the simplest)**
1. Download SideStore Installer: Visit https://sidestore.io to download the latest version
2. Connect iPhone with iTunes or Apple device
3. Run the SideStore Installer and follow the prompts
4. SideStore will be automatically installed on iPhone

**Method B: Install SideStore manually**
1. Install [iTunes](https://www.apple.com/itunes/download/) or [Apple Device Components](https://learn.microsoft.com/zh-cn/windows/client-management/install-apple-devices) on your computer
2. Download the latest version of SideStore .ipa from: https://github.com/SideStore/SideStore/releases
3. Install SideStore using [Sideloadly](https://sideloadly.io) (the most useful sideloading tool on Windows):
 - Download and install Sideloadly
 - Connect to iPhone
 - Open Sideloadly and drag in SideStore.ipa
 - Enter Apple ID and password
 - Click to start

### 1.3 Install Zhinxin Tong with SideStore

1. Open **SideStore** on iPhone
2. Connect iPhone and computer with a data cable
3. Ensure that the SideStore service is running (with Sideloadly kept open)
4. In SideStore:
 - Click on the top left corner +
 - Select the `zhuanxintong.ipa` file we downloaded
 - Click Install
5. Wait for the installation to complete

### 1.4 Trusted Developer Certificate
Before opening for the first time, you need to:
- iPhone: Settings → General → VPN and Device Management
- Locate the developer certificate corresponding to your Apple ID
- Click **Trust**

### 1.5 Turn on the Concentration Channel
- Find the "Zhuxintong" icon on the home screen
- Click to open and you can use it

---

## Frequently Asked Questions

**Q: What should I do if it expires in 7 days? **
A: Simply re-sign with SideStore. Connect your computer, open Sideloadly, and reinstall the .ipa file. Alternatively, enable Auto Resign in SideStore.

**Q: Can it be installed wirelessly? **
A: SideStore supports wireless installation. Enable Wireless Sideloading in the SideStore settings, and then connect your iPhone and computer to the same WiFi network.

---

## Project File Structure

```
zhuanxintong/
├─ index.html # Main page
├─ manifest.json # PWA configuration
├─ sw.js # Service Worker (Offline Cache)
├─ icon.svg # App icon
├─ package.json # Capacitor dependencies
├─ capacitor.config.json # Capacitor configuration
├── .gitignore
├─ css/style.css # Minimalist Zen Style
├── js/
│ ├─ app.js # Main application logic
│ ├─ timer.js # Pomodoro Timer (with loop and smooth circle)
│ ├─ sound.js # White noise engine
│ ├─ tasks.js # Task list
│ └── stats.js # Focused on statistics
└── .github/workflows/
 └── build.yml # GitHub Actions build workflow
```

---
