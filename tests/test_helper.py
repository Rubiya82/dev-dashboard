import base64
import copy
import http.client
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bridge', ROOT / 'tools/git-helper/server.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class HelperTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='dashboard-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'repo'
        self.remote = Path(self.temporary.name) / 'remote.git'
        self.root.mkdir()
        self.run_git('init', '-b', 'main')
        self.run_git('config', 'user.name', 'Dashboard Test')
        self.run_git('config', 'user.email', 'test@example.invalid')
        self.run_git('config', 'core.autocrlf', 'false')
        subprocess.run(['git', 'init', '--bare', str(self.remote)], check=True, capture_output=True)
        data = self.root / 'web/data'
        (data / 'tasks').mkdir(parents=True)
        (data / 'notes').mkdir()
        self.task = {'schemaVersion': 1, 'id': 'TASK-TEST', 'title': 'Sample', 'category': 'personal', 'status': 'planned', 'progress': 0, 'startDate': '2026-09-10', 'targetEndDate': None, 'actualEndDate': None, 'logs': [], 'decisions': [], 'milestones': [], 'releases': [], 'bodyFile': 'notes/TASK-TEST.md', 'future': {'keep': True}}
        (data / 'tasks/TASK-TEST.json').write_text(json.dumps(self.task), encoding='utf-8')
        (data / 'notes/TASK-TEST.md').write_text('Original\n', encoding='utf-8')
        (data / 'index.json').write_text(json.dumps({'schemaVersion': 1, 'tasks': [{'id': 'TASK-TEST', 'file': 'tasks/TASK-TEST.json'}]}), encoding='utf-8')
        (self.root / '.gitignore').write_text('.dashboard-backups/\n', encoding='utf-8')
        self.run_git('add', '.')
        self.run_git('commit', '-m', 'initial test fixture')
        self.run_git('remote', 'add', 'origin', str(self.remote))
        self.run_git('push', '-u', 'origin', 'main')
        self.repo = bridge.Repository(self.root)

    def run_git(self, *args):
        result = subprocess.run(['git', '-C', str(self.root), *args], capture_output=True, encoding='utf-8', check=True)
        return result.stdout.strip()

    def payload(self, title='Edited'):
        task = copy.deepcopy(self.task)
        task['title'] = title
        return {'changes': [{'path': 'tasks/TASK-TEST.json', 'content': base64.b64encode(json.dumps(task).encode()).decode(), 'baseHash': bridge.digest(self.repo.read('tasks/TASK-TEST.json'))}]}

    def test_save_commit_push_roundtrip(self):
        payload = self.payload()
        review = self.repo.review(payload)
        self.assertTrue(review['canPublish'])
        self.assertIn('+', review['diff'])
        result = self.repo.publish(dict(payload, reviewId=review['reviewId'], message='test: edit task', confirm=True))
        self.assertTrue(result['saved'] and result['committed'] and result['pushed'])
        remote = subprocess.run(['git', '--git-dir', str(self.remote), 'show', 'main:web/data/tasks/TASK-TEST.json'], check=True, capture_output=True, encoding='utf-8').stdout
        self.assertEqual(json.loads(remote)['title'], 'Edited')
        self.assertEqual(json.loads(remote)['future'], {'keep': True})
        self.assertEqual(self.run_git('status', '--porcelain'), '')
        self.assertEqual(len(list((self.root / '.dashboard-backups').rglob('TASK-TEST.json'))), 1)

    def test_saved_files_can_publish_without_browser_changes(self):
        self.repo.save(self.payload())
        payload = {'changes': []}
        review = self.repo.review(payload)
        result = self.repo.publish(dict(payload, reviewId=review['reviewId'], message='test: saved data', confirm=True))
        self.assertTrue(result['pushed'] and result['committed'])

    def test_external_change_conflict_no_overwrite(self):
        payload = self.payload()
        target = self.root / 'web/data/tasks/TASK-TEST.json'
        target.write_text(json.dumps(dict(self.task, title='Other editor')), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '충돌'):
            self.repo.save(payload)
        self.assertEqual(json.loads(target.read_text())['title'], 'Other editor')

    def test_stale_review(self):
        payload = self.payload()
        review = self.repo.review(payload)
        (self.root / 'web/data/notes/TASK-TEST.md').write_text('Other edit', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '검토'):
            self.repo.publish(dict(payload, reviewId=review['reviewId'], message='test: stale', confirm=True))

    def test_staged_unrelated_file_preserved(self):
        (self.root / 'private.txt').write_text('keep', encoding='utf-8')
        self.run_git('add', 'private.txt')
        self.assertFalse(self.repo.review(self.payload())['canPublish'])
        self.assertEqual(self.run_git('diff', '--cached', '--name-only'), 'private.txt')

    def test_unstaged_unrelated_file_not_committed(self):
        (self.root / 'private.txt').write_text('keep', encoding='utf-8')
        payload = self.payload()
        review = self.repo.review(payload)
        self.assertTrue(self.repo.publish(dict(payload, reviewId=review['reviewId'], message='test: scoped', confirm=True))['pushed'])
        self.assertNotIn('private.txt', self.run_git('show', '--pretty=', '--name-only', 'HEAD'))

    def test_path_allowlist(self):
        for path in ['../secret', 'tasks/../../x.json', '.git/config', 'tasks/TASK-X.json/../a', 'images/TASK-TEST/a.svg', 'C:/x', 'tasks\\TASK-TEST.json']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.repo.path(path)

    def test_cycle_and_cross_task_body_rejected(self):
        for changes in [{'parentId': 'TASK-TEST'}, {'bodyFile': 'notes/TASK-OTHER.md'}]:
            payload = self.payload()
            payload['changes'][0]['content'] = base64.b64encode(json.dumps(dict(self.task, **changes)).encode()).decode()
            with self.assertRaises(ValueError):
                self.repo.save(payload)

    def test_explicit_confirmation_required(self):
        with self.assertRaises(ValueError):
            self.repo.publish(dict(self.payload(), message='test: no confirm'))

    def test_push_failure_keeps_saved_commit(self):
        payload = self.payload()
        review = self.repo.review(payload)
        original = self.repo.git
        def fail_push(*args, **kwargs):
            if args[0] == 'push':
                raise ValueError('simulated offline push')
            return original(*args, **kwargs)
        self.repo.git = fail_push
        result = self.repo.publish(dict(payload, reviewId=review['reviewId'], message='test: offline', confirm=True))
        self.assertTrue(result['saved'] and result['committed'])
        self.assertFalse(result['pushed'])
        self.repo.git = original
        retry = self.repo.review({'changes': []})
        self.assertTrue(self.repo.publish({'changes': [], 'reviewId': retry['reviewId'], 'message': 'test: retry', 'confirm': True})['pushed'])

    def test_loopback_auth_and_origin(self):
        server = bridge.Server(('127.0.0.1', 0), self.repo, token='test-session-only')
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            for origin, token, status in [('null', 'test-session-only', 200), ('null', '', 401), ('https://untrusted.invalid', 'test-session-only', 403)]:
                client = http.client.HTTPConnection('127.0.0.1', server.server_port)
                client.request('GET', '/api/snapshot', headers={'Origin': origin, 'X-Dashboard-Token': token})
                response = client.getresponse()
                self.assertEqual(response.status, status)
                response.read()
                client.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def test_sample_contract(self):
        index = json.loads((ROOT / 'web/data/index.json').read_text(encoding='utf-8'))
        self.assertEqual(len(index['tasks']), 10)
        for entry in index['tasks']:
            bridge.validate_task(json.loads((ROOT / 'web/data' / entry['file']).read_text(encoding='utf-8')))

if __name__ == '__main__':
    unittest.main()
