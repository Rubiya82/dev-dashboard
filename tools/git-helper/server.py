"""Optional token-paired loopback bridge. Python standard library only."""
import argparse
import base64
import datetime as dt
import difflib
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PATH_RE = re.compile(r'(?:index\.json|tasks/TASK-[A-Z0-9_-]+\.json|notes/TASK-[A-Z0-9_-]+\.md|images/TASK-[A-Z0-9_-]+/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp|gif))\Z')
ID_RE = re.compile(r'TASK-[A-Z0-9_-]+\Z')

def digest(data):
    return hashlib.sha256(data).hexdigest() if data is not None else None

def safe_path(path):
    if not isinstance(path, str) or len(path) > 220 or not PATH_RE.fullmatch(path):
        raise ValueError('허용되지 않는 데이터 경로입니다.')
    return path

def date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('날짜 형식은 YYYY-MM-DD입니다.')
    return dt.date.fromisoformat(value)

def validate_task(task):
    if not isinstance(task, dict) or task.get('schemaVersion') != 1 or not ID_RE.fullmatch(task.get('id', '')):
        raise ValueError('과제 ID/schemaVersion 오류입니다.')
    if not isinstance(task.get('title'), str) or not 1 <= len(task['title'].strip()) <= 300:
        raise ValueError('과제명이 필요합니다.')
    if task.get('category') not in ('assigned', 'personal', 'project') or task.get('status') not in ('planned', 'in_progress', 'blocked', 'on_hold', 'completed', 'cancelled'):
        raise ValueError('분류/상태 오류입니다.')
    if type(task.get('progress')) is not int or not 0 <= task['progress'] <= 100:
        raise ValueError('진행률 오류입니다.')
    start = date(task.get('startDate'))
    for key in ('targetEndDate', 'actualEndDate'):
        if key not in task or (task[key] is not None and date(task[key]) < start):
            raise ValueError('종료일은 시작일 이후여야 합니다.')
    for key in ('logs', 'decisions', 'milestones', 'releases'):
        if not isinstance(task.get(key), list) or any(not isinstance(v, dict) for v in task[key]):
            raise ValueError('기록 목록 오류입니다.')
    for key, field in (('decisions', 'date'), ('milestones', 'date'), ('releases', 'releaseDate')):
        for item in task[key]:
            if item.get(field) is not None:
                date(item[field])
    parent = task.get('parentId')
    if parent is not None and (not isinstance(parent, str) or not ID_RE.fullmatch(parent)):
        raise ValueError('상위 과제 ID 오류입니다.')
    if task.get('bodyFile') is not None and task['bodyFile'] != f"notes/{task['id']}.md":
        raise ValueError('본문은 과제별 notes 경로여야 합니다.')
    for image in task.get('images', []):
        if not isinstance(image, dict) or not safe_path(image.get('file')).startswith(f"images/{task['id']}/"):
            raise ValueError('이미지 경로가 과제와 일치하지 않습니다.')
    return task

