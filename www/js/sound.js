/* ===== 专心通 · 白噪音引擎 =====
   用 Web Audio API 程序化生成自然声音，无需任何外部音频文件。
   每种声音由「噪声源 + 滤波 + 调制」组合而成。 */

(function(){
  const SOUND_DEFS = [
    { id:'rain',   name:'雨声', kanji:'听雨' },
    { id:'wave',   name:'海浪', kanji:'观潮' },
    { id:'forest', name:'森林', kanji:'山林' },
    { id:'fire',   name:'篝火', kanji:'炉火' },
    { id:'wind',   name:'风声', kanji:'松风' },
    { id:'noise',  name:'白噪', kanji:'静噪' },
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
  let current = null;       // 当前播放的声音实例 {id, stop}
  let onStateChange = null; // 回调

  function ensureCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if(ctx.state === 'suspended') ctx.resume();
  }

  /* —— 噪声 buffer 生成 —— */
  function noiseBuffer(type){
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
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
    } else { // brown
      let last=0;
      for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.2; }
    }
    return buf;
  }

  /* —— 单个声音构建器：返回 {stop} —— */
  function createSound(id){
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);

    const nodes = [];
    const timers = [];

    function srcLoop(buf){
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      nodes.push(s);
      return s;
    }

    switch(id){
      case 'rain': {
        const s = srcLoop(noiseBuffer('white'));
        const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=550;
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7500;
        const g = ctx.createGain(); g.gain.value=0.5;
        s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); s.start();
        break;
      }
      case 'wave': {
        const s = srcLoop(noiseBuffer('brown'));
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700;
        const g = ctx.createGain(); g.gain.value=0.9;
        s.connect(lp); lp.connect(g); g.connect(out); s.start();
        // LFO 模拟海浪起伏
        const lfo = ctx.createOscillator(); lfo.frequency.value=0.1;
        const lg = ctx.createGain(); lg.gain.value=0.5;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        nodes.push(lfo);
        break;
      }
      case 'forest': {
        const s = srcLoop(noiseBuffer('pink'));
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200;
        const g = ctx.createGain(); g.gain.value=0.3;
        s.connect(lp); lp.connect(g); g.connect(out); s.start();
        // 随机鸟鸣
        const t = setInterval(()=>{
          if(Math.random()>0.5) chirp(out);
        }, 2200 + Math.random()*2500);
        timers.push(t);
        break;
      }
      case 'fire': {
        const s = srcLoop(noiseBuffer('brown'));
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1000;
        const g = ctx.createGain(); g.gain.value=0.7;
        s.connect(lp); lp.connect(g); g.connect(out); s.start();
        // 随机爆裂声
        const t = setInterval(()=>{
          if(Math.random()>0.4) crackle(out);
        }, 180);
        timers.push(t);
        break;
      }
      case 'wind': {
        const s = srcLoop(noiseBuffer('pink'));
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=500;
        const g = ctx.createGain(); g.gain.value=0.6;
        s.connect(lp); lp.connect(g); g.connect(out); s.start();
        const lfo = ctx.createOscillator(); lfo.frequency.value=0.08;
        const lg = ctx.createGain(); lg.gain.value=400;
        lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
        nodes.push(lfo);
        break;
      }
      case 'noise': {
        const s = srcLoop(noiseBuffer('pink'));
        const g = ctx.createGain(); g.gain.value=0.4;
        s.connect(g); g.connect(out); s.start();
        break;
      }
    }

    function chirp(dest){
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
    }
    function crackle(dest){
      const o = ctx.createOscillator();
      o.type='square';
      o.frequency.value = 60 + Math.random()*120;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08+Math.random()*0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.05);
      o.connect(g); g.connect(dest);
      o.start(); o.stop(ctx.currentTime+0.06);
    }

    return {
      stop(){
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(0, now + 0.4);
        timers.forEach(clearInterval);
        setTimeout(()=>{
          nodes.forEach(n=>{ try{ n.stop(); }catch(e){} });
          try{ out.disconnect(); }catch(e){}
        }, 500);
      }
    };
  }

  /* —— 提示音（专注完成）—— */
  function chime(){
    ensureCtx();
    const notes = [880, 1108.73, 1318.51]; // A5 C#6 E6
    notes.forEach((f, i)=>{
      const o = ctx.createOscillator();
      o.type='sine'; o.frequency.value=f;
      const g = ctx.createGain();
      const t = ctx.currentTime + i*0.15;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t+1.2);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t+1.3);
    });
  }

  /* —— 公开 API —— */
  window.Sound = {
    defs: SOUND_DEFS,
    icons: ICONS,
    isPlaying(id){ return current && current.id === id; },
    currentId(){ return current ? current.id : null; },
    toggle(id){
      ensureCtx();
      if(current && current.id === id){
        current.stop(); current = null;
      } else {
        if(current) current.stop();
        current = { id, stop: createSound(id).stop }; // 声音已在播放，保存 stop 句柄
      }
      if(onStateChange) onStateChange(current ? current.id : null);
    },
    setVolume(v){
      volume = v;
      if(master) master.gain.value = v;
    },
    getVolume(){ return volume; },
    onStateChange(cb){ onStateChange = cb; },
    chime
  };
})();
