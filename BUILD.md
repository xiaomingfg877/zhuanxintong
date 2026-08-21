# 专心通 iOS 打包指南（免费版）

本指南教你如何在 **Windows 电脑**上，不花一分钱，把「专心通」打包成真正的 iOS 应用（.ipa），安装到你的 iPhone / iPad 上。

## 整体流程

```
代码 → GitHub Actions（Mac 云编译）→ .ipa 文件 → SideStore 签名 → 装入 iPhone
```

| 步骤 | 工具 | 费用 |
|------|------|------|
| 1. 推代码到 GitHub | Git + GitHub | 免费 |
| 2. 云端编译 .ipa | GitHub Actions | 免费（每月 2000 分钟） |
| 3. 下载 .ipa | 浏览器 | 免费 |
| 4. 签名安装到手机 | SideStore + 免费 Apple ID | 免费 |

**注意**：免费 Apple ID 签名的 App 有效期为 7 天，到期后需用 SideStore 重新签名。

---

## 第一步：创建 GitHub 仓库并推送代码

### 1.1 注册 GitHub 账号
访问 https://github.com 注册免费账号。

### 1.2 创建新仓库
- 点右上角 + → New repository
- Repository name 填：`zhuanxintong`
- 选 Public 或 Private 都行
- 不要勾选任何初始化选项（Add README / .gitignore 等）
- 点 **Create repository**

### 1.3 推送本地代码到仓库
在 Windows 上打开 PowerShell，执行：

```powershell
cd C:\Users\Lenovo\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a87c43b730de4e10b6b332f\zhuanxintong

# 初始化 Git
git init
git add .
git commit -m "初始版本：专心通 v2"

# 连接远程仓库（把 YOUR_USERNAME 替换成你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/zhuanxintong.git
git branch -M main
git push -u origin main
```

## 第二步：触发云端编译

### 2.1 进入 Actions 标签页
推送完成后，打开你的 GitHub 仓库页面：
- 点顶部的 **Actions** 标签
- 左侧选 **"Build iOS IPA"** 工作流
- 点 **Run workflow** 按钮

### 2.2 等待编译
- GitHub Actions 会自动租用一台 Mac 云主机
- 大约需要 **5-10 分钟**完成编译
- 编译过程：安装 Node → 安装 Capacitor → 创建 iOS 项目 → 同步 Web 文件 → Xcode 编译 → 打包 .ipa

### 2.3 下载 .ipa
- 编译完成后（✓ 绿色对勾），点进该次运行
- 页面底部 **Artifacts** 区域会有：
  - `zhuanxintong-ios` → **这就是 .ipa 文件**
- 点击下载，保存到电脑

## 第三步：用 SideStore 安装到 iPhone

### 3.1 准备工作

**确认你的 Apple ID 是免费的（非开发者账号）**，如果没有：
1. 访问 https://appleid.apple.com 注册免费 Apple ID
2. 在 iPhone 上登录：设置 → 通用 → 传输或还原 iPhone → 恢复

**在 iPhone 上开启开发者模式**：
- 设置 → 隐私与安全性 → 开发者模式 → 打开

### 3.2 安装 SideStore

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

### 3.3 用 SideStore 安装专心通

1. iPhone 上打开 **SideStore**
2. 用数据线连接 iPhone 和电脑
3. 确保 SideStore 的服务正在运行（Sideloadly 保持打开）
4. 在 SideStore 中：
   - 点左上角 +
   - 选择我们下载的 `zhuanxintong.ipa`
   - 点 Install
5. 等待安装完成

### 3.4 信任开发者证书
首次打开前需要：
- iPhone：设置 → 通用 → VPN与设备管理
- 找到你的 Apple ID 对应的开发者证书
- 点 **信任**

### 3.5 打开专心通
- 在主屏幕找到「专心通」图标
- 点击打开，即可使用

---

## 常见问题

**Q: 7 天后过期怎么办？**
A: 用 SideStore 重新签名即可。连接电脑，打开 Sideloadly，重新安装一次 .ipa 就行。或者在 SideStore 中启用自动重签名（Auto Resign）。

**Q: 能否用无线安装？**
A: SideStore 支持无线安装。在 SideStore 设置中开启 Wireless Sideloading，iPhone 和电脑连同一 WiFi 即可。

**Q: 为什么需要 Mac 云主机？**
A: Apple 的 Xcode 只能在 macOS 上运行，编译 .ipa 必须用 Mac。GitHub Actions 提供免费的 Mac 云主机。

**Q: 编译失败怎么办？**
A: 查看 Actions 运行日志，常见问题：
   - Node 版本不兼容 → 检查 workflow 中 node-version
   - Capacitor iOS 平台创建失败 → 检查网络连接
   - Xcode 构建失败 → 查看完整错误日志

**Q: 可以上架 App Store 吗？**
A: 免费 Apple ID 不行。上架 App Store 需要 $99/年的 Apple 开发者账号，以及通过 App Review。

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

## 更新 App

当你修改了代码后：

1. 提交并推送到 GitHub：
```powershell
git add .
git commit -m "更新内容"
git push
```

2. GitHub Actions 会自动重新编译（或手动 Run workflow）
3. 下载新的 .ipa
4. 用 SideStore 重新安装

**注意**：重新安装后数据会保留（因为 Capacitor 使用 WKWebView，localStorage 在同一 App 中持久）。
