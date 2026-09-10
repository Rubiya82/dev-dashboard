"""Read-only checks for the portable, public artifact."""
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bridge', ROOT / 'tools/git-helper/server.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
index = json.loads((ROOT / 'web/data/index.json').read_text(encoding='utf-8'))
ids = set()
for entry in index['tasks']:
    task = bridge.validate_task(json.loads((ROOT / 'web/data' / bridge.safe_path(entry['file'])).read_text(encoding='utf-8')))
    assert task['id'] == entry['id'] and task['id'] not in ids
    ids.add(task['id'])
for name in ('index.html', 'web/index.html'):
    text = (ROOT / name).read_text(encoding='utf-8')
    assert not re.search(r'<script[^>]+src=', text), 'External runtime script'
    assert not re.search(r'(?:href|src)=["\']/[^/]', text), 'Root-relative asset'
    assert not re.search(r'/\*__[A-Z]+__\*/', text), 'Unexpanded bundle placeholder'
    assert '<script id="bootstrap"' in text
secret = re.compile(r'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----')
count = 0
for path in ROOT.rglob('*'):
    relative = path.relative_to(ROOT)
    if any(p in ('.git', '.dashboard-backups', '.test-output', '__pycache__') for p in relative.parts):
        continue
    if path.is_file() and path.suffix in ('.html', '.js', '.css', '.md', '.json', '.yml', '.py', '.ps1'):
        assert not secret.search(path.read_text(encoding='utf-8-sig')), f'Credential-shaped content: {relative}'
        count += 1
print(f'OK: {len(ids)} tasks, 2 self-contained HTML files, {count} text files scanned')
