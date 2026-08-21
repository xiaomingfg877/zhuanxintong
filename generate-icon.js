/* 将 icon.svg 转为 1024x1024 PNG 用于 iOS 应用图标 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, 'www', 'icon.svg');
const outPath = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

async function generate() {
  try {
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(outPath);
    console.log('Icon generated:', outPath);
  } catch(e) {
    console.error('Icon generation failed:', e.message);
    process.exit(1);
  }
}

generate();
