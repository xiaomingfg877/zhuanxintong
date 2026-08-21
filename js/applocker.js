/* ===== 专心通 / Focus Master · 应用锁机功能 v1
   - 锁机：专注期间阻止用户切换到其他应用
   - iOS: 引导到 Screen Time API（需要原生 FamilyControls 支持）
   - Android: 使用沉浸式全屏 + 系统引导（Digital Wellbeing）
   - 策略：在专注模式下，进入全屏沉浸模式，阻止切换视图；
           专注未结束尝试退出时弹出挽留提示。
   - 配置：设置中开关、锁定时长、定时锁定、专注模式联动
*/
(function(){
  'use strict';

  const CFG_KEY = 'zxt_applocker_v1';
  const CHECK_INTERVAL = 60 * 1000; // 每 60 秒检查一次定时锁定

  let cfg = loadCfg();
  let activeLock = false;       // 是否正在锁定中
  let lockEndTime = 0;          // 锁定结束时间戳
  let onLockChange = null;
  let timerInterval = null;
  let guidedSystemSetup = false;

  function loadCfg(){
    try{
      return Object.assign({
        enabled: false,          // 总开关
        lockInFocus: true,       // 专注模式自动锁定
        defaultDuration: 25,      // 默认锁定时长（分）
        scheduledTime: '',       // 定时锁定时间 HH:MM
        scheduledEnabled: false, // 是否启用定时锁定
        lastScheduleKey: '',     // 防止当天重复触发
      }, JSON.parse(localStorage.getItem(CFG_KEY)) || {});
    }catch(e){
      return { enabled:false, lockInFocus:true, defaultDuration:25, scheduledTime:'', scheduledEnabled:false, lastScheduleKey:'' };
    }
  }
  function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

  function t(key){ return window.I18n ? I18n.t(key) : key; }

  /* —— 检查是否在 Capacitor 环境中 —— */
  function isNative(){
    return !!(window.Capacitor && window.Capacitor.isNative && window.Capacitor.isNative());
  }
  function platform(){
    if(window.Capacitor && window.Capacitor.getPlatform) return window.Capacitor.getPlatform();
    return 'web';
  }

  /* —— 创建锁机遮罩 DOM —— */
  let lockOverlay = null;
  function ensureOverlay(){
    if(lockOverlay) return lockOverlay;
    lockOverlay = document.createElement('div');
    lockOverlay.className = 'app-locker-overlay';
    lockOverlay.id = 'appLockerOverlay';
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
        <p class="locker-hint" id="lockerHint">${t('lockerHint')}</p>
        <div class="locker-actions">
          <button class="locker-emergency" id="lockerEmergency">${t('lockerEmergency')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(lockOverlay);

    // 紧急退出：连续点击 5 次才能强制退出
    let emergencyCount = 0;
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
            emergencyCount = Math.max(0, emergencyCount - 1);
            emergencyBtn.textContent = t('lockerEmergency');
          }, 1500);
        }
      });
    }
    return lockOverlay;
  }

  /* —— 启动锁机 —— */
  function lock(durationMin){
    if(!cfg.enabled) return false;
    if(activeLock) return false;
    const minutes = Math.max(1, Math.min(480, durationMin || cfg.defaultDuration));
    lockEndTime = Date.now() + minutes * 60 * 1000;
    activeLock = true;
    ensureOverlay();
    lockOverlay.classList.add('active');
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
      if(el.requestFullscreen) el.requestFullscreen();
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if(el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    } catch(e){}
  }
  function exitFullScreen(){
    try {
      if(document.exitFullscreen && document.fullscreenElement){
        document.exitFullscreen();
      } else if(document.webkitExitFullscreen && document.webkitFullscreenElement){
        document.webkitExitFullscreen();
      }
    } catch(e){}
  }

  /* —— 阻止/恢复返回按钮（Android Capacitor）—— */
  function preventBack(){
    try {
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
        window.Capacitor.Plugins.App.addListener &&
          window.Capacitor.Plugins.App.addListener('backButton', (e)=>{
            // 阻止默认行为
            if(e && e.preventDefault) e.preventDefault();
            // 提示用户正在锁机中
            showExitHint();
          });
      }
    } catch(e){}
  }
  function restoreBack(){
    try {
      // Capacitor 不允许移除 listener，但可以通过状态控制
    } catch(e){}
  }
  function showExitHint(){
    const hint = lockOverlay && lockOverlay.querySelector('#lockerHint');
    if(hint){
      hint.textContent = t('lockerExitHint');
      hint.classList.add('warning');
      setTimeout(()=>{
        hint.textContent = t('lockerHint');
        hint.classList.remove('warning');
      }, 2500);
    }
  }

  /* —— 定时锁定检查 —— */
  function checkScheduledLock(){
    if(!cfg.enabled || !cfg.scheduledEnabled || !cfg.scheduledTime) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const currentTime = `${hh}:${mm}`;
    const today = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    const scheduleKey = `${today}_${cfg.scheduledTime}`;
    if(scheduleKey === cfg.lastScheduleKey) return;
    if(currentTime === cfg.scheduledTime){
      cfg.lastScheduleKey = scheduleKey;
      saveCfg();
      lock(cfg.defaultDuration);
    }
  }

  /* —— 引导用户到系统设置开启原生锁机 —— */
  async function guideToSystemSettings(){
    const plat = platform();
    if(plat === 'ios'){
      // iOS: 引导到 Screen Time 设置
      alert(t('lockerIOSGuide'));
      // 使用 URL scheme 打开设置
      try {
        window.location.href = 'App-prefs:SCREEN_TIME';
      } catch(e){}
    } else if(plat === 'android'){
      // Android: 引导到 Digital Wellbeing
      alert(t('lockerAndroidGuide'));
      try {
        window.location.href = 'package:com.google.android.apps.wellbeing';
      } catch(e){}
    } else {
      alert(t('lockerWebGuide'));
    }
    guidedSystemSetup = true;
  }

  /* —— 检查原生 Family Controls 权限（iOS）—— */
  async function checkNativePermission(){
    const plat = platform();
    if(plat === 'ios'){
      // iOS: 检查是否有 Screen Time 授权
      // 需要原生插件支持，这里返回 'unknown'
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
              // 专注结束：解锁
              unlock(false);
            }
          }
        });
      }
      // 启动定时检查
      if(cfg.enabled && cfg.scheduledEnabled){
        setInterval(checkScheduledLock, CHECK_INTERVAL);
        checkScheduledLock();
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
        setInterval(checkScheduledLock, CHECK_INTERVAL);
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
    setScheduled(time, enabled){
      cfg.scheduledTime = time || '';
      cfg.scheduledEnabled = !!enabled;
      cfg.lastScheduleKey = ''; // 重置当天 key
      saveCfg();
    },
    getScheduled(){ return { time: cfg.scheduledTime, enabled: cfg.scheduledEnabled }; },
    onLockChange(cb){ onLockChange = cb; },
    guideToSystemSettings,
    checkNativePermission,
    platform
  };
})();
