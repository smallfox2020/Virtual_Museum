# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vip import search
tot=jump=0; okj=okn=0; badj=badn=[]
seen=set()
for q in ['虚拟博物馆','博物馆 数字化','WebGL 三维 虚拟','三维 漫游 碰撞检测','博物馆 沉浸式 体验']:
    ld = search(q)
    for r in ld.get('records', []):
        rid = r.get('id')
        if rid in seen: continue
        seen.add(rid)
        b,e = r.get('beginPage'), r.get('endPage')
        try: b,e = int(b), int(e)
        except: continue
        jp = (r.get('jumpPage') or '').strip()
        try: jc = int(jp) if jp else None
        except: continue
        pc = r.get('pageCnt')
        if not pc: continue
        tot += 1
        if jc is not None:
            jump += 1
            if pc == (e-b+1) + 1 and jc > e: okj += 1
            else: badj.append((r.get('title')[:18], b, e, jc, pc))
        else:
            if pc == e-b+1: okn += 1
            else: badn.append((r.get('title')[:18], b, e, pc))
print('样本 %d 条；有转页 %d 条，其中 pageCnt=(end-begin+1)+1 且转页页>末页 的有 %d 条' % (tot, jump, okj))
print('无转页的 %d 条中 pageCnt=end-begin+1 的有 %d 条' % (tot-jump, okn))
print('不吻合（有转页）:', badj[:6])
print('不吻合（无转页）:', badn[:6])
