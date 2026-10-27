import os, time, urllib.request
url = os.environ['PAGE_URL']
last = ''
for attempt in range(24):
    try:
        request = urllib.request.Request(url + '?build=' + os.environ.get('GITHUB_SHA', 'verify'), headers={'User-Agent': 'BAIHUA-release-verification/1.0'})
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode('utf-8')
            if 'v1.0.0-demo.7' in body and 'id="download"' in body:
                print('Public download page verified:', url)
                break
            last = 'HTTP 200 but expected download page content was missing: ' + body[:180]
    except Exception as error:
        last = str(error)
    time.sleep(5)
else:
    print('::error::Public download page verification failed: ' + last.replace('\n', ' '))
    raise SystemExit(1)
