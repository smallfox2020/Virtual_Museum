# -*- coding: utf-8 -*-
"""在当前目录下，用两份样板 docx 的格式生成新的开题报告与任务书。"""
import copy, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # report/ 目录（样板所在地）
OUT_DIR = os.environ.get('OUT_DIR') or HERE                           # 成品输出目录
TITLE = '湖北省博物馆虚拟展厅的设计与实现'

# --------------------------------------------------------------------------
# 工具
# --------------------------------------------------------------------------

def make_par(tmpl_p, text):
    """克隆模板段落，只保留第一个 run 并把文字换成 text。"""
    newp = copy.deepcopy(tmpl_p)
    rs = newp.findall(qn('w:r'))
    if not rs:
        r = OxmlElement('w:r')
        newp.append(r)
        rs = [r]
    first = rs[0]
    for r in rs[1:]:
        newp.remove(r)
    for child in list(first):
        if child.tag != qn('w:rPr'):
            first.remove(child)
    if text:
        t = OxmlElement('w:t')
        t.set(qn('xml:space'), 'preserve')
        t.text = text
        first.append(t)
    return newp


def insert_seq(anchor, blocks):
    """blocks: [(tmpl_p, text), ...]；依次插到 anchor 之前。"""
    prev = anchor
    for tmpl, text in blocks:
        newp = make_par(tmpl, text)
        prev.addprevious(newp)


def fill_cell(cell, blocks):
    """清空单元格后按 blocks 重建。"""
    tc = cell._tc
    for p in tc.findall(qn('w:p')):
        tc.remove(p)
    prev = None
    for tmpl, text in blocks:
        newp = make_par(tmpl, text)
        if prev is None:
            tc.append(newp)
        else:
            prev.addnext(newp)
        prev = newp


def set_simple(cell, text):
    """把单元格的文字整体替换掉（保留第一段格式）。"""
    ps = cell.paragraphs
    runs = ps[0].runs
    keep = None
    for p in ps[1:]:
        p._p.getparent().remove(p._p)
    if runs:
        keep = runs[0]
        for r in runs[1:]:
            r._element.getparent().remove(r._element)
        keep.text = text
    else:
        ps[0].add_run(text)


# --------------------------------------------------------------------------
# 内容
# --------------------------------------------------------------------------

# 以下 17 条全部在维普（cqvip）逐条核对过刊名、年、卷、期、起止页；
# [15]-[17] 三条外文在 Crossref 按 DOI 核对。
REF_LIST = [
    '[1]孙丹妮.欧美虚拟博物馆理论与馆建述略[J].美术,2020,(06):20-26.',
    '[2]向辉,孟祥旭,杨承磊.山东大学考古数字博物馆设计与实现[J].系统仿真学报,2003,15(03):319-321.',
    '[3]曾定浩,卢威,贝佳,等.一个基于XML的虚拟博物馆场景描述语言[J].系统仿真学报,2006,18(09):2492-2496.',
    '[4]曹彤.虚拟博物馆的三维场景构造及交互漫游实现[J].计算机工程与设计,2007,28(24):6006-6007,6011.',
    '[5]李赟,刘一松,陈继明.基于WebGL的三维虚拟博物馆碰撞检测[J].软件导刊,2017,16(05):124-128.',
    '[6]任国栋,陈林华,陶学锋,等.基于Unity3D的虚拟博物馆信息可视化系统[J].计算机系统应用,'
    '2013,22(09):86-90,59.',
    '[7]马自萍,郭贝贝,李海东,等.Pano2VR的宁夏虚拟博物馆全景漫游实现[J].现代电子技术,'
    '2021,44(08):149-153.',
    '[8]裴卉宁,温志强,黄雪芹,等.融合视觉认知特征的虚拟博物馆界面布局美度评价方法[J].图学学报,'
    '2023,44(02):389-398.',
    '[9]王红,刘素仁.沉浸与叙事:新媒体影像技术下的博物馆文化沉浸式体验设计研究[J].艺术百家,'
    '2018,(04):161-169.',
    '[10]李宣,舒安琦.交互叙事视角下智慧博物馆沉浸式体验设计研究[J].包装工程,2024,45(06):461-470.',
    '[11]范浩宇,蔡新元.智慧博物馆沉浸式体验空间营造研究[J].家具与室内装饰,2023,30(09):117-123.',
    '[12]耿国华,高健,汤汶,等.文化遗产数字化保护与应用研究综述[J].西北大学学报(自然科学版),'
    '2025,55(01):1-22.',
    '[13]李洪亮,杨和平.曾侯乙编钟演奏与创编虚拟仿真实验设计与实现[J].实验室研究与探索,'
    '2022,41(10):199-205.',
    '[14]彭红,张薇.湖北省博物馆IP开发的问题和策略[J].包装工程,2019,40(18):254-258.',
    '[15]Wojciechowski R,Walczak K,White M,et al.Building virtual and augmented reality museum '
    'exhibitions[C]//Proceedings of the Ninth International Conference on 3D Web Technology.'
    'New York:ACM,2004:135-144.',
    '[16]Sylaiou S,Mania K,Karoulis A,et al.Exploring the relationship between presence and '
    'enjoyment in a virtual museum[J].International Journal of Human-Computer Studies,'
    '2010,68(05):243-253.',
    '[17]Bruno F,Bruno S,De Sensi G,et al.From 3D reconstruction to virtual reality:A complete '
    'methodology for digital archaeological exhibition[J].Journal of Cultural Heritage,'
    '2010,11(01):42-49.',
]

