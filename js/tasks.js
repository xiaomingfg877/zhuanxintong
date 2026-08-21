/* ===== 专心通 / Focus Master · 任务清单 v2（标签+描述+时间+编辑）===== */
(function(){
  'use strict';
  const TASKS_KEY = 'zxt_tasks_v2';
  const TAGS_KEY = 'zxt_tags_v1';
  const FOCUS_KEY = 'zxt_focusing_id';

  // 预设标签（id 对应 i18n key 的 tagXxx 前缀）
  const PRESET_TAGS = [
    { id:'chinese', nameKey:'tagChinese', color:'#c26b6b', preset:true },
    { id:'math',    nameKey:'tagMath',    color:'#6b8ab8', preset:true },
    { id:'english', nameKey:'tagEnglish', color:'#8b7eaa', preset:true },
    { id:'physics', nameKey:'tagPhysics', color:'#6b8e7b', preset:true },
    { id:'chem',    nameKey:'tagChemistry', color:'#b08d57', preset:true },
    { id:'bio',     nameKey:'tagBiology', color:'#7ea56f', preset:true },
    { id:'history', nameKey:'tagHistory', color:'#a0745a', preset:true },
    { id:'geo',     nameKey:'tagGeography', color:'#6e9dbf', preset:true },
    { id:'politics',nameKey:'tagPolitics', color:'#c07d9c', preset:true },
    { id:'work',    nameKey:'tagWork',    color:'#b5482e', preset:true },
    { id:'study',   nameKey:'tagStudy',   color:'#b08d57', preset:true },
    { id:'reading', nameKey:'tagReading', color:'#8b7eaa', preset:true },
    { id:'exercise',nameKey:'tagExercise',color:'#6b8e7b', preset:true },
    { id:'life',    nameKey:'tagLife',    color:'#c9a672', preset:true },
    { id:'entertainment', nameKey:'tagEntertainment', color:'#c26b6b', preset:true },
  ];

  let tasks = loadTasks();
  let customTags = loadCustomTags();
  let onFocusingChange = null;
  let onDataChange = null;

  function loadTasks(){
    try{ return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveTasks(){ localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }

  function loadCustomTags(){
    try{ return JSON.parse(localStorage.getItem(TAGS_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveCustomTags(){ localStorage.setItem(TAGS_KEY, JSON.stringify(customTags)); }

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s||'').replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
  function t(key){ return window.I18n ? I18n.t(key) : (key||''); }

  /* 获取所有标签（预设 + 自定义合并，name 用 i18n 翻译） */
  function getAllTags(){
    const all = PRESET_TAGS.map(p => ({
      id: p.id,
      name: t(p.nameKey) || p.nameKey,
      color: p.color,
      preset: true
    }));
    customTags.forEach(c => {
      all.push({ id: c.id, name: c.name, color: c.color, preset:false });
    });
    return all;
  }
  function getTagById(id){ return getAllTags().find(x=>x.id===id); }

  /* 任务 CRUD */
  function addTask(data){
    const text = (data.text||'').trim();
    if(!text) return null;
    const task = {
      id: uid(),
      text,
      desc: data.desc || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      time: data.time || null,  // "HH:MM"
      done: false,
      focusMin: 0,
      createdAt: Date.now(),
      notifiedDate: null  // 'YYYY-MM-DD' - 今天是否已经提醒过
    };
    tasks.unshift(task);
    saveTasks();
    if(onDataChange) onDataChange();
    return task;
  }
  function updateTask(id, patch){
    const idx = tasks.findIndex(t=>t.id===id);
    if(idx < 0) return false;
    tasks[idx] = Object.assign({}, tasks[idx], patch || {});
    saveTasks();
    if(onDataChange) onDataChange();
    return true;
  }
  function removeTask(id){
    tasks = tasks.filter(t=>t.id!==id);
    if(localStorage.getItem(FOCUS_KEY) === id) localStorage.removeItem(FOCUS_KEY);
    saveTasks();
    if(onFocusingChange) onFocusingChange(getFocusingId());
    if(onDataChange) onDataChange();
  }
  function toggleTask(id){
    const task = tasks.find(t=>t.id===id);
    if(task){ task.done = !task.done; saveTasks(); if(onDataChange) onDataChange(); }
  }

  /* 标签管理 */
  function addCustomTag(name, color){
    name = (name||'').trim();
    if(!name) return null;
    const id = 'c_' + uid();
    customTags.push({ id, name, color: color||'#b5482e' });
    saveCustomTags();
    if(onDataChange) onDataChange();
    return id;
  }
  function removeCustomTag(id){
    // 移除标签，并从所有任务的 tags 中清除
    customTags = customTags.filter(x=>x.id!==id);
    tasks.forEach(task => {
      if(task.tags && task.tags.includes(id)){
        task.tags = task.tags.filter(x=>x!==id);
      }
    });
    saveCustomTags(); saveTasks();
    if(onDataChange) onDataChange();
  }

  /* 专注状态 */
  function setFocusing(id){
    if(localStorage.getItem(FOCUS_KEY) === id){
      localStorage.removeItem(FOCUS_KEY);
    } else {
      localStorage.setItem(FOCUS_KEY, id);
    }
    if(onFocusingChange) onFocusingChange(getFocusingId());
    if(onDataChange) onDataChange();
  }
  function getFocusingId(){ return localStorage.getItem(FOCUS_KEY); }
  function getFocusingTask(){ return tasks.find(t=>t.id===getFocusingId()); }
  function addFocusMinutes(min){
    const task = getFocusingTask();
    if(task){ task.focusMin += min; saveTasks(); if(onDataChange) onDataChange(); }
  }

  /* 获取今天有时间设置的任务（时间表视图） */
  function getScheduledTasks(){
    return tasks
      .filter(t => t.time && !t.done)
      .sort((a,b) => (a.time||'').localeCompare(b.time||''));
  }

  /* 标记某任务今天已经发过通知，避免重复提醒 */
  function setNotifiedToday(taskId){
    const today = new Date();
    const todayStr = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    updateTask(taskId, { notifiedDate: todayStr });
  }
  function wasNotifiedToday(task){
    if(!task || !task.notifiedDate) return false;
    const today = new Date();
    const todayStr = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    return task.notifiedDate === todayStr;
  }

  /* 渲染任务列表（task view） */
  function renderTasks(){
    const list = document.getElementById('taskList');
    const empty = document.getElementById('taskEmpty');
    if(!list) return;
    const fid = getFocusingId();
    list.innerHTML = tasks.map(task => {
      // 标签
      const tagChips = (task.tags||[]).map(tagId => {
        const tag = getTagById(tagId);
        if(!tag) return '';
        return `<span class="task-tag" style="background:${tag.color}">${esc(tag.name)}</span>`;
      }).join('');
      // 时间徽章
      const timeBadge = task.time
        ? `<span class="task-time-badge">⏰ ${esc(task.time)}</span>`
        : '';
      // 描述
      const descHtml = task.desc
        ? `<p class="task-desc">${esc(task.desc)}</p>`
        : '';
      // 专注按钮 / 专注分钟
      const focusBadge = task.focusMin
        ? `<button class="task-focus" data-act="focus">${task.focusMin}${t('taskMin')}</button>`
        : `<button class="task-focus" data-act="focus">${t('taskFocus')}</button>`;
      const doneClass = task.done ? 'done' : '';
      const focusingClass = task.id===fid ? 'focusing' : '';
      return `<li class="task-item ${doneClass} ${focusingClass}" data-id="${task.id}">
        <button class="task-check" data-act="toggle" aria-label="toggle">
          <svg viewBox="0 0 24 24"><path d="M9 16l-4-4 1.4-1.4L9 13.2l7.6-7.6L18 7z"/></svg>
        </button>
        <div class="task-main">
          <div class="task-top">
            <div class="task-top-row">
              <span class="task-text">${esc(task.text)}</span>
            </div>
          </div>
          ${descHtml}
          <div class="task-meta">
            ${tagChips}
            ${timeBadge}
          </div>
        </div>
        ${focusBadge}
        <div class="task-actions">
          <button class="task-btn" data-act="edit" aria-label="edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="task-btn task-del" data-act="del" aria-label="delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </li>`;
    }).join('');
    if(empty) empty.style.display = tasks.length ? 'none' : 'block';
  }

  /* 渲染标签选择器（弹窗中 / 设置里） */
  function renderTagSelector(container, selectedIds){
    if(!container) return;
    selectedIds = selectedIds || [];
    const tags = getAllTags();
    container.innerHTML = tags.map(tag => {
      const active = selectedIds.includes(tag.id) ? 'active' : '';
      const style = active ? `background:${tag.color}` : `color:${tag.color};--tc:${tag.color}`;
      return `<button type="button" class="ts-item ${active}" data-id="${tag.id}" style="${style}">${esc(tag.name)}</button>`;
    }).join('');
  }

  /* 渲染标签管理（设置里） */
  function renderTagManager(container){
    if(!container) return;
    const tags = getAllTags();
    container.innerHTML = tags.map(tag => {
      const delBtn = tag.preset
        ? ''
        : `<span class="tag-del" data-del-tag="${tag.id}">×</span>`;
      return `<span class="tag-chip" style="background:${tag.color}">${esc(tag.name)}${delBtn}</span>`;
    }).join('');
  }

  /* 事件：任务列表的事件委托（点击 check / focus / edit / del） */
  function bindTaskEvents(el){
    if(!el) return;
    el.addEventListener('click', (e)=>{
      const li = e.target.closest('.task-item'); if(!li) return;
      const id = li.dataset.id;
      const actEl = e.target.closest('[data-act]'); if(!actEl) return;
      const act = actEl.dataset.act;
      if(act==='toggle') toggleTask(id);
      else if(act==='del') removeTask(id);
      else if(act==='focus') setFocusing(id);
      else if(act==='edit'){
        // 触发编辑事件
        const task = tasks.find(t=>t.id===id);
        if(task && window.Tasks && window.Tasks.onEdit){
          window.Tasks.onEdit(task);
        }
      }
    });
  }

  window.Tasks = {
    all: ()=> tasks.slice(),
    add: (text) => addTask({ text }),
    addFull: addTask,
    update: updateTask,
    remove: removeTask,
    toggle: toggleTask,
    setFocusing,
    getFocusing: getFocusingId,
    getFocusingTask,
    addFocus: addFocusMinutes,
    onFocusingChange: (cb)=>{ onFocusingChange = cb; },
    onDataChange: (cb)=>{ onDataChange = cb; },
    onEdit: null,  // 由 app.js 设置，打开编辑弹窗
    render: renderTasks,
    renderTagSelector,
    renderTagManager,
    bindTaskEvents,
    getAllTags,
    addCustomTag,
    removeCustomTag,
    getTagById,
    getScheduledTasks,
    setNotifiedToday,
    wasNotifiedToday,
  };
})();
