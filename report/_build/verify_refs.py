# -*- coding: utf-8 -*-
"""按确切题名逐条复查，输出 GB/T 7714 格式的完整条目（含卷、期、页码）。"""
import sys, io, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vip import search   # vip 里已经包了 utf-8 的 stdout

TITLES = [
    '欧美虚拟博物馆理论与馆建述略',
    '山东大学考古数字博物馆设计与实现',
    '一个基于XML的虚拟博物馆场景描述语言',
    '虚拟博物馆的三维场景构造及交互漫游实现',
    '基于WebGL的三维虚拟博物馆碰撞检测',
    '基于Unity3D的虚拟博物馆信息可视化系统',
    'Pano2VR的宁夏虚拟博物馆全景漫游实现',
    '融合视觉认知特征的虚拟博物馆界面布局美度评价方法',
    '沉浸与叙事:新媒体影像技术下的博物馆文化沉浸式体验设计研究',
    '交互叙事视角下智慧博物馆沉浸式体验设计研究',
    '智慧博物馆沉浸式体验空间营造研究',
    '文化遗产数字化保护与应用研究综述',
    '曾侯乙编钟演奏与创编虚拟仿真实验设计与实现',
    '湖北省博物馆IP开发的问题和策略',
]


def norm(s):
    return ''.join(ch for ch in (s or '') if ch not in ' :：,，,;；()（）—-—"')


for t in TITLES:
    print('=' * 6, t)
    try:
        ld = search(t)
    except Exception as e:
        print('  ERR', e)
        continue
    best = None
    for r in ld.get('records', []):
        if norm(r.get('title')) == norm(t):
            best = r
            break
    if best is None:
        for r in ld.get('records', [])[:1]:
            best = r
    if not best:
        print('  NOT FOUND')
        continue
    oi = best.get('objectInfo') or {}
    auths = [a['name'] for a in (best.get('authorInfo') or [])]
    print('  title :', best.get('title'))
    print('  auth  :', ', '.join(auths))
    print('  source:', oi.get('name'), '| vol', oi.get('vol'), '| num', oi.get('num'),
          '| year', oi.get('year'), '| issn', oi.get('issn'), '| core', oi.get('isCore'))
    print('  pages :', best.get('beginPage'), '-', best.get('endPage'),
          '| pageCnt', best.get('pageCnt'), '| cited', best.get('byRefCnt'))
    print('  doi   :', best.get('doi'), '| id', best.get('id'))
    time.sleep(1)
