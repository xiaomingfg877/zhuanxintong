/* 将 icon.svg 转为应用图标 / PWA / Android Adaptive Icon / Android Splash PNG
 *  依赖：sharp  (npm install sharp)
 *  运行：node generate-icon.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const svgPath = path.join(ROOT, 'icon.svg');

const androidRes = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const wwwStatic = path.join(ROOT, 'www', 'static');
const wwwIcons  = path.join(ROOT, 'www', 'icons');

function ensureDir(p){ fs.mkdirSync(p, {recursive:true}); }

async function toPng(src, size, outPath){
  ensureDir(path.dirname(outPath));
  await sharp(src).resize(size, size, {fit:'contain', background:{r:0,g:0,b:0,alpha:0}}).png().toFile(outPath);
}

/* 前景图标（透明背景，仅时钟部分）用于 Android Adaptive Icon
 * 做法：去掉最外层 <rect>，只保留 clock 图形
 */
function buildForegroundSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="132" fill="none" stroke="#2c2c2c" stroke-width="20"/>
  <circle cx="256" cy="256" r="10" fill="#b5482e"/>
  <path d="M256 124 V256" stroke="#2c2c2c" stroke-width="20" stroke-linecap="round"/>
  <path d="M256 256 L336 196" stroke="#b5482e" stroke-width="20" stroke-linecap="round"/>
</svg>`;
}

// 写入临时前景 SVG Buffer
const foregroundSvgBuffer = Buffer.from(buildForegroundSVG(), 'utf8');

/* 生成一个指定路径下的 PNG (sharp + Buffer) */
async function bufferToPng(buf, size, outPath){
  ensureDir(path.dirname(outPath));
  await sharp(buf).resize(size, size, {fit:'contain', background:{r:0,g:0,b:0,alpha:0}}).png().toFile(outPath);
}

/* 背景层 Adaptive：纯色 #f5f3ee 即可 */
function buildBackgroundSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f5f3ee"/>
</svg>`;
}
const backgroundSvgBuffer = Buffer.from(buildBackgroundSVG(), 'utf8');

