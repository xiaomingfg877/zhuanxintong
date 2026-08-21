# 专心通 介绍-中文版

>The English version introduction is under the Chinese version introduction.

> 极简专注学习与工作工具，让你安静下来。

一款基于 Web 技术的跨平台专注应用，支持 iOS / Android / Web。朱砂色 × 液态玻璃设计，番茄钟 + 白噪音 + 锁机模式 + 时间花园，帮你进入心流状态。

---

## ✨ 功能特性

### 🎯 专注计时
- **番茄工作法**：专注 → 短休 → 长休循环，4 轮专注后自动长休
- **普通模式**：自由设置时长，无循环约束
- **自定义时间**：灵活调整专注 / 休息时长
- **圆环动画**：液态玻璃倒计时环，流畅顺滑
- **沉浸模式**：双击圆环进入全屏沉浸，状态栏隐藏 + 防息屏

### 🔊 白噪音
- 内置多种环境音：雨声、森林、海浪、咖啡馆、篝火、风铃声
- 支持同时混合播放，自由搭配
- 本地音频解码，无需联网

### ✅ 任务管理
- 创建待办任务，添加详细描述
- 系统预设标签 + 自定义标签分类
- 专注时可关联任务，自动统计耗时

### 📅 时间表 / 日程提醒
- 创建日程计划，设置提醒时间
- 系统通知权限集成，到点自动提醒
- 支持 iOS / Android 原生本地通知

### 🌸 时间花园
- 每完成一次专注，花园里种上一朵花
- 坚持越久，花园越茂盛
- 用可视化激励保持专注习惯

### 📊 专注统计
- 每日 / 每周 / 每月专注时长
- 完成番茄个数统计
- 直观的数据图表

### 🔒 应用锁机
- **专注自动锁机**：专注开始后自动锁定在应用内
- **定时锁定**：设置时间段自动进入锁机模式
- **选择性锁机**：可选择锁定范围（所有应用 / 仅指定应用）
- **自定义应用**：预设 20 种常用应用 + 自定义添加
- **紧急退出**：连续点击 5 次紧急退出按钮（防止误锁）
- **全屏沉浸**：拦截边缘滑动、缩放、下拉橡皮筋等手势

### ⚙️ 设置
- **中英双语**：一键切换中文 / 英文
- **深浅模式**：浅色 / 深色 / 跟随系统
- **关于页面**：作者信息、版本号
- **设置顶栏**：胶囊液态玻璃设计，纯图标导航

---

## 🎨 设计特色

| 元素 | 说明 |
|------|------|
| **配色** | 朱砂红 × 米白，东方美学配色 |
| **质感** | 液态玻璃（Liquid Glass）毛玻璃效果 |
| **顶栏** | 胶囊形导航栏，半透明背景模糊 |
| **响应式** | 适配手机 / 平板 / 桌面各尺寸 |
| **动画** | 流畅缓动曲线，丝滑过渡 |

---

## 📦 技术栈

- **前端**：原生 HTML / CSS / JavaScript（零框架依赖）
- **跨平台**：Capacitor 5 封装 iOS / Android 原生包
- **PWA**：Service Worker 离线缓存，Web 端可安装到桌面
- **CI/CD**：GitHub Actions 云编译自动产出 .ipa / .apk

---

## 🚀 快速开始

### Web 本地预览

```bash
# 进入项目目录
cd zhuanxintong

# 启动本地服务器（任选其一）
python -m http.server 8000
# 或
npx serve .
```

浏览器打开 http://localhost:8000

### iOS / Android 打包

详见 [BUILD.md](BUILD.md) — 包含 GitHub Actions 云编译 + SideStore 签名安装的完整流程。

---

## 📂 项目结构

```
zhuanxintong/
├── index.html              # 主页面
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker 离线缓存
├── icon.svg                # 应用图标
├── css/
│   └── style.css           # 样式（液态玻璃设计系统）
├── js/
│   ├── app.js              # 主逻辑、导航、设置表单
│   ├── timer.js            # 番茄钟 / 计时器核心
│   ├── sound.js            # 白噪音播放器
│   ├── tasks.js            # 任务管理
│   ├── schedule.js         # 时间表 / 日程提醒
│   ├── garden.js           # 时间花园
│   ├── stats.js            # 专注统计
│   ├── applocker.js        # 应用锁机
│   └── i18n.js             # 中/英文国际化
├── ios/                    # iOS 原生工程（Capacitor）
│   └── App/
│       ├── App/            # Swift 代码、Info.plist、资源
│       ├── App.xcodeproj/  # Xcode 工程
│       └── Podfile         # CocoaPods 依赖
├── www/                    # 同步副本（Capacitor 打包用）
├── .github/
│   └── workflows/
│       └── build.yml       # GitHub Actions 编译配置
├── package.json            # npm 依赖（Capacitor CLI）
├── capacitor.config.json   # Capacitor 配置
├── generate-icon.js        # 图标生成脚本
└── BUILD.md                # 打包 & 安装详细指南
```

---

## 🔧 构建说明

| 目标 | 方式 | 产物 |
|------|------|------|
| Web 站点 | 直接静态部署 `index.html` 及同级资源 | 静态文件 |
| iOS .ipa | GitHub Actions（Mac runner + Xcode build） | `zhuanxintong-ios` artifact |
| Android .apk | GitHub Actions（Ubuntu runner + Gradle） | `zhuanxintong-android` artifact |

---

## 📝 作者

