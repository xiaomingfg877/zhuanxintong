/* ===== 专心通 / Focus Master · 应用主逻辑 v3 ===== */
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
        langPref:'auto'
      }, JSON.parse(localStorage.getItem(CFG_KEY)));
    }catch(e){
      return {focus:25, break:5, longBreak:15, rounds:4, loopEnabled:true, chime:true, immersive:true, seconds:true, volume:60, timerMode:'pomodoro', preventSleep:true, hideStatusBar:true, langPref:'auto'};
    }
  }
  function saveCfg(cfg){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  let cfg = loadCfg();

  // —— 语言 ——
  function applyLang(pref){
    if(pref === 'auto'){
      // 移除保存的语言，让 i18n 自动检测
      localStorage.removeItem('zxt_lang');
      I18n.applyTranslations();
    } else {
      I18n.setLang(pref);
    }
    // 重新渲染依赖语言的动态内容
    renderSoundGrid();
    renderPresetLabels();
    Timer.paint();
    Tasks.render();
    Stats.render();
    updateTimerHint();
    updateLangButtons(pref);
  }
  function updateLangButtons(pref){
    document.querySelectorAll('.lang-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.lang === pref);
    });
  }

  // 首次应用语言
  if(cfg.langPref && cfg.langPref !== 'auto'){
    I18n.setLang(cfg.langPref);
  } else {
    I18n.applyTranslations();
  }
  updateLangButtons(cfg.langPref || 'auto');

  // 语言切换按钮
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
      if(v==='stats') Stats.render();
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
      // 更新设置页面的 radio
      document.querySelectorAll('input[name="timerMode"]').forEach(r=>{
        r.checked = r.value === m;
      });
      // 正常模式隐藏番茄循环设置和休息时间
      updateModeUI(m);
    });
  }

  // 设置页面的 radio 模式切换
  document.querySelectorAll('input[name="timerMode"]').forEach(radio=>{
    radio.addEventListener('change', ()=>{
      if(radio.checked){
        const m = radio.value;
        cfg.timerMode = m; saveCfg(cfg);
        Timer.setTimerMode(m);
        // 更新顶部的模式按钮
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

  // —— 完成回调 ——
  Timer.onComplete((finishedMode, minutes)=>{
    if(cfg.chime) Sound.chime();
    if(finishedMode === 'focus'){
      Stats.recordFocus(minutes);
      if(cfg.timerMode !== 'normal') Stats.recordPomo();
      Tasks.addFocus(minutes);
    }
  });

  // —— 沉浸模式 ——
  let wakeLock = null;
  let statusBarHidden = false;

  async function requestWakeLock(){
    if(!cfg.preventSleep) return;
    try {
      if('wakeLock' in navigator){
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch(e){}
  }

  async function releaseWakeLock(){
    if(wakeLock){
      try { await wakeLock.release(); } catch(e){}
      wakeLock = null;
    }
  }

  async function hideStatusBar(){
    if(!cfg.hideStatusBar) return;
    try {
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StatusBar){
        await Capacitor.Plugins.StatusBar.hide();
        statusBarHidden = true;
      }
    } catch(e){}
  }

  async function showStatusBar(){
    if(!statusBarHidden) return;
    try {
      if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StatusBar){
        await Capacitor.Plugins.StatusBar.show();
        statusBarHidden = false;
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

  // 页面恢复时重新请求 wakeLock
  document.addEventListener('visibilitychange', async ()=>{
    if(document.visibilityState === 'visible' && !$('immersive').hidden && cfg.preventSleep){
      await requestWakeLock();
    }
  });

  // —— 白噪音 ——
  const soundGrid = $('soundGrid');
  function renderSoundGrid(){
    soundGrid.innerHTML = Sound.defs.map(s=>`
      <button class="sound-card" data-id="${s.id}">
        <span class="sc-pulse"></span>
        <svg viewBox="0 0 24 24">${Sound.icons[s.id]}</svg>
        <span class="sc-name">${I18n.t(s.nameKey)}</span>
        <span class="sc-kanji">${I18n.t(s.kanjiKey)}</span>
      </button>
    `).join('');
    // 恢复播放状态
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

  // —— 任务 ——
  $('taskAdd').addEventListener('submit', (e)=>{
    e.preventDefault();
    Tasks.add($('taskInput').value);
    $('taskInput').value = '';
  });
  $('taskList').addEventListener('click', (e)=>{
    const li = e.target.closest('.task-item'); if(!li) return;
    const id = li.dataset.id;
    const actEl = e.target.closest('[data-act]'); if(!actEl) return;
    const act = actEl.dataset.act;
    if(act==='toggle') Tasks.toggle(id);
    else if(act==='del') Tasks.remove(id);
    else if(act==='focus') Tasks.setFocusing(id);
  });
  Tasks.onFocusingChange((id)=>{
    const t = id ? Tasks.all().find(x=>x.id===id) : null;
    $('timerTask').textContent = t ? t.text : I18n.t('noTask');
    updateTimerHint();
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

  // —— 设置表单 ——
  // 初始化表单值
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
  // 模式 radio
  document.querySelectorAll('input[name="timerMode"]').forEach(r=>{
    r.checked = r.value === cfg.timerMode;
  });
  updateModeUI(cfg.timerMode);

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
  // timerMode radios
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

  // —— 初始化 ——
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
  Stats.render();
  if(Tasks.getFocusing()){
    const t = Tasks.getFocusingTask();
    if(t){
      $('timerTask').textContent = t.text;
    }
  }
  updateTimerHint();

  // 注册 Service Worker
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    });
  }
})();
