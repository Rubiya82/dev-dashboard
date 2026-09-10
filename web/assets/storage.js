(function (scope) {
  'use strict';
  const C = scope.DHD;
  const b64 = data => { let s = ''; for (let i = 0; i < data.length; i += 16384) s += String.fromCharCode(...data.subarray(i, i + 16384)); return btoa(s); };
  const unb64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  class Workspace {
    constructor() { this.tasks = []; this.index = {}; this.files = new Map(); this.baseline = new Map(); this.errors = []; this.source = 'sample'; this.directory = null; this.helper = null; this.undoStack = []; this.redoStack = []; this.grouping = false; }
    snapshot() {
      const referenced = new Set(this.tasks.flatMap(t => t.images.map(i => i.file)));
      return { tasks: C.clone(this.tasks), index: C.clone(this.index), files: new Map([...this.files].filter(([path]) => !path.startsWith('images/') || this.baseline.has(path) || referenced.has(path))) };
    }
    checkpoint() { if (this.grouping) return; this.undoStack.push(this.snapshot()); if (this.undoStack.length > 30) this.undoStack.shift(); this.redoStack = []; }
    restore(snapshot) {
      this.tasks = C.clone(snapshot.tasks); this.index = C.clone(snapshot.index); this.files = new Map(snapshot.files);
      // A saved file absent from an older snapshot remains an unindexed orphan, not a disk deletion.
      for (const [path, data] of this.baseline) if (!this.files.has(path)) this.files.set(path, data);
    }
    undo() { this.assertWritable(); if (!this.undoStack.length) return false; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); return true; }
    redo() { this.assertWritable(); if (!this.redoStack.length) return false; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); return true; }
    removeMany(ids) {
      this.assertWritable(); const wanted = new Set(ids), roots = this.tasks.filter(t => wanted.has(t.id) && !this.tasks.some(p => wanted.has(p.id) && C.descendants(this.tasks, p.id).has(t.id)));
      if (!roots.length) return [];
      this.checkpoint(); this.grouping = true;
      try { return roots.flatMap(t => this.remove(t.id)); } finally { this.grouping = false; }
    }
    async load(reader, source) {
      const rawIndex = await reader('index.json'); const index = JSON.parse(C.text(rawIndex));
      if (!C.plain(index) || index.schemaVersion !== 1 || !Array.isArray(index.tasks)) throw Error('유효한 대시보드 데이터 폴더가 아닙니다.');
      const files = new Map([['index.json', rawIndex]]), tasks = [], errors = [];
      const read = async path => { C.safePath(path); const data = await reader(path); files.set(path, data); return data; };
      // Limit concurrent reads; a broken document never prevents other rows loading.
      for (let i = 0; i < index.tasks.length; i += 12) {
        const results = await Promise.all(index.tasks.slice(i, i + 12).map(async entry => {
          try {
            if (!C.plain(entry) || !entry.id || entry.file !== `tasks/${entry.id}.json`) throw Error('index 파일 경로와 ID가 일치하지 않습니다.');
            const t = C.normalize(JSON.parse(C.text(await read(entry.file))));
            if (t.id !== entry.id) throw Error('문서 ID와 목록 ID가 일치하지 않습니다.');
            if (t.bodyFile) await read(t.bodyFile);
            for (const img of t.images) await read(img.file);
            return { task: t };
          } catch (e) { return { error: `${entry?.id || '알 수 없는 과제'}: ${e.message}` }; }
        }));
        results.forEach(r => r.error ? errors.push(r.error) : tasks.push(r.task));
      }
      try { C.validateTree(tasks); } catch (e) { errors.push(e.message); }
      this.index = index; this.tasks = tasks; this.files = files; this.baseline = new Map(files); this.errors = errors; this.source = source; this.undoStack = []; this.redoStack = [];
      return this;
    }
    body(t) { return t.bodyFile && this.files.has(t.bodyFile) ? C.text(this.files.get(t.bodyFile)) : ''; }
    changed() { return new Map([...this.files].filter(([path, data]) => !C.equal(this.baseline.get(path) ?? null, data))); }
    assertWritable() { if (this.errors.length) throw Error('불러오기 오류가 있는 데이터는 저장할 수 없습니다. 원본 파일을 복구한 뒤 다시 열어주세요.'); }
    record(id, changes, bodyValues = null) {
      this.assertWritable(); const old = this.tasks.find(t => t.id === id); if (!old) throw Error('과제를 찾을 수 없습니다.');
      const edited = C.normalize({ ...C.clone(old), ...changes, id: old.id, schemaVersion: 1 });
      const next = this.tasks.map(t => t.id === id ? edited : t); C.validateTree(next);
      this.checkpoint();
      if (bodyValues) {
        edited.bodyFile ||= `notes/${edited.id}.md`;
        this.files.set(edited.bodyFile, C.bytes(C.writeBody(this.body(old), bodyValues.description, bodyValues.checklist)));
      }
      edited.updatedAt = new Date().toISOString(); edited.history = [...(old.history || []), { id: 'H-' + crypto.randomUUID(), at: edited.updatedAt, action: 'updated', title: '과제 내용 수정' }].slice(-300);
      this.tasks = next; this.files.set(`tasks/${id}.json`, C.bytes(C.json(edited))); this.updateIndex(); return edited;
    }
    add(parentId = null) {
      this.assertWritable(); const parent = this.tasks.find(t => t.id === parentId); const now = new Date().toISOString();
      const t = C.normalize({ schemaVersion: 1, id: 'TASK-' + crypto.randomUUID().toUpperCase(), parentId, order: C.children(this.tasks, parentId).length, title: parent ? '새 하위 작업' : '새 메인 과제', category: parent?.category || 'personal', status: 'planned', progress: 0, startDate: C.today(), targetEndDate: null, actualEndDate: null, summary: '', owners: parent?.owners || ['나'], tags: [], links: [], milestones: [], logs: [], decisions: [], releases: [], createdAt: now, updatedAt: now });
      t.bodyFile = `notes/${t.id}.md`; C.validateTree([...this.tasks, t]); this.checkpoint(); this.tasks.push(t);
      this.files.set(t.bodyFile, C.bytes(C.writeBody('', '', ''))); this.files.set(`tasks/${t.id}.json`, C.bytes(C.json(t))); this.updateIndex(); return t;
    }
    relocate(id, parentId, beforeId) {
      this.assertWritable(); const copy = C.clone(this.tasks); C.move(copy, id, parentId, beforeId);
      this.checkpoint();
      for (const t of copy) {
        const old = this.tasks.find(x => x.id === t.id);
        if (old.order !== t.order || old.parentId !== t.parentId) { t.updatedAt = new Date().toISOString(); this.files.set(`tasks/${t.id}.json`, C.bytes(C.json(t))); }
      }
      this.tasks = copy; this.updateIndex();
    }
    remove(id) {
      this.assertWritable(); const task = this.tasks.find(t => t.id === id); if (!task) throw Error('삭제할 과제를 찾을 수 없습니다.');
      this.checkpoint();
      const removedIds = new Set([id, ...C.descendants(this.tasks, id)]);
      const removed = this.tasks.filter(t => removedIds.has(t.id));
      const parentId = task.parentId; this.tasks = this.tasks.filter(t => !removedIds.has(t.id));
      C.children(this.tasks, parentId).forEach((sibling, order) => {
        if (sibling.order !== order) { sibling.order = order; sibling.updatedAt = new Date().toISOString(); this.files.set(`tasks/${sibling.id}.json`, C.bytes(C.json(sibling))); }
      });
      // Existing content remains as an unindexed Git-recoverable orphan. Only never-saved files are discarded.
      for (const item of removed) for (const path of [`tasks/${item.id}.json`, item.bodyFile, ...(item.images || []).map(image => image.file)].filter(Boolean)) {
        if (this.baseline.has(path)) this.files.set(path, this.baseline.get(path)); else this.files.delete(path);
      }
      this.updateIndex(); return removed;
    }
    updateIndex() { this.index = C.indexDocument(this.index, this.tasks); this.files.set('index.json', C.bytes(C.json(this.index))); }
    async image(task, file) {
      this.assertWritable();
      if (file.size > 8 * 1024 * 1024) throw Error('이미지는 한 장당 8MB까지 추가할 수 있습니다.');
      const data = new Uint8Array(await file.arrayBuffer());
      let ext = null; const ascii = part => String.fromCharCode(...part);
      if (data[0] === 0x89 && ascii(data.slice(1, 8)) === 'PNG\r\n\x1a\n') ext = 'png';
      else if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ext = 'jpg';
      else if (['GIF87a', 'GIF89a'].includes(ascii(data.slice(0, 6)))) ext = 'gif';
      else if (ascii(data.slice(0, 4)) === 'RIFF' && ascii(data.slice(8, 12)) === 'WEBP') ext = 'webp';
      if (!ext) throw Error('PNG, JPEG, GIF, WebP 이미지 파일만 지원합니다.');
      const path = `images/${task.id}/${crypto.randomUUID()}.${ext}`;
      this.files.set(path, data); return { file: path, caption: file.name || '붙여넣은 이미지' };
    }
    async payload() {
      this.assertWritable();
      const changes = [];
      for (const [path, data] of this.changed()) {
        const old = this.baseline.get(path);
        changes.push({ path, content: b64(data), baseHash: old ? await sha(old) : null });
      }
      return { changes };
    }
    saved() { this.baseline = new Map(this.files); }
  }
  async function sha(data) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join(''); }
  async function fileHandle(root, path, create = false) {
    C.safePath(path); const parts = path.split('/'); let directory = root;
    for (const name of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(name, { create });
    return directory.getFileHandle(parts.at(-1), { create });
  }
  async function readDirectory(root, path) { const handle = await fileHandle(root, path); return new Uint8Array(await (await handle.getFile()).arrayBuffer()); }
  async function resolveDataDirectory(selected) {
    const candidates = [async () => selected, async () => (await selected.getDirectoryHandle('web')).getDirectoryHandle('data'), async () => selected.getDirectoryHandle('data')];
    for (const candidate of candidates) {
      try { const root = await candidate(); const idx = JSON.parse(C.text(await readDirectory(root, 'index.json'))); if (idx.schemaVersion === 1 && Array.isArray(idx.tasks)) return root; } catch (_) { /* Try next known workspace shape. */ }
    }
    throw Error('선택한 폴더에서 data/index.json을 찾을 수 없습니다. 저장소 루트 또는 web/data 폴더를 선택하세요.');
  }
  async function saveDirectory(ws) {
    ws.assertWritable(); const changes = ws.changed(); if (!ws.directory) throw Error('먼저 작업 폴더를 열어주세요.');
    // Preflight all files before any write, and recheck each file immediately before writing.
    async function verify(path) { let current = null; try { current = await readDirectory(ws.directory, path); } catch (e) { if (e.name !== 'NotFoundError') throw e; } if (!C.equal(current, ws.baseline.get(path) ?? null) && !C.equal(current, ws.files.get(path))) throw Error(`${path}: 외부에서 변경된 파일입니다. 다시 열어 변경을 확인하세요.`); }
    for (const [path] of changes) await verify(path);
    for (const [path, data] of [...changes].sort(([a], [b]) => (a === 'index.json') - (b === 'index.json'))) {
      await verify(path); const handle = await fileHandle(ws.directory, path, true); const writer = await handle.createWritable();
      try { await writer.write(data); await writer.close(); ws.baseline.set(path, data); } catch (e) { try { await writer.abort(); } catch (_) {} throw e; }
    }
  }
  class Helper {
    constructor(port, token) {
      const number = Number(port); if (!Number.isInteger(number) || number < 1024 || number > 65535) throw Error('포트 번호가 올바르지 않습니다.');
      this.base = `http://127.0.0.1:${number}`; this.token = token;
    }
    async request(path, body = null) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path === '/api/publish' ? 150000 : 30000);
      try {
        const response = await fetch(this.base + path, { method: body === null ? 'GET' : 'POST', headers: { 'X-Dashboard-Token': this.token, ...(body !== null ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== null ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
        const value = await response.json(); if (!response.ok) throw Error(value.error || '로컬 도구 요청 실패'); return value;
      } finally { clearTimeout(timer); }
    }
  }
  scope.DHDStorage = { Workspace, sha, readDirectory, resolveDataDirectory, saveDirectory, Helper, b64, unb64 };
})(globalThis);
