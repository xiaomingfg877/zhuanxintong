/* ===== 专心通 / Focus Master · 应用主逻辑 v4
   新增：主题切换（浅/深/跟随）、通知开关绑定、标签管理CRUD、
   任务编辑弹窗（新建+编辑）、Schedule/Garden 初始化与回调接入。
*/
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CFG_KEY = 'zxt_config_v3';

  // —— 设置持久化 ——
  function loadCfg(){
    try{
      return Object.assign({
        focus:25, break:5, longBreak:15, rounds:4,
        loopEnabled:true, chime:true, immersive:true, seconds:true, volume:60,
        timerMode:'pomodoro', preventSleep:true, hideStatusBar:true,
        langPref:'auto', theme:'auto'
      }, JSON.parse(localStorage.getItem(CFG_KEY)));
    }catch(e){
      return {focus:25, break:5, longBreak:15, rounds:4, loopEnabled:true, chime:true, immersive:true, seconds:true, volume:60, timerMode:'pomodoro', preventSleep:true, hideStatusBar:true, langPref:'auto', theme:'auto'};
    }
  }
  function saveCfg(cfg){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  let cfg = loadCfg();

  // —— 主题切换 ——
  const THEME_KEY = 'zxt_theme_pref';
  function applyTheme(pref){
    pref = pref || cfg.theme || 'auto';
    const root = document.body;
    let mode = pref;
    if(pref === 'auto'){
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-theme', pref);
    // meta theme-color
    const light = document.querySelector('meta[theme-color][media*="light"]');
    const dark = document.querySelector('meta[theme-color][media*="dark"]');
    const universal = document.querySelectorAll('meta[theme-color]');
    try{
      if(mode === 'dark'){
        universal.forEach(m => m.setAttribute('content', '#14130f'));
      } else {
        universal.forEach(m => m.setAttribute('content', '#f5f3ee'));
      }
    }catch(_){}
    // 更新按钮 active 状态
    document.querySelectorAll('.theme-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.theme === pref);
    });
    // iOS 状态栏样式（Capacitor）
    try{
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StatusBar){
        Capacitor.Plugins.StatusBar.setStyle &&
          Capacitor.Plugins.StatusBar.setStyle({ style: mode==='dark' ? 'DARK' : 'LIGHT' }).catch(()=>{});
      }
    }catch(_){}
  }
  // 跟随系统监听
  if(window.matchMedia){
    try{
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = ()=>{ if(cfg.theme==='auto') applyTheme('auto'); };
      if(mql.addEventListener) mql.addEventListener('change', onChange);
      else if(mql.addListener) mql.addListener(onChange);
    }catch(_){}
  }
  // 立即应用
  applyTheme(cfg.theme);
  // 绑定主题切换按钮
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const th = btn.dataset.theme;
      cfg.theme = th; saveCfg(cfg);
      applyTheme(th);
    });
  });

  // —— 语言 ——
  function applyLang(pref){
    if(pref === 'auto'){
      localStorage.removeItem('zxt_lang');
      I18n.applyTranslations();
    } else {
      I18n.setLang(pref);
    }
    renderSoundGrid();
    renderPresetLabels();
    Timer.paint();
    Tasks.render();
    if(window.Stats) Stats.render();
    if(window.Schedule) Schedule.render();
    if(window.Garden) Garden.render();
    Tasks.renderTagManager($('tagManager'));
    updateTimerHint();
    updateLangButtons(pref);
    // 刷新锁机相关UI
    if(window.AppLocker){
      AppLocker.refreshAppList();
      AppLocker.refreshOverlay();
    }
  }
  function updateLangButtons(pref){
    document.querySelectorAll('.lang-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.lang === pref);
    });
  }
  if(cfg.langPref && cfg.langPref !== 'auto'){
    I18n.setLang(cfg.langPref);
  } else {
    I18n.applyTranslations();
  }
  updateLangButtons(cfg.langPref || 'auto');
  document.querySelectorAll('.lang-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const lang = btn.dataset.lang;
      cfg.langPref = lang; saveCfg(cfg);
      applyLang(lang);
    });
  });

  // —— 视图切换 ——
  const navs = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  navs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const v = btn.dataset.view;
      navs.forEach(b=>b.classList.toggle('active', b===btn));
      views.forEach(s=>s.classList.toggle('active', s.id==='view-'+v));
      if(v==='stats' && window.Stats) Stats.render();
      if(v==='schedule' && window.Schedule) Schedule.render();
      if(v==='garden' && window.Garden) Garden.render();
      if(v==='settings'){
        Tasks.renderTagManager($('tagManager'));
      }
    });
  });

  // —— 模式切换（番茄/正常）——
  const modeSwitch = $('modeSwitch');
  if(modeSwitch){
    modeSwitch.addEventListener('click', (e)=>{
      const btn = e.target.closest('.mode-btn');
      if(!btn) return;
      const m = btn.dataset.mode;
      modeSwitch.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b===btn));
      cfg.timerMode = m; saveCfg(cfg);
      Timer.setTimerMode(m);
      document.querySelectorAll('input[name="timerMode"]').forEach(r=>{
        r.checked = r.value === m;
      });
      updateModeUI(m);
    });
  }
  document.querySelectorAll('input[name="timerMode"]').forEach(radio=>{
    radio.addEventListener('change', ()=>{
      if(radio.checked){
        const m = radio.value;
        cfg.timerMode = m; saveCfg(cfg);
        Timer.setTimerMode(m);
        modeSwitch.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===m));
        updateModeUI(m);
      }
    });
  });
  function updateModeUI(m){
    try {
      const mode = m || cfg.timerMode || 'pomodoro';
      console.log('[updateModeUI] mode=' + mode);
      
      // 写入 documentElement 属性，配合 CSS 选择器
      try{
        document.documentElement.setAttribute('data-timer-mode', mode);
        document.body.setAttribute('data-timer-mode', mode);
      }catch(_){}
      
      const isNormal = mode === 'normal';
      
      // —— 设置视图：隐藏番茄循环和休息行 ——
      const pomodoroSettings = $('pomodoroSettings');
      const cfgBreakRow = $('cfgBreakRow');
      
      if(isNormal){
        if(pomodoroSettings){
          pomodoroSettings.setAttribute('data-hidden', 'true');
          pomodoroSettings.style.setProperty('display', 'none', 'important');
          pomodoroSettings.style.setProperty('visibility', 'hidden', 'important');
          pomodoroSettings.style.setProperty('height', '0', 'important');
          pomodoroSettings.style.setProperty('max-height', '0', 'important');
          pomodoroSettings.style.setProperty('overflow', 'hidden', 'important');
          pomodoroSettings.style.setProperty('padding', '0', 'important');
          pomodoroSettings.style.setProperty('margin', '0', 'important');
        }
        if(cfgBreakRow){
          cfgBreakRow.setAttribute('data-hidden', 'true');
          cfgBreakRow.style.setProperty('display', 'none', 'important');
          cfgBreakRow.style.setProperty('visibility', 'hidden', 'important');
          cfgBreakRow.style.setProperty('height', '0', 'important');
          cfgBreakRow.style.setProperty('max-height', '0', 'important');
          cfgBreakRow.style.setProperty('overflow', 'hidden', 'important');
        }
      } else {
        if(pomodoroSettings){
          pomodoroSettings.removeAttribute('data-hidden');
          pomodoroSettings.style.removeProperty('display');
          pomodoroSettings.style.removeProperty('visibility');
          pomodoroSettings.style.removeProperty('height');
          pomodoroSettings.style.removeProperty('max-height');
          pomodoroSettings.style.removeProperty('overflow');
          pomodoroSettings.style.removeProperty('padding');
          pomodoroSettings.style.removeProperty('margin');
        }
        if(cfgBreakRow){
          cfgBreakRow.removeAttribute('data-hidden');
          cfgBreakRow.style.removeProperty('display');
          cfgBreakRow.style.removeProperty('visibility');
          cfgBreakRow.style.removeProperty('height');
          cfgBreakRow.style.removeProperty('max-height');
          cfgBreakRow.style.removeProperty('overflow');
        }
      }
      
      // —— 专注视图：隐藏自定义中的休息部分 ——
      const customBreak = $('customBreak');
      const customSep = document.querySelector('.custom-sep');
      const customUnit = document.querySelector('.timer-custom .custom-unit');
      const timerCustom = document.querySelector('.timer-custom');
      
      if(isNormal){
        // 隐藏休息输入框
        if(customBreak){
          customBreak.style.setProperty('display', 'none', 'important');
          customBreak.style.setProperty('visibility', 'hidden', 'important');
          customBreak.style.setProperty('width', '0', 'important');
          customBreak.style.setProperty('height', '0', 'important');
          customBreak.style.setProperty('padding', '0', 'important');
          customBreak.style.setProperty('margin', '0', 'important');
          customBreak.style.setProperty('opacity', '0', 'important');
          customBreak.setAttribute('disabled', 'disabled');
          customBreak.setAttribute('aria-hidden', 'true');
        }
        // 隐藏分隔符
        if(customSep){
          customSep.style.setProperty('display', 'none', 'important');
          customSep.style.setProperty('visibility', 'hidden', 'important');
          customSep.style.setProperty('width', '0', 'important');
          customSep.style.setProperty('opacity', '0', 'important');
        }
        // 调整自定义区域布局，让应用按钮紧贴专注输入
        if(timerCustom){
          timerCustom.style.setProperty('gap', '4px', 'important');
        }
      } else {
        if(customBreak){
          customBreak.style.removeProperty('display');
          customBreak.style.removeProperty('visibility');
          customBreak.style.removeProperty('width');
          customBreak.style.removeProperty('height');
          customBreak.style.removeProperty('padding');
          customBreak.style.removeProperty('margin');
          customBreak.style.removeProperty('opacity');
          customBreak.removeAttribute('disabled');
          customBreak.removeAttribute('aria-hidden');
        }
        if(customSep){
          customSep.style.removeProperty('display');
          customSep.style.removeProperty('visibility');
          customSep.style.removeProperty('width');
          customSep.style.removeProperty('opacity');
        }
        if(timerCustom){
          timerCustom.style.removeProperty('gap');
        }
      }
      
      // 重新渲染预设按钮标签
      renderPresetLabels();
      
      console.log('[updateModeUI] Done, isNormal=' + isNormal);
    } catch(e) {
      console.error('[updateModeUI] Error:', e);
    }
  }

  // —— 番茄钟按钮 ——
  $('btnToggle').addEventListener('click', ()=>{
    if(Timer.isRunning()) Timer.pause(); else Timer.start();
  });
  $('btnReset').addEventListener('click', ()=>Timer.reset());
  $('btnSkip').addEventListener('click', ()=>Timer.skip());

  // 中心圆环点击
  $('timerTapArea').addEventListener('click', (e)=>{
    if(e.target.closest('.btn-circle')) return;
    if(!cfg.immersive){
      if(Timer.isRunning()) Timer.pause(); else Timer.start();
    }
  });
  $('timerTapArea').addEventListener('dblclick', ()=>{
    if(cfg.immersive) enterImmersive();
  });

  // —— 预设按钮 ——
  function renderPresetLabels(){
    try {
      const mode = (Timer.getTimerMode && Timer.getTimerMode()) || cfg.timerMode || 'pomodoro';
      const isNormal = mode === 'normal';
      const presets = document.querySelectorAll('.preset');
      if(!presets.length) { console.warn('[renderPresetLabels] No presets found'); return; }
      presets.forEach(b=>{
        const f = b.dataset.focus;
        const m = b.dataset.break;
        if(!f) return;
        let html;
        if(isNormal){
          // 正常模式：只显示专注时间
          const label = (window.I18n && I18n.t) ? I18n.t('presetFocusOnly', {n: f}) : `专注${f}`;
          html = `<span class="preset-focus">${label}</span>`;
          b.style.gap = '0';
        } else {
          // 番茄模式：显示专注·休息
          const label = (window.I18n && I18n.t) ? I18n.t('presetFocus', {n: f, m: m}) : `专注${f} · 休息${m}`;
          html = `<span class="preset-focus">${label}</span>`;
          b.style.gap = '';
        }
        b.innerHTML = html;
      });
      console.log('[renderPresetLabels] Done, mode=' + mode);
    } catch(e) {
      console.error('[renderPresetLabels] Error:', e);
    }
  }
  $('timerPresets').addEventListener('click', (e)=>{
    const b = e.target.closest('.preset');
    if(!b) return;
    $('timerPresets').querySelectorAll('.preset').forEach(x=>x.classList.toggle('active', x===b));
    Timer.setPreset(+b.dataset.focus, +b.dataset.break);
    $('customFocus').value = b.dataset.focus;
    $('customBreak').value = b.dataset.break;
  });

  // —— 自定义时间 ——
  $('btnCustom').addEventListener('click', ()=>{
    const f = Math.max(1, Math.min(180, +$('customFocus').value || 25));
    const b = Math.max(1, Math.min(60, +$('customBreak').value || 5));
    $('customFocus').value = f;
    $('customBreak').value = b;
    Timer.setCustom(f, b);
    $('timerPresets').querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));
    cfg.focus = f; cfg.break = b; saveCfg(cfg);
  });

  // —— 完成回调（集成 Garden）——
  Timer.onComplete((finishedMode, minutes)=>{
    if(cfg.chime && window.Sound) Sound.chime();
    if(finishedMode === 'focus'){
      if(window.Stats){ Stats.recordFocus(minutes); }
      if(cfg.timerMode !== 'normal' && window.Stats){ Stats.recordPomo(); }
      if(window.Tasks){ Tasks.addFocus(minutes); }
      if(window.Garden){ Garden.onFocusComplete(minutes); }
    }
  });

  // —— 沉浸模式 ——
  let wakeLock = null;
  let statusBarHidden = false;
  async function requestWakeLock(){
    if(!cfg.preventSleep) return;
    try { if('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); } } catch(e){}
  }
  async function releaseWakeLock(){
    if(wakeLock){ try { await wakeLock.release(); } catch(e){} wakeLock = null; }
  }
  async function hideStatusBar(){
    if(!cfg.hideStatusBar) return;
    try {
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StatusBar){
        await Capacitor.Plugins.StatusBar.hide(); statusBarHidden = true;
      }
    } catch(e){}
  }
  async function showStatusBar(){
    if(!statusBarHidden) return;
    try {
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StatusBar){
        await Capacitor.Plugins.StatusBar.show(); statusBarHidden = false;
      }
    } catch(e){}
  }
  async function enterImmersive(){
    $('immersive').hidden = false;
    await requestWakeLock();
    await hideStatusBar();
  }
  async function exitImmersive(){
    $('immersive').hidden = true;
    await releaseWakeLock();
    await showStatusBar();
  }
  $('immersiveClose').addEventListener('click', exitImmersive);
  document.addEventListener('visibilitychange', async ()=>{
    if(document.visibilityState === 'visible' && !$('immersive').hidden && cfg.preventSleep){
      await requestWakeLock();
    }
  });

  // —— 白噪音 ——
  const soundGrid = $('soundGrid');
  let soundReady = !!(window.Sound && Sound.defs && Sound.icons);
  function renderSoundGrid(){
    if(!soundGrid) return;
    if(!window.Sound || !Sound.defs || !Sound.icons){
      // Sound 尚未就绪，稍后重试
      soundGrid.innerHTML = '<p style="color:var(--ink-soft);text-align:center;padding:20px;">加载中...</p>';
      setTimeout(()=>{ soundReady = !!(window.Sound && Sound.defs); if(soundReady) renderSoundGrid(); }, 200);
      return;
    }
    try {
      soundGrid.innerHTML = Sound.defs.map(s=>`
        <button class="sound-card" data-id="${s.id}">
          <span class="sc-pulse"></span>
          <svg viewBox="0 0 24 24">${Sound.icons[s.id]}</svg>
          <span class="sc-name">${(window.I18n && I18n.t) ? I18n.t(s.nameKey) : s.nameKey}</span>
          <span class="sc-kanji">${(window.I18n && I18n.t) ? I18n.t(s.kanjiKey) : s.kanjiKey}</span>
        </button>
      `).join('');
      const cur = Sound.currentId && Sound.currentId();
      if(cur){
        soundGrid.querySelectorAll('.sound-card').forEach(c=>c.classList.toggle('playing', c.dataset.id===cur));
      }
      soundReady = true;
    } catch(e) {
      console.error('[renderSoundGrid] Error:', e);
    }
  }
  // 立即尝试渲染，如果 Sound 未就绪则延迟重试
  renderSoundGrid();
  
  // 延迟绑定 Sound 相关的事件，确保 Sound 已就绪
  const bindSoundEvents = () => {
    if(!window.Sound){
      setTimeout(bindSoundEvents, 100);
      return;
    }
    try {
      soundGrid.addEventListener('click', (e)=>{
        const card = e.target.closest('.sound-card');
        if(!card) return;
        if(Sound.toggle) Sound.toggle(card.dataset.id);
      });
      if(Sound.onStateChange){
        Sound.onStateChange((id)=>{
          soundGrid.querySelectorAll('.sound-card').forEach(c=>c.classList.toggle('playing', c.dataset.id===id));
          const volEl = $('soundVolume');
          if(volEl) volEl.hidden = !id;
        });
      }
      const volSlider = $('volSlider');
      if(volSlider){
        volSlider.value = cfg.volume;
        const volVal = $('volVal');
        if(volVal) volVal.textContent = cfg.volume;
        if(Sound.setVolume){
          try { Sound.setVolume(cfg.volume / 100); } catch(_){}
        }
        volSlider.addEventListener('input', ()=>{
          const v = +volSlider.value;
          if(Sound.setVolume){ try { Sound.setVolume(v/100); } catch(_){} }
          if(volVal) volVal.textContent = v;
          cfg.volume = v; saveCfg(cfg);
        });
      }
      console.log('[App] Sound events bound OK');
    } catch(e) {
      console.error('[App] Sound bind error:', e);
    }
  };
  // 页面加载后立即尝试绑定
  if(document.readyState === 'complete' || soundReady){
    bindSoundEvents();
  } else {
    window.addEventListener('load', bindSoundEvents, { once: true });
    // 兜底：最多等待 2 秒
    setTimeout(bindSoundEvents, 2000);
  }

  // —— 任务 + 标签管理 + 任务编辑弹窗 ——
  $('taskAdd').addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = $('taskInput').value.trim();
    if(!val) return;
    // 直接走「新建弹窗」流程——允许用户补全描述/标签/时间
    openTaskModal(null, { text: val });
    $('taskInput').value = '';
  });

  // 任务列表点击（toggle / del / focus / edit）
  const taskListEl = $('taskList');
  Tasks.bindTaskEvents(taskListEl);
  // 数据变化：重渲染任务 + 时间表
  Tasks.onDataChange(()=>{
    Tasks.render();
    if(window.Schedule) Schedule.render();
  });

  // 任务编辑注册回调（由 task item 的 edit 按钮触发）
  Tasks.onEdit = (task)=>{
    openTaskModal(task);
  };

  // —— 标签管理（设置页面）——
  function initTagManager(){
    Tasks.renderTagManager($('tagManager'));
    const tagMgr = $('tagManager');
    if(tagMgr){
      tagMgr.addEventListener('click', (e)=>{
        const del = e.target.closest('[data-del-tag]');
        if(del){
          Tasks.removeCustomTag(del.dataset.delTag);
          Tasks.renderTagManager(tagMgr);
        }
      });
    }
    const addBtn = $('btnAddTag');
    if(addBtn){
      addBtn.addEventListener('click', ()=>{
        const name = ($('newTagInput')?.value || '').trim();
        const color = ($('newTagColor')?.value) || '#b5482e';
        if(!name) return;
        Tasks.addCustomTag(name, color);
        $('newTagInput').value = '';
        Tasks.renderTagManager(tagMgr);
      });
    }
  }
  initTagManager();

  // —— 任务编辑弹窗 ——
  let modalEditingId = null;
  let modalSelectedTags = [];
  function openTaskModal(task, defaults){
    const modal = $('taskModal');
    if(!modal) return;
    const title = $('modalTitle');
    const text = $('modalTaskText');
    const desc = $('modalTaskDesc');
    const time = $('modalTaskTime');
    if(task){
      modalEditingId = task.id;
      modalSelectedTags = (task.tags || []).slice();
      title.textContent = I18n.t('editTask');
      text.value = task.text || '';
      desc.value = task.desc || '';
      time.value = task.time || '';
    } else {
      modalEditingId = null;
      modalSelectedTags = [];
      title.textContent = I18n.t('newTask');
      text.value = (defaults && defaults.text) || '';
      desc.value = (defaults && defaults.desc) || '';
      time.value = (defaults && defaults.time) || '';
    }
    renderModalTagSelector();
    modal.hidden = false;
    setTimeout(()=>{ try{ text.focus(); }catch(_){} }, 50);
  }
  function closeTaskModal(){
    const modal = $('taskModal');
    if(modal) modal.hidden = true;
    modalEditingId = null;
    modalSelectedTags = [];
  }
  function renderModalTagSelector(){
    const box = $('modalTagSelector');
    if(!box) return;
    Tasks.renderTagSelector(box, modalSelectedTags);
    box.querySelectorAll('.ts-item').forEach(it=>{
      it.addEventListener('click', ()=>{
        const id = it.dataset.id;
        const i = modalSelectedTags.indexOf(id);
        if(i>=0) modalSelectedTags.splice(i,1);
        else modalSelectedTags.push(id);
        renderModalTagSelector();
      });
    });
  }
  $('btnModalCancel').addEventListener('click', closeTaskModal);
  // 点击遮罩关闭
  const modalMask = document.querySelector('#taskModal .modal-mask');
  if(modalMask) modalMask.addEventListener('click', closeTaskModal);
  $('btnClearTime').addEventListener('click', ()=>{
    const t = $('modalTaskTime'); if(t) t.value = '';
  });
  $('btnModalSave').addEventListener('click', ()=>{
    const text = ($('modalTaskText').value || '').trim();
    if(!text){ closeTaskModal(); return; }
    const desc = ($('modalTaskDesc').value || '').trim();
    const time = ($('modalTaskTime').value || '').trim() || null;
    const data = {
      text,
      desc,
      tags: modalSelectedTags.slice(),
      time,
    };
    if(modalEditingId){
      Tasks.update(modalEditingId, data);
    } else {
      Tasks.addFull(data);
    }
    closeTaskModal();
    Tasks.render();
    if(window.Schedule) Schedule.render();
  });

  // —— 专注中状态变化 ——
  Tasks.onFocusingChange((id)=>{
    const t = id ? Tasks.all().find(x=>x.id===id) : null;
    $('timerTask').textContent = t ? t.text : I18n.t('noTask');
    updateTimerHint();
    Tasks.render();
  });
  function updateTimerHint(){
    const fid = Tasks.getFocusing();
    const t = fid ? Tasks.getFocusingTask() : null;
    if(t){
      $('timerHint').textContent = I18n.t('timerHintTask', {text: t.text});
    } else {
      $('timerHint').textContent = I18n.t('timerHint');
    }
  }

  // —— 时间表初始化 ——
  if(window.Schedule){
    Schedule.init();
    Schedule.render();
  }

  // —— 通知权限请求按钮（设置中）——
  const btnReqN = $('btnRequestNotify');
  if(btnReqN){
    // 初始化时显示当前权限状态
    if(window.Schedule && Schedule.getPermissionStatusAsync){
      Schedule.getPermissionStatusAsync().then(p=>{
        if(p === 'granted') btnReqN.textContent = I18n.t('notifyPermGranted');
        else if(p === 'denied') btnReqN.textContent = I18n.t('notifyPermDenied');
      });
    }
    btnReqN.addEventListener('click', async ()=>{
      if(window.Schedule){
        const r = await Schedule.requestPermission();
        btnReqN.textContent = r === 'granted' ? I18n.t('notifyPermGranted')
                              : r === 'denied' ? I18n.t('notifyPermDenied')
                              : I18n.t('notifyPermDefault');
        setTimeout(()=>{ btnReqN.textContent = I18n.t('reqPermission'); }, 2500);
      }
    });
  }

  // —— 花园初始化 ——
  if(window.Garden){
    Garden.render();
  }

  // —— 锁机功能初始化 ——
  if(window.AppLocker){
    try { 
      // 初始化（会自动清理残留遮罩）
      AppLocker.init(); 
      
      // ——— 专注视图（上边栏第一个）锁机组 ———
      const cfgLockerTop = $('cfgLockerTop');
      const cfgLockerInFocusTop = $('cfgLockerInFocusTop');
      const cfgLockerDurationTop = $('cfgLockerDurationTop');
      const testLockerTopBtn = $('btnTestLockerTop');
      const btnOpenLockerSettings = $('btnOpenLockerSettings');

      // 加载初始值
      if(cfgLockerTop) cfgLockerTop.checked = AppLocker.isEnabled();
      if(cfgLockerInFocusTop) cfgLockerInFocusTop.checked = AppLocker.isLockInFocus();
      if(cfgLockerDurationTop) cfgLockerDurationTop.value = AppLocker.getDefaultDuration();

      // 绑定专注视图锁机开关
      if(cfgLockerTop){
        cfgLockerTop.addEventListener('change', ()=>{
          AppLocker.setEnabled(cfgLockerTop.checked);
        });
      }
      if(cfgLockerInFocusTop){
        cfgLockerInFocusTop.addEventListener('change', ()=>{
          AppLocker.setLockInFocus(cfgLockerInFocusTop.checked);
        });
      }
      if(cfgLockerDurationTop){
        cfgLockerDurationTop.addEventListener('change', ()=>{
          const v = Math.max(1, Math.min(480, +cfgLockerDurationTop.value || 25));
          cfgLockerDurationTop.value = v;
          AppLocker.setDefaultDuration(v);
        });
      }
      if(testLockerTopBtn){
        testLockerTopBtn.addEventListener('click', ()=>{
          // 先确保没有残留遮罩
          if(typeof AppLocker.cleanupStaleOverlay === 'function'){
            AppLocker.cleanupStaleOverlay();
          }
          if(typeof AppLocker.testLock === 'function'){
            AppLocker.testLock();
          } else {
            AppLocker.lock(1, true);
          }
        });
      }
      if(btnOpenLockerSettings){
        btnOpenLockerSettings.addEventListener('click', ()=>{
          // 跳转到设置视图
          const settingsBtn = document.querySelector('.nav-item[data-view="settings"]');
          if(settingsBtn) settingsBtn.click();
        });
      }

      // ——— 设置视图：绑定兼容旧布局的元素（如果存在）———
      const oldCfgLocker = $('cfgLocker');
      if(oldCfgLocker){
        oldCfgLocker.checked = AppLocker.isEnabled();
        oldCfgLocker.addEventListener('change', ()=>{
          AppLocker.setEnabled(oldCfgLocker.checked);
          if(cfgLockerTop) cfgLockerTop.checked = oldCfgLocker.checked;
        });
      }
      const oldCfgLockerInFocus = $('cfgLockerInFocus');
      if(oldCfgLockerInFocus){
        oldCfgLockerInFocus.checked = AppLocker.isLockInFocus();
        oldCfgLockerInFocus.addEventListener('change', ()=>{
          AppLocker.setLockInFocus(oldCfgLockerInFocus.checked);
          if(cfgLockerInFocusTop) cfgLockerInFocusTop.checked = oldCfgLockerInFocus.checked;
        });
      }
      const oldCfgLockerDuration = $('cfgLockerDuration');
      if(oldCfgLockerDuration){
        oldCfgLockerDuration.value = AppLocker.getDefaultDuration();
        oldCfgLockerDuration.addEventListener('change', ()=>{
          const v = Math.max(1, Math.min(480, +oldCfgLockerDuration.value || 25));
          oldCfgLockerDuration.value = v;
          AppLocker.setDefaultDuration(v);
          if(cfgLockerDurationTop) cfgLockerDurationTop.value = v;
        });
      }
      // 旧测试按钮
      const oldBtnTestLocker = $('btnTestLocker');
      if(oldBtnTestLocker){
        oldBtnTestLocker.addEventListener('click', ()=>{
          if(typeof AppLocker.cleanupStaleOverlay === 'function'){
            AppLocker.cleanupStaleOverlay();
          }
          if(typeof AppLocker.testLock === 'function') AppLocker.testLock();
          else AppLocker.lock(1, true);
        });
      }
      const oldBtnGuide = $('btnLockerGuide');
      if(oldBtnGuide){
        oldBtnGuide.addEventListener('click', ()=>{
          AppLocker.guideToSystemSettings();
        });
      }
    } catch(e) { 
      console.warn('AppLocker init error', e); 
      // 即使初始化失败，也尝试清理残留遮罩
      try { AppLocker.cleanupStaleOverlay(); } catch(_){}
    }
  }

  // —— 设置表单初始化 ——
  $('cfgLoop').checked = cfg.loopEnabled;
  $('cfgLongBreak').value = cfg.longBreak;
  $('cfgRounds').value = cfg.rounds;
  $('cfgFocus').value = cfg.focus;
  $('cfgBreak').value = cfg.break;
  $('cfgVol').value = cfg.volume;
  $('cfgVolVal').textContent = cfg.volume;
  $('cfgChime').checked = cfg.chime;
  $('cfgImmersive').checked = cfg.immersive;
  $('cfgSeconds').checked = cfg.seconds;
  $('cfgPreventSleep').checked = cfg.preventSleep;
  $('cfgHideStatusBar').checked = cfg.hideStatusBar;
  document.querySelectorAll('input[name="timerMode"]').forEach(r=>{
    r.checked = r.value === cfg.timerMode;
  });
  // 通知设置（跟 Schedule 模块联动）
  if(window.Schedule){
    $('cfgNotify').checked = Schedule.isEnabled();
    $('cfgNotifyBefore').value = Schedule.getBefore();
  }
  $('cfgNotify').addEventListener('change', ()=>{
    if(window.Schedule) Schedule.setEnabled($('cfgNotify').checked);
  });
  $('cfgNotifyBefore').addEventListener('change', ()=>{
    if(window.Schedule) Schedule.setBefore(+$('cfgNotifyBefore').value || 0);
  });

  // 绑定设置变更
  function bindCfg(id, key, cast){
    const el = $(id);
    if(!el) return;
    const apply = ()=>{
      let v;
      if(el.type==='checkbox') v = el.checked;
      else v = cast ? cast(el.value) : +el.value;
      cfg[key] = v; saveCfg(cfg);
      if(key==='loopEnabled' || key==='rounds' || key==='longBreak'){
        Timer.setLoop(cfg.loopEnabled, cfg.rounds, cfg.longBreak);
      }
      if(key==='focus' || key==='break'){
        Timer.setPreset(cfg.focus, cfg.break);
        $('customFocus').value = cfg.focus;
        $('customBreak').value = cfg.break;
        $('timerPresets').querySelectorAll('.preset').forEach(x=>{
          x.classList.toggle('active', +x.dataset.focus===cfg.focus && +x.dataset.break===cfg.break);
        });
      }
      if(key==='volume'){
        $('cfgVolVal').textContent = v;
        if(window.Sound && Sound.setVolume){
          try { Sound.setVolume(v/100); } catch(_){}
        }
        if(volSlider) volSlider.value = v;
        $('volVal').textContent = v;
      }
      if(key==='timerMode'){
        Timer.setTimerMode(v);
        updateModeUI(v);
        modeSwitch.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===v));
      }
    };
    if(el.type==='range'){
      el.addEventListener('input', ()=>{ $('cfgVolVal').textContent = el.value; });
      el.addEventListener('change', apply);
    } else if(el.type === 'radio'){
      el.addEventListener('change', apply);
    } else {
      el.addEventListener('change', apply);
    }
  }
  bindCfg('cfgLoop','loopEnabled');
  bindCfg('cfgLongBreak','longBreak', Number);
  bindCfg('cfgRounds','rounds', Number);
  bindCfg('cfgFocus','focus', Number);
  bindCfg('cfgBreak','break', Number);
  bindCfg('cfgVol','volume', Number);
  bindCfg('cfgChime','chime');
  bindCfg('cfgImmersive','immersive');
  bindCfg('cfgSeconds','seconds');
  bindCfg('cfgPreventSleep','preventSleep');
  bindCfg('cfgHideStatusBar','hideStatusBar');
  document.querySelectorAll('input[name="timerMode"]').forEach(radio=>{
    bindCfg(radio.id, 'timerMode');
  });

  // 清除数据
  $('cfgClear').addEventListener('click', ()=>{
    if(confirm(I18n.t('clearConfirm'))){
      localStorage.clear();
      location.reload();
    }
  });

  // —— 全局初始化 ——
  // 步骤1：设置循环配置
  try {
    Timer.setLoop(cfg.loopEnabled, cfg.rounds, cfg.longBreak);
    console.log('[App] Step1: setLoop OK');
  } catch(e) { console.error('[App] Step1 setLoop error:', e); }
  
  // 步骤2：设置计时模式
  try {
    Timer.setTimerMode(cfg.timerMode);
    console.log('[App] Step2: setTimerMode OK, mode=' + cfg.timerMode);
  } catch(e) { console.error('[App] Step2 setTimerMode error:', e); }
  
  // 步骤3：设置预设时间
  try {
    Timer.setPreset(cfg.focus, cfg.break);
    console.log('[App] Step3: setPreset OK');
  } catch(e) { console.error('[App] Step3 setPreset error:', e); }
  
  // 步骤4：同步自定义输入
  try {
    const customFocus = $('customFocus');
    const customBreak = $('customBreak');
    if(customFocus) customFocus.value = cfg.focus;
    if(customBreak) customBreak.value = cfg.break;
    console.log('[App] Step4: sync custom inputs OK');
  } catch(e) { console.error('[App] Step4 sync error:', e); }
  
  // 步骤5：更新预设按钮的active状态
  try {
    const presetsEl = $('timerPresets');
    if(presetsEl){
      presetsEl.querySelectorAll('.preset').forEach(x=>{
        x.classList.toggle('active', +x.dataset.focus===cfg.focus && +x.dataset.break===cfg.break);
      });
    }
    console.log('[App] Step5: update presets OK');
  } catch(e) { console.error('[App] Step5 presets error:', e); }
  
  // 步骤6：渲染预设标签
  try {
    renderPresetLabels();
    console.log('[App] Step6: renderPresetLabels OK');
  } catch(e) { console.error('[App] Step6 renderPresetLabels error:', e); }
  
  // 步骤7：应用模式UI
  try {
    updateModeUI(cfg.timerMode);
    console.log('[App] Step7: updateModeUI OK');
  } catch(e) { console.error('[App] Step7 updateModeUI error:', e); }
  
  // 步骤8：渲染任务列表
  try {
    if(window.Tasks) Tasks.render();
    console.log('[App] Step8: renderTasks OK');
  } catch(e) { console.error('[App] Step8 tasks error:', e); }
  
  // 步骤9：渲染统计
  try {
    if(window.Stats) Stats.render();
    console.log('[App] Step9: renderStats OK');
  } catch(e) { console.error('[App] Step9 stats error:', e); }
  
  // 步骤10：恢复专注中的任务
  try {
    if(window.Tasks && Tasks.getFocusing()){
      const t = Tasks.getFocusingTask();
      if(t){ $('timerTask').textContent = t.text; }
    }
    console.log('[App] Step10: restore task OK');
  } catch(e) { console.error('[App] Step10 task error:', e); }
  
  // 步骤11：更新计时器提示
  try {
    updateTimerHint();
    console.log('[App] Step11: updateTimerHint OK');
  } catch(e) { console.error('[App] Step11 hint error:', e); }
  
  console.log('[App] All init steps completed');

  // 注册 Service Worker
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    });
  }

  // iOS：首次触摸确保音频解锁（额外的一层保险）
  document.addEventListener('touchstart', function firstTouch(){
    try{ if(window.Sound && Sound.unlockAudio) Sound.unlockAudio(); }catch(_){}
    try{ if(window.Sound && Sound.forceResume) Sound.forceResume(); }catch(_){}
    document.removeEventListener('touchstart', firstTouch, true);
  }, { once:true, capture:true });

  // —— 启动加载界面 Splash 隐藏（稍作延迟，确保首屏过渡平滑）——
  function hideSplash(){
    const el = $('appSplash');
    if(!el) return;
    // 最少显示 400ms 避免闪烁
    setTimeout(()=>{
      el.classList.add('hide');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 600);
    }, 400);
  }
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    hideSplash();
  } else {
    window.addEventListener('load', hideSplash);
    setTimeout(hideSplash, 1500); // 兜底
  }

  // —— 声音选择消失修复：若 Sound.defs/icons 未就绪则延迟重绘，否则依赖现有流程 ——
  (function retrySoundGrid(){
    let tries = 0;
    const doTry = ()=>{
      const grid = $('soundGrid');
      if(!grid || !window.Sound){ tries++; if(tries<10) setTimeout(doTry, 100); return; }
      if(!Sound.defs || !Sound.defs.length || !Sound.icons){
        tries++;
        if(tries < 15){ setTimeout(doTry, 120); return; }
      }
      try{
        // 若已经有子元素就不重绘（Sound.onStateChange 依赖这些元素），否则重绘
        if(!grid.children.length && typeof renderSoundGrid === 'function') renderSoundGrid();
      }catch(_){}
    };
    doTry();
  })();

  // —— 通知权限修复：页面就绪后主动尝试一次（解决 iOS/Android 原生请求不到的问题）——
  (function ensureNotifyPerm(){
    const doIt = async ()=>{
      if(!window.Schedule) return;
      try{
        // 如果有 Capacitor LocalNotifications，先走原生请求
        if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications){
          try{
            const LN = window.Capacitor.Plugins.LocalNotifications;
            if(LN.checkPermissions){ await LN.checkPermissions(); }
            if(LN.requestPermissions){ await LN.requestPermissions(); }
          }catch(e){ console.warn('notify capacitor perm err', e); }
        }
        if(typeof Schedule.requestPermission === 'function'){
          await Schedule.requestPermission();
        }
        // 更新按钮文案
        const btn = $('btnRequestNotify');
        if(btn && Schedule.getPermissionStatusAsync){
          const p = await Schedule.getPermissionStatusAsync();
          if(p==='granted') btn.textContent = I18n.t('notifyPermGranted');
          else if(p==='denied') btn.textContent = I18n.t('notifyPermDenied');
        }
      }catch(e){ console.warn('notify init err', e); }
    };
    setTimeout(doIt, 300);
  })();
})();
