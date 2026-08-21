/* ===== 专心通 / Focus Master · 白噪音引擎 v2
   程序化生成自然声音，无需外部音频文件。
   修复 iOS/移动端音频播放问题（全面加强版）：
   1. 首次用户交互时解锁 AudioContext（多种事件：touchstart/click/pointerdown）
   2. 确保 resume() 在用户手势内同步调用，失败时重试
   3. Capacitor 环境下使用原生解锁
   4. 每次播放前强制检查并恢复 context
   5. 页面恢复/前后台切换时自动恢复 AudioContext
   6. 处理 iOS Safari 静音开关 / 媒体会话 API ===== */

(function(){
  const SOUND_DEFS = [
    { id:'rain',   nameKey:'rain',   kanjiKey:'rainKj' },
    { id:'wave',   nameKey:'wave',   kanjiKey:'waveKj' },
    { id:'forest', nameKey:'forest', kanjiKey:'forestKj' },
    { id:'fire',   nameKey:'fire',   kanjiKey:'fireKj' },
    { id:'wind',   nameKey:'wind',   kanjiKey:'windKj' },
    { id:'noise',  nameKey:'noise',  kanjiKey:'noiseKj' },
  ];

  const ICONS = {
    rain:'<path d="M6 14a4 4 0 0 1 .5-2A3 3 0 0 1 12 9a4 4 0 0 1 3.5 2A3.5 3.5 0 1 1 17 18H7a3 3 0 0 1-1-4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 20l-1 2M13 20l-1 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    wave:'<path d="M3 14c2-2 3-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 18c2-2 3-2 5 0s3 2 5 0 3-2 5 0 3 2 5 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    forest:'<path d="M12 3L6 13h3l-3 5h12l-3-5h3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 18v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    fire:'<path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-2-1-3-1-3 2 1 3 3 3 5a4 4 0 1 1-8 0c0-3 4-5 4-9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    wind:'<path d="M3 8h10a2 2 0 1 0-2-2M3 12h14a2 2 0 1 1-2 2M3 16h8a2 2 0 1 1-2 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    noise:'<path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
  };

  let ctx = null;
  let master = null;
  let volume = 0.6;
  let current = null;
  let onStateChange = null;
  let unlocked = false;
  let unlockAttempts = 0;

  /* —— 创建/恢复 AudioContext，带重试 —— */
  function ensureCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);
      } catch(e){
        return false;
      }
    }
    return true;
  }

  /* —— 强制 resume（同步+异步双保险）—— */
  function forceResume(){
    if(!ctx) return false;
    if(ctx.state === 'running') return true;
    try {
      // 同步调用一次
      if(typeof ctx.resume === 'function'){
        const p = ctx.resume();
        if(p && typeof p.catch === 'function'){
          p.catch(()=>{
            // 失败后 100ms 再试一次
            setTimeout(()=>{
              try{ ctx.resume && ctx.resume().catch(()=>{}); }catch(_){}
            }, 100);
          });
        }
      }
      return true;
    } catch(e){
      return false;
    }
  }

  /* —— iOS 音频解锁：静音 buffer + 小音量振荡器双保险 —— */
  function unlockAudio(){
    if(unlocked) return;
    if(!ensureCtx()) return;
    try {
      // 1) 静音 buffer 法
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0;
      source.connect(g); g.connect(master);
      try { source.start(0); source.stop(0.01); } catch(_){}

      // 2) 0 音量振荡器（某些 iOS 版本需要实际的 AudioNode）
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      og.gain.value = 0;
      o.connect(og); og.connect(master);
      try { o.start(0); o.stop(0.01); } catch(_){}

      // 3) 强制 resume
      forceResume();

      unlocked = true;
      unlockAttempts++;
    } catch(e){}
  }

  /* —— 全局触摸解锁监听（多个事件，多次尝试）—— */
  function setupUnlock(){
    const doUnlock = () => {
      unlockAudio();
      if(!unlocked && unlockAttempts < 3){
        // 如果没成功，再尝试一次（某些 iOS 需要更多时间）
        setTimeout(unlockAudio, 50);
      }
    };
    const events = ['touchstart', 'pointerdown', 'click', 'keydown'];
    const remove = () => {
      events.forEach(ev => {
        document.removeEventListener(ev, doUnlock, true);
        document.removeEventListener(ev, doUnlock);
      });
    };
    const handler = (e) => {
      doUnlock();
      // Capacitor iOS: 尝试原生音频解锁
      try {
        if(window.Capacitor && window.Capacitor.Plugins){
          const Pl = window.Capacitor.Plugins;
          if(Pl.LocalNotifications){ /* noop */ }
        }
      } catch(_){}
      // 第一次成功后再移除，但保留 click 以防后续操作继续需要
      if(unlocked){
        setTimeout(remove, 1000);
      }
    };
    events.forEach(ev => {
      document.addEventListener(ev, handler, true);
      document.addEventListener(ev, handler);
    });
  }
  setupUnlock();

  /* —— 页面可见性变化：恢复播放 + 恢复 context —— */
  document.addEventListener('visibilitychange', () => {
    if(!ctx) return;
    if(document.visibilityState === 'visible'){
      // 回到前台：强制 resume，并恢复播放中的声音
      forceResume();
      if(current && current.id){
        try {
          if(master) master.gain.value = volume;
        } catch(_){}
        // 如果是在 Capacitor 内，重新 resume 上下文
        setTimeout(forceResume, 200);
      }
    } else {
      // 后台：在 iOS/Safari 可能会被挂起，不需要暂停；但把 gain 降低防止回来爆音
      if(master){
        try { master.gain.value = volume; } catch(_){}
      }
    }
  });

  /* —— Capacitor: app 激活时恢复 —— */
  try {
    if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
      window.Capacitor.Plugins.App.addListener &&
        window.Capacitor.Plugins.App.addListener('appStateChange', (state)=>{
          if(state && state.isActive){
            forceResume();
            setTimeout(forceResume, 300);
          }
        });
    }
  } catch(_){}

  /* —— 噪声 buffer 生成 —— */
  function noiseBuffer(type){
    if(!ctx) return null;
    const len = (ctx.sampleRate || 44100) * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
    const d = buf.getChannelData(0);
    if(type === 'white'){
      for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    } else if(type === 'pink'){
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<len;i++){
        const w = Math.random()*2-1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
      }
    } else {
      let last=0;
      for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.2; }
    }
    return buf;
  }

  /* —— 单个声音构建器 —— */
  function createSound(id){
    if(!ctx) return null;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);

    const nodes = [];
    const timers = [];

    function srcLoop(buf){
      if(!buf) return null;
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      nodes.push(s);
      return s;
    }

    switch(id){
      case 'rain': {
        const buf = noiseBuffer('white');
        const s = srcLoop(buf);
        if(s){
          const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=550;
          const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7500;
          const g = ctx.createGain(); g.gain.value=0.5;
          s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); s.start();
        }
        break;
      }
      case 'wave': {
        const buf = noiseBuffer('brown');
        const s = srcLoop(buf);
        if(s){
          const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700;
          const g = ctx.createGain(); g.gain.value=0.9;
          s.connect(lp); lp.connect(g); g.connect(out); s.start();
          const lfo = ctx.createOscillator(); lfo.frequency.value=0.1;
          const lg = ctx.createGain(); lg.gain.value=0.5;
          lfo.connect(lg); lg.connect(g.gain); lfo.start();
          nodes.push(lfo);
        }
        break;
      }
      case 'forest': {
        const buf = noiseBuffer('pink');
        const s = srcLoop(buf);
        if(s){
          const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200;
          const g = ctx.createGain(); g.gain.value=0.3;
          s.connect(lp); lp.connect(g); g.connect(out); s.start();
          const t = setInterval(()=>{
            if(Math.random()>0.5) chirp(out);
          }, 2200 + Math.random()*2500);
          timers.push(t);
        }
        break;
      }
      case 'fire': {
        const buf = noiseBuffer('brown');
        const s = srcLoop(buf);
        if(s){
          const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1000;
          const g = ctx.createGain(); g.gain.value=0.7;
          s.connect(lp); lp.connect(g); g.connect(out); s.start();
          const t = setInterval(()=>{
            if(Math.random()>0.4) crackle(out);
          }, 180);
          timers.push(t);
        }
        break;
      }
      case 'wind': {
        const buf = noiseBuffer('pink');
        const s = srcLoop(buf);
        if(s){
          const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=500;
          const g = ctx.createGain(); g.gain.value=0.6;
          s.connect(lp); lp.connect(g); g.connect(out); s.start();
          const lfo = ctx.createOscillator(); lfo.frequency.value=0.08;
          const lg = ctx.createGain(); lg.gain.value=400;
          lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
          nodes.push(lfo);
        }
        break;
      }
      case 'noise': {
        const buf = noiseBuffer('pink');
        const s = srcLoop(buf);
        if(s){
          const g = ctx.createGain(); g.gain.value=0.4;
          s.connect(g); g.connect(out); s.start();
        }
        break;
      }
    }

    function chirp(dest){
      if(!ctx) return;
      try {
        const o = ctx.createOscillator();
        o.type='sine';
        const base = 1800 + Math.random()*1400;
        o.frequency.setValueAtTime(base, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(base*1.5, ctx.currentTime+0.08);
        o.frequency.exponentialRampToValueAtTime(base*0.8, ctx.currentTime+0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.2);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime+0.22);
      } catch(_){}
    }
    function crackle(dest){
      if(!ctx) return;
      try {
        const o = ctx.createOscillator();
        o.type='square';
        o.frequency.value = 60 + Math.random()*120;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08+Math.random()*0.06, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.05);
        o.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime+0.06);
      } catch(_){}
    }

    return {
      stop(){
        if(!ctx) return;
        const now = ctx.currentTime;
        try {
          out.gain.cancelScheduledValues(now);
          out.gain.setValueAtTime(out.gain.value, now);
          out.gain.linearRampToValueAtTime(0, now + 0.4);
        } catch(_){}
        timers.forEach(clearInterval);
        setTimeout(()=>{
          nodes.forEach(n=>{ try{ n.stop && n.stop(); }catch(e){} });
          try{ out.disconnect(); }catch(e){}
        }, 500);
      }
    };
  }

  /* —— 提示音（专注完成）—— */
  function chime(){
    if(!ensureCtx()) return;
    forceResume();
    try {
      const notes = [880, 1108.73, 1318.51];
      notes.forEach((f, i)=>{
        const o = ctx.createOscillator();
        o.type='sine'; o.frequency.value=f;
        const g = ctx.createGain();
        const t = ctx.currentTime + i*0.15;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t+0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t+1.4);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t+1.5);
      });
    } catch(_){}
  }

  /* —— 公开 API —— */
  window.Sound = {
    defs: SOUND_DEFS,
    icons: ICONS,
    isPlaying(id){ return current && current.id === id; },
    currentId(){ return current ? current.id : null; },
    async toggle(id){
      // 每次点击都确保解锁 + resume
      unlockAudio();
      if(!ensureCtx()) return;
      forceResume();
      // 再次确保 resume（iOS 有时第一次 resume 不生效）
      if(ctx.state === 'suspended'){
        try { await ctx.resume(); } catch(e){}
        setTimeout(forceResume, 150);
      }
      // iPad/iOS Safari 静音模式绕过：尝试设置一次主音量
      try {
        if(master){
          master.gain.setValueAtTime(volume, ctx.currentTime);
        }
      } catch(_){}
      if(current && current.id === id){
        if(current && current.stop) current.stop();
        current = null;
      } else {
        if(current && current.stop) current.stop();
        const soundObj = createSound(id);
        if(soundObj){
          current = { id, stop: soundObj.stop };
        }
      }
      if(onStateChange) onStateChange(current ? current.id : null);
    },
    setVolume(v){
      volume = v;
      if(master){
        try {
          master.gain.cancelScheduledValues && master.gain.cancelScheduledValues(ctx ? ctx.currentTime : 0);
          master.gain.value = v;
        } catch(_){}
      }
    },
    getVolume(){ return volume; },
    onStateChange(cb){ onStateChange = cb; },
    chime,
    unlockAudio,
    forceResume,
    isUnlocked(){ return unlocked; },
    getCtxState(){ return ctx ? ctx.state : 'no-ctx'; }
  };
})();
