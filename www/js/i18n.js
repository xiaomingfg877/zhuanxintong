/* ===== 专心通 / Focus Master · 国际化模块 ===== */
(function(){
  'use strict';

  const TRANS = {
    zh: {
      appName: '专心通',
      appSub: '静而后能安，安而后能虑',
      // nav
      navFocus: '专注',
      navSound: '声音',
      navTasks: '任务',
      navStats: '统计',
      navSettings: '设置',
      // timer view
      modeFocus: '专注',
      modeBreak: '短休息',
      modeLongBreak: '长休息',
      noTask: '未选择任务',
      pomodoroRound: '番茄 {n} / {total}',
      roundN: '第 {n} 轮',
      timerHint: '点中间的圆开始专注，双击进入沉浸',
      timerHintTask: '正在专注：{text}',
      immersiveFocus: '专注中',
      exitImmersive: '退出沉浸',
      // presets
      presetFocus: '专注{n} · 休息{m}',
      custom: '自定义',
      apply: '应用',
      minute: '分',
      // actions
      start: '开始',
      reset: '重置',
      skip: '跳过',
      // sound view
      soundIntro: '选一种声音，让心沉下来。',
      volume: '音量',
      rain: '雨声', wave: '海浪', forest: '森林',
      fire: '篝火', wind: '风声', noise: '白噪',
      rainKj: '听雨', waveKj: '观潮', forestKj: '山林',
      fireKj: '炉火', windKj: '松风', noiseKj: '静噪',
      // tasks view
      taskPlaceholder: '写下要做的事…',
      addTask: '添加',
      taskEmpty: '还没有任务，添一件小事开始吧。',
      taskFocus: '专注',
      taskMin: '分',
      delete: '删除',
      // stats view
      todayFocus: '今日专注',
      weekFocus: '本周专注',
      totalPomo: '累计番茄',
      unitMin: '分钟',
      unitPomo: '个',
      weeks12: '近 12 周',
      days7: '最近 7 天',
      // settings
      settingsTitle: '设置',
      groupTimerMode: '计时模式',
      modePomodoro: '番茄模式',
      modeNormal: '正常模式',
      modePomodoroDesc: '专注后自动休息，循环进行',
      modeNormalDesc: '持续计时，不自动休息',
      groupPomodoro: '番茄循环',
      enableLoop: '启用番茄循环',
      longBreakMin: '长休息时长（分）',
      rounds: '循环轮数',
      groupDefault: '默认时长',
      focusMin: '专注（分）',
      breakMin: '短休息（分）',
      groupSound: '声音',
      defaultVolume: '默认音量',
      completeChime: '完成提示音',
      groupLanguage: '语言',
      langZh: '中文',
      langEn: 'English',
      langAuto: '跟随系统',
      groupOther: '其他',
      immersiveToggle: '双击圆环进沉浸',
      showSeconds: '显示秒数',
      preventSleep: '防息屏（沉浸时）',
      hideStatusBar: '隐藏状态栏（沉浸时）',
      clearAllData: '清除所有数据',
      clear: '清除',
      clearConfirm: '确定要清除所有统计、任务和设置数据吗？此操作不可恢复。',
      // about
      groupAbout: '关于',
      aboutName: '专心通 · Focus Master',
      aboutVersion: '版本',
      aboutDesc: '极简专注学习与工作工具，让你安静下来。',
      aboutAuthor: '静而后能安',
      // days
      daySun: '日', dayMon: '一', dayTue: '二', dayWed: '三', dayThu: '四', dayFri: '五', daySat: '六',
    },
    en: {
      appName: 'Focus Master',
      appSub: 'Stillness brings clarity',
      navFocus: 'Focus',
      navSound: 'Sound',
      navTasks: 'Tasks',
      navStats: 'Stats',
      navSettings: 'Settings',
      modeFocus: 'Focus',
      modeBreak: 'Break',
      modeLongBreak: 'Long Break',
      noTask: 'No task selected',
      pomodoroRound: 'Pomodoro {n} / {total}',
      roundN: 'Round {n}',
      timerHint: 'Tap the circle to start. Double-tap for immersive mode.',
      timerHintTask: 'Focusing: {text}',
      immersiveFocus: 'Focusing',
      exitImmersive: 'Exit Immersive',
      presetFocus: 'Focus {n} · Break {m}',
      custom: 'Custom',
      apply: 'Apply',
      minute: 'min',
      start: 'Start',
      reset: 'Reset',
      skip: 'Skip',
      soundIntro: 'Choose a sound to settle your mind.',
      volume: 'Volume',
      rain: 'Rain', wave: 'Waves', forest: 'Forest',
      fire: 'Campfire', wind: 'Wind', noise: 'White Noise',
      rainKj: 'Rain', waveKj: 'Tide', forestKj: 'Woods',
      fireKj: 'Embers', windKj: 'Breeze', noiseKj: 'Static',
      taskPlaceholder: 'What needs to be done…',
      addTask: 'Add',
      taskEmpty: 'No tasks yet. Add one to begin.',
      taskFocus: 'Focus',
      taskMin: 'm',
      delete: 'Delete',
      todayFocus: 'Today',
      weekFocus: 'This Week',
      totalPomo: 'Total Pomodoros',
      unitMin: 'min',
      unitPomo: '',
      weeks12: 'Last 12 Weeks',
      days7: 'Last 7 Days',
      settingsTitle: 'Settings',
      groupTimerMode: 'Timer Mode',
      modePomodoro: 'Pomodoro',
      modeNormal: 'Normal',
      modePomodoroDesc: 'Auto break after focus, cycles on',
      modeNormalDesc: 'Continuous timing, no auto breaks',
      groupPomodoro: 'Pomodoro Cycle',
      enableLoop: 'Enable Pomodoro loop',
      longBreakMin: 'Long break (min)',
      rounds: 'Rounds',
      groupDefault: 'Default Duration',
      focusMin: 'Focus (min)',
      breakMin: 'Break (min)',
      groupSound: 'Sound',
      defaultVolume: 'Default volume',
      completeChime: 'Completion chime',
      groupLanguage: 'Language',
      langZh: '中文',
      langEn: 'English',
      langAuto: 'System',
      groupOther: 'Other',
      immersiveToggle: 'Double-tap for immersive',
      showSeconds: 'Show seconds',
      preventSleep: 'Prevent sleep (immersive)',
      hideStatusBar: 'Hide status bar (immersive)',
      clearAllData: 'Clear all data',
      clear: 'Clear',
      clearConfirm: 'Are you sure you want to clear all stats, tasks, and settings? This cannot be undone.',
      groupAbout: 'About',
      aboutName: 'Focus Master · 专心通',
      aboutVersion: 'Version',
      aboutDesc: 'A minimalist focus tool for study and work.',
      aboutAuthor: 'Stillness brings clarity',
      daySun: 'S', dayMon: 'M', dayTue: 'T', dayWed: 'W', dayThu: 'T', dayFri: 'F', daySat: 'S',
    }
  };

  const LANG_KEY = 'zxt_lang';

  function detectLang(){
    const saved = localStorage.getItem(LANG_KEY);
    if(saved === 'zh' || saved === 'en') return saved;
    // detect system language
    const nav = navigator.language || navigator.userLanguage || 'en';
    return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  let currentLang = detectLang();

  function t(key, vars){
    let str = (TRANS[currentLang] && TRANS[currentLang][key]) || (TRANS.zh[key]) || key;
    if(vars){
      for(const k in vars){
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      }
    }
    return str;
  }

  function applyTranslations(){
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('appName');
    // app name in header
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.dataset.i18n;
      if(key === 'appName'){
        el.textContent = t('appName');
      } else if(el.dataset.i18nVars){
        try{
          const vars = JSON.parse(el.dataset.i18nVars);
          el.textContent = t(key, vars);
        }catch(e){
          el.textContent = t(key);
        }
      } else {
        el.textContent = t(key);
      }
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
  }

  function setLang(lang){
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
  }

  function getLang(){ return currentLang; }

  window.I18n = { t, setLang, getLang, applyTranslations, detectLang };
})();