class Repository:
    def __init__(self, root):
        self.root = Path(root).resolve(strict=True)
        self.data = self.root / 'web' / 'data'
        self.lock = threading.RLock()
        self.reviews = {}
        if Path(self.git('rev-parse', '--show-toplevel').strip()).resolve() != self.root:
            raise ValueError('저장소 루트를 지정해 주세요.')
        self.path('index.json')

    def git(self, *args, check=True):
        env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never')
        result = subprocess.run(['git', '-C', str(self.root), *args], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, env=env, shell=False)
        if check and result.returncode:
            output = re.sub(r'(https?://)[^/\s@]+@', r'\1[redacted]@', result.stderr or result.stdout)
            raise ValueError(output.strip()[:3000] or 'Git 명령에 실패했습니다.')
        return result.stdout if check else result

    def path(self, relative):
        safe_path(relative)
        target = self.data / relative
        for component in [self.root / 'web', self.data, target, *list(target.parents)[:len(Path(relative).parts)-1]]:
            if component.is_symlink() or (hasattr(component, 'is_junction') and component.is_junction()):
                raise ValueError('심볼릭 링크/정션은 허용하지 않습니다.')
        if not target.resolve().is_relative_to(self.data.resolve()):
            raise ValueError('저장소 외부 경로입니다.')
        return target

    def read(self, relative):
        target = self.path(relative)
        return target.read_bytes() if target.is_file() else None

    def snapshot(self):
        files = {}
        for p in self.data.rglob('*'):
            relative = p.relative_to(self.data).as_posix()
            if p.is_file() and PATH_RE.fullmatch(relative):
                files[relative] = base64.b64encode(self.read(relative)).decode('ascii')
        return {'repository': self.root.name, 'files': files}

    def changes(self, body):
        items = body.get('changes')
        if not isinstance(items, list) or len(items) > 3000:
            raise ValueError('변경 목록 오류입니다.')
        decoded = {}
        for item in items:
            path = safe_path(item.get('path'))
            if path in decoded:
                raise ValueError('중복 변경 경로입니다.')
            data = base64.b64decode(item.get('content', ''), validate=True)
            if len(data) > 8 * 1024 * 1024:
                raise ValueError('파일당 최대 8MB입니다.')
            current = self.read(path)
            if digest(current) != item.get('baseHash') and current != data:
                raise ValueError(f'{path}: 외부 변경 충돌. 다시 열어 확인하세요.')
            if path.endswith(('.json', '.md')):
                text = data.decode('utf-8')
                if path.startswith('tasks/'):
                    task = validate_task(json.loads(text))
                    if path != f"tasks/{task['id']}.json":
                        raise ValueError('파일명과 과제 ID가 다릅니다.')
            else:
                ext = path.rsplit('.', 1)[-1]
                valid = {'png': data.startswith(b'\x89PNG\r\n\x1a\n'), 'jpg': data.startswith(b'\xff\xd8\xff'), 'jpeg': data.startswith(b'\xff\xd8\xff'), 'gif': data[:6] in (b'GIF87a', b'GIF89a'), 'webp': data[:4] == b'RIFF' and data[8:12] == b'WEBP'}
                if not valid.get(ext):
                    raise ValueError('이미지 형식과 확장자가 다릅니다.')
            decoded[path] = data
        self.validate_workspace(decoded)
        return decoded

    def validate_workspace(self, proposed):
        def read(path):
            value = proposed[path] if path in proposed else self.read(path)
            if value is None:
                raise ValueError(f'연결된 파일이 없습니다: {path}')
            return value
        index = json.loads(read('index.json').decode('utf-8'))
        if index.get('schemaVersion') != 1 or not isinstance(index.get('tasks'), list):
            raise ValueError('index.json 오류입니다.')
        tasks = {}
        for entry in index['tasks']:
            if entry.get('file') != f"tasks/{entry.get('id')}.json" or entry.get('id') in tasks:
                raise ValueError('목록 ID/경로 오류입니다.')
            task = validate_task(json.loads(read(safe_path(entry['file'])).decode('utf-8')))
            if task['id'] != entry['id']:
                raise ValueError('목록 ID가 일치하지 않습니다.')
            tasks[task['id']] = task
            if task.get('bodyFile'):
                read(task['bodyFile']).decode('utf-8')
            for image in task.get('images', []):
                read(image['file'])
        for task in tasks.values():
            seen, parent = {task['id']}, task.get('parentId')
            while parent:
                if parent not in tasks or parent in seen:
                    raise ValueError('상위 과제 누락 또는 계층 순환입니다.')
                seen.add(parent)
                parent = tasks[parent].get('parentId')

    def save(self, body):
        changes = self.changes(body)
        backup = self.root / '.dashboard-backups' / (dt.datetime.now().strftime('%Y%m%d-%H%M%S-') + secrets.token_hex(4))
        for path, data in sorted(changes.items(), key=lambda item: item[0] == 'index.json'):
            self.changes(body)  # Recheck baseline; already-written matching bytes are safe on retry.
            target, old = self.path(path), self.read(path)
            if old == data:
                continue
            if old is not None:
                copy = backup / path
                copy.parent.mkdir(parents=True, exist_ok=True)
                copy.write_bytes(old)
            target.parent.mkdir(parents=True, exist_ok=True)
            fd, temporary = tempfile.mkstemp(prefix='.dhd-', suffix='.tmp', dir=target.parent)
            try:
                with os.fdopen(fd, 'wb') as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
                self.path(path)
                os.replace(temporary, target)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
        return {'saved': True, 'files': list(changes)}

    def git_state(self, fetch=False):
        if self.git('diff', '--cached', '--name-only').strip():
            raise ValueError('이미 스테이징된 파일이 있습니다. Git에서 먼저 처리해 주세요.')
        branch = self.git('symbolic-ref', '--quiet', '--short', 'HEAD').strip()
        upstream = self.git('rev-parse', '--abbrev-ref', '@{upstream}').strip()
        if upstream != f'origin/{branch}':
            raise ValueError('현재 브랜치 upstream을 origin의 같은 이름 브랜치로 설정하세요.')
        urls = self.git('remote', 'get-url', '--push', '--all', 'origin').strip().splitlines()
        if len(urls) != 1 or re.search(r'https?://[^/]+@', urls[0]):
            raise ValueError('원격 URL은 한 개만 사용하며 URL 안 인증정보는 허용하지 않습니다.')
        if fetch:
            self.git('fetch', '--no-tags', 'origin', branch)
        head, remote_head = self.git('rev-parse', 'HEAD').strip(), self.git('rev-parse', '@{upstream}').strip()
        if self.git('merge-base', '--is-ancestor', remote_head, head, check=False).returncode:
            raise ValueError('원격에 새 변경이 있습니다. Git에서 pull/충돌 해결 후 다시 연결하세요.')
        ahead = self.git('rev-list', f'{remote_head}..HEAD').splitlines()
        if self.git('rev-list', '--merges', f'{remote_head}..HEAD').strip():
            raise ValueError('미푸시 병합 커밋은 Git에서 먼저 확인하고 push하세요.')
        for commit in ahead:
            paths = self.git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', commit).splitlines()
            if any(not p.startswith('web/data/') or not PATH_RE.fullmatch(p[9:]) for p in paths):
                raise ValueError('미푸시 커밋에 데이터 외 파일이 있습니다. Git에서 먼저 push하세요.')
        paths = sorted(set(p for p in self.git('ls-files', '--modified', '--others', '--exclude-standard', '-z', '--', 'web/data/').split('\0') if p))
        for path in paths:
            if not path.startswith('web/data/') or not PATH_RE.fullmatch(path[9:]) or self.read(path[9:]) is None:
                raise ValueError('데이터 외 파일/삭제 파일은 Git에서 직접 처리하세요.')
        return {'branch': branch, 'remote': urls[0], 'head': head, 'remoteHead': remote_head, 'ahead': ahead, 'diskPaths': paths}

    def fingerprint(self, changes, state):
        value = {'state': state, 'proposed': {p: digest(v) for p, v in changes.items()}, 'snapshot': self.snapshot()['files']}
        return digest(json.dumps(value, sort_keys=True).encode('utf-8'))

    def review(self, body):
        changes = self.changes(body)
        try:
            state = self.git_state(fetch=True)
        except ValueError as error:
            return {'repository': self.root.name, 'branch': '', 'remote': '', 'paths': list(changes), 'diff': '', 'canPublish': False, 'warning': str(error)}
        paths = sorted(set(state['diskPaths']) | {'web/data/' + p for p in changes})
        sections = [self.git('diff', f"{state['remoteHead']}..HEAD", '--', 'web/data/')]
        for path in paths:
            old = self.git('show', 'HEAD:' + path, check=False)
            data = changes[path[9:]] if path[9:] in changes else self.read(path[9:])
            if path.endswith(('.json', '.md')):
                before = old.stdout if old.returncode == 0 else ''
                sections.append(''.join(difflib.unified_diff(before.splitlines(True), data.decode('utf-8').splitlines(True), fromfile='a/' + path, tofile='b/' + path)))
            else:
                sections.append(f'Image: {path} ({len(data)} bytes)\n')
        key = secrets.token_urlsafe(24)
        self.reviews = {key: (time.monotonic(), self.fingerprint(changes, state))}
        return {'repository': self.root.name, 'branch': state['branch'], 'remote': state['remote'], 'paths': paths, 'diff': '\n'.join(sections), 'canPublish': True, 'reviewId': key, 'warning': f"미푸시 데이터 커밋 {len(state['ahead'])}개 포함. 저장 → 커밋 → push를 진행합니다."}

    def publish(self, body):
        if body.get('confirm') is not True:
            raise ValueError('최종 반영 확인이 필요합니다.')
        message = body.get('message', '')
        if not isinstance(message, str) or not 3 <= len(message.strip()) <= 120 or any(ord(c) < 32 for c in message):
            raise ValueError('커밋 메시지는 줄바꿈 없이 3~120자입니다.')
        changes, state = self.changes(body), self.git_state(fetch=True)
        review = self.reviews.pop(body.get('reviewId'), None)
        if not review or time.monotonic() - review[0] > 600 or review[1] != self.fingerprint(changes, state):
            raise ValueError('검토 후 파일/브랜치 변경 또는 시간 만료입니다. 다시 확인하세요.')
        self.save(body)
        result = {'saved': True, 'committed': False, 'pushed': False, 'commit': None}
        try:
            paths = sorted(set(state['diskPaths']) | {'web/data/' + p for p in changes})
            if paths:
                self.git('add', '--', *paths)
                if self.git('diff', '--cached', '--quiet', check=False).returncode:
                    self.git('commit', '-m', message, '--only', '--', *paths)
                    result['committed'] = True
            result['commit'] = self.git('rev-parse', 'HEAD').strip()
            self.git('push', 'origin', f"HEAD:refs/heads/{state['branch']}")
            result['pushed'] = True
        except (ValueError, subprocess.TimeoutExpired) as error:
            result['error'] = str(error)
        return result

