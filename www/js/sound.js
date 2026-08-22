/* ===== 专心通 / Focus Master · 白噪音引擎 v7
   完全使用 Web Audio API 程序化生成声音，无外部音频文件。
   v7 修复：iOS Safari 核心兼容性 - 同步创建/恢复 AudioContext，
   不等待 Promise，确保在用户手势调用栈内完成所有音频操作。
*/
(function(){
  'use strict';

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

  // —— Web Audio 核心 ——
  let ctx = null;
  let master = null;
  let compressor = null;
  let volume = 0.6;
  let current = null;
  let onStateChangeCb = null;
  let unlocked = false;

  let activeNodes = {};
  let noiseBuffer = null;

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ console.warn('[Sound] Web Audio not supported'); return null; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 24;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      console.log('[Sound] AudioContext created, state=' + ctx.state);
    } catch(e) {
      console.error('[Sound] Failed to create AudioContext:', e);
      return null;
    }
    return ctx;
  }

  // 同步恢复 AudioContext - 关键：必须在用户手势同步栈内完成
  function syncResume(){
    const ac = ensureCtx();
    if(!ac) return null;
    if(ac.state === 'running'){
      unlocked = true;
      return ac;
    }
    // 同步调用 resume() - 即使返回 Promise 也不等待
    try {
      ac.resume();
      // 立即标记为 unlocked - 在大多数浏览器中这已经足够
      // iOS Safari 中，resume() 会在当前事件循环中生效
      unlocked = true;
    } catch(e) {
      console.warn('[Sound] resume error:', e);
    }
    return ac;
  }

  function getNoiseBuffer(){
    if(noiseBuffer) return noiseBuffer;
    const ac = ensureCtx(); if(!ac) return null;
    const len = ac.sampleRate * 2;
    noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for(let i = 0; i < len; i++){
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 5;
    }
    return noiseBuffer;
  }

  function createSoundNode(soundId){
    const ac = ensureCtx(); if(!ac) return null;
    const buf = getNoiseBuffer(); if(!buf) return null;

    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = ac.createGain();
    gain.gain.value = 0;

    const filter = ac.createBiquadFilter();
    let extraNodes = [];

    switch(soundId){
      case 'rain':
        filter.type = 'highpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.7;
        const rainDelay = ac.createDelay(2.0);
        rainDelay.delayTime.value = 0.08;
        const rainFb = ac.createGain();
        rainFb.gain.value = 0.15;
        src.connect(filter);
        filter.connect(rainDelay);
        rainDelay.connect(rainFb);
        rainFb.connect(rainDelay);
        rainDelay.connect(gain);
        extraNodes = [rainDelay, rainFb];
        break;

      case 'wave':
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        filter.Q.value = 1.2;
        const waveLfo = ac.createOscillator();
        waveLfo.type = 'sine';
        waveLfo.frequency.value = 0.08;
        const waveLfoGain = ac.createGain();
        waveLfoGain.gain.value = 0.45;
        waveLfo.connect(waveLfoGain);
        waveLfoGain.connect(gain.gain);
        src.connect(filter);
        filter.connect(gain);
        waveLfo.start();
        extraNodes = [waveLfo, waveLfoGain];
        break;

      case 'forest':
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.8;
        src.connect(filter);
        filter.connect(gain);
        const birdInterval = setInterval(()=>{
          if(!ctx || ctx !== ac) return;
          if(Math.random() < 0.35){
            const osc = ac.createOscillator();
            const birdGain = ac.createGain();
            const now = ac.currentTime;
            const baseFreq = 1800 + Math.random() * 2000;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.linearRampToValueAtTime(baseFreq * (0.7 + Math.random() * 0.4), now + 0.08);
            osc.frequency.linearRampToValueAtTime(baseFreq * (0.5 + Math.random() * 0.3), now + 0.18);
            birdGain.gain.setValueAtTime(0, now);
            birdGain.gain.linearRampToValueAtTime(0.08, now + 0.02);
            birdGain.gain.linearRampToValueAtTime(0, now + 0.28);
            osc.connect(birdGain);
            birdGain.connect(master);
            osc.start(now);
            osc.stop(now + 0.32);
          }
        }, 4000);
        extraNodes = [{ stop: ()=>clearInterval(birdInterval) }];
        break;

      case 'fire':
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value = 1.0;
        src.connect(filter);
        filter.connect(gain);
        const fireInterval = setInterval(()=>{
          if(!ctx || ctx !== ac) return;
          if(Math.random() < 0.5){
            const pop = ac.createBufferSource();
            const popBuf = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
            const popData = popBuf.getChannelData(0);
            for(let i = 0; i < popData.length; i++){
              popData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/popData.length, 3);
            }
            pop.buffer = popBuf;
            const popFilter = ac.createBiquadFilter();
            popFilter.type = 'bandpass';
            popFilter.frequency.value = 1500 + Math.random() * 2000;
            const popGain = ac.createGain();
            popGain.gain.value = 0.2 + Math.random() * 0.3;
            pop.connect(popFilter);
            popFilter.connect(popGain);
            popGain.connect(master);
            pop.start();
          }
        }, 250);
        extraNodes = [{ stop: ()=>clearInterval(fireInterval) }];
        break;

      case 'wind':
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.6;
        const windLfo = ac.createOscillator();
        windLfo.type = 'sine';
        windLfo.frequency.value = 0.15;
        const windLfoGain = ac.createGain();
        windLfoGain.gain.value = 0.4;
        windLfo.connect(windLfoGain);
        windLfoGain.connect(gain.gain);
        const windFilterLfo = ac.createOscillator();
        windFilterLfo.type = 'sine';
        windFilterLfo.frequency.value = 0.1;
        const windFilterGain = ac.createGain();
        windFilterGain.gain.value = 300;
        windFilterLfo.connect(windFilterGain);
        windFilterGain.connect(filter.frequency);
        src.connect(filter);
        filter.connect(gain);
        windLfo.start();
        windFilterLfo.start();
        extraNodes = [windLfo, windLfoGain, windFilterLfo, windFilterGain];
        break;

      case 'noise':
      default:
        filter.type = 'allpass';
        src.connect(filter);
        filter.connect(gain);
        break;
    }

    // 初始静音，然后渐入
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.3);

    try {
      src.start(0);
    } catch(e) {
      try { src.start(); } catch(e2) {
        console.error('[Sound] src.start() failed:', e2);
      }
    }

    return { src, gain, filter, extraNodes };
  }

  function stopSound(soundId){
    const nodes = activeNodes[soundId];
    if(!nodes) return;
    const ac = ensureCtx();
    if(!ac){ delete activeNodes[soundId]; return; }
    const now = ac.currentTime;
    try {
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
      nodes.gain.gain.linearRampToValueAtTime(0, now + 0.15);
    } catch(_) {}
    setTimeout(()=>{
      try { nodes.src.stop(); } catch(_){}
      if(nodes.extraNodes){
        nodes.extraNodes.forEach(n => {
          if(n && typeof n.stop === 'function'){ try{ n.stop(); } catch(_){} }
          if(n && n.disconnect){ try{ n.disconnect(); } catch(_){} }
        });
      }
      delete activeNodes[soundId];
    }, 200);
  }

  function stopAll(){
    Object.keys(activeNodes).forEach(id => stopSound(id));
    current = null;
    if(onStateChangeCb) onStateChangeCb(null);
  }

  // —— 公共 API ——
  // 关键：toggle 必须完全同步执行，不能等待任何 Promise
  // 否则 iOS Safari 会拒绝播放音频
  function toggle(id){
    // 1. 同步创建/恢复 AudioContext
    const ac = syncResume();
    if(!ac) return;

    // 2. 同步创建声音节点并启动
    if(current === id){
      stopSound(id);
      current = null;
      if(onStateChangeCb) onStateChangeCb(null);
    } else {
      if(current) stopSound(current);
      const nodes = createSoundNode(id);
      if(!nodes){
        console.warn('[Sound] Failed to create sound node for:', id);
        return;
      }
      activeNodes[id] = nodes;
      current = id;
      if(onStateChangeCb) onStateChangeCb(id);
    }
  }

  function currentId(){ return current; }

  function setVol(v){
    volume = Math.max(0, Math.min(1, v));
    const ac = ensureCtx();
    if(master && ac){
      try {
        master.gain.setTargetAtTime(volume, ac.currentTime, 0.05);
      } catch(_) {
        master.gain.value = volume;
      }
    }
    Object.values(activeNodes).forEach(n => {
      const ac2 = ensureCtx(); if(!ac2) return;
      try {
        n.gain.gain.setTargetAtTime(volume * 0.4, ac2.currentTime, 0.05);
      } catch(_) {
        n.gain.gain.value = volume * 0.4;
      }
    });
  }

  function chime(){
    // 同步恢复
    const ac = syncResume();
    if(!ac) return;
    const now = ac.currentTime;
    const notes = [880, 1318.5, 1760];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  function onStateChange(cb){ onStateChangeCb = cb; }

  function forceResume(){
    const ac = ensureCtx();
    if(!ac) return;
    if(ac.state === 'suspended'){
      try { ac.resume(); } catch(_) {}
    }
    if(current && !activeNodes[current]){
      activeNodes[current] = createSoundNode(current);
    }
  }

  function unlockAudio(){
    return syncResume();
  }

  window.Sound = {
    defs: SOUND_DEFS,
    icons: ICONS,
    toggle,
    currentId,
    setVolume: setVol,
    chime,
    onStateChange,
    unlockAudio,
    forceResume,
    stopAll,
  };

  // —— 初始化：注册手势监听以预热 AudioContext ——
  function setupGestureListeners(){
    const handler = () => {
      syncResume();
      document.removeEventListener('touchstart', handler, { capture: true });
      document.removeEventListener('click', handler, { capture: true });
      document.removeEventListener('keydown', handler, { capture: true });
      document.removeEventListener('keicydown', handler, { capture: true });
    };
    document.addEventListener('touchstart', handler, { once: true, passive: true, capture: true });
    document.addEventListener('click', handler, { once: true, capture: true });
    document.addEventListener('keydown', handler, { once: true, capture: true });
  }

  setupGestureListeners();

  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible'){
      forceResume();
    }
  });

  document.addEventListener('pageshow', ()=>{
    forceResume();
  });

})();
