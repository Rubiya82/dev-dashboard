"""Maintainer utility: bundle checked-in HTML. End users need no build step."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def render(data_base):
    template = (ROOT / 'web/app.template.html').read_text(encoding='utf-8')
    data = ROOT / 'web/data'
    index = json.loads((data / 'index.json').read_text(encoding='utf-8'))
    files = {'index.json': (data / 'index.json').read_text(encoding='utf-8')}
    for entry in index['tasks']:
        files[entry['file']] = (data / entry['file']).read_text(encoding='utf-8')
        task = json.loads(files[entry['file']])
        if task.get('bodyFile'):
            files[task['bodyFile']] = (data / task['bodyFile']).read_text(encoding='utf-8')
    # Embedded content is only a generic offline demo, never the local source of truth.
    replacements = {'BOOTSTRAP': json.dumps(files, ensure_ascii=False).replace('<', '\\u003c'), 'CONFIG': json.dumps({'dataBase': data_base})}
    for key, filename in [('STYLES', 'styles.css'), ('CORE', 'core.js'), ('STORAGE', 'storage.js'), ('APP', 'app.js')]:
        replacements[key] = re.sub(r'</script', r'<\\/script', (ROOT / 'web/assets' / filename).read_text(encoding='utf-8'), flags=re.I)
    for key, value in replacements.items():
        template = template.replace('/*__' + key + '__*/', value)
    return template

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for filename, base in [('index.html', './web/data/'), ('web/index.html', './data/')]:
        output = render(base)
        target = ROOT / filename
        if args.check:
            if not target.exists() or target.read_text(encoding='utf-8') != output:
                raise SystemExit(f'Stale bundle: {filename}; run python tools/build_dashboard.py')
        else:
            target.write_text(output, encoding='utf-8', newline='\n')
        print(f'OK {filename}: {len(output.encode("utf-8")):,} bytes')

if __name__ == '__main__':
    main()
