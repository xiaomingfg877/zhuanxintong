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
    const pomodoroSettings = $('pomodoroSettings');
    const cfgBreakRow = $('cfgBreakRow');
    if(m === 'normal'){
      if(pomodoroSettings) pomodoroSettings.style.display = 'none';
      if(cfgBreakRow) cfgBreakRow.style.display = 'none';
    } else {
      if(pomodoroSettings) pomodoroSettings.style.display = '';
      if(cfgBreakRow) cfgBreakRow.style.display = '';
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
    document.querySelectorAll('.preset').forEach(b=>{
      const f = b.dataset.focus, m = b.dataset.break;
      b.textContent = I18n.t('presetFocus', {n: f, m: m});
    });
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
  function renderSoundGrid(){
    if(!soundGrid) return;
    soundGrid.innerHTML = Sound.defs.map(s=>`
      <button class="sound-card" data-id="${s.id}">
        <span class="sc-pulse"></span>
        <svg viewBox="0 0 24 24">${Sound.icons[s.id]}</svg>
        <span class="sc-name">${I18n.t(s.nameKey)}</span>
        <span class="sc-kanji">${I18n.t(s.kanjiKey)}</span>
      </button>
    `).join('');
    const cur = Sound.currentId();
    if(cur){
      soundGrid.querySelectorAll('.sound-card').forEach(c=>c.classList.toggle('playing', c.dataset.id===cur));
    }
  }
  renderSoundGrid();
  soundGrid.addEventListener('click', (e)=>{
    const card = e.target.closest('.sound-card');
    if(!card) return;
    Sound.toggle(card.dataset.id);
  });
  Sound.onStateChange((id)=>{
    soundGrid.querySelectorAll('.sound-card').forEach(c=>c.classList.toggle('playing', c.dataset.id===id));
    $('soundVolume').hidden = !id;
  });
  const volSlider = $('volSlider');
  volSlider.value = cfg.volume;
  $('volVal').textContent = cfg.volume;
  Sound.setVolume(cfg.volume / 100);
  volSlider.addEventListener('input', ()=>{
    const v = +volSlider.value; Sound.setVolume(v/100); $('volVal').textContent = v; cfg.volume = v; saveCfg(cfg);
  });

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
    // 初始化
    AppLocker.init();
    // 加载锁机配置
    const scheduled = AppLocker.getScheduled();
    $('cfgLocker').checked = AppLocker.isEnabled();
    $('cfgLockerInFocus').checked = AppLocker.isLockInFocus();
    $('cfgLockerDuration').value = AppLocker.getDefaultDuration();
    $('cfgLockerScheduled').checked = scheduled.enabled;
    $('cfgLockerTime').value = scheduled.time || '22:00';
    $('cfgLockerEndTime').value = scheduled.endTime || '';
    const schedRow = $('lockerScheduledRow');
    if(schedRow) schedRow.style.display = scheduled.enabled ? '' : 'none';

    // 锁定所有应用开关
    const cfgAllApps = $('cfgLockerAllApps');
    cfgAllApps.checked = AppLocker.isLockAllApps();
    cfgAllApps.addEventListener('change', ()=>{
      AppLocker.setLockAllApps(cfgAllApps.checked);
      renderLockerAppList();
      updateLockerAppsHint();
    });

    // 渲染应用列表
    function renderLockerAppList(){
      const list = $('lockerAppList');
      if(!list) return;
      AppLocker.refreshAppList();
    }

    // 使用事件委托处理应用列表点击
    const lockerAppListEl = $('lockerAppList');
    if(lockerAppListEl){
      lockerAppListEl.addEventListener('click', (e)=>{
        const del = e.target.closest('[data-del]');
        if(del){
          e.stopPropagation();
          const id = del.dataset.del;
          AppLocker.removeCustomApp(id);
          renderLockerAppList();
          return;
        }
        const item = e.target.closest('.locker-app-item');
        if(!item) return;
        const id = item.dataset.id;
        const current = AppLocker.getLockedApps();
        const idx = current.indexOf(id);
        if(idx >= 0) current.splice(idx, 1);
        else current.push(id);
        AppLocker.setLockedApps(current);
        renderLockerAppList();
        updateLockerAppsHint();
      });
    }

    function updateLockerAppsHint(){
      const hint = $('lockerAppsHint');
      if(!hint) return;
      if(AppLocker.isLockAllApps()){
        hint.textContent = I18n.t('lockAllAppsHint');
      } else {
        const n = AppLocker.getLockedApps().length;
        hint.textContent = I18n.t('lockSelectedHint', {n: n});
      }
    }

    // 初始渲染
    renderLockerAppList();
    updateLockerAppsHint();

    // 绑定开关
    $('cfgLocker').addEventListener('change', ()=>{
      AppLocker.setEnabled($('cfgLocker').checked);
    });
    $('cfgLockerInFocus').addEventListener('change', ()=>{
      AppLocker.setLockInFocus($('cfgLockerInFocus').checked);
    });
    $('cfgLockerDuration').addEventListener('change', ()=>{
      const v = Math.max(1, Math.min(480, +$('cfgLockerDuration').value || 25));
      $('cfgLockerDuration').value = v;
      AppLocker.setDefaultDuration(v);
    });
    $('cfgLockerScheduled').addEventListener('change', ()=>{
      const en = $('cfgLockerScheduled').checked;
      const time = $('cfgLockerTime').value || '22:00';
      const endTime = $('cfgLockerEndTime').value || '';
      AppLocker.setScheduled(time, endTime, en);
      if(schedRow) schedRow.style.display = en ? '' : 'none';
    });
    $('cfgLockerTime').addEventListener('change', ()=>{
      const en = $('cfgLockerScheduled').checked;
      const time = $('cfgLockerTime').value || '22:00';
      const endTime = $('cfgLockerEndTime').value || '';
      AppLocker.setScheduled(time, endTime, en);
    });
    $('cfgLockerEndTime').addEventListener('change', ()=>{
      const en = $('cfgLockerScheduled').checked;
      const time = $('cfgLockerTime').value || '22:00';
      const endTime = $('cfgLockerEndTime').value || '';
      AppLocker.setScheduled(time, endTime, en);
    });

    // 自定义应用添加
    const customInput = $('lockerCustomInput');
    const btnAddCustom = $('btnAddCustomApp');
    if(btnAddCustom){
      btnAddCustom.addEventListener('click', ()=>{
        const name = (customInput?.value || '').trim();
        if(!name) return;
        const id = 'custom_' + Date.now();
        AppLocker.addCustomApp({ id: id, nameZh: name, nameEn: name, icon: '📱' });
        const current = AppLocker.getLockedApps();
        current.push(id);
        AppLocker.setLockedApps(current);
        if(customInput) customInput.value = '';
        renderLockerAppList();
        updateLockerAppsHint();
      });
    }
    if(customInput){
      customInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter') btnAddCustom?.click();
      });
    }

    const btnGuide = $('btnLockerGuide');
    if(btnGuide){
      btnGuide.addEventListener('click', ()=>{
        AppLocker.guideToSystemSettings();
      });
    }
    const btnTest = $('btnTestLocker');
    if(btnTest){
      btnTest.addEventListener('click', ()=>{
        if(!AppLocker.isEnabled()){
          alert(I18n.t('enableLocker'));
          return;
        }
        AppLocker.lock(1); // 测试锁机 1 分钟
      });
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
        Sound.setVolume(v/100);
        volSlider.value = v; $('volVal').textContent = v;
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
  Timer.setLoop(cfg.loopEnabled, cfg.rounds, cfg.longBreak);
  Timer.setTimerMode(cfg.timerMode);
  Timer.setPreset(cfg.focus, cfg.break);
  $('customFocus').value = cfg.focus;
  $('customBreak').value = cfg.break;
  $('timerPresets').querySelectorAll('.preset').forEach(x=>{
    x.classList.toggle('active', +x.dataset.focus===cfg.focus && +x.dataset.break===cfg.break);
  });
  renderPresetLabels();
  Tasks.render();
  if(window.Stats) Stats.render();
  if(Tasks.getFocusing()){
    const t = Tasks.getFocusingTask();
    if(t){ $('timerTask').textContent = t.text; }
  }
  updateTimerHint();
  updateModeUI(cfg.timerMode);

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
})();
