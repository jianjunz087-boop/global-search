import json, os, re, time, urllib.request
from pathlib import Path

def release_in(body):
    match = re.search(r'const verifiedRelease=(\{[^\n]+\});', body)
    return json.loads(match.group(1)) if match else None

expected = release_in(Path('docs/index.html').read_text(encoding='utf-8'))
if not expected:
    raise SystemExit('No verified release is configured in the source download page')
url = os.environ['PAGE_URL']
last = ''
for attempt in range(24):
    try:
        request = urllib.request.Request(url + '?build=' + os.environ.get('GITHUB_SHA', 'verify'), headers={'User-Agent': 'BAIHUA-release-verification/1.0'})
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode('utf-8')
            release = release_in(body)
            if release and release['version'] == expected['version'] and release['url'] == expected['url'] and 'id="download"' in body:
                print('Public download page verified:', url, release['version'])
                break
            last = 'HTTP 200 but expected published release was not yet present'
    except Exception as error:
        last = str(error)
    time.sleep(5)
else:
    print('::error::Public download page verification failed: ' + last.replace('\n', ' '))
    raise SystemExit(1)