async function generate(){
  console.log('Start generating icons...');

  // 1) iOS 1024 master (兼容之前逻辑)
  const iosIcon = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
  await toPng(svgPath, 1024, iosIcon);
  console.log('iOS master:', iosIcon);

  // 2) PWA manifest PNG icons（www/icons/*.png）
  const pwaSizes = [72,96,128,144,152,192,384,512];
  for(const s of pwaSizes){
    await toPng(svgPath, s, path.join(wwwIcons, `icon-${s}.png`));
  }
  console.log('PWA icons:', wwwIcons);

  // 更新 manifest.json 为含 PNG 图标（兼容 Android Chrome）
  const manifestPath = path.join(ROOT, 'manifest.json');
  const wwwManifestPath = path.join(ROOT, 'www', 'manifest.json');
  if(fs.existsSync(manifestPath)){
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    m.icons = [
      ...pwaSizes.map(s => ({ src:`icons/icon-${s}.png`, sizes:`${s}x${s}`, type:'image/png', purpose:'any maskable' })),
      { src:'icon.svg', sizes:'any', type:'image/svg+xml', purpose:'any maskable' }
    ];
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
    if(fs.existsSync(wwwManifestPath)) fs.writeFileSync(wwwManifestPath, JSON.stringify(m, null, 2));
    console.log('manifest.json updated.');
  }

  // 3) Android Adaptive Icons (mipmap 各种尺寸 + 矢量 XML 兜底)
  // adaptive-icon XML (v26+)：前景层 + 背景层 drawable 引用
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
  const adaptiveRoundXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

  // Android 8.0+: mipmap-anydpi-v26 放 XML
  const v26Dir = path.join(androidRes, 'mipmap-anydpi-v26');
  ensureDir(v26Dir);
  fs.writeFileSync(path.join(v26Dir, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(v26Dir, 'ic_launcher_round.xml'), adaptiveRoundXml);

  // 背景色 values
  const valuesDir = path.join(androidRes, 'values');
  ensureDir(valuesDir);
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#f5f3ee</color>
</resources>`);

  // mipmap-*dpi/ic_launcher_foreground.png：前景图（透明背景，缩放后 66% 大小安全区）
  // 标准：mdpi=108, hdpi=162, xhdpi=216, xxhdpi=324, xxxhdpi=432
  const fgDens = [
    {folder:'mipmap-mdpi',    size:108},
    {folder:'mipmap-hdpi',    size:162},
    {folder:'mipmap-xhdpi',   size:216},
    {folder:'mipmap-xxhdpi',  size:324},
    {folder:'mipmap-xxxhdpi', size:432},
  ];
  for(const d of fgDens){
    await bufferToPng(foregroundSvgBuffer, d.size, path.join(androidRes, d.folder, 'ic_launcher_foreground.png'));
  }
  // 兼容旧版本（pre-26）：生成完整的 ic_launcher.png 和 ic_launcher_round.png
  // 尺寸：mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
  const legacyDens = [
    {folder:'mipmap-mdpi',    size:48},
    {folder:'mipmap-hdpi',    size:72},
    {folder:'mipmap-xhdpi',   size:96},
    {folder:'mipmap-xxhdpi',  size:144},
    {folder:'mipmap-xxxhdpi', size:192},
  ];
  for(const d of legacyDens){
    await toPng(svgPath, d.size, path.join(androidRes, d.folder, 'ic_launcher.png'));
    await toPng(svgPath, d.size, path.join(androidRes, d.folder, 'ic_launcher_round.png'));
  }
  console.log('Android adaptive / legacy icons:', androidRes);

  // 4) Android Splash Screen drawable (适配 12+ SplashScreen API & 老版本)
  // drawable/splash.xml -> layer-list (background + 居中的 logo)
  const drawableDir = path.join(androidRes, 'drawable');
  ensureDir(drawableDir);
  // 先存一份 288x288 的 logo.png 用于 Splash 中心图形
  await bufferToPng(foregroundSvgBuffer, 288, path.join(drawableDir, 'splash_logo.png'));
  // drawable/splash_screen.xml
  fs.writeFileSync(path.join(drawableDir, 'splash_screen.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item
        android:drawable="@drawable/splash_logo"
        android:gravity="center"
        android:width="192dp"
        android:height="192dp" />
</layer-list>`);
  // values-v31/splash_screen.xml (Android 12+ windowSplashScreenAnimatedIcon)
  const values31 = path.join(androidRes, 'values-v31');
  ensureDir(values31);
  fs.writeFileSync(path.join(values31, 'themes.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>
        <item name="windowSplashScreenAnimationDuration">200</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>`);
  const valuesAny = path.join(androidRes, 'values');
  ensureDir(valuesAny);
  if(!fs.existsSync(path.join(valuesAny, 'themes.xml'))){
    fs.writeFileSync(path.join(valuesAny, 'themes.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_screen</item>
        <item name="android:statusBarColor">@color/ic_launcher_background</item>
    </style>
</resources>`);
  }
  console.log('Android Splash resources created.');

  // 5) Small notification icon (alpha-only white)：drawable-mdpi / -hdpi 等
  // 简化：用一个简单的透明时钟线稿 SVG，输出 24dp 各级 PNG（白色 通道）
  const notifSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="9"/>
<path d="M12 7v5l3 2"/>
</svg>`;
  const notifBuf = Buffer.from(notifSvg, 'utf8');
  const notifSizes = [
    {folder:'drawable-mdpi',     size:24},
    {folder:'drawable-hdpi',     size:36},
    {folder:'drawable-xhdpi',    size:48},
    {folder:'drawable-xxhdpi',   size:72},
    {folder:'drawable-xxxhdpi',  size:96},
  ];
  for(const d of notifSizes){
    await bufferToPng(notifBuf, d.size, path.join(androidRes, d.folder, 'ic_stat_icon.png'));
  }
  console.log('Android notification small icons created.');

  console.log('All icons generated ✅');
}

generate().catch(err => { console.error('Icon generation failed:', err); process.exit(1); });
