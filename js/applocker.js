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
  let lockDurationMin = 0;      // 原始锁定时长（分钟），用于惩罚计算
  let onLockChange = null;
  let timerInterval = null;
  let scheduledInterval = null;
  let backButtonListenerActive = false;
  let emergencyCount = 0;
  let lastEmergencyResetAt = 0; // 紧急计数上次重置（防止超时时计数被清零导致可以点到5）
  let confirmMask = null;

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
    if(lockOverlay){
      // 如果overlay存在但不在body中（可能被移除了），重新创建
      if(!document.body.contains(lockOverlay)){
        lockOverlay = null; // 重置以便重新创建
      } else {
        return lockOverlay;
      }
    }
    lockOverlay = document.createElement('div');
    lockOverlay.className = 'app-locker-overlay';
    lockOverlay.id = 'appLockerOverlay';
    // 确保在最顶层
    lockOverlay.style.zIndex = '999999';
    // 默认隐藏
    lockOverlay.style.display = 'none';
    lockOverlay.style.visibility = 'hidden';
    renderOverlayContent();
    document.body.appendChild(lockOverlay);
    return lockOverlay;
  }
  
  /* —— 清理可能残留的遮罩（初始化时调用）—— */
  function cleanupStaleOverlay(){
    // 检查是否有残留的遮罩元素（来自上次未正常关闭的锁机）
    const stale = document.getElementById('appLockerOverlay');
    if(stale){
      stale.classList.remove('active');
      stale.style.display = 'none';
      stale.style.visibility = 'hidden';
      stale.style.pointerEvents = 'none';
      stale.style.touchAction = '';
      // 不删除元素本身（复用），但确保它不阻挡交互
      if(lockOverlay === stale){
        activeLock = false;
        lockEndTime = 0;
        lockDurationMin = 0;
      }
    }
    // 清理body上的locker-active类
    document.body.classList.remove('locker-active');
    // 恢复触摸事件
    blockTouchEvents(false);
    lockPageScroll(false);
    // 恢复全屏
    try { exitFullScreen(); } catch(_){}
    // 恢复返回按钮
    restoreBack();
  }

  function renderOverlayContent(){
    if(!lockOverlay) return;
    const lang = (window.I18n && I18n.getLang) ? I18n.getLang() : 'zh';
    const lockedNames = getLockedAppNames();
    const plat = platform();
    // iOS 平台显示系统限制提示
    const iosLimitHtml = (plat === 'ios') ?
      `<p class="locker-ios-limit">${t('lockerIOSLimit')}</p>` : '';
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
        ${iosLimitHtml}
        <div class="locker-actions">
          <button class="locker-emergency" id="lockerEmergency">${t('lockerEmergency')}</button>
        </div>
      </div>
    `;

    // 紧急退出：连续点击 5 次才能强制退出（3 秒内连续点击才有效，避免超时清零）
    emergencyCount = 0;
    lastEmergencyResetAt = 0;
    const emergencyBtn = lockOverlay.querySelector('#lockerEmergency');
    if(emergencyBtn){
      emergencyBtn.addEventListener('click', (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        const now = Date.now();
        // 超过 3 秒没点击则重置计数
        if(now - lastEmergencyResetAt > 3000) emergencyCount = 0;
        lastEmergencyResetAt = now;
        emergencyCount++;
        if(emergencyCount >= 5){
          emergencyCount = 0;
          // 先执行紧急退出惩罚（花园）
          let penaltyResult = { affected: 0 };
          try{
            if(window.Garden && typeof Garden.penalize === 'function'){
              // 依据锁定时长，每 25 分钟惩罚 1 朵花，至少 1 朵
              const dur = lockDurationMin || cfg.defaultDuration;
              const penaltyBase = Math.max(1, Math.ceil(dur / 25));
              penaltyResult = Garden.penalize(penaltyBase) || penaltyResult;
            }
          }catch(e){ console.warn('[Locker] garden penalty error', e); }
          // 显示惩罚提示（原生 alert，简单可靠）
          try{
            const affected = penaltyResult.affected || 0;
            const title = t('emergencyExitTitle');
            let msg = t('emergencyExitDesc');
            if(affected > 0) msg += '\n' + t('penaltyMsg', {n: affected});
            setTimeout(()=>safeAlert(title, msg), 150);
          }catch(e){}
          unlock(true);
        } else {
          emergencyBtn.textContent = `${t('lockerEmergency')} (${5 - emergencyCount})`;
          // 3 秒后若没有继续点击则重置文案
          clearTimeout(emergencyBtn._resetTimer);
          emergencyBtn._resetTimer = setTimeout(()=>{
            if(lockOverlay && document.body.contains(emergencyBtn)){
              emergencyCount = 0;
              emergencyBtn.textContent = t('lockerEmergency');
            }
          }, 3000);
        }
      });
    }
  }

  /* —— 简单的跨平台弹窗（优先自定义 DOM，兜底 alert） —— */
  function safeAlert(title, message){
    try{
      if(confirmMask) return; // 已经有弹窗
      const mask = document.createElement('div');
      mask.className = 'locker-confirm-mask';
      mask.innerHTML = `
        <div class="locker-confirm-box">
          <h3>${escapeHtml(title)}</h3>
          <p style="white-space:pre-line;">${escapeHtml(message)}</p>
          <div class="actions">
            <button class="btn-confirm" data-act="ok">OK</button>
          </div>
        </div>`;
      document.body.appendChild(mask);
      confirmMask = mask;
      const close = ()=>{ if(confirmMask === mask){ mask.remove(); confirmMask = null; } };
      mask.querySelector('[data-act="ok"]').addEventListener('click', close);
      mask.addEventListener('click', (e)=>{ if(e.target === mask) close(); });
    }catch(e){
      try{ alert((title?title+'\n':'') + message); }catch(_){}
    }
  }
  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* —— 进入锁机前 弹确认框；用户确认后再锁定 ——
       返回 Promise<boolean>：是否确实进入了锁机
       skipConfirm=true 则不弹框（Timer 联动时使用，启动专注的瞬间已经在 UI 确认过了）
  */
  function lockWithConfirm(durationMin, skipConfirm){
    if(activeLock) return Promise.resolve(false);
    // 没有开启总开关且非测试模式：直接返回 false
    // (测试模式使用 lock(..., force=true) 直接走 lock)
    const doLock = ()=>lock(durationMin, false);
    if(skipConfirm){
      return Promise.resolve(!!doLock());
    }
    return new Promise((resolve)=>{
      try{
        if(confirmMask){ confirmMask.remove(); confirmMask = null; }
        const mask = document.createElement('div');
        mask.className = 'locker-confirm-mask';
        const emergencyTxt = t('lockerEmergency');
        const tipTxt = t('lockerConfirmTip', {text: emergencyTxt}).replace(/\n/g, '<br>');
        mask.innerHTML = `
          <div class="locker-confirm-box">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              ${escapeHtml(t('lockerConfirmTitle'))}
            </h3>
            <p>${escapeHtml(t('lockerConfirmDesc'))}</p>
            <div class="tip">${tipTxt}</div>
            <div class="actions">
              <button class="btn-cancel" data-act="cancel">${escapeHtml(t('lockerConfirmCancel'))}</button>
              <button class="btn-confirm" data-act="ok">${escapeHtml(t('lockerConfirmOK'))}</button>
            </div>
          </div>`;
        document.body.appendChild(mask);
        confirmMask = mask;
        const close = (result)=>{ if(confirmMask === mask){ mask.remove(); confirmMask = null; } resolve(result); };
        mask.querySelector('[data-act="cancel"]').addEventListener('click', ()=>close(false));
        mask.querySelector('[data-act="ok"]').addEventListener('click', ()=>{
          const ok = !!doLock();
          close(ok);
        });
        mask.addEventListener('click', (e)=>{ if(e.target === mask) close(false); });
      }catch(e){
        console.warn('[Locker] confirm popup error', e);
        resolve(!!doLock());
      }
    });
  }

  /* —— 启动锁机 ——
     force=true: 忽略 cfg.enabled 检查（用于测试锁机），且允许 <1 分钟的时长
  */
  function lock(durationMin, force){
    if(!force && !cfg.enabled) return false;
    if(activeLock) return false;
    let minutes;
    if(force){
      // 测试模式：允许秒级时长
      minutes = Math.max(1/60, Math.min(480, durationMin || (cfg.defaultDuration/60)));
    } else {
      minutes = Math.max(1, Math.min(480, durationMin || cfg.defaultDuration));
    }
    lockDurationMin = minutes;
    lockEndTime = Date.now() + minutes * 60 * 1000;
    activeLock = true;
    
    // 确保遮罩存在
    ensureOverlay();
    if(!lockOverlay){
      activeLock = false; lockEndTime = 0; return false;
    }
    
    // 重新渲染内容（更新i18n和应用列表）
    renderOverlayContent();
    
    // 强制移除 splash 层（如果还存在）
    const splash = document.getElementById('appSplash');
    if(splash){ splash.classList.add('hide'); splash.remove(); }
    
    // 显示遮罩 - 确保在最顶层
    lockOverlay.classList.add('active');
    lockOverlay.style.display = 'flex';
    lockOverlay.style.visibility = 'visible';
    lockOverlay.style.pointerEvents = 'auto';
    lockOverlay.style.touchAction = 'none';
    lockOverlay.style.zIndex = '999999';
    
    // 确保遮罩在body最后（最顶层）
    if(lockOverlay.parentNode && lockOverlay.parentNode.lastChild !== lockOverlay){
      lockOverlay.parentNode.appendChild(lockOverlay);
    }
    
    // iOS: 阻止所有触摸/手势事件
    blockTouchEvents(true);
    // 进入全屏（如果支持）
    requestFullScreen();
    // 锁定页面滚动
    lockPageScroll(true);
    // 添加 body 类以便 CSS 辅助
    document.body.classList.add('locker-active');
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
    lockDurationMin = 0;
    
    // 停止计时器
    if(timerInterval){
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // 恢复触摸/手势（在隐藏遮罩之前）
    blockTouchEvents(false);
    lockPageScroll(false);
    exitFullScreen();
    restoreBack();
    
    // 清理 body 类
    document.body.classList.remove('locker-active');
    
    // 隐藏遮罩（确保完全不可见且不阻挡交互）
    if(lockOverlay){
      lockOverlay.classList.remove('active');
      lockOverlay.style.display = 'none';
      lockOverlay.style.visibility = 'hidden';
      lockOverlay.style.pointerEvents = 'none';
      lockOverlay.style.touchAction = '';
    }
    
    if(onLockChange) onLockChange(false, 0, forced);
  }

  /* —— 测试锁机（忽略 enabled 开关，走确认弹窗 -> 确认后强制锁 15 秒） —— */
  function testLock(){
    if(activeLock) return Promise.resolve(false);
    return new Promise((resolve)=>{
      try{
        if(confirmMask){ confirmMask.remove(); confirmMask = null; }
        const mask = document.createElement('div');
        mask.className = 'locker-confirm-mask';
        const emergencyTxt = t('lockerEmergency');
        const tipTxt = t('lockerConfirmTip', {text: emergencyTxt}).replace(/\n/g, '<br>') +
          `<br><br>⏱️ 测试锁机将锁定 <b>15 秒</b>。`;
        mask.innerHTML = `
          <div class="locker-confirm-box">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              ${escapeHtml(t('lockerConfirmTitle'))}
            </h3>
            <p>${escapeHtml(t('lockerConfirmDesc'))}</p>
            <div class="tip">${tipTxt}</div>
            <div class="actions">
              <button class="btn-cancel" data-act="cancel">${escapeHtml(t('lockerConfirmCancel'))}</button>
              <button class="btn-confirm" data-act="ok">${escapeHtml(t('lockerConfirmOK'))}</button>
            </div>
          </div>`;
        document.body.appendChild(mask);
        confirmMask = mask;
        const close = (result)=>{ if(confirmMask === mask){ mask.remove(); confirmMask = null; } resolve(result); };
        mask.querySelector('[data-act="cancel"]').addEventListener('click', ()=>close(false));
        mask.querySelector('[data-act="ok"]').addEventListener('click', ()=>{
          // 测试锁机：强制锁 15 秒
          const durMin = 15 / 60; // 0.25 min = 15 sec
          const ok = lock(durMin, true);
          close(ok);
        });
        mask.addEventListener('click', (e)=>{ if(e.target === mask) close(false); });
      }catch(e){
        console.warn('[Locker] testLock popup error', e);
        resolve(!!lock(15/60, true));
      }
    });
  }

  /* —— 重新激活锁机（从后台回到前台时调用）—— */
  function reLock(){
    if(!activeLock) return;
    if(lockEndTime <= Date.now()){
      unlock(false);
      return;
    }
    // 重新渲染遮罩（语言可能切换）
    ensureOverlay();
    renderOverlayContent();
    lockOverlay.classList.add('active');
    lockOverlay.style.pointerEvents = 'auto';
    // 重新阻止触摸事件
    blockTouchEvents(true);
    // 重新进入全屏
    requestFullScreen();
    // 重新锁定滚动
    lockPageScroll(true);
    // 重新启动计时器（如果已停止）
    if(!timerInterval){
      startTimer();
    }
    // 重新阻止返回
    preventBack();
    // 更新显示
    updateTimerDisplay();
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
    const plat = platform();
    if(plat === 'ios' || plat === 'android'){
      // 原生平台：尝试使用 Capacitor 的全屏 API
      try {
        if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar){
          // 隐藏状态栏，实现全屏效果
          if(window.Capacitor.Plugins.StatusBar.hide){
            window.Capacitor.Plugins.StatusBar.hide().catch(()=>{});
          }
          if(window.Capacitor.Plugins.StatusBar.setOverlaysWebView){
            window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: false }).catch(()=>{});
          }
        }
      } catch(e){}
      // iOS Safari: 不支持 Fullscreen API，跳过
      if(plat === 'ios') return;
    }
    // Web/Android: 标准 Fullscreen API
    try {
      const el = document.documentElement;
      if(el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if(el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    } catch(e){}
  }
  function exitFullScreen(){
    const plat = platform();
    if(plat === 'ios' || plat === 'android'){
      try {
        if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar){
          if(window.Capacitor.Plugins.StatusBar.show){
            window.Capacitor.Plugins.StatusBar.show().catch(()=>{});
          }
          if(window.Capacitor.Plugins.StatusBar.setOverlaysWebView){
            window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true }).catch(()=>{});
          }
        }
      } catch(e){}
      if(plat === 'ios') return;
    }
    try {
      if(document.exitFullscreen && document.fullscreenElement){
        document.exitFullscreen().catch(()=>{});
      } else if(document.webkitExitFullscreen && document.webkitFullscreenElement){
        document.webkitExitFullscreen();
      }
    } catch(e){}
  }

  /* —— 阻止/恢复返回按钮（Android Capacitor + iOS popstate）—— */
  function preventBack(){
    if(backButtonListenerActive) return; // 防止重复添加
    // Android: Capacitor App 插件的 backButton 事件
    try {
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
        const App = window.Capacitor.Plugins.App;
        if(App.addListener){
          App.addListener('backButton', onBackButton);
        }
      }
    } catch(e){}
    // iOS/Web: 拦截浏览器后退（popstate）
    window.addEventListener('popstate', onPopStateBlock);
    // iOS: 拦截 history back
    const plat = platform();
    if(plat === 'ios'){
      // iOS Capacitor: 使用 App 插件监听
      try {
        if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
          window.Capacitor.Plugins.App.addListener('backButton', onBackButton).catch(()=>{});
        }
      } catch(e){}
    }
    backButtonListenerActive = true;
  }
  function onBackButton(){
    // 提示用户正在锁机中
    showExitHint();
  }
  function onPopStateBlock(){
    // 阻止浏览器后退：重新 pushState 保持当前历史
    window.history.pushState(null, '', window.location.href);
    showExitHint();
  }
  function restoreBack(){
    if(!backButtonListenerActive) return;
    try {
      // Capacitor App 插件
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
        const App = window.Capacitor.Plugins.App;
        if(App.removeListener){
          App.removeListener('backButton', onBackButton);
        }
      }
    } catch(e){}
    window.removeEventListener('popstate', onPopStateBlock);
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

  /* —— iOS/通用：阻止触摸和手势事件 —— */
  let touchBlocked = false;
  function blockTouchEvents(on){
    if(on === touchBlocked) return;
    touchBlocked = on;
    if(on){
      // 拦截所有触摸事件（防止 iOS 边缘滑动、下拉刷新、橡皮筋等）
      document.addEventListener('touchstart', onTouchBlock, { passive: false });
      document.addEventListener('touchmove', onTouchBlock, { passive: false });
      document.addEventListener('touchend', onTouchBlock, { passive: false });
      document.addEventListener('touchcancel', onTouchBlock, { passive: false });
      // iOS 手势：捏合缩放、双击缩放
      document.addEventListener('gesturestart', onGestureBlock, { passive: false });
      document.addEventListener('gesturechange', onGestureBlock, { passive: false });
      document.addEventListener('gestureend', onGestureBlock, { passive: false });
      // iOS 阻止双击缩放
      document.addEventListener('dblclick', onDblClickBlock, { passive: false });
      // 阻止 context menu
      document.addEventListener('contextmenu', preventDefault, { passive: false });
      // 阻止键盘事件（音量键等可能触发系统操作）
      document.addEventListener('keydown', onKeyDownBlock, { passive: false });
    } else {
      document.removeEventListener('touchstart', onTouchBlock);
      document.removeEventListener('touchmove', onTouchBlock);
      document.removeEventListener('touchend', onTouchBlock);
      document.removeEventListener('touchcancel', onTouchBlock);
      document.removeEventListener('gesturestart', onGestureBlock);
      document.removeEventListener('gesturechange', onGestureBlock);
      document.removeEventListener('gestureend', onGestureBlock);
      document.removeEventListener('dblclick', onDblClickBlock);
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('keydown', onKeyDownBlock);
    }
  }
  function onTouchBlock(e){
    // 如果触摸在紧急退出按钮上，允许通过
    if(e.target && e.target.closest && e.target.closest('#lockerEmergency')){
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  function onGestureBlock(e){
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  function onDblClickBlock(e){
    e.preventDefault();
    return false;
  }
  function preventDefault(e){
    e.preventDefault();
    return false;
  }
  function onKeyDownBlock(e){
    // 阻止 Escape、F11 等键
    if(e.key === 'Escape' || e.key === 'F11' || e.key === 'Backspace'){
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  /* —— 锁定页面滚动（防止橡皮筋/下拉刷新）—— */
  let scrollLocked = false;
  let savedScrollY = 0;
  function lockPageScroll(on){
    if(on === scrollLocked) return;
    scrollLocked = on;
    if(on){
      savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      // 固定 body 位置
      const st = document.body.style;
      // 保存原始样式
      st.overflow = 'hidden';
      st.position = 'fixed';
      st.top = (-savedScrollY) + 'px';
      st.left = '0';
      st.right = '0';
      st.width = '100%';
      // 锁定 html 和 body 的滚动
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    } else {
      const st = document.body.style;
      // 恢复原始样式
      st.overflow = '';
      st.position = '';
      st.top = '';
      st.left = '';
      st.right = '';
      st.width = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
      // 恢复滚动位置
      window.scrollTo(0, savedScrollY);
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
      // 首先清理可能残留的锁机遮罩（防止上次未正常关闭导致按钮无法点击）
      cleanupStaleOverlay();
      
      // 监听专注开始/结束
      if(window.Timer){
        Timer.onStateChange((running, mode, minutes)=>{
          if(cfg.enabled && cfg.lockInFocus && mode === 'focus'){
            if(running && !activeLock){
              // 使用 lockWithConfirm：弹窗提示用户即将进入锁机模式
              const dur = minutes || cfg.defaultDuration;
              lockWithConfirm(dur, false).then(confirmed => {
                if(!confirmed){
                  // 用户取消了锁机确认 → 暂停计时器
                  if(window.Timer && Timer.isRunning()){
                    Timer.pause();
                  }
                }
              });
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
      // 可见性变化：从后台回前台时重新检查 + 重新激活锁机
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState === 'visible' && cfg.enabled){
          checkScheduledLock();
          // 关键修复：iOS 上滑退出后回到应用，若锁机未到期，立即重新激活锁机遮罩
          if(activeLock && lockEndTime > Date.now()){
            reLock();
          }
        }
      });
      // Capacitor App 状态变化：原生层从后台回前台
      try {
        if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
          const App = window.Capacitor.Plugins.App;
          if(App.addListener){
            App.addListener('appStateChange', (state)=>{
              if(state && state.isActive && cfg.enabled){
                // 应用回到前台，重新检查定时锁定
                checkScheduledLock();
                // 若锁机未到期，重新激活
                if(activeLock && lockEndTime > Date.now()){
                  reLock();
                }
              }
            });
            // 监听应用恢复活跃（iOS 特有）
            App.addListener('resume', ()=>{
              if(activeLock && lockEndTime > Date.now()){
                reLock();
              }
            });
          }
        }
      } catch(e){}
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
    lockWithConfirm,
    testLock,
    // 直接 lock（内部用，跳过确认但仍遵守 enabled 开关；force=true 忽略开关用于测试）
    forceLock(min, force){ return lock(min, !!force); },
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
    platform,
    cleanupStaleOverlay,
    // 强制清理（用于调试或紧急情况）
    forceCleanup: cleanupStaleOverlay
  };
})();
