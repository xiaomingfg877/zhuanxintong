/* ===== 专心通 · 专注统计 ===== */
(function(){
  'use strict';
  const KEY = 'zxt_stats_v1';
  let stats = load();

  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {days:{}}; }catch(e){ return {days:{}}; }
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(stats)); }
  function keyOf(d){ const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
  function day(k){ if(!stats.days[k]) stats.days[k]={min:0,pomo:0}; return stats.days[k]; }

  const Stats = {
    recordFocus(min){ day(keyOf(new Date())).min += min; save(); },
    recordPomo(){ day(keyOf(new Date())).pomo += 1; save(); },
    todayMin(){ const d=stats.days[keyOf(new Date())]; return d?d.min:0; },
    weekMin(){
      let sum=0; const now=new Date();
      for(let i=0;i<7;i++){
        const d=new Date(now); d.setDate(now.getDate()-i);
        const s=stats.days[keyOf(d)]; if(s) sum+=s.min;
      }
      return sum;
    },
    totalPomo(){
      let sum=0; for(const k in stats.days) sum+=stats.days[k].pomo; return sum;
    },
    render(){
      const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
      set('todayMin', this.todayMin());
      set('weekMin', this.weekMin());
      set('totalPomo', this.totalPomo());
      this.renderHeat();
      this.renderBars();
    },
    renderHeat(){
      const wrap = document.getElementById('heatmap');
      if(!wrap) return;
      const now = new Date();
      const cells = [];
      for(let i=83;i>=0;i--){
        const d = new Date(now); d.setDate(now.getDate()-i);
        const s = stats.days[keyOf(d)];
        const min = s?s.min:0;
        let cls='hm-cell';
        if(min>=120) cls+=' hm-4';
        else if(min>=60) cls+=' hm-3';
        else if(min>=25) cls+=' hm-2';
        else if(min>0) cls+=' hm-1';
        cells.push(`<div class="${cls}" title="${keyOf(d)} · ${min}分钟"></div>`);
      }
      wrap.innerHTML = cells.join('');
    },
    renderBars(){
      const wrap = document.getElementById('barChart');
      if(!wrap) return;
      const now = new Date();
      const days = ['日','一','二','三','四','五','六'];
      let html='';
      for(let i=6;i>=0;i--){
        const d = new Date(now); d.setDate(now.getDate()-i);
        const s = stats.days[keyOf(d)];
        const min = s?s.min:0;
        const pct = Math.min(100, (min/120)*100);
        html += `<div class="bar-col"><div class="bar" style="height:${Math.max(pct,3)}%" title="${min}分钟"></div><div class="bar-day">${days[d.getDay()]}</div></div>`;
      }
      wrap.innerHTML = html;
    }
  };

  window.Stats = Stats;
})();
