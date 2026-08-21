/* ===== 专心通 / Focus Master · 时间表 + 通知提醒 v1 =====
   - 每分钟轮询任务时间
   - 原生 Notification API（浏览器）+ Capacitor LocalNotifications（iOS 原生）
   - 支持提前提醒分钟
   - 同一任务每天只提醒一次（跨天重置）
   - 在设置中可以开关
*/
(function(){
  'use strict';
  const CFG_KEY = 'zxt_schedule_v1';
  const CHECK_INTERVAL = 20 * 1000; // 每 20 秒检查一次（足够及时又省电）

  let cfg = loadCfg();
  let onReminder = null;
  let checkTimer = null;
  let lastCheckKey = ''; // 防止同一分钟内重复

  function loadCfg(){
    try{
      return Object.assign({
        enabled: false,   // 总开关
        before: 0,        // 提前几分钟提醒
      }, JSON.parse(localStorage.getItem(CFG_KEY)) || {});
    }catch(e){
      return { enabled:false, before:0 };
    }
  }
  function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

  function t(key){ return window.I18n ? I18n.t(key) : key; }

  /* 请求通知权限（浏览器 + Capacitor） */
  async function requestPermission(){
    // 1) Capacitor 原生本地通知
    try {
      if(window.Capacitor && window.Capacitor.Plugins
        && window.Capacitor.Plugins.LocalNotifications){
        const LN = window.Capacitor.Plugins.LocalNotifications;
        // 先请求权限
        if(LN.requestPermissions){
          try {
            const r = await LN.requestPermissions();
            if(r && (r.display === 'granted' || r.notification === 'granted')) {
              // 创建一个通知通道（Android 需要）
              try {
                if(LN.createChannel){
                  await LN.createChannel({
                    id: 'focus-reminders',
                    name: '专注提醒',
                    description: '任务到点提醒',
                    importance: 4,
                    visibility: 1,
                    sound: 'default'
                  });
                }
              } catch(_){}
              return 'granted';
            }
          } catch(e){
            console.warn('LocalNotifications.requestPermissions failed:', e);
          }
        }
        // 检查当前权限
        if(LN.checkPermissions){
          try {
            const p = await LN.checkPermissions();
            if(p && (p.display === 'granted' || p.notification === 'granted')) {
              return 'granted';
            }
          } catch(_){}
        }
      }
    } catch(e){
      console.warn('Capacitor LocalNotifications not available:', e);
    }
    // 2) 浏览器 Notification API
    if(typeof Notification !== 'undefined'){
      if(Notification.permission === 'granted') return 'granted';
      if(Notification.permission === 'denied') return 'denied';
      try {
        const r = await Notification.requestPermission();
        return r;
      } catch(_){ return Notification.permission; }
    }
    return 'default';
  }

  function getPermissionStatus(){
    // Capacitor 优先
    if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications){
      const LN = window.Capacitor.Plugins.LocalNotifications;
      if(LN.checkPermissions){
        try {
          // 同步返回 Promise，但我们简化返回浏览器状态作为兜底
          // 实际异步检查会在 requestPermission 中处理
        } catch(_){}
      }
    }
    if(typeof Notification !== 'undefined') return Notification.permission;
    return 'default';
  }

  /* 异步获取权限状态（原生支持） */
  async function getPermissionStatusAsync(){
    try {
      if(window.Capacitor && window.Capacitor.Plugins
        && window.Capacitor.Plugins.LocalNotifications){
        const LN = window.Capacitor.Plugins.LocalNotifications;
        if(LN.checkPermissions){
          const p = await LN.checkPermissions();
          return p && (p.display || p.notification) || 'default';
        }
      }
    } catch(_){}
    if(typeof Notification !== 'undefined') return Notification.permission;
    return 'default';
  }

  /* 发送一条通知（优先原生 Capacitor） */
  function sendNotification(title, body){
    // Capacitor 本地通知（iOS 后台也能弹）
    try {
      if(window.Capacitor && window.Capacitor.Plugins
        && window.Capacitor.Plugins.LocalNotifications){
        const LN = window.Capacitor.Plugins.LocalNotifications;
        if(LN.schedule){
          LN.schedule({ notifications: [{
            id: Math.floor(Math.random()*2147483647),
            title, body,
            schedule: { at: new Date(Date.now()+1000), allowWhileIdle: true },
            sound: 'default'
          }]}).catch(()=>{});
          return;
        }
      }
    } catch(_){}
    // 浏览器 Web Notification（前台有效）
    try {
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        try { new Notification(title, { body, silent:false }); } catch(_){}
      }
    } catch(_){}
  }

  /* 检查当前时间是否有任务到点，触发通知 */
  function checkNow(){
    if(!cfg.enabled) return;
    if(!window.Tasks) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const currentTime = `${hh}:${mm}`;

    // 计算提前提醒的时间（before 分钟前）
    let beforeH = now.getHours();
    let beforeM = now.getMinutes() - cfg.before;
    if(beforeM < 0){ beforeM += 60; beforeH -= 1; if(beforeH<0) beforeH+=24; }
    const triggerTime = `${String(beforeH).padStart(2,'0')}:${String(beforeM).padStart(2,'0')}`;

    // 为了避免 20 秒内重复，以分钟 + before 为 key 防抖
    const checkKey = currentTime + '_b' + cfg.before;
    if(checkKey === lastCheckKey) return;
    lastCheckKey = checkKey;

    const all = window.Tasks.all();
    all.forEach(task => {
      if(task.done || !task.time) return;
      if(window.Tasks.wasNotifiedToday(task)) return;
      if(task.time === triggerTime){
        // 命中！
        const tagNames = (task.tags||[]).map(id=>{
          const tg = window.Tasks.getTagById(id); return tg ? tg.name : '';
        }).filter(Boolean).join('·');
        const title = '⏰ ' + (task.text || t('scheduleTitle'));
        const body = (task.time ? task.time + '  ' : '') + (tagNames || (task.desc||''));
        sendNotification(title, body);
        window.Tasks.setNotifiedToday(task.id);
        if(onReminder) onReminder(task);
        // 同步 chime 一下
        try { if(window.Sound && Sound.chime) Sound.chime(); } catch(_){}
      }
    });
  }

  /* 启动 / 停止轮询 */
  function startLoop(){
    stopLoop();
    checkNow();
    checkTimer = setInterval(checkNow, CHECK_INTERVAL);
  }
  function stopLoop(){
    if(checkTimer){ clearInterval(checkTimer); checkTimer = null; }
    lastCheckKey = '';
  }
  function setEnabled(on){
    cfg.enabled = !!on;
    saveCfg();
    if(cfg.enabled) startLoop(); else stopLoop();
    renderStatus();
  }
  function setBefore(min){
    cfg.before = Math.max(0, Math.min(30, +min||0));
    saveCfg();
  }
  function isEnabled(){ return cfg.enabled; }
  function getBefore(){ return cfg.before; }

  /* 渲染时间表视图 */
  function renderScheduleView(){
    const list = document.getElementById('scheduleList');
    const empty = document.getElementById('scheduleEmpty');
    const dateEl = document.getElementById('scheduleDate');
    if(!list) return;

    // 日期
    const now = new Date();
    const weekdays = ['daySun','dayMon','dayTue','dayWed','dayThu','dayFri','daySat'];
    const monthKey = 'month' + (now.getMonth()+1);
    const dateStr = `${t(monthKey)} ${now.getDate()} · ${t(weekdays[now.getDay()])}`;
    if(dateEl) dateEl.textContent = dateStr;

    const items = window.Tasks ? window.Tasks.getScheduledTasks() : [];
    list.innerHTML = items.map(task => {
      const tag = (task.tags||[])[0];
      const tagObj = tag ? window.Tasks.getTagById(tag) : null;
      const tagHtml = tagObj
        ? `<span class="task-tag si-tag" style="background:${tagObj.color}">${tagObj.name}</span>`
        : '';
      const notified = window.Tasks.wasNotifiedToday(task)
        ? `<span class="schedule-notified">${t('notified')}</span>`
        : '';
      return `<li class="schedule-item" data-id="${task.id}">
        <span class="schedule-time">${task.time}</span>
        <div class="schedule-info">
          <div class="si-title">${escapeHtml(task.text)}</div>
          ${tagHtml}
        </div>
        ${notified}
      </li>`;
    }).join('');
    if(empty) empty.style.display = items.length ? 'none' : 'block';
  }
  function escapeHtml(s){
    return String(s||'').replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }

  function renderStatus(){
    // 时间表页面顶部的提醒状态
    const status = document.getElementById('notifyStatus');
    const btn = document.getElementById('btnEnableNotify');
    if(status){
      status.textContent = cfg.enabled ? t('notifyOn') : t('notifyOff');
      status.classList.toggle('on', !!cfg.enabled);
    }
    if(btn){
      btn.textContent = cfg.enabled ? t('disableNotify') : t('enableNotify');
    }
  }

  /* 绑定：时间表视图里的快捷开关按钮 */
  function bindScheduleView(){
    const btn = document.getElementById('btnEnableNotify');
    if(btn){
      btn.addEventListener('click', async () => {
        if(!cfg.enabled){
          // 先请求权限
          const perm = await requestPermission();
          if(perm === 'denied'){
            try { alert(t('notifyPermDenied')); } catch(_){}
          }
        }
        setEnabled(!cfg.enabled);
      });
    }
  }

  /* 公共 API */
  window.Schedule = {
    init(){
      bindScheduleView();
      renderStatus();
      // 如果启用了，启动轮询
      if(cfg.enabled) startLoop();
      // 页面恢复时也重新启动
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState === 'visible'){
          if(cfg.enabled){
            lastCheckKey = ''; // 允许立即检查一次
            startLoop();
          }
          renderScheduleView();
        }
      });
    },
    requestPermission,
    getPermissionStatus,
    getPermissionStatusAsync,
    setEnabled,
    isEnabled,
    setBefore,
    getBefore,
    render: renderScheduleView,
    renderStatus,
    onReminder(cb){ onReminder = cb; },
    // 手动触发立即检查（调试用）
    _checkNow: checkNow,
  };
})();