- **xiaomingfg877**
- 项目地址：[github.com/xiaomingfg877/zhuanxintong](https://github.com/xiaomingfg877/zhuanxintong)

---

## 📄 License

MIT License — 自由使用、修改、分发。

---
---

# Focus Master Introduction - English Version

> A minimalist focus tool for studying and working — help you find your peace.

A cross-platform focus app built with web technology, available on iOS / Android / Web. Designed with **Vermilion Red × Liquid Glass**, featuring Pomodoro timer, white noise, app lock, and a Time Garden to help you enter flow state.

---

## ✨ Features

### 🎯 Focus Timer
- **Pomodoro Technique**: Focus → Short break → Long break cycles, auto long-break after 4 focus rounds
- **Normal Mode**: Free-form duration, no cycle constraints
- **Custom Duration**: Flexible focus / break length adjustment
- **Animated Ring**: Liquid glass countdown ring, buttery smooth
- **Immersive Mode**: Double-tap the ring for fullscreen immersion, status bar hidden + screen-awake lock

### 🔊 White Noise
- Built-in ambient sounds: Rain, Forest, Ocean waves, Café, Campfire, Wind chimes
- Mix & match multiple sounds simultaneously
- Local audio decoding, no internet required

### ✅ Task Management
- Create tasks with detailed descriptions
- System preset tags + custom tag categories
- Link tasks to focus sessions, auto-track time spent

### 📅 Schedule & Reminders
- Create schedules with reminder times
- Integrated with system notification permissions, auto alerts
- Native local notifications on iOS / Android

### 🌸 Time Garden
- Every completed focus session plants a flower in your garden
- The more you persist, the lusher your garden grows
- Visual motivation to build your focus habit

### 📊 Focus Stats
- Daily / Weekly / Monthly focus duration
- Completed Pomodoro count
- Intuitive data charts

### 🔒 App Lock
- **Auto-lock on Focus**: Automatically locks you inside the app when focus starts
- **Scheduled Lock**: Set a time window for auto lock-in
- **Selective Locking**: Choose the lock scope (all apps / only selected apps)
- **Custom Apps**: 20 preset popular apps + custom additions
- **Emergency Exit**: Tap the emergency button 5 times (prevents accidental lock)
- **Fullscreen Immersion**: Blocks edge swipe, pinch zoom, rubber-band scrolling, and other gestures

### ⚙️ Settings
- **Bilingual**: One-tap switch between Chinese / English
- **Theme**: Light / Dark / Follow system
- **About page**: Author info, version number
- **Top Nav Bar**: Capsule-shaped liquid glass design, icon-only navigation

---

## 🎨 Design Highlights

| Element | Description |
|---------|-------------|
| **Colors** | Vermilion Red × Ivory white, Eastern aesthetic palette |
| **Texture** | Liquid Glass (frosted glass effect with backdrop blur) |
| **Top Bar** | Capsule-shaped nav bar, translucent with background blur |
| **Responsive** | Optimized for phone / tablet / desktop sizes |
| **Animation** | Smooth easing curves, silky transitions |

---

## 📦 Tech Stack

- **Frontend**: Vanilla HTML / CSS / JavaScript (zero framework)
- **Cross-Platform**: Capacitor 5 for native iOS / Android wrappers
- **PWA**: Service Worker offline cache, installable on the web
- **CI/CD**: GitHub Actions cloud builds output .ipa / .apk automatically

---

## 🚀 Quick Start

### Local Web Preview

```bash
# Go to project directory
cd zhuanxintong

# Start a local server (either)
python -m http.server 8000
# or
npx serve .
```

Open http://localhost:8000 in your browser.

### iOS / Android Build

See [BUILD.md](BUILD.md) — the complete guide with GitHub Actions cloud build + SideStore signing & installation.

---

## 📂 Project Structure

```
zhuanxintong/
├── index.html              # Main page
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline cache
├── icon.svg                # App icon
├── css/
│   └── style.css           # Styles (Liquid Glass design system)
├── js/
│   ├── app.js              # Main logic, navigation, settings forms
│   ├── timer.js            # Pomodoro / timer core
│   ├── sound.js            # White noise player
│   ├── tasks.js            # Task management
│   ├── schedule.js         # Schedule / reminders
│   ├── garden.js           # Time Garden
│   ├── stats.js            # Focus statistics
│   ├── applocker.js        # App lock
│   └── i18n.js             # Chinese / English i18n
├── ios/                    # Native iOS project (Capacitor)
│   └── App/
│       ├── App/            # Swift code, Info.plist, assets
│       ├── App.xcodeproj/  # Xcode project
│       └── Podfile         # CocoaPods dependencies
├── www/                    # Sync copy (used by Capacitor build)
├── .github/
│   └── workflows/
│       └── build.yml       # GitHub Actions build config
├── package.json            # npm deps (Capacitor CLI)
├── capacitor.config.json   # Capacitor config
├── generate-icon.js        # Icon generation script
└── BUILD.md                # Build & install detailed guide
```

---

## 🔧 Build Info

| Target | Method | Artifact |
|--------|--------|----------|
| Web Site | Static deploy `index.html` + sibling assets directly | Static files |
| iOS .ipa | GitHub Actions (Mac runner + Xcode build) | `zhuanxintong-ios` artifact |
| Android .apk | GitHub Actions (Ubuntu runner + Gradle) | `zhuanxintong-android` artifact |

---

## 📝 Author

- **xiaomingfg877**
- Repository: [github.com/xiaomingfg877/zhuanxintong](https://github.com/xiaomingfg877/zhuanxintong)

---

## 📄 License

MIT License — free to use, modify, and distribute.