SCHEDULE = [
    '1.2025.06.01-2025.09.10\u2014\u2014确定毕业设计选题，然后按要求在指导老师的指导下开始毕业论文(设计)工作。',
    '2.2025.09.11-2025.10.10\u2014\u2014指导教师下发任务书，基于任务书，开始查阅论文相关文献资料和熟悉课题。',
    '3.2025.10.11-2025.10.28\u2014\u2014拟定开题报告和文献综述等，并经过论文指导老师修订完成后报院专业审查小组认可，'
    '学院毕业论文工作委员会进行审定，参与开题报告会，确定开题。',
    '4.2025.10.29-2025.12.31\u2014\u2014在指导老师指导下，围绕湖北省博物馆馆藏资源与虚拟展厅设计开展调研，'
    '收集展厅平面资料、文物图像与同类虚拟展陈案例，完成课题调研部分。',
    '5.2026.1.1-2026.1.31\u2014\u2014将资料整合，确定虚拟展厅的空间布局与视觉方案，完成主要展厅的设计与程序实现，'
    '在指导老师指导下完成论文初稿。',
    '6.2026.2.1-2026.2.15\u2014\u2014根据指导老师的修改意见，完善交互功能与展品细节，修改论文，撰写论文期中检查表。',
    '7.2026.2.16-2026.3.20\u2014\u2014根据老师的指导意见修改论文并按照湖北大学知行学院本科毕业论文文本规范修改论文格式，'
    '符合规范后，交给论文指导老师检查，基本确立论文全稿。',
    '8.2026.3.12-2026.03.31\u2014\u2014完成论文定稿,自己在维普查重，文字重复率小于20%的论文可以参加答辩，'
    '并将所有与毕业论文有关的资料交给指导老师。',
]

NO_REF_MARK = '\u3000'


# --------------------------------------------------------------------------
# 一、任务书
# --------------------------------------------------------------------------

