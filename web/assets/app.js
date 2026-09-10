(async function () {
  'use strict';
  const C = window.DHD, S = window.DHDStorage, config = window.DHD_CONFIG;
  let ws = new S.Workspace();
  const ui = { scope: null, query: '', category: 'all', status: 'all', archiveMode: 'active', collapsed: new Set(), view: 'tree', selected: null, draft: null, draftDirty: false, tab: 'overview', preview: false, busy: false, imageUrls: [], addedImages: new Set(), review: null, lastExport: null, dragTask: null };
  const $ = selector => document.querySelector(selector);
  Object.assign(ui, { scheduleEdit: false, bulkMode: false, checked: new Set() });
  const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
  let theme = 'dark';
  try { theme = localStorage.getItem('dhd-theme') || 'dark'; } catch (_) {}
  function applyTheme(value) {
    theme = ['dark', 'light', 'system'].includes(value) ? value : 'dark';
    document.documentElement.dataset.theme = theme === 'system' ? (themeMedia.matches ? 'light' : 'dark') : theme;
    $('#themeSelect').value = theme;
    try { localStorage.setItem('dhd-theme', theme); } catch (_) {}
  }
  themeMedia.addEventListener('change', () => { if (theme === 'system') applyTheme(theme); });
  applyTheme(theme);
  function foldTask(id) { ui.collapsed.has(id) ? ui.collapsed.delete(id) : ui.collapsed.add(id); render(); }
  function historyStep(direction) {
    if (ui.busy || document.querySelector('dialog[open]')) return;
    guard(() => { if (!ws[direction]()) return; ui.checked.clear(); if (!ws.tasks.some(t => t.id === ui.scope)) ui.scope = null; render(); message(`${direction === 'undo' ? '실행 취소' : '다시 실행'}했습니다. 파일과 Git에 반영하려면 다시 저장하세요.`); });
  }
  function updateSelection(rows = orderedRows()) {
    const visible = new Set(rows.filter(r => r.match).map(r => r.t.id));
    for (const id of ui.checked) if (!visible.has(id)) ui.checked.delete(id);
    $('#bulkModeButton').textContent = ui.bulkMode ? '선택 취소' : '선택 삭제';
    for (const id of ['selectAllLabel', 'selectionCount', 'bulkDeleteButton']) $('#' + id).hidden = !ui.bulkMode;
    $('#selectionCount').textContent = `${ui.checked.size}개 선택`;
    $('#bulkDeleteButton').disabled = !ui.checked.size || ws.errors.length > 0;
    $('#selectAllTasks').checked = visible.size > 0 && ui.checked.size === visible.size;
    $('#selectAllTasks').indeterminate = ui.checked.size > 0 && ui.checked.size < visible.size;
    $('#selectAllTasks').disabled = !visible.size;
    $('#scheduleEditButton').hidden = ui.view !== 'gantt';
    $('#scheduleEditButton').textContent = ui.scheduleEdit ? '🔓 일정 이동 켜짐 · 눌러 잠그기' : '🔒 일정 이동 잠김';
    $('#scheduleEditButton').setAttribute('aria-pressed', ui.scheduleEdit);
  }
  function selectionBox(t, match) { return ui.bulkMode ? el('input', { type: 'checkbox', class: 'task-check', checked: ui.checked.has(t.id), disabled: !match, 'aria-label': `${t.title} 삭제 선택`, onchange: e => { e.target.checked ? ui.checked.add(t.id) : ui.checked.delete(t.id); render(); } }) : null; }
  function bulkDelete() {
    const ids = [...ui.checked], removedIds = new Set(ids.flatMap(id => [id, ...C.descendants(ws.tasks, id)]));
    if (!ids.length || !confirm(`선택한 ${ids.length}개 과제와 하위 작업을 포함해 총 ${removedIds.size}개를 삭제할까요?\n접혀 있거나 필터로 숨겨진 하위 작업도 포함됩니다. 실행 취소로 복구할 수 있습니다. 기존 파일은 보존됩니다.`)) return;
    guard(() => { ws.removeMany(ids); if (removedIds.has(ui.scope)) ui.scope = null; ui.checked.clear(); ui.bulkMode = false; render(); message(`${removedIds.size}개 과제를 삭제했습니다. 실행 취소로 복구할 수 있습니다. 파일 저장이 필요합니다.`); });
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value ?? '';
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) if (child != null) node.append(child.nodeType ? child : document.createTextNode(String(child)));
    return node;
  }
  function message(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); }
  async function guard(fn) { try { return await fn(); } catch (e) { message(e.message, true); } }
  function draftChanged() { ui.draftDirty = true; $('#draftState').textContent = '적용 전 변경 있음'; $('#taskError').textContent = ''; }
  function archivedIds() { const hidden = new Set(); for (const t of ws.tasks) if (t.archived) { hidden.add(t.id); for (const id of C.descendants(ws.tasks, t.id)) hidden.add(id); } return hidden; }
  function orderedRows() {
    const scopeIds = ui.scope ? new Set([ui.scope, ...C.descendants(ws.tasks, ui.scope)]) : new Set(ws.tasks.map(t => t.id));
    const hidden = archivedIds();
    const direct = ws.tasks.filter(t => scopeIds.has(t.id) && (ui.archiveMode === 'all' || (ui.archiveMode === 'archived' ? hidden.has(t.id) : !hidden.has(t.id))) && (ui.category === 'all' || t.category === ui.category) && (ui.status === 'all' || t.status === ui.status) && (!ui.query || `${t.title} ${t.summary} ${(t.tags || []).join(' ')}`.toLowerCase().includes(ui.query)));
    const matches = new Set(direct.map(t => t.id)), included = new Set(matches), map = new Map(ws.tasks.map(t => [t.id, t]));
    for (const t of direct) { let p = t.parentId; const seen = new Set(); while (p && map.has(p) && !seen.has(p)) { seen.add(p); included.add(p); p = map.get(p).parentId; } }
    const rows = [], visited = new Set(), filtering = ui.query || ui.status !== 'all' || ui.category !== 'all';
    function visit(t, depth) { if (visited.has(t.id) || !included.has(t.id)) return; visited.add(t.id); rows.push({ t, depth, match: matches.has(t.id) }); if (!ui.collapsed.has(t.id)) for (const ch of C.children(ws.tasks, t.id)) visit(ch, depth + 1); }
    if (ui.scope && map.has(ui.scope)) visit(map.get(ui.scope), 0); else for (const t of C.children(ws.tasks)) visit(t, 0);
    for (const t of direct) if (!visited.has(t.id) && (!t.parentId || !map.has(t.parentId))) visit(t, 0);
    return rows;
  }
  function renderNav() {
    const hidden = archivedIds(); $('#sidebarCount').textContent = ws.tasks.filter(t => !hidden.has(t.id)).length;
    $('#allTasks').classList.toggle('active', !ui.scope);
    $('#projectNav').replaceChildren(...C.children(ws.tasks).filter(t => !t.archived).map((t, i) => {
      const button = el('button', { class: 'nav' + (ui.scope === t.id ? ' active' : ''), onclick: () => { ui.scope = t.id; render(); } }, el('i', { class: 'project-dot' }), el('span', { text: t.title }));
      button.firstChild.style.background = ['#a899ed', '#85b4e8', '#76bcac'][i % 3]; return button;
    }));
    const title = ws.tasks.find(t => t.id === ui.scope)?.title;
    $('#scopeTitle').textContent = title || '전체 과제'; $('#pageTitle').textContent = title || '진행 중인 일, 한눈에.';
    $('#sourceBadge').textContent = { sample: '○ 로컬 샘플 · 폴더를 열어주세요', pages: '● GitHub Pages', directory: '● 로컬 파일 연결됨', helper: '● Git 저장소 연결됨' }[ws.source];
  }
  function renderKpis() {
    const hidden = archivedIds(), scopeIds = ui.scope ? new Set([ui.scope, ...C.descendants(ws.tasks, ui.scope)]) : null;
    const active = ws.tasks.filter(t => (ui.archiveMode === 'all' || (ui.archiveMode === 'archived' ? hidden.has(t.id) : !hidden.has(t.id))) && (!scopeIds || scopeIds.has(t.id)));
    const roots = active.filter(t => !t.parentId || !active.some(parent => parent.id === t.parentId)), leaves = active.filter(t => !active.some(x => x.parentId === t.id));
    const total = leaves.length ? Math.round(leaves.reduce((sum, t) => sum + t.progress, 0) / leaves.length) : 0;
    const stats = [['메인 과제', roots.length, `하위 작업 ${active.length - roots.length}개`, '▦'], ['진행 중', active.filter(t => t.status === 'in_progress').length, '현재 집중하고 있는 작업', '↗'], ['완료한 작업', active.filter(t => t.status === 'completed').length, `전체 ${active.length}개 작업 중`, '✓'], ['전체 진행률', `${total}%`, '말단 작업 기준 평균', '◔']];
    $('#kpis').replaceChildren(...stats.map(([label, value, detail, icon]) => el('article', { class: 'kpi' }, el('div', { class: 'kpi-top' }, label, el('span', { class: 'kpi-icon', text: icon })), el('strong', { text: value }), el('small', { text: detail }))));
  }
  function renderTree(rows) {
    const archived = archivedIds();
    const header = el('div', { class: 'task-row header' }, el('span', { text: '과제 / 작업' }), el('span', { text: '상태' }), el('span', { text: '진행률' }), el('span', { text: '목표일' }), el('span', { text: '작업' }));
    updateSelection(rows);
    const nodes = rows.map(({ t, depth, match }) => {
      const kids = C.children(ws.tasks, t.id), pct = C.progress(ws.tasks, t);
      const select = el('select', { class: `row-status status-${t.status}`, 'aria-label': `${t.title} 상태`, onchange: e => guard(() => { const changes = { status: e.target.value }; if (changes.status === 'completed') changes.progress = 100; ws.record(t.id, changes); render(); }) }, ...Object.entries(C.statuses).map(([v, label]) => el('option', { value: v, selected: v === t.status, text: label })));
      const progress = el('div', { class: 'row-progress' }, el('div', { class: 'progress-track', role: 'progressbar', 'aria-label': `${t.title} 진행률`, 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('div', { class: 'progress-fill' })), el('span', { text: `${pct}%` })); progress.querySelector('.progress-fill').style.width = pct + '%';
      const row = el('div', { class: 'task-row' + (!depth ? ' root-row' : '') + (archived.has(t.id) ? ' archived' : ''), 'data-id': t.id },
        el('div', { class: 'task-name' }, el('span', { class: 'drag-handle', draggable: 'true', title: '드래그하여 이동', 'aria-hidden': 'true' }, '⠿'), el('button', { class: 'fold', 'aria-label': `${t.title} ${ui.collapsed.has(t.id) ? '펼치기' : '접기'}`, 'aria-expanded': !ui.collapsed.has(t.id), disabled: !kids.length, onclick: () => { ui.collapsed.has(t.id) ? ui.collapsed.delete(t.id) : ui.collapsed.add(t.id); renderTree(orderedRows()); } }, kids.length ? (ui.collapsed.has(t.id) ? '▸' : '▾') : '·'), el('button', { class: 'task-open', onclick: () => openTask(t.id) }, t.title), kids.length ? el('span', { class: 'child-count', text: kids.length }) : null), select, progress, el('time', { class: 'row-date', text: t.targetEndDate || '미정' }), el('div', { class: 'row-actions' }, el('button', { title: '위로 이동', 'aria-label': `${t.title} 위로 이동`, onclick: () => stepMove(t.id, -1) }, '↑'), el('button', { title: '아래로 이동', 'aria-label': `${t.title} 아래로 이동`, onclick: () => stepMove(t.id, 1) }, '↓'), el('button', { title: '하위 작업 추가', 'aria-label': `${t.title} 하위 작업 추가`, onclick: () => addTask(t.id) }, '＋')));
      row.style.setProperty('--depth', Math.min(depth, 12));
      const checkbox = selectionBox(t, match); if (checkbox) row.querySelector('.task-name').prepend(checkbox);
      row.querySelector('.fold').addEventListener('click', () => render());
      row.querySelector('.drag-handle').addEventListener('dragstart', e => { ui.dragTask = t.id; e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; });
      row.querySelector('.drag-handle').addEventListener('dragend', () => ui.dragTask = null);
      row.addEventListener('dragover', e => { if (ui.query || ui.category !== 'all' || ui.status !== 'all') return; e.preventDefault(); const y = (e.clientY - row.getBoundingClientRect().top) / row.getBoundingClientRect().height; row.classList.remove('drop-before', 'drop-after', 'drop-inside'); row.dataset.drop = y < .25 ? 'before' : y > .75 ? 'after' : 'inside'; row.classList.add('drop-' + row.dataset.drop); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after', 'drop-inside'));
      row.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (!ws.tasks.some(x => x.id === id) || id === t.id) return; guard(() => { const siblings = C.children(ws.tasks, t.parentId); const before = row.dataset.drop === 'before' ? t.id : siblings[siblings.findIndex(x => x.id === t.id) + 1]?.id; ws.relocate(id, row.dataset.drop === 'inside' ? t.id : t.parentId, row.dataset.drop === 'inside' ? null : before); ui.collapsed.delete(t.id); render(); }); });
      return row;
    });
    $('#tree').replaceChildren(header, ...(nodes.length ? nodes : [el('div', { class: 'empty', text: '조건에 맞는 과제가 없습니다.' })]));
    $('#resultCount').textContent = `${rows.length}개 표시`;
  }
  function stepMove(id, delta) { guard(() => { const t = ws.tasks.find(t => t.id === id), siblings = C.children(ws.tasks, t.parentId); const idx = siblings.findIndex(t => t.id === id); if (idx + delta < 0 || idx + delta >= siblings.length) return; const before = delta < 0 ? siblings[idx - 1]?.id : siblings[idx + 2]?.id; ws.relocate(id, t.parentId, before); render(); }); }
  function canReorder() { return !ui.query && ui.category === 'all' && ui.status === 'all' && ui.archiveMode === 'active'; }
  function latestStatusSummary(t) {
    const domainItems = [
      ...t.logs.map(item => ({ at: item.at, kind: '개발 로그', title: item.title, detail: item.content })),
      ...t.decisions.map(item => ({ at: item.date, kind: '의사결정', title: item.title, detail: item.decision })),
      ...t.milestones.map(item => ({ at: item.date, kind: '마일스톤', title: item.title, detail: item.description })),
      ...t.releases.map(item => ({ at: item.releaseDate, kind: '릴리즈', title: `${item.version || ''} ${item.title || ''}`.trim(), detail: item.summary }))
    ].filter(item => item.at).sort((a, b) => b.at.localeCompare(a.at));
    const history = (t.history || []).filter(item => item.at).map(item => ({ at: item.at, kind: '변경 이력', title: item.title || item.action, detail: '' })).sort((a, b) => b.at.localeCompare(a.at));
    const latest = domainItems[0] || history[0], dates = `${t.startDate} ~ ${C.endDate(t) || '종료일 미정'}`, taskSummary = String(t.summary || '').replace(/\s+/g, ' ').trim();
    const prefix = `${C.statuses[t.status]} · ${C.progress(ws.tasks, t)}%\n${dates}${taskSummary ? `\n${taskSummary.slice(0, 140)}` : ''}`;
    if (!latest) return `${prefix}\n최근 기록 없음`;
    const detail = String(latest.detail || '').replace(/\s+/g, ' ').trim();
    return `${prefix}\n최근 ${latest.kind} · ${latest.at.slice(0, 10)}\n${latest.title || ''}${detail ? ` — ${detail.slice(0, 140)}` : ''}`;
  }
  function installGanttOrder(row, task, handle) {
    handle.addEventListener('dragstart', event => { if (!canReorder()) { event.preventDefault(); message('검색·필터·보관함 보기 중에는 순서를 이동할 수 없습니다.', true); return; } ui.dragTask = task.id; event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move'; });
    handle.addEventListener('dragend', () => ui.dragTask = null);
    row.addEventListener('dragover', event => { if (!canReorder()) return; const moving = ws.tasks.find(t => t.id === ui.dragTask); if (!moving || moving.parentId !== task.parentId || moving.id === task.id) return; event.preventDefault(); const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2; row.dataset.drop = before ? 'before' : 'after'; row.classList.toggle('drop-before', before); row.classList.toggle('drop-after', !before); });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
    row.addEventListener('drop', event => { event.preventDefault(); const id = ui.dragTask || event.dataTransfer.getData('text/plain'), moving = ws.tasks.find(t => t.id === id), position = row.dataset.drop; row.classList.remove('drop-before', 'drop-after'); ui.dragTask = null; if (!moving || moving.parentId !== task.parentId || moving.id === task.id) { message('간트의 위·아래 이동은 같은 상위 과제 안에서만 가능합니다.', true); return; } const siblings = C.children(ws.tasks, task.parentId); const beforeId = position === 'before' ? task.id : siblings[siblings.findIndex(t => t.id === task.id) + 1]?.id; guard(() => { ws.relocate(id, task.parentId, beforeId); render(); message('간트에서 과제 순서를 변경했습니다. 파일 저장이 필요합니다.'); }); });
  }
  function installScheduleDrag(bar, lane, task, range, pos, tooltip) {
    let startX = 0, delta = 0, pointerId = null;
    const showTip = event => { if (pointerId !== null) return; const box = lane.getBoundingClientRect(); tooltip.hidden = false; tooltip.style.left = Math.max(4, Math.min(event.clientX - box.left + 10, box.width - Math.min(320, box.width * .75))) + 'px'; };
    bar.addEventListener('pointerenter', showTip); bar.addEventListener('pointermove', event => {
      if (pointerId === null) return showTip(event);
      if (event.pointerId !== pointerId) return;
      delta = Math.abs(event.clientX - startX) < 10 ? 0 : Math.round((event.clientX - startX) / Math.max(1, lane.clientWidth) * range.days);
      bar.style.left = pos(C.iso(C.day(task.startDate) + delta)) + '%';
    });
    bar.addEventListener('pointerleave', () => { if (pointerId === null) tooltip.hidden = true; });
    bar.addEventListener('pointerdown', event => { if (!ui.scheduleEdit || event.button !== 0 || pointerId !== null) return; event.preventDefault(); startX = event.clientX; delta = 0; pointerId = event.pointerId; tooltip.hidden = true; bar.classList.add('dragging'); try { bar.setPointerCapture?.(pointerId); } catch (_) {} });
    const finish = event => {
      if (pointerId !== event.pointerId) return;
      try { bar.releasePointerCapture?.(pointerId); } catch (_) {} pointerId = null; bar.classList.remove('dragging');
      if (event.type === 'pointerup' && delta) {
        try {
          const shifted = C.shiftSchedule(task, delta);
          ui.scheduleEdit = false;
          if (confirm(`${task.title} 일정을 변경할까요?\n시작일: ${task.startDate} → ${shifted.startDate}\n목표 종료일: ${task.targetEndDate || '미정'} → ${shifted.targetEndDate || '미정'}\n실제 종료일: ${task.actualEndDate || '미정'} → ${shifted.actualEndDate || '미정'}\n마일스톤·릴리즈·하위 과제 일정은 유지됩니다.`)) {
            ws.record(task.id, { startDate: shifted.startDate, targetEndDate: shifted.targetEndDate, actualEndDate: shifted.actualEndDate });
            message(`${task.title} 일정을 변경했습니다. 실행 취소로 되돌릴 수 있습니다. 일정 이동은 다시 잠겼습니다.`);
          } else message('일정 변경을 취소했습니다. 일정 이동은 다시 잠겼습니다.');
        } catch (error) { message(error.message, true); }
      }
      render();
    };
    bar.addEventListener('pointerup', finish); bar.addEventListener('pointercancel', finish);
    bar.addEventListener('lostpointercapture', event => { if (pointerId === event.pointerId) { pointerId = null; render(); } });
  }
  function renderGantt(rows) {
    if (!rows.length) return $('#gantt').replaceChildren(el('div', { class: 'empty', text: '표시할 일정이 없습니다.' }));
    const range = C.timeline(rows.map(r => r.t));
    const pos = date => (C.day(date) - range.start) / range.days * 100;
    const scale = el('div', { class: 'gantt-scale' });
    for (const m of range.months) { const label = el('span', { class: 'gantt-month', text: m.label }); label.style.left = `${(m.start - range.start) / range.days * 100}%`; label.style.width = `${m.days / range.days * 100}%`; scale.append(label); }
    const table = el('div', { class: 'gantt-table' }, el('div', { class: 'gantt-row' }, el('div', { class: 'gantt-label', text: '과제 · ● 마일스톤  ◆ 릴리즈' }), scale));
    for (const { t, depth, match } of rows) {
      const lane = el('div', { class: 'gantt-lane' });
      for (const m of range.months) { const line = el('span', { class: 'gantt-grid' }); line.style.left = (m.start - range.start) / range.days * 100 + '%'; lane.append(line); }
      const end = C.endDate(t), summary = latestStatusSummary(t), tooltip = el('div', { class: 'gantt-tooltip', role: 'tooltip', text: summary, hidden: true });
      if (end) { const bar = el('div', { class: 'gantt-bar' + (!depth ? ' root' : ''), title: summary, tabindex: 0, 'aria-label': `${t.title}. ${summary.replace(/\n/g, ' ')}` }, el('div', { class: 'progress-fill' })); bar.style.left = pos(t.startDate) + '%'; bar.style.width = Math.max(.3, (C.day(end) - C.day(t.startDate) + 1) / range.days * 100) + '%'; bar.firstChild.style.width = C.progress(ws.tasks, t) + '%'; bar.addEventListener('focus', () => { tooltip.hidden = false; tooltip.style.left = Math.max(4, Math.min(lane.clientWidth * pos(t.startDate) / 100, lane.clientWidth - 320)) + 'px'; }); bar.addEventListener('blur', () => tooltip.hidden = true); lane.append(bar, tooltip); installScheduleDrag(bar, lane, t, range, pos, tooltip); } else lane.append(el('span', { class: 'no-end', text: '종료일 미정', title: summary }));
      for (const item of [...t.milestones.map(m => ({ date: m.date, title: m.title, type: '', symbol: '●' })), ...t.releases.map(r => ({ date: r.releaseDate, title: `v${r.version} ${r.title || ''}`, type: ' release', symbol: '◆' }))]) { if (C.day(item.date) === null) continue; const marker = el('span', { class: 'gantt-marker' + item.type, title: `${item.date} ${item.title}`, text: item.symbol }); marker.style.left = pos(item.date) + '%'; lane.append(marker); }
      const now = pos(C.today()); if (now >= 0 && now <= 100) { const line = el('span', { class: 'today-line', title: '오늘' }); line.style.left = now + '%'; lane.append(line); }
      const handle = el('span', { class: 'drag-handle', draggable: true, title: '위·아래로 드래그하여 순서 변경', 'aria-hidden': true }, '⠿');
      const label = el('div', { class: 'gantt-label gantt-task-label' }, handle, el('button', { class: 'task-open', text: t.title, onclick: () => openTask(t.id) })); label.style.setProperty('--depth', depth); const row = el('div', { class: 'gantt-row', 'data-id': t.id }, label, lane); installGanttOrder(row, t, handle); table.append(row);
      const kids = C.children(ws.tasks, t.id);
      label.insertBefore(el('button', { class: 'fold', 'aria-label': `${t.title} ${ui.collapsed.has(t.id) ? '펼치기' : '접기'}`, 'aria-expanded': !ui.collapsed.has(t.id), disabled: !kids.length, onclick: () => foldTask(t.id) }, kids.length ? (ui.collapsed.has(t.id) ? '▸' : '▾') : '·'), label.querySelector('.task-open'));
      const checkbox = selectionBox(t, match); if (checkbox) label.prepend(checkbox);
    }
    $('#gantt').replaceChildren(table);
    $('#gantt').classList.toggle('schedule-edit', ui.scheduleEdit);
  }
  function renderBottom() {
    const hidden = archivedIds(); const active = ws.tasks.filter(t => !hidden.has(t.id));
    const upcoming = active.flatMap(t => t.milestones.map(m => ({ ...m, task: t.title, taskId: t.id }))).filter(m => m.status !== 'completed').sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 4);
    const logs = active.flatMap(t => t.logs.map(l => ({ ...l, task: t.title, taskId: t.id }))).sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 4);
    const renderItems = (root, list, icon) => $(root).replaceChildren(...(list.length ? list.map(item => el('div', { class: 'activity-item' }, el('span', { class: 'activity-icon', text: icon }), el('div', {}, el('button', { class: 'task-open', text: item.title || '개발 기록', onclick: () => openTask(item.taskId) }), el('small', { text: item.task })), el('time', { text: (item.date || item.at || '').slice(5, 10).replace('-', '.') }))) : [el('div', { class: 'empty', text: '아직 기록이 없습니다.' })]));
    renderItems('#upcoming', upcoming, '◇'); renderItems('#activity', logs, '↳');
  }
  function updateSaveState() {
    $('#undoButton').disabled = ui.busy || !ws.undoStack.length || ws.errors.length > 0;
    $('#redoButton').disabled = ui.busy || !ws.redoStack.length || ws.errors.length > 0;
    $('main').inert = ui.busy; $('.sidebar').inert = ui.busy;
    const n = ws.changed().size; $('#saveState').textContent = ui.busy ? '처리 중…' : n ? `저장할 파일 ${n}개` : '변경 없음'; $('#saveState').classList.toggle('dirty', n > 0);
    $('#saveButton').disabled = ui.busy || !n || !(ws.directory || ws.helper) || ws.errors.length > 0;
    $('#exportButton').disabled = ui.busy || !n || ws.errors.length > 0;
    $('#publishButton').disabled = ui.busy || ws.errors.length > 0;
    $('#errorsPanel').hidden = !ws.errors.length; $('#errors').replaceChildren(...ws.errors.map(error => el('li', { text: error })));
  }
  function render() { renderNav(); renderKpis(); const rows = orderedRows(); renderTree(rows); renderGantt(rows); renderBottom(); updateSaveState(); }
  function field(label, name, value, type = 'text', options = null, target = ui.draft.task) {
    const input = options ? el('select', { name }, ...options.map(([v, text]) => el('option', { value: v, selected: String(v) === String(value ?? ''), text }))) : type === 'textarea' ? el('textarea', { name, rows: 4 }) : el('input', { name, type });
    input.value = value ?? '';
    input.addEventListener('input', () => { target[name] = type === 'number' ? Number(input.value) : ['targetEndDate', 'actualEndDate', 'parentId'].includes(name) && !input.value ? null : input.value; draftChanged(); });
    return el('label', { class: 'form-field' }, el('span', { text: label }), input);
  }
  function openTask(id) {
    const task = ws.tasks.find(t => t.id === id); if (!task) return;
    if ($('#taskDialog').open && !closeDraft()) return;
    ui.selected = id; ui.draft = { task: C.clone(task), ...C.parseBody(ws.body(task)) }; ui.draftDirty = false; ui.tab = 'overview'; ui.preview = false; ui.addedImages.clear();
    $('#taskTitle').textContent = task.title; $('#taskId').textContent = task.id; $('#draftState').textContent = ''; $('#taskError').textContent = ''; renderDetail(); $('#taskDialog').showModal();
  }
  function closeDraft() {
    if (ui.draftDirty && !confirm('아직 적용하지 않은 입력 내용이 있습니다. 편집 창을 닫을까요?')) return false;
    for (const path of ui.addedImages) ws.files.delete(path);
    ui.addedImages.clear(); ui.draftDirty = false; ui.draft = null; revokeImages(); $('#taskDialog').close(); updateSaveState(); return true;
  }
  function applyDraft() {
    if (!ui.draft) return true;
    try {
      const { task, description, checklist } = ui.draft;
      if (task.status === 'completed') task.progress = 100;
      C.validateTask(task);
      for (const group of ['logs', 'decisions', 'milestones', 'releases']) for (const item of task[group]) {
        if (typeof item.title !== 'string' || !item.title.trim()) throw Error('기록의 제목을 입력해 주세요.');
        if (group === 'releases' && !item.version?.trim()) throw Error('릴리즈 버전을 입력해 주세요.');
      }
      // Persist image references in MD, while preserving unrecognized sections.
      let body = C.writeBody(ws.body(task), description, checklist);
      const images = `<!-- dhd:images -->\n${task.images.map(i => `![${(i.caption || '이미지').replace(/[\[\]\n\r]/g, '')}](../${i.file})`).join('\n\n')}\n<!-- /dhd:images -->`;
      const regex = /<!-- dhd:images -->\r?\n[\s\S]*?\r?\n<!-- \/dhd:images -->/;
      body = regex.test(body) ? body.replace(regex, () => images) : body.trimEnd() + '\n\n' + images + '\n';
      task.bodyFile ||= `notes/${task.id}.md`;
      ws.record(task.id, task, { description, checklist }); ws.files.set(task.bodyFile, C.bytes(body));
      ui.draft.task = C.clone(ws.tasks.find(t => t.id === task.id)); ui.draftDirty = false; ui.addedImages.clear(); $('#draftState').textContent = '적용됨 · 파일 저장 필요'; $('#taskError').textContent = ''; $('#taskTitle').textContent = task.title; render(); renderDetail(); $('#draftState').textContent = '적용됨 · 파일 저장 필요'; return true;
    } catch (e) { $('#taskError').textContent = e.message; return false; }
  }
  function renderOverview() {
    const task = ui.draft.task, excluded = new Set([task.id, ...C.descendants(ws.tasks, task.id)]);
    const parentOptions = [['', '메인 과제 (상위 없음)'], ...ws.tasks.filter(t => !excluded.has(t.id) && !t.archived).map(t => [t.id, t.title])];
    const title = field('과제명', 'title', task.title); title.classList.add('wide'); title.querySelector('input').maxLength = 300; title.querySelector('input').required = true;
    const progress = field(C.children(ws.tasks, task.id).length ? '직접 입력 진행률 (화면에서는 하위 작업 평균 표시)' : '진행률 (%)', 'progress', task.progress, 'number'); progress.querySelector('input').min = 0; progress.querySelector('input').max = 100;
    const summary = field('한 줄 요약', 'summary', task.summary, 'textarea'); summary.classList.add('wide');
    const owners = field('담당자 (쉼표로 구분)', 'ownerInput', task.owners.join(', '), 'text', null, {}); owners.querySelector('input').addEventListener('input', e => task.owners = e.target.value.split(',').map(v => v.trim()).filter(Boolean));
    const tags = field('태그 (쉼표로 구분)', 'tagInput', task.tags.join(', '), 'text', null, {}); tags.querySelector('input').addEventListener('input', e => task.tags = e.target.value.split(',').map(v => v.trim()).filter(Boolean));
    return el('div', { class: 'form-grid' }, title, field('상위 과제', 'parentId', task.parentId, 'text', parentOptions), field('분류', 'category', task.category, 'text', Object.entries(C.categories)), field('상태', 'status', task.status, 'text', Object.entries(C.statuses)), progress, field('시작일', 'startDate', task.startDate, 'date'), field('목표 종료일 (선택)', 'targetEndDate', task.targetEndDate, 'date'), field('실제 종료일 (선택)', 'actualEndDate', task.actualEndDate, 'date'), owners, tags, summary);
  }
  function revokeImages() { ui.imageUrls.forEach(url => URL.revokeObjectURL(url)); ui.imageUrls = []; }
  function imageUrl(img) { const data = ws.files.get(img.file); if (!data) return ''; const ext = img.file.split('.').at(-1); const url = URL.createObjectURL(new Blob([data], { type: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}` })); ui.imageUrls.push(url); return url; }
  function previewBody() {
    const { task, description, checklist } = ui.draft;
    const node = el('article', { class: 'preview' }, el('h2', { text: task.title }), el('p', { text: task.summary }), el('h3', { text: '상세 내용' }), el('p', { text: description }));
    if (checklist) { node.append(el('h3', { text: '완료 기준' })); for (const line of checklist.split('\n').filter(Boolean)) node.append(el('p', { text: line.replace(/^- \[x\] /i, '☑ ').replace(/^- \[ \] /, '☐ ') })); }
    for (const img of task.images) node.append(el('figure', {}, el('img', { src: imageUrl(img), alt: img.caption || '과제 이미지' }), el('figcaption', { text: img.caption })));
    return node;
  }
  function renderBody() {
    revokeImages();
    const wrapper = el('div', { class: 'body-editor' }, el('div', { class: 'body-toolbar' }, el('p', { text: '폼에 내용을 입력하세요. 문서 파일은 자동으로 만들어집니다.' }), el('button', { type: 'button', onclick: () => { ui.preview = !ui.preview; renderDetail(); } }, ui.preview ? '입력 폼으로' : '문서 미리보기')));
    if (ui.preview) { wrapper.append(previewBody()); return wrapper; }
    wrapper.append(field('상세 설명 / 작업 내용', 'description', ui.draft.description, 'textarea', null, ui.draft));
    const list = el('div');
    function drawChecklist() {
      const items = ui.draft.checklist ? ui.draft.checklist.split('\n').filter(Boolean).map(line => ({ checked: /^- \[x\]/i.test(line), text: line.replace(/^- \[[ xX]\]\s?/, '') })) : [];
      const sync = () => { ui.draft.checklist = items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n'); draftChanged(); };
      list.replaceChildren(el('div', { class: 'collection-head' }, el('h3', { text: '완료 기준 / 체크리스트' }), el('button', { type: 'button', text: '＋ 항목', onclick: () => { items.push({ checked: false, text: '새 확인 항목' }); sync(); drawChecklist(); } })));
      items.forEach((item, i) => list.append(el('div', { class: 'checklist-item' }, el('input', { type: 'checkbox', checked: item.checked, 'aria-label': `${item.text} 완료`, onchange: e => { item.checked = e.target.checked; sync(); } }), el('input', { type: 'text', value: item.text, 'aria-label': '확인 항목 내용', oninput: e => { item.text = e.target.value; sync(); } }), el('button', { type: 'button', 'aria-label': '확인 항목 제거', onclick: () => { items.splice(i, 1); sync(); drawChecklist(); } }, '×'))));
    }
    drawChecklist(); wrapper.append(list);
    const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
    const drop = el('div', { class: 'image-drop', tabindex: 0, 'aria-label': '이미지 붙여넣기 또는 파일 놓기' }, '이미지를 끌어 놓거나 Ctrl+V로 붙여넣으세요.', el('br'), el('button', { type: 'button', text: '이미지 선택', onclick: () => input.click() }), el('small', { text: 'PNG · JPG · WebP · GIF / 장당 8MB' }), input);
    async function addImages(files) { try { for (const file of files) { const img = await ws.image(ui.draft.task, file); ui.addedImages.add(img.file); ui.draft.task.images.push(img); draftChanged(); } renderDetail(); } catch (e) { $('#taskError').textContent = e.message; } }
    input.addEventListener('change', () => addImages([...input.files]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop.addEventListener('drop', e => { e.preventDefault(); addImages([...e.dataTransfer.files]); });
    wrapper.append(drop, el('div', { class: 'image-grid' }, ...ui.draft.task.images.map((img, i) => {
      const caption = el('input', { value: img.caption || '', 'aria-label': '이미지 설명', oninput: e => { img.caption = e.target.value; draftChanged(); } });
      return el('div', { class: 'image-card' }, el('img', { src: imageUrl(img), alt: img.caption || '이미지' }), caption, el('button', { type: 'button', text: '문서에서 제거', onclick: () => { ui.draft.task.images.splice(i, 1); if (ui.addedImages.has(img.file)) { ws.files.delete(img.file); ui.addedImages.delete(img.file); } draftChanged(); renderDetail(); } }));
    })));
    wrapper.addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); addImages(files); } });
    return wrapper;
  }
  const recordFields = {
    logs: [['title', '제목'], ['at', '기록 일시 (시간대 포함)'], ['content', '작업 내용', 'textarea'], ['relatedRelease', '관련 릴리즈'], ['relatedMilestone', '관련 마일스톤']],
    decisions: [['title', '제목'], ['date', '결정일', 'date'], ['decision', '결정 내용', 'textarea'], ['reason', '선택 이유', 'textarea'], ['impact', '영향 범위', 'textarea'], ['alternatives', '검토한 대안 (줄마다 하나)', 'array']],
    milestones: [['title', '제목'], ['date', '목표일', 'date'], ['status', '상태', 'milestoneStatus'], ['description', '설명', 'textarea']],
    releases: [['title', '제목'], ['version', '버전'], ['releaseDate', '릴리즈 날짜', 'date'], ['status', '상태', 'releaseStatus'], ['summary', '요약', 'textarea'], ['notes', '릴리즈 노트 (줄마다 하나)', 'array']]
  };
  function renderCollection(name) {
    const items = ui.draft.task[name], group = el('div', {}, el('div', { class: 'collection-head' }, el('p', { text: `${items.length}개 기록` }), el('button', { type: 'button', text: '＋ 기록 추가', onclick: () => { const item = { id: name.toUpperCase() + '-' + crypto.randomUUID(), title: '새 기록' }; if (name === 'logs') { item.at = new Date().toISOString(); item.type = 'development'; item.tags = []; } else if (name === 'releases') { item.releaseDate = C.today(); item.status = 'planned'; item.version = '0.1.0'; item.notes = []; } else { item.date = C.today(); if (name === 'milestones') item.status = 'planned'; else item.alternatives = []; } items.push(item); draftChanged(); renderDetail(); } })));
    for (const [index, item] of items.entries()) {
      const fields = recordFields[name].map(([key, label, type = 'text']) => {
        if (type === 'array') { const control = field(label, key, (item[key] || []).join('\n'), 'textarea', null, {}); control.querySelector('textarea').addEventListener('input', e => { item[key] = e.target.value.split('\n'); draftChanged(); }); return control; }
        return field(label, key, item[key] || '', type === 'releaseStatus' || type === 'milestoneStatus' ? 'text' : type, type === 'releaseStatus' ? [['planned', '예정'], ['released', '배포 완료'], ['cancelled', '취소']] : type === 'milestoneStatus' ? [['planned', '예정'], ['in_progress', '진행 중'], ['completed', '완료']] : null, item);
      });
      group.append(el('details', { class: 'record', open: true }, el('summary', {}, el('span', { text: item.title || '새 기록' }), el('small', { text: item.date || item.releaseDate || (item.at || '').slice(0, 10) })), el('div', { class: 'form-grid' }, fields), el('button', { type: 'button', text: '기록 제거', onclick: () => { items.splice(index, 1); draftChanged(); renderDetail(); } })));
    }
    return group;
  }
  function renderHistory() {
    const t = ui.draft.task;
    const entries = [...(t.history || []), ...t.logs.map(l => ({ at: l.at, title: '개발 · ' + l.title })), ...t.decisions.map(d => ({ at: d.date, title: '결정 · ' + d.title })), ...t.milestones.map(m => ({ at: m.date, title: '마일스톤 · ' + m.title })), ...t.releases.map(r => ({ at: r.releaseDate, title: '릴리즈 · v' + r.version }))].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return el('div', {}, ...(entries.length ? entries.map(item => el('div', { class: 'history-item' }, el('time', { text: (item.at || '').replace('T', ' ').slice(0, 19) }), el('span', { text: item.title || item.action }))) : [el('div', { class: 'empty', text: '아직 변경 이력이 없습니다.' })]));
  }
  function renderDetail() {
    $('#taskTabs').querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', button.dataset.tab === ui.tab));
    $('#archiveTask').textContent = ui.draft.task.archived ? '보관 해제' : '보관하기';
    $('#taskFields').replaceChildren(ui.tab === 'overview' ? renderOverview() : ui.tab === 'body' ? renderBody() : ui.tab === 'history' ? renderHistory() : renderCollection(ui.tab));
  }
  function deleteDraft() {
    if (!ui.draft) return;
    const task = ws.tasks.find(t => t.id === ui.selected); if (!task) return;
    const children = C.descendants(ws.tasks, task.id).size;
    const scope = children ? `이 과제와 하위 작업 ${children}개` : '이 과제';
    if (!confirm(`${scope}를 대시보드에서 삭제할까요?\n\n목록과 index.json에서는 제거되며, 기존 MD·JSON·이미지 파일은 Git 복구를 위해 남겨 둡니다.`)) return;
    const removed = ws.remove(task.id); const removedIds = new Set(removed.map(item => item.id));
    if (ui.scope && removedIds.has(ui.scope)) ui.scope = null;
    ui.addedImages.clear(); ui.draftDirty = false; ui.draft = null; ui.selected = null; revokeImages(); $('#taskDialog').close(); render();
    message(`${removed.length}개 과제를 대시보드에서 삭제했습니다. 변경을 파일에 저장해야 확정됩니다.`);
  }
  function addTask(parentId = null) { guard(() => { const t = ws.add(parentId); if (parentId) ui.collapsed.delete(parentId); ui.query = ''; $('#search').value = ''; render(); openTask(t.id); }); }
  async function chooseFolder() {
    if (!window.showDirectoryPicker) throw Error('이 브라우저에서는 폴더 직접 저장을 사용할 수 없습니다. Edge/Chrome 또는 Git 연결을 사용하세요.');
    if ((ws.changed().size || ui.draftDirty) && !confirm('저장하지 않은 변경이 있습니다. 선택한 폴더의 데이터로 다시 열까요?')) return;
    const selected = await window.showDirectoryPicker({ mode: 'readwrite' }); const directory = await S.resolveDataDirectory(selected);
    const next = await new S.Workspace().load(path => S.readDirectory(directory, path), 'directory'); next.directory = directory; ws = next; ui.scope = null; render(); message(`작업 폴더를 열었습니다. ${ws.tasks.length}개 과제 · 저장 버튼으로 파일에 반영됩니다.`);
  }
  async function save() {
    ui.busy = true; updateSaveState();
    try { if (ws.helper) { await ws.helper.request('/api/save', await ws.payload()); ws.saved(); } else await S.saveDirectory(ws); message('로컬 파일에 저장했습니다. GitHub 반영은 아직 진행하지 않았습니다.'); }
    finally { ui.busy = false; updateSaveState(); }
  }
  function exportZip() {
    ws.assertWritable(); const files = new Map([...ws.changed()].map(([path, data]) => ['web/data/' + path, data]));
    if (!files.size) return;
    const blob = C.zip(files), url = URL.createObjectURL(blob), link = el('a', { href: url, download: `dashboard-changes-${C.today()}.zip` }); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    ui.lastExport = new Date(); message('변경 ZIP 다운로드를 요청했습니다. 압축을 저장소 루트에 풀고 push하세요. 파일 저장이 확인될 때까지 변경 표시는 유지됩니다.');
  }
  async function connect(e) {
    e.preventDefault(); $('#connectionError').textContent = '';
    try {
      if (location.protocol !== 'file:' && !['localhost', '127.0.0.1'].includes(location.hostname)) throw Error('Git 자동 반영은 PC에서 HTML을 직접 열어 사용해 주세요.');
      if (ws.changed().size && !confirm('저장되지 않은 변경이 있습니다. Git 저장소의 파일로 다시 열까요?')) return;
      const helper = new S.Helper($('#helperPort').value, $('#helperToken').value.trim()); const snapshot = await helper.request('/api/snapshot');
      const next = await new S.Workspace().load(async path => { if (!(path in snapshot.files)) throw Error('파일이 없습니다: ' + path); return S.unb64(snapshot.files[path]); }, 'helper');
      next.helper = helper; ws = next; ui.scope = null; $('#helperToken').value = ''; $('#connectionDialog').close(); render(); message(`${snapshot.repository} 저장소에 연결했습니다. 이제 GitHub 반영 버튼을 사용할 수 있습니다.`);
    } catch (e) { $('#connectionError').textContent = e.message; }
  }
  async function publishReview() {
    if (!ws.helper) {
      if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) { $('#connectionDialog').showModal(); return; }
      message('Pages에서 편집한 내용은 변경 ZIP으로 다운로드할 수 있습니다. GitHub 자동 반영은 로컬 HTML과 Git 연결 도구에서 지원합니다.'); return;
    }
    ui.busy = true; updateSaveState();
    try {
      const payload = await ws.payload(); const review = await ws.helper.request('/api/review', payload); ui.review = { ...review, payload };
      $('#gitTarget').textContent = `${review.repository} · ${review.branch} → ${review.remote || '원격 미설정'}`;
      $('#publishFiles').replaceChildren(...review.paths.map(path => el('li', { text: path }))); $('#gitDiff').textContent = review.diff || '새 파일 또는 변경 파일이 없습니다. 이전에 실패한 push를 재시도할 수 있습니다.';
      $('#publishResult').textContent = review.warning || ''; $('#confirmPublish').disabled = !review.canPublish; $('#publishDialog').showModal();
    } finally { ui.busy = false; updateSaveState(); }
  }
  async function publish(e) {
    e.preventDefault(); if (!ui.review) return;
    $('#confirmPublish').disabled = true; $('#publishResult').textContent = '파일 저장 → 커밋 → 푸시 중…'; ui.busy = true; updateSaveState();
    try {
      const result = await ws.helper.request('/api/publish', { ...ui.review.payload, reviewId: ui.review.reviewId, message: $('#commitMessage').value, confirm: true });
      if (result.saved) ws.saved();
      const text = result.pushed ? `GitHub 반영 완료${result.commit ? ' · ' + result.commit.slice(0, 7) : ''}. Pages 게시가 끝나면 새로고침하세요.` : `파일 저장${result.committed ? '·커밋' : ''} 완료. ${result.error || 'push를 완료하지 못했습니다.'}`;
      $('#publishResult').textContent = text; message(text, !result.pushed); ui.review = null;
    } catch (e) { $('#publishResult').textContent = '반영 실패: ' + e.message + ' · 창을 닫고 변경 확인부터 다시 시도해 주세요.'; }
    finally { ui.busy = false; updateSaveState(); }
  }
  $('#allTasks').addEventListener('click', () => { ui.scope = null; render(); });
  $('#sidebarAdd').addEventListener('click', () => addTask()); $('#newTaskButton').addEventListener('click', () => addTask());
  $('#search').addEventListener('input', e => { ui.query = e.target.value.toLowerCase().trim(); ui.collapsed.clear(); const rows = orderedRows(); renderTree(rows); renderGantt(rows); });
  for (const [id, key] of [['category', 'category'], ['status', 'status']]) $('#' + id).addEventListener('change', e => { ui[key] = e.target.value; render(); });
  $('#archiveMode').addEventListener('change', e => { ui.archiveMode = e.target.value; ui.scope = null; render(); });
  $('#expandButton').addEventListener('click', () => { ui.collapsed.clear(); render(); });
  $('#collapseButton').addEventListener('click', () => { ui.collapsed = new Set(ws.tasks.filter(t => C.children(ws.tasks, t.id).length).map(t => t.id)); render(); message('하위 과제를 모두 접었습니다.'); });
  $('#undoButton').addEventListener('click', () => historyStep('undo')); $('#redoButton').addEventListener('click', () => historyStep('redo'));
  $('#themeSelect').addEventListener('change', e => applyTheme(e.target.value));
  $('#bulkModeButton').addEventListener('click', () => { ui.bulkMode = !ui.bulkMode; ui.checked.clear(); render(); });
  $('#bulkDeleteButton').addEventListener('click', bulkDelete);
  $('#selectAllTasks').addEventListener('change', e => { ui.checked = new Set(e.target.checked ? orderedRows().filter(r => r.match).map(r => r.t.id) : []); render(); });
  $('#scheduleEditButton').addEventListener('click', () => { ui.scheduleEdit = !ui.scheduleEdit; render(); message(ui.scheduleEdit ? '막대를 끌고 손을 떼면 변경 날짜를 확인합니다. 확인 후 자동으로 잠깁니다.' : '일정 이동을 잠갔습니다. 터치로 스크롤할 수 있습니다.'); });
  document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || e.altKey || e.target.closest('input,textarea,select,[contenteditable=true]') || document.querySelector('dialog[open]')) return; const key = e.key.toLowerCase(); if (key === 'z' || key === 'y') { e.preventDefault(); historyStep(key === 'y' || e.shiftKey ? 'redo' : 'undo'); } });
  for (const view of ['tree', 'gantt']) $('#' + view + 'View').addEventListener('click', () => { ui.view = view; ui.scheduleEdit = false; render(); });
  for (const view of ['tree', 'gantt']) $('#' + view + 'View').addEventListener('click', () => { ui.view = view; $('#tree').hidden = view !== 'tree'; $('#gantt').hidden = view !== 'gantt'; for (const name of ['tree', 'gantt']) { $('#' + name + 'View').classList.toggle('active', name === view); $('#' + name + 'View').setAttribute('aria-pressed', name === view); } });
  $('#taskTabs').addEventListener('click', e => { const tab = e.target.closest('[data-tab]'); if (tab) { ui.tab = tab.dataset.tab; renderDetail(); } });
  $('#taskForm').addEventListener('submit', e => { e.preventDefault(); applyDraft(); });
  $('#closeTask').addEventListener('click', closeDraft); $('#taskDialog').addEventListener('cancel', e => { e.preventDefault(); closeDraft(); });
  $('#addChild').addEventListener('click', () => { if (!applyDraft()) return; const parentId = ui.selected; $('#taskDialog').close(); ui.draft = null; addTask(parentId); });
  $('#archiveTask').addEventListener('click', () => { ui.draft.task.archived = !ui.draft.task.archived; draftChanged(); renderDetail(); });
  $('#deleteTask').addEventListener('click', deleteDraft);
  $('#folderButton').addEventListener('click', () => guard(chooseFolder)); $('#saveButton').addEventListener('click', () => guard(save)); $('#exportButton').addEventListener('click', () => guard(exportZip));
  $('#mobileFolderButton').addEventListener('click', () => guard(chooseFolder));
  $('#mobileAllTasks').addEventListener('click', () => { ui.scope = null; render(); });
  $('#helperButton').addEventListener('click', () => $('#connectionDialog').showModal()); $('#connectionForm').addEventListener('submit', connect);
  $('#publishButton').addEventListener('click', () => guard(publishReview)); $('#publishForm').addEventListener('submit', publish);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (!ui.busy) $('#' + button.dataset.close).close(); }));
  $('#publishDialog').addEventListener('cancel', e => { if (ui.busy) e.preventDefault(); });
  window.addEventListener('beforeunload', e => { if (ui.draftDirty || ws.changed().size || ui.busy) { e.preventDefault(); e.returnValue = ''; } });
  try {
    if (location.protocol === 'file:') {
      const bootstrap = JSON.parse($('#bootstrap').textContent); await ws.load(async path => C.bytes(bootstrap[path]), 'sample');
      message('로컬 HTML로 실행 중입니다. 샘플을 둘러보거나 작업 폴더를 열어 실제 파일을 수정하세요. Git 자동 반영은 ‘Git 연결 설정’을 이용하세요.');
    } else {
      const base = new URL(config.dataBase, document.baseURI);
      await ws.load(async path => { C.safePath(path); const response = await fetch(new URL(path, base), { cache: 'no-store' }); if (!response.ok) throw Error(`${path}: HTTP ${response.status}`); return new Uint8Array(await response.arrayBuffer()); }, 'pages');
      message('파일 기반 작업 공간입니다. 화면에서 편집 후 변경 ZIP을 내려받아 저장소에 반영하세요.');
    }
  } catch (e) { ws.errors.push(e.message); message('데이터를 열지 못했습니다: ' + e.message, true); }
  render();
  // Diagnostics expose no credentials or mutating application state.
  window.DHD_DIAGNOSTICS = () => ({ taskCount: ws.tasks.length, errorCount: ws.errors.length, changedFiles: ws.changed().size, source: ws.source, roots: C.children(ws.tasks).length });
})();
