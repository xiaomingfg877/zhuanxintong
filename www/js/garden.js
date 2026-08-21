/* ===== 专心通 / Focus Master · 时光花园 v1
   创新特色功能（非养动物）：
   - 每次专注完成 → 在花园里种下一朵花
   - 花的类型根据专注时长和任务标签解锁
   - 8 种花：樱花/玫瑰/向日葵/莲花/梅花/菊花/郁金香/雏菊
   - 花语成就系统（6 项）
   - 连续天数 streak 计算
   - 花园可视化（SVG 花朵，轻微摆动动画）
*/
(function(){
  'use strict';
  const DATA_KEY = 'zxt_garden_v1';
  const FLOWER_TYPES = [
    { id:'sakura',     nameKey:'flowerSakura',     unlockMin:0,   color:'#f5b7c2', color2:'#e893a3', minFocus:1 },
    { id:'daisy',      nameKey:'flowerDaisy',      unlockMin:0,   color:'#f8e6a0', color2:'#e8c95a', minFocus:1 },
    { id:'tulip',      nameKey:'flowerTulip',      unlockMin:30,  color:'#e87a6a', color2:'#c95342', minFocus:10 },
    { id:'rose',       nameKey:'flowerRose',       unlockMin:60,  color:'#d4556a', color2:'#a0364a', minFocus:15 },
    { id:'chrysanthemum',nameKey:'flowerChrysanthemum',unlockMin:120,color:'#e4a34f',color2:'#b87c2a',minFocus:25 },
    { id:'sunflower',  nameKey:'flowerSunflower',  unlockMin:240, color:'#e6b23a', color2:'#b8881a', minFocus:30 },
    { id:'lotus',      nameKey:'flowerLotus',      unlockMin:360, color:'#f0b8cc', color2:'#c58fa5', minFocus:45 },
    { id:'plum',       nameKey:'flowerPlum',       unlockMin:500, color:'#e8a0b0', color2:'#a85369', minFocus:60 },
  ];
  const ACHIEVEMENTS = [
    { id:'ach1', nameKey:'ach1Name', descKey:'ach1Desc', icon:'🌱', check:(s)=> s.flowers.length>=1 || s.totalFocusMin >= s.configuredFirstMin },
    { id:'ach2', nameKey:'ach2Name', descKey:'ach2Desc', icon:'🌿', check:(s)=> s.flowers.length >= 10 },
    { id:'ach3', nameKey:'ach3Name', descKey:'ach3Desc', icon:'🌸', check:(s)=> s.totalFocusMin >= 100 },
    { id:'ach4', nameKey:'ach4Name', descKey:'ach4Desc', icon:'🌷', check:(s)=> s.streakDays >= 7 },
    { id:'ach5', nameKey:'ach5Name', descKey:'ach5Desc', icon:'🌺', check:(s)=> s.flowers.length >= 50 },
    { id:'ach6', nameKey:'ach6Name', descKey:'ach6Desc', icon:'🏵️', check:(s)=> countUnlockedTypes(s) >= FLOWER_TYPES.length },
  ];

  function countUnlockedTypes(s){
    const types = new Set(s.flowers.map(f=>f.type));
    return types.size;
  }

  let state = load();

  function load(){
    try{
      const raw = localStorage.getItem(DATA_KEY);
      if(raw) return JSON.parse(raw);
    }catch(_){}
    return {
      flowers: [],
      totalFocusMin: 0,
      lastActiveDate: null,    // YYYY-MM-DD
      streakDays: 0,
      configuredFirstMin: 0,  // 兼容
      achievements: {},
      createdAt: Date.now(),
    };
  }
  function save(){
    try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); } catch(_){}
  }
  function t(k){ return window.I18n ? I18n.t(k) : k; }
  function todayStr(d){
    d = d || new Date();
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }
  function yestStr(){
    const d = new Date(); d.setDate(d.getDate()-1);
    return todayStr(d);
  }

  /* 更新连续天数 streak（每次完成专注或渲染时调用） */
  function updateStreak(){
    const today = todayStr();
    if(state.lastActiveDate === today) return;
    if(state.lastActiveDate === yestStr()){
      state.streakDays = (state.streakDays || 0) + 1;
    } else if(state.lastActiveDate == null){
      state.streakDays = 1;
    } else {
      // 中断了，重新开始
      state.streakDays = 1;
    }
    state.lastActiveDate = today;
    save();
  }

  /* 解锁哪一种花（基于累计分钟 + 随机） */
  function pickFlowerType(focusMinutes){
    const unlocked = FLOWER_TYPES.filter(f => state.totalFocusMin + 1 >= f.unlockMin
      && focusMinutes >= f.minFocus);
    const pool = unlocked.length ? unlocked : FLOWER_TYPES.slice(0,2);
    return pool[Math.floor(Math.random()*pool.length)];
  }

  /* 专注完成回调：种下一朵花 */
  function onFocusComplete(focusMinutes){
    if(!focusMinutes || focusMinutes <= 0) return;
    state.totalFocusMin += focusMinutes;
    updateStreak();
    const type = pickFlowerType(focusMinutes);
    state.flowers.push({
      id: 'f_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      type: type.id,
      minute: focusMinutes,
      date: todayStr(),
      createdAt: Date.now(),
    });
    // 检查成就
    checkAchievements();
    save();
    render();
  }

  function checkAchievements(){
    const stateEx = Object.assign({ configuredFirstMin: 0 }, state);
    ACHIEVEMENTS.forEach(a => {
      if(!state.achievements[a.id] && a.check(stateEx)){
        state.achievements[a.id] = Date.now();
      }
    });
  }

  /* SVG 花朵样式（每种花独特图案） */
  function flowerSVG(flowerId, bloomAt){
    const meta = FLOWER_TYPES.find(f=>f.id===flowerId) || FLOWER_TYPES[0];
    const c1 = meta.color, c2 = meta.color2;
    const bloom = typeof bloomAt === 'number' ? (Date.now() - bloomAt) : (1000*60*60); // 超过 1 小时就盛开
    const isBloom = bloom > 60*1000; // 超过 1 分钟就盛开（播种一分钟后开花）
    const scale = isBloom ? 1 : 0.5 + bloom/(60*1000) * 0.5;
    const bloomClass = isBloom ? 'bloom' : '';

    const inner = flowerInnerSVG(meta.id, c1, c2);
    return `<div class="flower ${bloomClass}" title="${t(meta.nameKey)} · ${meta.minFocus}+min" style="transform:scale(${scale})">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>
    </div>`;
  }

  function flowerInnerSVG(id, c1, c2){
    switch(id){
      case 'sakura': // 樱花 - 5 瓣
        return `<g>
          <g transform="translate(50 48)">
            ${[0,72,144,216,288].map(a=>
              `<ellipse cx="0" cy="-16" rx="10" ry="18" fill="${c1}" opacity=".95" transform="rotate(${a})"/>`
            ).join('')}
          </g>
          <circle cx="50" cy="50" r="6" fill="${c2}"/>
          <circle cx="48" cy="48" r="1.4" fill="#fff" opacity=".9"/>
        </g>`;
      case 'rose': // 玫瑰 - 螺旋花瓣
        return `<g>
          <circle cx="50" cy="52" r="22" fill="${c1}"/>
          <circle cx="50" cy="52" r="16" fill="${c2}" opacity=".85"/>
          <circle cx="50" cy="52" r="10" fill="${c1}" opacity=".95"/>
          <circle cx="50" cy="52" r="5" fill="${c2}"/>
          <path d="M50 28 Q58 36 50 42 Q42 36 50 28 Z" fill="${c2}" opacity=".5"/>
        </g>`;
      case 'sunflower': // 向日葵 - 黄花瓣+棕心
        return `<g transform="translate(50 50)">
          ${Array.from({length:14}).map((_,i)=>{
            const a = (i/14)*360;
            return `<ellipse cx="0" cy="-28" rx="6" ry="14" fill="${c1}" transform="rotate(${a})"/>`;
          }).join('')}
          <circle cx="0" cy="0" r="15" fill="${c2}"/>
          ${Array.from({length:10}).map(()=>
            `<circle cx="${(Math.random()*20-10).toFixed(1)}" cy="${(Math.random()*20-10).toFixed(1)}" r="1.2" fill="#3a2a10"/>`
          ).join('')}
        </g>`;
      case 'lotus': // 莲花 - 多层花瓣
        return `<g transform="translate(50 54)">
          ${[-24,-12,0,12,24].map(a=>
            `<ellipse cx="0" cy="-18" rx="7" ry="22" fill="${c1}" transform="rotate(${a})"/>`
          ).join('')}
          ${[-14,0,14].map(a=>
            `<ellipse cx="0" cy="-12" rx="6" ry="16" fill="${c2}" opacity=".95" transform="rotate(${a})"/>`
          ).join('')}
          <circle cx="0" cy="0" r="6" fill="#ffd66b"/>
          ${[[0,-3],[-4,1],[4,1],[2,4],[-2,4]].map(p=>
            `<circle cx="${p[0]}" cy="${p[1]}" r="1.2" fill="#e8a83a"/>`).join('')}
        </g>`;
      case 'plum': // 梅花 - 5 瓣 红心
        return `<g transform="translate(50 50)">
          ${[0,72,144,216,288].map(a=>
            `<ellipse cx="0" cy="-14" rx="9" ry="14" fill="${c1}" transform="rotate(${a})"/>`
          ).join('')}
          <circle cx="0" cy="0" r="4" fill="${c2}"/>
          ${[0,72,144,216,288].map(a=>
            `<circle cx="0" cy="-7" r="0.9" fill="#b5482e" transform="rotate(${a})"/>`
          ).join('')}
        </g>`;
      case 'chrysanthemum': // 菊花 - 多瓣细长
        return `<g transform="translate(50 50)">
          ${Array.from({length:18}).map((_,i)=>{
            const a = (i/18)*360;
            return `<rect x="-2" y="-30" width="4" height="20" rx="2" fill="${c1}" transform="rotate(${a})"/>`;
          }).join('')}
          <circle cx="0" cy="0" r="11" fill="${c2}"/>
          <circle cx="0" cy="0" r="5" fill="${c1}"/>
        </g>`;
      case 'tulip': // 郁金香 - 杯状
        return `<g>
          <path d="M32 40 Q36 18 50 16 Q64 18 68 40 Q60 50 50 52 Q40 50 32 40 Z" fill="${c1}"/>
          <path d="M38 38 Q46 24 50 24" stroke="${c2}" stroke-width="1.4" fill="none" opacity=".6"/>
          <rect x="48" y="52" width="4" height="28" fill="#6b8e5a"/>
          <path d="M48 64 Q38 62 36 70 Q44 68 48 72 Z" fill="#6b8e7b"/>
        </g>`;
      case 'daisy': // 雏菊 - 白瓣黄心
      default:
        return `<g transform="translate(50 50)">
          ${Array.from({length:16}).map((_,i)=>{
            const a = (i/16)*360;
            return `<ellipse cx="0" cy="-22" rx="5" ry="14" fill="${c1}" transform="rotate(${a})"/>`;
          }).join('')}
          <circle cx="0" cy="0" r="12" fill="${c2}"/>
          ${Array.from({length:8}).map((_,i)=>{
            const a = (i/8)*360 * Math.PI/180;
            return `<circle cx="${(Math.cos(a)*5).toFixed(1)}" cy="${(Math.sin(a)*5).toFixed(1)}" r="1" fill="#fff8"/>`;
          }).join('')}
        </g>`;
    }
  }

  /* 渲染花园视图 */
  function render(){
    // stats
    const seedEl = document.getElementById('gardenSeeds');
    const bloomEl = document.getElementById('gardenBlooms');
    const streakEl = document.getElementById('gardenStreak');
    if(seedEl) seedEl.textContent = state.flowers.length;
    if(bloomEl) bloomEl.textContent = Math.min(state.flowers.length, Math.floor(state.totalFocusMin / 15));
    if(streakEl) streakEl.textContent = state.streakDays;

    // 花园 canvas
    const canvas = document.getElementById('gardenCanvas');
    if(canvas){
      if(state.flowers.length === 0){
        canvas.innerHTML = `<div class="garden-empty">
          <div style="font-size:40px">🌱</div>
          <div>${t('gardenEmpty')}</div>
        </div>`;
      } else {
        // 限制显示最近 60 朵（避免卡顿）
        const flowers = state.flowers.slice(-60);
        canvas.innerHTML = flowers.map(f=>flowerSVG(f.type, f.createdAt)).join('');
      }
    }

    // 成就列表
    const achList = document.getElementById('achievementList');
    if(achList){
      achList.innerHTML = ACHIEVEMENTS.map(a => {
        const unlocked = !!state.achievements[a.id];
        const cls = unlocked ? '' : 'locked';
        return `<div class="achievement ${cls}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-info">
            <div class="ach-name">${t(a.nameKey)}</div>
            <div class="ach-desc">${t(a.descKey)}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  /* 公共 API */
  window.Garden = {
    onFocusComplete,
    render,
    getStats(){
      return {
        totalFlowers: state.flowers.length,
        totalMinutes: state.totalFocusMin,
        streak: state.streakDays,
        unlockedTypes: countUnlockedTypes(state),
        unlockedAchievements: Object.keys(state.achievements).length,
        totalAchievements: ACHIEVEMENTS.length,
        flowers: state.flowers,
      };
    }
  };
})();
