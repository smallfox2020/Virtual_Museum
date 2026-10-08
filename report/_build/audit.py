# -*- coding: utf-8 -*-
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vip import search
TITLES = ['欧美虚拟博物馆理论与馆建述略','山东大学考古数字博物馆设计与实现',
 '一个基于XML的虚拟博物馆场景描述语言','虚拟博物馆的三维场景构造及交互漫游实现',
 '基于WebGL的三维虚拟博物馆碰撞检测','基于Unity3D的虚拟博物馆信息可视化系统',
 'Pano2VR的宁夏虚拟博物馆全景漫游实现','融合视觉认知特征的虚拟博物馆界面布局美度评价方法',
 '沉浸与叙事:新媒体影像技术下的博物馆文化沉浸式体验设计研究',
 '交互叙事视角下智慧博物馆沉浸式体验设计研究','智慧博物馆沉浸式体验空间营造研究',
 '文化遗产数字化保护与应用研究综述','曾侯乙编钟演奏与创编虚拟仿真实验设计与实现',
 '湖北省博物馆IP开发的问题和策略']
def norm(s): return ''.join(c for c in (s or '') if c not in ' :：,，;；()（）—-—"')
for t in TITLES:
    rec = None
    for a in range(3):
        try:
            ld = search(t)
            for r in ld.get('records', []):
                if norm(r.get('title')) == norm(t): rec = r; break
            break
        except Exception as e:
            time.sleep(2)
    if not rec:
        print('FAIL  ', t); continue
    oi = rec.get('objectInfo') or {}
    jp = rec.get('jumpPage') or ''
    flag = '  <<<<< 跨页' if jp.strip() else ''
    print('%s | %s %s vol%s num%s | begin=%s end=%s jump=%r cnt=%s%s' % (
        t[:22], oi.get('name'), oi.get('year'), oi.get('vol'), oi.get('num'),
        rec.get('beginPage'), rec.get('endPage'), jp, rec.get('pageCnt'), flag))
    time.sleep(1)