def build_taskbook():
    d = Document(os.path.join(HERE, '1.毕业论文（设计）任务书.docx'))
    body = d.element.body
    kids = list(body.iterchildren())

    info_tbl = None
    sched_tbl = None
    for k in kids:
        if k.tag == qn('w:tbl'):
            txt = ''.join(k.itertext())
            if '题' in txt and '学    号' in txt:
                info_tbl = k
            elif '2025.06.01' in txt or '进度' in txt or '1.2025' in txt:
                sched_tbl = k
    assert info_tbl is not None and sched_tbl is not None, '没找到表格'

    # 模板
    def find_p(key, start=0):
        for i, k in enumerate(kids):
            if i < start:
                continue
            if k.tag == qn('w:p') and key in ''.join(k.itertext()):
                return k
        raise KeyError(key)

    T_DATE = find_p('下发任务书日期')
    T_BLANK = None
    for k in kids:
        if k.tag == qn('w:p') and ''.join(k.itertext()).strip() == '' and k is not T_DATE:
            T_BLANK = k
            break
    T_H1 = find_p('毕业论文（设计）的任务和要求')
    T_SUB = find_p('主要任务')
    T_BODY = find_p('本次毕业论文的主要任务是')
    T_ITEM = find_p('1、独立完成任务')
    T_OTHER = find_p('其它要求：')
    T_REFHEAD = find_p('二、应查阅的主要参考文献')
    T_REF = find_p('[1]方正')
    T_SCHEDHEAD = find_p('毕业论文（设计）进度计划')

    # 标题
    from docx.table import Table
    set_simple(Table(info_tbl, d).rows[0].cells[1], TITLE)

    # 删掉 info 表之后、进度表之前的所有段落
    started = False
    for k in kids:
        if k is info_tbl:
            started = True
            continue
        if not started:
            continue
        if k is sched_tbl:
            break
        if k.tag == qn('w:p'):
            body.remove(k)

    blocks = []
    blocks.append((T_DATE, '下发任务书日期 ：2025年09月20日'))
    blocks.append((T_BLANK, ''))
    blocks.append((T_BLANK, ''))
    blocks.append((T_H1, '毕业论文（设计）的任务和要求：'))

    blocks.append((T_SUB, '主要任务'))
    blocks.append((T_BODY,
        '本次毕业论文（设计）的主要任务是，根据学校和学院对毕业论文的有关规定和要求，在老师的安排和指导下，'
        '完成湖北省博物馆虚拟展厅的设计与实现。阅读虚拟博物馆、数字展陈设计、Web3D 实时渲染、文化遗产数字化保护等'
        '相关文献，梳理学界关于博物馆数字化展示、空间叙事与沉浸式交互体验的研究成果，吃透核心理论与前沿方法，'
        '撰写规范的开题报告。开展实地调研与案例搜集工作，深入挖掘湖北省博物馆曾侯乙编钟、越王勾践剑、曾侯乙尊盘等'
        '代表性馆藏的历史背景、器物形制、纹饰特征与色彩体系，收集国内外虚拟博物馆、线上展厅与数字文创案例及其'
        '用户体验反馈资料，运用空间设计、交互设计、视觉传达设计等专业理论与方法，对资料信息进行系统梳理与深度剖析，'
        '明晰虚拟展厅在文化传播与审美体验方面的核心价值，总结现有虚拟展厅普遍存在的建模粗糙、动线混乱、交互单薄、'
        '沉浸感不足等问题，结合本项目的功能定位，构建“空间叙事 + 视觉转译 + 实时交互”的设计路径，'
        '提出针对性的优化策略与实践方案。'))
    blocks.append((T_BODY,
        '本次毕业设计将完成一套可在浏览器与桌面端运行的湖北省博物馆虚拟展厅作品：以序厅、长廊、曾侯乙墓展厅、'
        '青铜器展厅、陶瓷展厅、楚文化展厅与编钟厅组成约 48 m × 80 m 的展陈空间，按照“震撼—朝圣—升华—理性—'
        '浪漫—沉淀”的情绪曲线组织参观动线；实现第一人称/第三人称漫游、跳跃与碰撞检测、展品检视与观察模式、'
        '小地图导航、语音朗读、抽签与猜谜互动小游戏、程序化生成贴图与背景音乐等功能；'
        '并使用 Electron 将网页应用封装为免安装的桌面程序。在此基础上完成毕业论文的撰写，'
        '对调研过程、设计方案、技术实现与测试结果进行系统总结。'))

    blocks.append((T_SUB, '主要目标'))
    blocks.append((T_BODY,
        '本次毕业论文的主要目标是，通过对湖北省博物馆虚拟展厅的设计与实现，将所学的空间设计理论、交互设计方法、'
        '三维可视化技术运用于实际项目开发中，提升文化遗产调研、视觉元素提炼、方案创新落地与工程实现的综合能力，'
        '培养传统文化与数字技术融合的创新思维，掌握学术论文写作的规范流程与核心方法，圆满完成毕业论文各阶段学习任务，'
        '最终撰写出符合院校要求、兼具学术性与实践性的合格毕业论文。'))

    blocks.append((T_SUB, '基本要求'))
    blocks.append((T_BODY,
        '论文撰写要求思路清晰、内容充实、论点明确、论据充分、语言通顺、逻辑严谨。撰写论文前应系统研读虚拟博物馆、'
        '数字展陈、Web3D 交互与文化遗产数字化等领域的研究资料，精准把握湖北省博物馆馆藏的文化内核与楚文化的视觉特征，'
        '紧跟数字博物馆、沉浸式体验设计的前沿动态，夯实专业理论功底，提升论文的文化深度与学术水平。'
        '设计实践要求空间布局与参观动线合理、器物比例准确、材质与光影统一、界面清晰易用，'
        '展品陈列不穿模、不闪烁，交互反馈及时，并能在普通配置的电脑上流畅运行。'
        '根据开题报告框架、中期检查意见及指导老师的修改建议，反复打磨论文内容、完善设计方案、规范论证逻辑，'
        '严格遵照论文进度安排推进写作、修改与定稿工作，按时参加毕业论文开题答辩、中期考核与最终答辩。'
        '论文的格式规范、字数要求、参考文献标注、图表排版等撰写细节，严格参照学校本科毕业论文格式标准执行，'
        '确保论文体例规范、内容完整、贴合专业培养目标。'))

    blocks.append((T_SUB, ' 其他要求'))
    for s in ['1、独立完成任务；', '2、完成开题报告；', '3、设计报告、论文格式需符合规范；',
              '4、学会查找10篇以上有关文献，其中外文资料至少2篇；', '5、题目一般不超过20个字；',
              '6、中文摘要300汉字左右，外文摘要约250个实词左右。']:
        blocks.append((T_ITEM, s))

    blocks.append((T_OTHER, '其它要求：'))
    for s in ['1、独立完成任务；', '2、完成开题报告；', '3、设计报告、论文格式需符合规范；',
              '4、学会查找10篇以上有关文献，其中外文资料至少2篇；', '5、题目一般不超过20个字；',
              '6、中文摘要300汉字左右，外文摘要约250个实词左右；']:
        blocks.append((T_ITEM, s))

    blocks.append((T_REFHEAD, '二、应查阅的主要参考文献：'))
    for r in REF_LIST:
        blocks.append((T_REF, r))

    blocks.append((T_SCHEDHEAD, '毕业论文（设计）进度计划'))

    insert_seq(sched_tbl, blocks)

    # 进度表
    scell = [c for c in sched_tbl.iter(qn('w:tc'))][0]
    ps = scell.findall(qn('w:p'))
    tmpl = ps[0]
    for p in ps:
        scell.remove(p)
    prev = None
    for s in SCHEDULE:
        newp = make_par(tmpl, s)
        if prev is None:
            scell.append(newp)
        else:
            prev.addnext(newp)
        prev = newp

    out = os.path.join(OUT_DIR, '任务书.docx')
    d.save(out)
    print('saved:', out)


