/* Domain and portable storage rules. No DOM or Git-provider dependency. */
(function (scope) {
  'use strict';
  const categories = { assigned: '수명 업무', personal: '개인 개발', project: '프로젝트' };
  const statuses = { planned: '예정', in_progress: '진행 중', blocked: '차단됨', on_hold: '보류', completed: '완료', cancelled: '취소' };
  const DAY = 86400000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const json = value => JSON.stringify(value, null, 2) + '\n';
  const bytes = text => new TextEncoder().encode(text);
  const text = value => new TextDecoder('utf-8', { fatal: true }).decode(value);
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (y < 100 || y > 9999) return null;
    const n = Date.UTC(y, m - 1, d), test = new Date(n);
    return test.getUTCFullYear() === y && test.getUTCMonth() === m - 1 && test.getUTCDate() === d ? n / DAY : null;
  }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function iso(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
  function safePath(path) {
    if (typeof path !== 'string' || path.length > 220 || !/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('허용되지 않는 파일 경로입니다.');
    if (!(path === 'index.json' || /^tasks\/TASK-[A-Z0-9_-]+\.json$/.test(path) || /^notes\/TASK-[A-Z0-9_-]+\.md$/.test(path) || /^images\/TASK-[A-Z0-9_-]+\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(path))) throw Error('대시보드 데이터 파일만 사용할 수 있습니다.');
    return path;
  }
  function validateTask(t) {
    if (!plain(t)) throw Error('과제 문서는 객체여야 합니다.');
    if (t.schemaVersion !== 1) throw Error('지원하지 않는 schemaVersion입니다.');
    if (typeof t.id !== 'string' || !/^TASK-[A-Z0-9_-]+$/.test(t.id)) throw Error('과제 ID가 올바르지 않습니다.');
    if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 300) throw Error('과제명은 1~300자여야 합니다.');
    if (!Object.hasOwn(categories, t.category) || !Object.hasOwn(statuses, t.status)) throw Error('분류 또는 상태가 올바르지 않습니다.');
    if (!Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100) throw Error('진행률은 0~100 정수여야 합니다.');
    if (day(t.startDate) === null) throw Error('시작일이 올바르지 않습니다.');
    for (const key of ['targetEndDate', 'actualEndDate']) {
      if (!Object.hasOwn(t, key)) throw Error(`${key} 필드가 필요합니다.`);
      if (t[key] !== null && day(t[key]) === null) throw Error('종료일이 올바르지 않습니다.');
      if (t[key] && day(t[key]) < day(t.startDate)) throw Error('종료일은 시작일보다 빠를 수 없습니다.');
    }
    if (t.parentId != null && (typeof t.parentId !== 'string' || !/^TASK-[A-Z0-9_-]+$/.test(t.parentId) || t.parentId === t.id)) throw Error('상위 과제가 올바르지 않습니다.');
    if (t.order != null && (!Number.isFinite(t.order) || t.order < 0)) throw Error('과제 순서가 올바르지 않습니다.');
    for (const key of ['milestones', 'logs', 'decisions', 'releases']) {
      if (!Array.isArray(t[key]) || t[key].some(item => !plain(item))) throw Error(`${key} 항목이 올바르지 않습니다.`);
    }
    for (const key of ['tags', 'owners']) if (t[key] != null && (!Array.isArray(t[key]) || t[key].some(v => typeof v !== 'string'))) throw Error(`${key}는 문자열 목록이어야 합니다.`);
    for (const [key, dateKey] of [['milestones', 'date'], ['decisions', 'date'], ['releases', 'releaseDate']]) for (const item of t[key]) {
      if (item[dateKey] != null && day(item[dateKey]) === null) throw Error(`${key}의 날짜가 올바르지 않습니다.`);
    }
    if (t.bodyFile != null && t.bodyFile !== `notes/${t.id}.md`) throw Error('본문 파일은 과제별 notes 경로여야 합니다.');
    if (t.images != null && (!Array.isArray(t.images) || t.images.some(v => !plain(v)))) throw Error('이미지 목록이 올바르지 않습니다.');
    for (const img of t.images || []) if (!safePath(img.file).startsWith(`images/${t.id}/`)) throw Error('이미지 경로가 과제와 일치하지 않습니다.');
    return t;
  }
  function normalize(raw) {
    validateTask(raw);
    const t = clone(raw);
    for (const key of ['tags', 'owners', 'links', 'images', 'history']) if (!Array.isArray(t[key])) t[key] = [];
    t.parentId ??= null; t.order ??= 0; t.summary ??= ''; t.archived ??= false;
    return t;
  }
  function validateTree(tasks) {
    const map = new Map();
    for (const t of tasks) { validateTask(t); if (map.has(t.id)) throw Error(`중복 ID: ${t.id}`); map.set(t.id, t); }
    for (const t of tasks) {
      const seen = new Set([t.id]); let cursor = t;
      while (cursor.parentId) {
        if (!map.has(cursor.parentId)) throw Error(`${t.title}: 상위 과제가 없습니다.`);
        if (seen.has(cursor.parentId)) throw Error('과제 계층이 순환합니다.');
        seen.add(cursor.parentId); cursor = map.get(cursor.parentId);
      }
    }
    return true;
  }
  function children(tasks, parentId = null) { return tasks.filter(t => (t.parentId || null) === parentId).sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id)); }
  function descendants(tasks, id) { const result = new Set(); const queue = [id]; while (queue.length) for (const t of children(tasks, queue.shift())) { if (!result.has(t.id)) { result.add(t.id); queue.push(t.id); } } return result; }
  function progress(tasks, task) {
    const childrenByParent = new Map();
    for (const t of tasks) { const list = childrenByParent.get(t.parentId) || []; list.push(t); childrenByParent.set(t.parentId, list); }
    const active = new Set();
    function leaves(t) {
      if (active.has(t.id)) return [t.progress];
      active.add(t.id);
      const list = (childrenByParent.get(t.id) || []).filter(x => !x.archived && x.status !== 'cancelled');
      const result = list.length ? list.flatMap(leaves) : [t.progress]; active.delete(t.id); return result;
    }
    const values = leaves(task); return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  function move(tasks, id, parentId, beforeId = null) {
    const t = tasks.find(x => x.id === id); if (!t) throw Error('과제를 찾을 수 없습니다.');
    if (parentId && (!tasks.some(x => x.id === parentId) || parentId === id || descendants(tasks, id).has(parentId))) throw Error('자신이나 하위 작업 안으로 이동할 수 없습니다.');
    const old = children(tasks, t.parentId).filter(x => x.id !== id); old.forEach((x, i) => x.order = i);
    const list = children(tasks, parentId).filter(x => x.id !== id); const index = beforeId ? list.findIndex(x => x.id === beforeId) : -1;
    t.parentId = parentId; list.splice(index < 0 ? list.length : index, 0, t); list.forEach((x, i) => x.order = i); validateTree(tasks);
  }
  function endDate(task) { return task.status === 'completed' && task.actualEndDate ? task.actualEndDate : task.targetEndDate; }
  function shiftSchedule(task, days) {
    if (!Number.isInteger(days)) throw Error('이동 일수는 정수여야 합니다.');
    const shifted = clone(task);
    for (const key of ['startDate', 'targetEndDate', 'actualEndDate']) if (shifted[key]) shifted[key] = iso(day(shifted[key]) + days);
    validateTask(shifted); return shifted;
  }
  function timeline(tasks) {
    const dates = tasks.flatMap(t => [t.startDate, endDate(t), ...t.milestones.map(m => m.date), ...t.releases.map(r => r.releaseDate)]).map(day).filter(v => v !== null);
    const first = new Date((dates.length ? Math.min(...dates) : day(today())) * DAY);
    const last = new Date((dates.length ? Math.max(...dates) : day(today())) * DAY);
    const start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1) / DAY;
    const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1) / DAY;
    const months = [];
    for (let n = start; n < end;) { const d = new Date(n * DAY); const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY; months.push({ start: n, days: next - n, label: `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}` }); n = next; }
    return { start, end, days: end - start, months };
  }
  function indexDocument(original, tasks) {
    const entries = new Map((original.tasks || []).map(e => [e.id, e]));
    return { ...clone(original), schemaVersion: 1, generatedAt: new Date().toISOString(), tasks: tasks.map(t => ({ ...entries.get(t.id), id: t.id, file: `tasks/${t.id}.json`, title: t.title, category: t.category, status: t.status, progress: t.progress, parentId: t.parentId || null, order: t.order || 0, startDate: t.startDate, targetEndDate: t.targetEndDate, actualEndDate: t.actualEndDate })) };
  }
  function parseBody(markdown = '') {
    const read = key => new RegExp(`<!-- dhd:${key} -->\\r?\\n([\\s\\S]*?)\\r?\\n<!-- /dhd:${key} -->`).exec(markdown)?.[1];
    return { description: read('description') ?? markdown, checklist: read('checklist') ?? '', extra: markdown };
  }
  function writeBody(original, description, checklist) {
    let result = original || '';
    for (const [key, value] of [['description', description], ['checklist', checklist]]) {
      const block = `<!-- dhd:${key} -->\n${value}\n<!-- /dhd:${key} -->`;
      const regex = new RegExp(`<!-- dhd:${key} -->\\r?\\n[\\s\\S]*?\\r?\\n<!-- /dhd:${key} -->`);
      if (regex.test(result)) result = result.replace(regex, () => block);
      else if (key === 'description' && !result.includes('<!-- dhd:')) result = block;
      else result += '\n\n' + block;
    }
    return result.trimEnd() + '\n';
  }
  function crc32(data) { let crc = -1; for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
  function zip(files) {
    // ZIP STORE: portable, dependency-free, UTF-8 names and CRC32, no compression.
    const chunks = [], directory = []; let offset = 0;
    const record = (size) => { const data = new Uint8Array(size); return [data, new DataView(data.buffer)]; };
    for (const [path, value] of files) {
      const name = bytes(path), data = typeof value === 'string' ? bytes(value) : value; const crc = crc32(data);
      const [header, v] = record(30); v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true); v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true);
      chunks.push(header, name, data);
      const [central, c] = record(46); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); directory.push(central, name); offset += header.length + name.length + data.length;
    }
    const size = directory.reduce((n, x) => n + x.length, 0); const [end, e] = record(22); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.size, true); e.setUint16(10, files.size, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
  }
  function equal(a, b) { return a === null || b === null ? a === b : a.length === b.length && a.every((v, i) => v === b[i]); }
  scope.DHD = Object.freeze({ categories, statuses, DAY, clone, json, bytes, text, plain, day, today, iso, safePath, validateTask, normalize, validateTree, children, descendants, progress, move, endDate, shiftSchedule, timeline, indexDocument, parseBody, writeBody, crc32, zip, equal });
})(globalThis);
