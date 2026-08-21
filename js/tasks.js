/* ===== 专心通 / Focus Master · 任务清单 v3 ===== */
(function(){
  'use strict';
  const KEY = 'zxt_tasks_v1';
  const FOCUS_KEY = 'zxt_focusing_id';
  let tasks = load();
  let onFocusingChange = null;

  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; }
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(tasks)); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s).replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
  function t(key){ return window.I18n ? I18n.t(key) : ''; }

  const Tasks = {
    all(){ return tasks; },
    add(text){
      text = (text||'').trim();
      if(!text) return;
      tasks.unshift({ id:uid(), text, done:false, focusMin:0 });
      save(); this.render();
    },
    toggle(id){
      const t = tasks.find(t=>t.id===id);
      if(t){ t.done = !t.done; save(); this.render(); }
    },
    remove(id){
      tasks = tasks.filter(t=>t.id!==id);
      if(localStorage.getItem(FOCUS_KEY) === id) localStorage.removeItem(FOCUS_KEY);
      save(); this.render();
      if(onFocusingChange) onFocusingChange(this.getFocusing());
    },
    setFocusing(id){
      if(localStorage.getItem(FOCUS_KEY) === id){
        localStorage.removeItem(FOCUS_KEY);
      } else {
        localStorage.setItem(FOCUS_KEY, id);
      }
      this.render();
      if(onFocusingChange) onFocusingChange(this.getFocusing());
    },
    getFocusing(){ return localStorage.getItem(FOCUS_KEY); },
    getFocusingTask(){ return tasks.find(t=>t.id===this.getFocusing()); },
    addFocus(min){
      const t = this.getFocusingTask();
      if(t){ t.focusMin += min; save(); this.render(); }
    },
    onFocusingChange(cb){ onFocusingChange = cb; },
    render(){
      const list = document.getElementById('taskList');
      const empty = document.getElementById('taskEmpty');
      if(!list) return;
      const fid = this.getFocusing();
      list.innerHTML = tasks.map(task=>{
        const focusBadge = task.focusMin
          ? `<span class="task-focus">${task.focusMin}${t('taskMin')}</span>`
          : `<button class="task-focus" data-act="focus">${t('taskFocus')}</button>`;
        return `<li class="task-item ${task.done?'done':''} ${task.id===fid?'focusing':''}" data-id="${task.id}">
          <button class="task-check" data-act="toggle" aria-label="${t('taskFocus')}"><svg viewBox="0 0 24 24"><path d="M9 16l-4-4 1.4-1.4L9 13.2l7.6-7.6L18 7z"/></svg></button>
          <span class="task-text">${esc(task.text)}</span>
          ${focusBadge}
          <button class="task-del" data-act="del" aria-label="${t('delete')}">×</button>
        </li>`;
      }).join('');
      if(empty) empty.style.display = tasks.length ? 'none' : 'block';
    }
  };

  window.Tasks = Tasks;
})();