# --------------------------------------------------------------------------
# 二、开题报告
# --------------------------------------------------------------------------

def build_proposal():
    d = Document(os.path.join(HERE, '2.毕业论文（设计）开题报告.docx'))
    body = d.element.body

    info_tbl = None
    big_tbl = None
    for tbl in body.iter(qn('w:tbl')):
        txt = ''.join(tbl.itertext())
        if '题' in txt and '学    号' in txt:
            info_tbl = tbl
        elif '本课题的研究目的及意义' in txt:
            big_tbl = tbl
    assert info_tbl is not None and big_tbl is not None

    from docx.table import Table
    tinfo = Table(info_tbl, d)
    set_simple(tinfo.rows[0].cells[1], TITLE)

    tbig = Table(big_tbl, d)
    rows = tbig.rows

    # 模板
    c0 = rows[0].cells[0]
    T_HEAD = c0.paragraphs[0]._p          # 无缩进小节标题
    T_BODY = c0.paragraphs[1]._p          # 首行缩进正文
    c2 = rows[2].cells[0]
    T_SUBHEAD = c2.paragraphs[1]._p       # 研究内容里的条目：用正文模板即可
    c4 = rows[4].cells[0]
    T_REF = c4.paragraphs[1]._p

    # ---------- 1 研究目的及意义 ----------
    fill_cell(rows[0].cells[0], [
        (T_HEAD, '1．本课题的研究目的及意义'),
        (T_BODY, '研究目的：通过梳理湖北省博物馆馆藏资源的文化内涵、艺术特征与视觉体系，'
                 '提炼曾侯乙编钟、越王勾践剑、曾侯乙尊盘等代表性文物的造型语言与文化符号，'
                 '基于现代设计理念与实时三维渲染技术，构建“空间叙事—视觉转译—实时交互”相结合的虚拟展厅设计方法，'
                 '形成从文化调研、元素提取到数字化展示落地的完整设计路径。'),
        (T_BODY, '（一）对湖北省博物馆代表性馆藏的历史背景、器物形制、纹饰特征与色彩体系进行系统梳理与归纳[14]，'
                 '建立清晰的展品视觉档案，为虚拟展厅的空间营造、展品建模与氛围设计提供依据与素材库。'),
        (T_BODY, '（二）通过对国内外虚拟博物馆、线上展厅与数字文创案例的分析，总结其在空间组织、'
                 '视觉表现与交互方式上的成功经验，找出现有作品普遍存在的建模粗糙、动线混乱、交互单薄、'
                 '沉浸感不足等问题，探索适合本项目的设计策略。'),
        (T_BODY, '（三）完成一套可运行的湖北省博物馆虚拟展厅作品，将设计构思转化为可视、可行走、可交互的数字空间，'
                 '验证设计方案在实际体验中的可行性。'),
        (T_BODY, '研究意义：'),
        (T_BODY, '（一）文化传承意义：湖北省博物馆是楚文化的重要载体，曾侯乙编钟、越王勾践剑等文物承载着先秦时期的'
                 '礼乐制度、青铜铸造工艺与审美观念。研究通过数字化手段重建文物的形态与空间语境，'
                 '打破实体展厅在时间与地理上的限制，让更多人能够“走进”博物馆，'
                 '为地域文化的当代传播与可持续传承提供新路径，增强文化认同与文化自信。'),
        (T_BODY, '（二）设计创新意义：突破传统图文展板式的单向展示模式，探索空间叙事、光影氛围与交互反馈'
                 '在数字展陈中的结合方式，为虚拟展厅的视觉语言与体验设计提供可参考的样本，'
                 '推动传统艺术元素与地域文化符号在数字媒介中的创新表达。'),
        (T_BODY, '（三）技术实践意义：项目采用开源实时渲染引擎与程序化生成技术，在不依赖大规模美术资产与'
                 '商业引擎授权的前提下完成完整展厅的搭建与打包发布，其技术路线对同类中小型数字展陈项目'
                 '具有借鉴价值，也为博物馆数字化展示的轻量化实现提供了实践参考。'),
    ])

    # ---------- 2 研究现状 ----------
    fill_cell(rows[1].cells[0], [
        (T_HEAD, '2．已了解的本课题国内外研究现状'),
        (T_BODY, '国内现状'),
        (T_BODY, '（一）理论研究：国内学者对虚拟博物馆与数字展陈的研究大致沿两条线索展开。'
                 '一是技术实现线索：早期工作围绕三维场景描述语言与场景组织方式展开[3]，'
                 '随后转向浏览器端实时渲染下的场景构造与交互漫游[4]、WebGL 环境中的碰撞检测[5]，'
                 '以及基于 Unity3D 的信息可视化[6]与基于 Pano2VR 的全景漫游[7]等实现方案。'
                 '二是设计研究线索：研究者从视觉认知与界面布局美度[8]、沉浸式体验的空间营造[9-11]'
                 '等角度讨论数字展陈的观看经验，普遍认为虚拟展厅的核心价值不只是“把展品搬到网上”，'
                 '而在于重建观看的情境与叙事逻辑；同时指出当前部分作品存在重技术轻内容、重还原轻体验、'
                 '界面与交互割裂等问题，强调交互方式必须与内容逻辑相匹配。在文化遗产数字化方面，'
                 '已有综述系统梳理了从数字化采集、三维重建、知识组织到展示应用的完整技术链条[12]。'),
        (T_BODY, '（二）设计实践：国内故宫博物院、敦煌研究院、上海博物馆等机构先后推出了数字全景漫游、'
                 '高精度三维文物浏览与线上特展，形成了较为成熟的呈现方式，在文物数字化采集与虚拟展示方面'
                 '积累了丰富经验；针对具体馆藏的数字化实践也已出现，如编钟类乐器的虚拟仿真演奏与创编实验[13]、'
                 '以及围绕湖北省博物馆馆藏 IP 的开发研究[14]。但整体来看，知名大馆的数字化程度较高，'
                 '地方性专题展陈与中小博物馆的虚拟化仍然薄弱，多采用全景照片拼接的方式呈现，'
                 '缺少可自由漫游的真实三维空间，也缺少与馆藏内容深度结合的互动环节。'),
        (T_BODY, '国外现状：'),
        (T_BODY, '国外对虚拟博物馆的研究与实践起步较早，卢浮宫、大英博物馆、史密森学会等机构较早开展了'
                 '藏品数字化与虚拟展厅建设，在元数据组织、展示规范与数字资源长期保存方面积累了经验，'
                 '相关理论与馆建经验已有较为系统的梳理[1]。在工程实现方面，有研究提出了基于 Web3D 技术'
                 '构建虚拟与增强现实博物馆展览的总体方案[15]，以及从三维重建到虚拟展示的完整方法论[17]；'
                 '在体验研究方面，有研究通过实验考察了虚拟环境中“临场感”与体验愉悦度之间的关系，'
                 '认为空间感、可操控性与内容深度共同影响用户的沉浸体验[16]。'
                 '这些成果为本课题在渲染流程、交互方式与体验评价方面提供了参考。总体来看，'
                 '国外研究在用户体验测评与研究方法上较为成熟，但针对中国地域文化与中国具体馆藏的空间叙事研究较少，'
                 '面向楚文化的虚拟展厅设计仍有较大的探索空间。'),
    ])

    # ---------- 研究内容 ----------
    outline = [
        '绪论',
        '一 虚拟展厅相关概念与设计基础',
        '（一）虚拟博物馆与数字展陈',
        '（二）实时渲染与 Web3D 技术',
        '（三）沉浸式体验与空间叙事',
        '二 湖北省博物馆馆藏资源的梳理与转译',
        '（一）馆藏资源与展厅主题的提取',
        '（二）楚文化视觉符号与色彩体系的转译',
        '（三）参观动线与空间氛围的编排',
        '三 虚拟展厅的总体设计',
        '（一）设计目标与功能需求',
        '（二）各展厅的空间布局与形态',
        '（三）视觉风格、材质与光影表现',
        '（四）交互方式与界面设计',
        '四 虚拟展厅的关键实现',
        '（一）场景搭建与程序化贴图生成',
        '（二）第一人称/第三人称漫游与碰撞检测',
        '（三）人物模型加载与动画驱动',
        '（四）展品检视、观察模式与信息展板',
        '（五）小地图、语音朗读与互动小游戏',
        '（六）程序化背景音乐与音效',
        '（七）Electron 桌面端封装与打包',
        '五 系统测试与设计评估',
        '（一）功能与兼容性测试',
        '（二）性能测试与可达性验证',
        '（三）用户体验评估与优化',
        '结论',
        '参考文献',
    ]
    blocks = [(T_HEAD, '本课题的研究内容')]
    for s in outline:
        blocks.append((T_BODY, s))
    fill_cell(rows[2].cells[0], blocks)

    # ---------- 实施方案、进度安排 ----------
    blocks = [(T_HEAD, '本课题研究的实施方案、进度安排')]
    for s in SCHEDULE:
        blocks.append((T_BODY, s))
    blocks.append((T_BODY, '本课题采用“文献调研—方案设计—程序实现—测试评估”的实施方案。'
                           '前期以文献研读与实地调研为主，明确设计定位；中期完成空间布局、'
                           '视觉风格与技术选型，并按模块实现漫游、交互与展陈功能；'
                           '后期通过功能测试、性能测试与用户体验反馈迭代优化，最终整理成文。'))
    fill_cell(rows[3].cells[0], blocks)

    # ---------- 参考文献 ----------
    blocks = [(T_HEAD, '已查阅的主要参考文献')]
    for r in REF_LIST:
        blocks.append((T_REF, r))
    fill_cell(rows[4].cells[0], blocks)

    out = os.path.join(OUT_DIR, '开题报告.docx')
    d.save(out)
    print('saved:', out)


if __name__ == '__main__':
    build_taskbook()
    build_proposal()
