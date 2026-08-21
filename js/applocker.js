/* ===== 专心通 / Focus Master · 应用锁机功能 v2
   - 锁机：专注期间阻止用户切换到其他应用
   - iOS: 引导到 Screen Time API（需要原生 FamilyControls 支持）
   - Android: 使用沉浸式全屏 + 系统引导（Digital Wellbeing）
   - 策略：在专注模式下，进入全屏沉浸模式，阻止切换视图；
           专注未结束尝试退出时弹出挽留提示。
   - 配置：设置中开关、锁定时长、定时锁定(时间段)、专注模式联动、选择锁定应用
*/
(function(){
  'use strict';

  const CFG_KEY = 'zxt_applocker_v2';
  const CHECK_INTERVAL = 30 * 1000; // 每 30 秒检查一次定时锁定（更精确）

  // 预设常用应用列表（用户可选择）
  const PRESET_APPS = [
    { id: 'wechat',      nameZh: '微信',      nameEn: 'WeChat',      icon: '💬' },
    { id: 'qq',          nameZh: 'QQ',        nameEn: 'QQ',          icon: '🐧' },
    { id: 'douyin',      nameZh: '抖音',      nameEn: 'TikTok',       icon: '🎵' },
    { id: 'kuaishou',    nameZh: '快手',      nameEn: 'Kuaishou',   icon: '⚡' },
    { id: 'bilibili',    nameZh: '哔哩哔哩',  nameEn: 'Bilibili',    icon: '📺' },
    { id: 'youtube',     nameZh: 'YouTube',   nameEn: 'YouTube',     icon: '▶️' },
    { id: 'weibo',       nameZh: '微博',      nameEn: 'Weibo',       icon: '🌐' },
    { id: 'zhihu',       nameZh: '知乎',      nameEn: 'Zhihu',       icon: '💡' },
    { id: 'xiaohongshu', nameZh: '小红书',    nameEn: 'Xiaohongshu', icon: '📕' },
    { id: 'meituan',     nameZh: '美团',      nameEn: 'Meituan',     icon: '🍜' },
    { id: 'taobao',      nameZh: '淘宝',      nameEn: 'Taobao',      icon: '🛒' },
    { id: 'jd',          nameZh: '京东',      nameEn: 'JD',          icon: '📦' },
    { id: 'netflix',     nameZh: 'Netflix',   nameEn: 'Netflix',     icon: '🎬' },
    { id: 'instagram',   nameZh: 'Instagram', nameEn: 'Instagram',   icon: '📷' },
    { id: 'facebook',    nameZh: 'Facebook',  nameEn: 'Facebook',    icon: '👥' },
    { id: 'twitter',     nameZh: 'X/Twitter', nameEn: 'X/Twitter',   icon: '🐦' },
    { id: 'games',       nameZh: '游戏',      nameEn: 'Games',       icon: '🎮' },
    { id: 'browser',     nameZh: '浏览器',    nameEn: 'Browser',     icon: '🌍' },
    { id: 'music',       nameZh: '音乐',      nameEn: 'Music',       icon: '🎧' },
    { id: 'camera',      nameZh: '相机',      nameEn: 'Camera',      icon: '📷' },
  ];

  let cfg = loadCfg();
  let activeLock = false;       // 是否正在锁定中
  let lockEndTime = 0;          // 锁定结束时间戳
  let onLockChange = null;
  let timerInterval = null;
  let scheduledInterval = null;
  let backButtonListenerActive = false;
  let emergencyCount = 0;

  function loadCfg(){
    try{
      // 尝试从旧版本迁移
      let oldCfg = null;
      try { oldCfg = JSON.parse(localStorage.getItem('zxt_applocker_v1') || 'null'); } catch(e) {}
      const raw = localStorage.getItem(CFG_KEY);
      let base;
      if(raw){
        base = JSON.parse(raw);
      } else if(oldCfg){
        // 从 v1 迁移到 v2
        base = {
          enabled: oldCfg.enabled || false,
          lockInFocus: oldCfg.lockInFocus !== false,
          defaultDuration: oldCfg.defaultDuration || 25,
          scheduledTime: oldCfg.scheduledTime || '',
          scheduledEndTime: '',
          scheduledEnabled: oldCfg.scheduledEnabled || false,
          lastScheduleKey: oldCfg.lastScheduleKey || '',
          lockedApps: [],
          customApps: [],
          lockAllApps: true,
        };
        saveCfg(base);
      }
      return Object.assign({
        enabled: false,
        lockInFocus: true,
        defaultDuration: 25,
        scheduledTime: '',
        scheduledEndTime: '',
        scheduledEnabled: false,
        lastScheduleKey: '',
        lockedApps: [],
        customApps: [],
        lockAllApps: true,
      }, base || {});
    }catch(e){
      return { enabled:false, lockInFocus:true, defaultDuration:25, scheduledTime:'', scheduledEndTime:'', scheduledEnabled:false, lastScheduleKey:'', lockedApps:[], customApps:[], lockAllApps:true };
    }
  }
  function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

  function t(key){ return window.I18n ? I18n.t(key) : key; }

  /* —— 获取所有可用应用（预设 + 自定义） —— */
  function getAllApps(){
    return PRESET_APPS.concat(cfg.customApps || []);
  }

  /* —— 检查是否锁定某个应用 —— */
  function shouldLockApp(appId){
    if(cfg.lockAllApps) return true; // 锁定所有
    return (cfg.lockedApps || []).indexOf(appId) !== -1;
  }

  /* —— 获取当前锁定配置摘要 —— */
  function getLockedAppNames(){
    if(cfg.lockAllApps) return t('lockAllApps');
    const ids = cfg.lockedApps || [];
    const apps = getAllApps().filter(a => ids.indexOf(a.id) !== -1);
    if(apps.length === 0) return t('lockNoApps');
    const lang = (window.I18n && I18n.getLang) ? I18n.getLang() : 'zh';
    return apps.map(a => a.icon + ' ' + (lang === 'en' ? a.nameEn : a.nameZh)).join(', ');
  }

  /* —— 检查是否在 Capacitor 环境中 —— */
  function isNative(){
    return !!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.isNative());
  }
  function platform(){
    if(window.Capacitor && window.Capacitor.getPlatform) return window.Capacitor.getPlatform();
    return 'web';
  }

  /* —— 创建/更新锁机遮罩 DOM —— */
  let lockOverlay = null;
  function ensureOverlay(){
    if(lockOverlay) return lockOverlay;
    lockOverlay = document.createElement('div');
    lockOverlay.className = 'app-locker-overlay';
    lockOverlay.id = 'appLockerOverlay';
    renderOverlayContent();
    document.body.appendChild(lockOverlay);
    return lockOverlay;
  }

  function renderOverlayContent(){
    if(!lockOverlay) return;
    const lang = (window.I18n && I18n.getLang) ? I18n.getLang() : 'zh';
    const lockedNames = getLockedAppNames();
    lockOverlay.innerHTML = `
      <div class="locker-bg"></div>
      <div class="locker-content">
        <div class="locker-icon">
          <svg viewBox="0 0 24 24" width="72" height="72">
            <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 11a2 2 0 0 1 1 3.73V18a1 1 0 0 1-2 0v-.27A2 2 0 0 1 12 14z" fill="currentColor"/>
          </svg>
        </div>
        <h3 class="locker-title">${t('lockerTitle')}</h3>
        <p class="locker-subtitle">${t('lockerSubtitle')}</p>
        <div class="locker-timer" id="lockerTimer">--:--</div>
        <div class="locker-apps" id="lockerApps">
          <span class="locker-apps-label">${t('lockerLockedApps')}</span>
          <span class="locker-apps-list">${lockedNames}</span>
        </div>
        <p class="locker-hint" id="lockerHint">${t('lockerHint')}</p>
        <div class="locker-actions">
          <button class="locker-emergency" id="lockerEmergency">${t('lockerEmergency')}</button>
        </div>
      </div>
    `;

    // 紧急退出：连续点击 5 次才能强制退出
    emergencyCount = 0;
    const emergencyBtn = lockOverlay.querySelector('#lockerEmergency');
    if(emergencyBtn){
      emergencyBtn.addEventListener('click', ()=>{
        emergencyCount++;
        if(emergencyCount >= 5){
          emergencyCount = 0;
          unlock(true);
        } else {
          emergencyBtn.textContent = `${t('lockerEmergency')} (${5 - emergencyCount})`;
          setTimeout(()=>{
            if(lockOverlay){
              emergencyCount = Math.max(0, emergencyCount - 1);
              emergencyBtn.textContent = t('lockerEmergency');
            }
          }, 1500);
        }
      });
    }
  }

  /* —— 启动锁机 —— */
  function lock(durationMin){
    if(!cfg.enabled) return false;
    if(activeLock) return false;
    const minutes = Math.max(1, Math.min(480, durationMin || cfg.defaultDuration));
    lockEndTime = Date.now() + minutes * 60 * 1000;
    activeLock = true;
    ensureOverlay();
    renderOverlayContent(); // 重新渲染以更新i18n和应用列表
    lockOverlay.classList.add('active');
    // 阻止触摸事件穿透
    lockOverlay.style.pointerEvents = 'auto';
    // 进入全屏（如果支持）
    requestFullScreen();
    // 启动计时器
    startTimer();
    // 阻止返回按钮
    preventBack();
    if(onLockChange) onLockChange(true, lockEndTime);
    updateTimerDisplay();
    return true;
  }

  /* —— 解除锁机 —— */
  function unlock(forced){
    if(!activeLock) return;
    activeLock = false;
    lockEndTime = 0;
    if(lockOverlay){
      lockOverlay.classList.remove('active');
      lockOverlay.style.pointerEvents = '';
    }
    if(timerInterval){
      clearInterval(timerInterval);
      timerInterval = null;
    }
    exitFullScreen();
    restoreBack();
    if(onLockChange) onLockChange(false, 0, forced);
  }

  /* —— 启动锁机计时器 —— */
  function startTimer(){
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  }
  function updateTimerDisplay(){
    if(!activeLock) return;
    const remain = Math.max(0, lockEndTime - Date.now());
    const mm = Math.floor(remain / 60000);
    const ss = Math.floor((remain % 60000) / 1000);
    const timerEl = lockOverlay && lockOverlay.querySelector('#lockerTimer');
    if(timerEl){
      timerEl.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }
    if(remain <= 0){
      unlock(false);
    }
  }

  /* —— 请求全屏 —— */
  function requestFullScreen(){
    try {
      const el = document.documentElement;
      if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if(el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    } catch(e){}
  }
  function exitFullScreen(){
    try {
      if(document.exitFullscreen && document.fullscreenElement){
        document.exitFullscreen().catch(()=>{});
      } else if(document.webkitExitFullscreen && document.webkitFullscreenElement){
        document.webkitExitFullscreen();
      }
    } catch(e){}
  }

  /* —— 阻止/恢复返回按钮（Android Capacitor）—— */
  function preventBack(){
    if(backButtonListenerActive) return; // 防止重复添加
    try {
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
        const App = window.Capacitor.Plugins.App;
        if(App.addListener){
          App.addListener('backButton', onBackButton);
          backButtonListenerActive = true;
        }
      }
    } catch(e){}
  }
  function onBackButton(){
    // 提示用户正在锁机中
    showExitHint();
  }
  function restoreBack(){
    if(!backButtonListenerActive) return;
    try {
      // Capacitor App 插件使用 removeListener 移除
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
        const App = window.Capacitor.Plugins.App;
        if(App.removeListener){
          App.removeListener('backButton', onBackButton);
        }
      }
    } catch(e){}
    backButtonListenerActive = false;
  }
  function showExitHint(){
    const hint = lockOverlay && lockOverlay.querySelector('#lockerHint');
    if(hint){
      hint.textContent = t('lockerExitHint');
      hint.classList.add('warning');
      setTimeout(()=>{
        if(lockOverlay){
          hint.textContent = t('lockerHint');
          hint.classList.remove('warning');
        }
      }, 2500);
    }
  }

  /* —— 时间解析与比较辅助 —— */
  function parseTime(hhmm){
    if(!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return { h, m, minutes: h * 60 + m };
  }

  function isCurrentInRange(startTime, endTime){
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if(!start) return false;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    if(!end){
      // 仅设置了开始时间：在开始时间后 1 分钟内触发一次
      return currentMin === start.minutes;
    }

    // 时间段锁定：当前时间在 [start, end) 范围内
    if(start.minutes === end.minutes) return false;
    if(start.minutes < end.minutes){
      // 同一天内，如 22:00 - 23:30
      return currentMin >= start.minutes && currentMin < end.minutes;
    } else {
      // 跨天，如 22:00 - 06:00
      return currentMin >= start.minutes || currentMin < end.minutes;
    }
  }

  /* —— 定时锁定检查 —— */
  function checkScheduledLock(){
    if(!cfg.enabled || !cfg.scheduledEnabled) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    const scheduleKey = `${today}_${cfg.scheduledTime}_${cfg.scheduledEndTime || ''}`;

    if(scheduleKey === cfg.lastScheduleKey) return;

    if(isCurrentInRange(cfg.scheduledTime, cfg.scheduledEndTime)){
      cfg.lastScheduleKey = scheduleKey;
      saveCfg();

      // 如果有结束时间，锁定到结束时间
      if(cfg.scheduledEndTime){
        const end = parseTime(cfg.scheduledEndTime);
        if(end){
          const endMinOfDay = end.minutes;
          const nowMinOfDay = now.getHours() * 60 + now.getMinutes();
          let durationMin;
          if(endMinOfDay > nowMinOfDay){
            durationMin = endMinOfDay - nowMinOfDay;
          } else {
            // 跨天
            durationMin = (24 * 60 - nowMinOfDay) + endMinOfDay;
          }
          durationMin = Math.max(1, Math.min(480, durationMin));
          lock(durationMin);
        } else {
          lock(cfg.defaultDuration);
        }
      } else {
        // 仅开始时间：使用默认时长
        lock(cfg.defaultDuration);
      }
    }
  }

  /* —— 启动/停止定时检查 —— */
  function startScheduledCheck(){
    if(scheduledInterval) return;
    scheduledInterval = setInterval(checkScheduledLock, CHECK_INTERVAL);
    checkScheduledLock();
  }
  function stopScheduledCheck(){
    if(scheduledInterval){
      clearInterval(scheduledInterval);
      scheduledInterval = null;
    }
  }

  /* —— 引导用户到系统设置开启原生锁机 —— */
  async function guideToSystemSettings(){
    const plat = platform();
    if(plat === 'ios'){
      alert(t('lockerIOSGuide'));
      try {
        window.location.href = 'App-prefs:SCREEN_TIME';
      } catch(e){}
    } else if(plat === 'android'){
      alert(t('lockerAndroidGuide'));
      try {
        window.location.href = 'package:com.google.android.apps.wellbeing';
      } catch(e){}
    } else {
      alert(t('lockerWebGuide'));
    }
  }

  /* —— 检查原生 Family Controls 权限（iOS）—— */
  async function checkNativePermission(){
    const plat = platform();
    if(plat === 'ios'){
      return 'unknown';
    }
    return 'unsupported';
  }

  /* —— 公共 API —— */
  window.AppLocker = {
    init(){
      // 监听专注开始/结束
      if(window.Timer){
        Timer.onStateChange((running, mode, minutes)=>{
          if(cfg.enabled && cfg.lockInFocus && mode === 'focus'){
            if(running && !activeLock){
              lock(minutes || cfg.defaultDuration);
            } else if(!running && activeLock && mode !== 'break'){
              unlock(false);
            }
          }
        });
      }
      // 启动定时检查
      if(cfg.enabled && cfg.scheduledEnabled){
        startScheduledCheck();
      }
      // 可见性变化：从后台回前台时重新检查
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState === 'visible' && cfg.enabled){
          checkScheduledLock();
        }
      });
    },
    lock,
    unlock,
    isLocked(){ return activeLock; },
    getEndTime(){ return lockEndTime; },
    setEnabled(on){
      cfg.enabled = !!on; saveCfg();
      if(!on && activeLock) unlock(true);
      if(on && cfg.scheduledEnabled){
        startScheduledCheck();
      } else {
        stopScheduledCheck();
      }
    },
    isEnabled(){ return cfg.enabled; },
    setLockInFocus(on){ cfg.lockInFocus = !!on; saveCfg(); },
    isLockInFocus(){ return cfg.lockInFocus; },
    setDefaultDuration(min){
      cfg.defaultDuration = Math.max(1, Math.min(480, +min||25));
      saveCfg();
    },
    getDefaultDuration(){ return cfg.defaultDuration; },
    setScheduled(time, endTime, enabled){
      cfg.scheduledTime = time || '';
      cfg.scheduledEndTime = endTime || '';
      cfg.scheduledEnabled = !!enabled;
      cfg.lastScheduleKey = ''; // 重置当天 key
      saveCfg();
      if(enabled && cfg.enabled){
        startScheduledCheck();
      } else {
        stopScheduledCheck();
      }
    },
    getScheduled(){
      return {
        time: cfg.scheduledTime,
        endTime: cfg.scheduledEndTime,
        enabled: cfg.scheduledEnabled
      };
    },
    // 应用选择相关
    getAllApps,
    getLockedAppNames,
    shouldLockApp,
    setLockAllApps(all){ cfg.lockAllApps = !!all; saveCfg(); },
    isLockAllApps(){ return cfg.lockAllApps; },
    setLockedApps(ids){ cfg.lockedApps = Array.isArray(ids) ? ids.slice() : []; saveCfg(); },
    getLockedApps(){ return (cfg.lockedApps || []).slice(); },
    addCustomApp(app){
      if(!app || !app.id) return;
      if(!cfg.customApps) cfg.customApps = [];
      if(!cfg.customApps.find(a => a.id === app.id)){
        cfg.customApps.push(app);
        saveCfg();
      }
    },
    removeCustomApp(appId){
      cfg.customApps = (cfg.customApps || []).filter(a => a.id !== appId);
      cfg.lockedApps = (cfg.lockedApps || []).filter(id => id !== appId);
      saveCfg();
    },
    onLockChange(cb){ onLockChange = cb; },
    guideToSystemSettings,
    checkNativePermission,
    // 重新渲染锁机遮罩（用于语言切换后）
    refreshOverlay(){ if(lockOverlay && activeLock) renderOverlayContent(); },
    // 刷新应用列表显示（用于语言切换）
    refreshAppList(){
      const list = document.getElementById('lockerAppList');
      if(!list) return;
      const allApps = getAllApps();
      const lockedIds = cfg.lockedApps || [];
      const lockAll = cfg.lockAllApps;

      if(lockAll){
        list.style.display = 'none';
        list.innerHTML = '';
      } else {
        list.style.display = 'flex';
        const lang = (window.I18n && I18n.getLang) ? I18n.getLang() : 'zh';
        list.innerHTML = allApps.map(app => {
          const active = lockedIds.indexOf(app.id) !== -1;
          const name = lang === 'en' ? app.nameEn : app.nameZh;
          const isCustom = (app.id || '').startsWith('custom_');
          return `<div class="locker-app-item${active ? ' active' : ''}" data-id="${app.id}">
            <span class="app-icon">${app.icon || '📱'}</span>
            <span class="app-name">${name}</span>
            ${isCustom ? '<span class="app-del" data-del="' + app.id + '">✕</span>' : ''}
          </div>`;
        }).join('');
      }
      // 更新hint
      const hint = document.getElementById('lockerAppsHint');
      if(hint){
        if(cfg.lockAllApps){
          hint.textContent = t('lockAllAppsHint');
        } else {
          hint.textContent = t('lockSelectedHint', {n: (cfg.lockedApps || []).length});
        }
      }
    },
    platform
  };
})();
