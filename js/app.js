/* ===== 专心通 · 应用主逻辑 v2 ===== */
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CFG_KEY = 'zxt_config_v1';

  // —— 设置持久化 ——
  function loadCfg(){
    try{
      return Object.assign({
        focus:25, break:5, longBreak:15, rounds:4,
        loopEnabled:true, chime:true, immersive:true, seconds:true, volume:60
      }, JSON.parse(localStorage.getItem(CFG_KEY)));
    }catch(e){
      return {focus:25, break:5, longBreak:15, rounds:4, loopEnabled:true, chime:true, immersive:true, seconds:true, volume:60};
    }
  }
  function saveCfg(cfg){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  let cfg = loadCfg();

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

  // —— 番茄钟：按钮 + 中心点击 ——
  $('btnToggle').addEventListener('click', ()=>{
    if(Timer.isRunning()) Timer.pause(); else Timer.start();
  });
  $('btnReset').addEventListener('click', ()=>Timer.reset());
  $('btnSkip').addEventListener('click', ()=>Timer.skip());

  // 点击中心圆环 = 开始/暂停（更大点击区域）
  $('timerTapArea').addEventListener('click', (e)=>{
    // 避免和双击冲突：单击延迟判断
    if(e.target.closest('.btn-circle')) return; // 点击到按钮不算
    if(!cfg.immersive){
      if(Timer.isRunning()) Timer.pause(); else Timer.start();
    }
  });
  $('timerTapArea').addEventListener('dblclick', ()=>{
    if(cfg.immersive){
      $('immersive').hidden = false;
    }
  });

  // —— 预设按钮 ——
  $('timerPresets').addEventListener('click', (e)=>{
    const b = e.target.closest('.preset');
    if(!b) return;
    $('timerPresets').querySelectorAll('.preset').forEach(x=>x.classList.toggle('active', x===b));
    Timer.setPreset(+b.dataset.focus, +b.dataset.break);
    // 同步到自定义输入框
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
    // 清除预设选中
    $('timerPresets').querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));
    // 保存到设置
    cfg.focus = f; cfg.break = b; saveCfg(cfg);
  });

  // —— 完成回调 ——
  Timer.onComplete((finishedMode, minutes)=>{
    if(cfg.chime) Sound.chime();
    if(finishedMode === 'focus'){
      Stats.recordFocus(minutes);
      Stats.recordPomo();
      Tasks.addFocus(minutes);
    }
  });

  // —— 沉浸模式关闭 ——
  $('immersiveClose').addEventListener('click', ()=>{ $('immersive').hidden = true; });

  // —— 白噪音 ——
  const soundGrid = $('soundGrid');
  soundGrid.innerHTML = Sound.defs.map(s=>`
    <button class="sound-card" data-id="${s.id}">
      <span class="sc-pulse"></span>
      <svg viewBox="0 0 24 24">${Sound.icons[s.id]}</svg>
      <span class="sc-name">${s.name}</span>
      <span class="sc-kanji">${s.kanji}</span>
    </button>
  `).join('');
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
    $('timerTask').textContent = t ? t.text : '未选择任务';
    $('timerHint').textContent = t ? `正在专注：${t.text}` : '点中间的圆开始专注，双击进入沉浸';
  });

  // —— 设置抽屉 ——
  const drawer = $('drawer');
  function openDrawer(){
    // 把当前配置填入表单
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
    drawer.hidden = false;
  }
  function closeDrawer(){ drawer.hidden = true; }
  $('btnSettings').addEventListener('click', openDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  $('drawerMask').addEventListener('click', closeDrawer);

  // 设置项变更 → 即时保存
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
      if(key==='chime'){ /* 仅影响完成时 */ }
      if(key==='immersive'){ /* 仅影响双击行为 */ }
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
    };
    if(el.type==='range'){
      el.addEventListener('input', ()=>{ $('cfgVolVal').textContent = el.value; });
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

  // 清除数据
  $('cfgClear').addEventListener('click', ()=>{
    if(confirm('确定要清除所有统计、任务和设置数据吗？此操作不可恢复。')){
      localStorage.clear();
      location.reload();
    }
  });

  // —— 初始化 ——
  Timer.setLoop(cfg.loopEnabled, cfg.rounds, cfg.longBreak);
  Timer.setPreset(cfg.focus, cfg.break);
  $('customFocus').value = cfg.focus;
  $('customBreak').value = cfg.break;
  // 匹配预设按钮
  $('timerPresets').querySelectorAll('.preset').forEach(x=>{
    x.classList.toggle('active', +x.dataset.focus===cfg.focus && +x.dataset.break===cfg.break);
  });

  Tasks.render();
  Stats.render();
  if(Tasks.getFocusing()){
    const t = Tasks.getFocusingTask();
    if(t){ $('timerTask').textContent = t.text; $('timerHint').textContent = `正在专注：${t.text}`; }
  }

  // 注册 Service Worker
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    });
  }
})();
