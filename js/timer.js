/* ===== 专心通 / Focus Master · 计时器 v3 =====
   支持两种模式：
   - 番茄模式（Pomodoro）：专注后自动休息，循环进行
   - 正常模式（Normal）：持续计时，不自动休息，完成后归零 */
(function(){
  'use strict';

  let mode = 'focus';
  let timerMode = 'pomodoro'; // 'pomodoro' | 'normal'
  let focusMin = 25, breakMin = 5;
  let longBreakMin = 15;
  let loopRounds = 4;
  let loopEnabled = true;
  let currentRound = 0;
  let remaining = focusMin * 60;
  let running = false;
  let timerId = null;
  let onTickCb = null, onCompleteCb = null;
  let onModeChangeCb = null;

  const RING_LEN = 2 * Math.PI * 128;

  let animCurrent = 0;
  let animTarget = 0;
  let rafId = null;

  function animateRing(){
    const diff = animTarget - animCurrent;
    if(Math.abs(diff) < 0.5){
      animCurrent = animTarget;
      const ring = document.getElementById('ringFg');
      if(ring) ring.style.strokeDashoffset = animTarget;
      rafId = null;
      return;
    }
    animCurrent += diff * 0.15;
    const ring = document.getElementById('ringFg');
    if(ring) ring.style.strokeDashoffset = animCurrent;
    rafId = requestAnimationFrame(animateRing);
  }

  function ringOffset(pct){
    return RING_LEN * (1 - pct);
  }

  function fmt(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec/60), s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function paint(){
    const timeEl = document.getElementById('timerTime');
    if(timeEl) timeEl.textContent = fmt(remaining);

    const total = (mode==='focus' ? focusMin : (mode==='break' ? breakMin : longBreakMin)) * 60;
    const pct = total>0 ? remaining/total : 0;
    animTarget = ringOffset(pct);
    if(!rafId) rafId = requestAnimationFrame(animateRing);

    const modeEl = document.getElementById('timerMode');
    if(modeEl){
      if(window.I18n){
        if(mode==='focus') modeEl.textContent = I18n.t('modeFocus');
        else if(mode==='break') modeEl.textContent = I18n.t('modeBreak');
        else modeEl.textContent = I18n.t('modeLongBreak');
      } else {
        if(mode==='focus') modeEl.textContent = '专注';
        else if(mode==='break') modeEl.textContent = '短休息';
        else modeEl.textContent = '长休息';
      }
    }

    document.body.classList.toggle('break-mode', mode!=='focus');

    const roundEl = document.getElementById('timerRound');
    if(roundEl){
      if(timerMode === 'normal'){
        roundEl.textContent = '';
      } else if(window.I18n){
        roundEl.textContent = loopEnabled ? I18n.t('pomodoroRound', {n: currentRound, total: loopRounds}) : '';
      } else {
        roundEl.textContent = loopEnabled ? `番茄 ${currentRound} / ${loopRounds}` : '';
      }
    }

    const it = document.getElementById('immersiveTime');
    if(it) it.textContent = fmt(remaining);
    const ir = document.getElementById('immersiveRound');
    if(ir){
      if(timerMode === 'normal'){
        ir.textContent = '';
      } else if(window.I18n){
        ir.textContent = loopEnabled ? I18n.t('roundN', {n: currentRound || 1}) : '';
      } else {
        ir.textContent = loopEnabled ? `第 ${currentRound || 1} 轮` : '';
      }
    }
  }

  function setBtnIcon(isRunning){
    const icon = document.getElementById('iconPlay');
    if(!icon) return;
    icon.innerHTML = isRunning
      ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  function tick(){
    remaining -= 1;
    if(remaining <= 0){
      remaining = 0; paint(); complete(); return;
    }
    paint();
    if(onTickCb) onTickCb(remaining);
  }

  function complete(){
    const finishedMode = mode;
    const minutes = (mode==='focus' ? focusMin : (mode==='break' ? breakMin : longBreakMin));
    stop();
    if(onCompleteCb) onCompleteCb(finishedMode, minutes);

    if(timerMode === 'normal'){
      // 正常模式：专注完成后归零，等待手动开始
      mode = 'focus';
      remaining = focusMin * 60;
    } else if(loopEnabled){
      if(finishedMode === 'focus'){
        currentRound += 1;
        if(currentRound >= loopRounds){
          mode = 'longbreak';
          remaining = longBreakMin * 60;
        } else {
          mode = 'break';
          remaining = breakMin * 60;
        }
      } else {
        if(finishedMode === 'longbreak') currentRound = 0;
        mode = 'focus';
        remaining = focusMin * 60;
      }
    } else {
      mode = (finishedMode==='focus') ? 'break' : 'focus';
      remaining = (mode==='focus' ? focusMin : breakMin) * 60;
    }
    paint();
    setBtnIcon(false);
    if(onModeChangeCb) onModeChangeCb(mode);
  }

  function start(){ if(running) return; running = true; setBtnIcon(true); timerId = setInterval(tick, 1000); }
  function pause(){ if(!running) return; running = false; setBtnIcon(false); clearInterval(timerId); }
  function stop(){ running = false; setBtnIcon(false); clearInterval(timerId); }
  function reset(){
    pause();
    mode = 'focus';
    remaining = focusMin * 60;
    currentRound = 0;
    paint();
    if(onModeChangeCb) onModeChangeCb(mode);
  }
  function skip(){ remaining = 1; tick(); }

  const Timer = {
    init(){ remaining = focusMin * 60; mode='focus'; currentRound=0; paint(); },
    start, pause, reset, skip,
    isRunning(){ return running; },
    getState(){ return { mode, remaining, running, currentRound, timerMode }; },
    setPreset(f, b){ focusMin=f; breakMin=b; mode='focus'; currentRound=0; reset(); },
    setCustom(f, b){ focusMin=f; breakMin=b; mode='focus'; currentRound=0; reset(); },
    setLoop(enabled, rounds, longBreak){
      loopEnabled = enabled;
      if(rounds) loopRounds = rounds;
      if(longBreak) longBreakMin = longBreak;
    },
    setTimerMode(m){
      timerMode = m;
      if(m === 'normal'){
        mode = 'focus';
        currentRound = 0;
      }
      reset();
    },
    getTimerMode(){ return timerMode; },
    getConfig(){
      return { focusMin, breakMin, longBreakMin, loopRounds, loopEnabled, timerMode };
    },
    onTick(cb){ onTickCb = cb; },
    onComplete(cb){ onCompleteCb = cb; },
    onModeChange(cb){ onModeChangeCb = cb; },
    paint
  };

  window.Timer = Timer;
})();