class Server(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, repository, token=None):
        self.repository, self.token = repository, token or secrets.token_urlsafe(32)
        super().__init__(address, Handler)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log request bodies or tokens.
    def allowed(self):
        port = self.server.server_port
        if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
            return False
        origin = self.headers.get('Origin')
        return origin in (None, 'null') or bool(re.fullmatch(r'http://(?:127\.0\.0\.1|localhost):\d{1,5}', origin))
    def reply(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode('utf-8') if status != 204 else b''
        self.send_response(status)
        if self.allowed() and self.headers.get('Origin'):
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Dashboard-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_OPTIONS(self):
        self.reply(204 if self.allowed() else 403, {})
    def do_GET(self):
        self.dispatch()
    def do_POST(self):
        self.dispatch()
    def dispatch(self):
        if not self.allowed():
            self.reply(403, {'error': 'Origin/Host denied'})
            return
        if not hmac.compare_digest(self.headers.get('X-Dashboard-Token', ''), self.server.token):
            self.reply(401, {'error': '연결 코드가 올바르지 않습니다.'})
            return
        try:
            with self.server.repository.lock:
                if self.command == 'GET' and self.path == '/api/snapshot':
                    result = self.server.repository.snapshot()
                elif self.command == 'POST' and self.path in ('/api/save', '/api/review', '/api/publish'):
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 48 * 1024 * 1024 or self.headers.get('Content-Type') != 'application/json':
                        raise ValueError('요청은 JSON 형식, 최대 48MB입니다.')
                    self.connection.settimeout(20)
                    body = json.loads(self.rfile.read(size))
                    if not isinstance(body, dict):
                        raise ValueError('JSON 객체가 필요합니다.')
                    result = getattr(self.server.repository, self.path.rsplit('/', 1)[-1])(body)
                else:
                    self.reply(404, {'error': 'Not found'})
                    return
                self.reply(200, result)
        except (ValueError, TypeError, KeyError, OSError, subprocess.TimeoutExpired) as error:
            self.reply(409, {'error': str(error)[:3000]})

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('port must be 1024..65535')
    repository = Repository(args.repo)
    server = Server(('127.0.0.1', args.port), repository)
    print(f'Repository: {repository.root}\nPort: {args.port}\nConnection code: {server.token}\nOpen index.html, then Git connection settings. Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
