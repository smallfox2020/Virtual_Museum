# -*- coding: utf-8 -*-
"""维普检索：抓 search 页 -> node 解析 __NUXT__ -> 打印结构化条目。"""
import sys, io, os, json, subprocess, urllib.parse, urllib.request, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.path.join(ROOT, '_tmp')
os.makedirs(TMP, exist_ok=True)
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')


def search(k, sort=None):
    url = 'https://www.cqvip.com/search?k=' + urllib.parse.quote(k)
    if sort:
        url += '&sort=' + str(sort)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        html = r.read().decode('utf-8', 'replace')
    hp = os.path.join(TMP, 'vip.html')
    open(hp, 'w', encoding='utf-8').write(html)
    jp = os.path.join(TMP, 'vip.json')
    subprocess.run(['node', os.path.join(HERE, 'nuxt.js'), hp, jp], check=True,
                   stdout=subprocess.DEVNULL)
    d = json.load(open(jp, encoding='utf-8'))
    return d['data'][0]['listData']


def show(k, sort=None, only_core=False, min_cite=0):
    print('=' * 10, k, ('sort=%s' % sort) if sort else '')
    try:
        ld = search(k, sort)
    except Exception as e:
        print('  ERR', e)
        return []
    out = []
    for r in ld.get('records', []):
        oi = r.get('objectInfo') or {}
        if oi.get('name') is None:
            continue
        if only_core and not oi.get('isCore'):
            continue
        if (r.get('byRefCnt') or 0) < min_cite:
            continue
        auths = [a['name'] for a in (r.get('authorInfo') or [])]
        fmt = '《%s》%s年第%s期 %s-%s页 (被引%s,%s)' % (
            oi.get('name'), oi.get('year'), oi.get('num'),
            r.get('beginPage'), r.get('endPage'), r.get('byRefCnt'),
            '核心' if oi.get('isCore') else '非核心')
        print(' -', r.get('title'))
        print('   ', ', '.join(auths[:6]), '|', fmt)
        print('    doi=%s id=%s' % (r.get('doi'), r.get('id')))
        out.append(r)
    if not out:
        print('  (无)')
    return out


if __name__ == '__main__':
    for q in sys.argv[1:]:
        show(q)
        time.sleep(1)
