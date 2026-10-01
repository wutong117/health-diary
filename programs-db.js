/* programs-db.js — 训练方法库 + 有氧方案库
 *
 * 内容说明：这里收录的是**训练方法本身**（结构、组数次数、强度、渐进超负荷规则、
 * 减载与周期化）—— 方法与参数属事实性内容，本文件的中文描述为自行整理撰写，
 * 不摘录任何书籍或网站原文。每一条都标注来源便于核对。
 *
 * kind 取值：
 *   program    完整计划体系，可「一键套用」生成计划（带 days 模板）
 *   technique  训练技巧/强度手法，只能作为说明与执行提示（不能生成计划）
 *   period     周期化/长期策略
 *   lose       减脂期安排
 *
 * 字段：id / name / en / kind / level / daysPerWeek / weeks / scheme / intensity /
 *       progression（渐进超负荷怎么做，这是本模块的核心）/ why / cautions / source / days
 */
(function (global) {
  'use strict';

  /* ---------- 完整计划体系（可一键套用） ---------- */
  var PROGRAMS = [
    {
      id: 'sl5x5', name: 'StrongLifts 5×5', en: 'StrongLifts 5x5', kind: 'program',
      level: '新手', daysPerWeek: 3, weeks: 12, minutes: 45,
      scheme: '全身 A/B 交替，每个动作 5 组 × 5 次（硬拉 1 组 × 5）',
      intensity: '约 70–80% 1RM，从空杠开始逐次加重',
      progression: '**每次训练**只要完成 5×5 就加 2.5 kg；同一重量连续 3 次失败 → 减重 10% 重新爬升。深蹲每次训练都练。',
      why: '新手线性期增长最快，规则简单到不需要思考，适合完全没经验的人起步。',
      cautions: '后期（约 8–12 周）会越来越重，需要转成 Weekly 或双进阶；下肢日强度大，减脂期容易恢复不过来。',
      source: 'Mehdi（StrongLifts 官方 FAQ）',
      days: [
        { name: 'A 日', items: [['squat', 5, 5, 5, 20], ['bench_press', 5, 5, 5, 20], ['barbell_row', 5, 5, 5, 30]] },
        { name: 'B 日', items: [['squat', 5, 5, 5, 20], ['ohp', 5, 5, 5, 15], ['deadlift', 1, 5, 5, 40]] }
      ],
      weekly: '周一 A / 周三 B / 周五 A，下周 B-A-B 交替'
    },
    {
      id: 'ss_lp', name: 'Starting Strength 线性计划', en: 'Starting Strength LP', kind: 'program',
      level: '新手', daysPerWeek: 3, weeks: 16, minutes: 50,
      scheme: '全身 A/B，3 组 × 5 次（硬拉 1 组 × 5）',
      intensity: '工作重量，接近但不到力竭',
      progression: '每次训练动作 +2.5 kg（硬拉早期可 +5 kg）；连续 2 次失败 → 减 10% 重来；后期转为每周或每月加重。',
      why: '以复合动作为核心，把"线性加重量"做到极致，是经典的新手入门体系。',
      cautions: '需要规范的动作技术（深蹲/硬拉/推举），最好有人看动作；不吃饱很难持续加重量。',
      source: 'Mark Rippetoe《Starting Strength》',
      days: [
        { name: 'A 日', items: [['squat', 3, 5, 5, 20], ['bench_press', 3, 5, 5, 20], ['deadlift', 1, 5, 5, 40]] },
        { name: 'B 日', items: [['squat', 3, 5, 5, 20], ['ohp', 3, 5, 5, 15], ['barbell_row', 3, 5, 5, 30]] }
      ],
      weekly: '周一 A / 周三 B / 周五 A，交替进行'
    },
    {
      id: 'greyskull', name: 'Greyskull LP', en: 'Greyskull LP', kind: 'program',
      level: '新手', daysPerWeek: 3, weeks: 12, minutes: 45,
      scheme: '每个动作 2 组 × 5 次 + 第 3 组 AMRAP（做到力竭）',
      intensity: '工作重量，末组全力',
      progression: '成功即加重（上肢 +1.25 kg、下肢 +2.5 kg）；**末组 AMRAP 做到 10 次以上就翻倍加重**；失败 → 减 10%。AMRAP 让进度可视化。',
      why: '在 5×5 的基础上用 AMRAP 解决"卡重量"的问题，重量推进更平滑。',
      cautions: 'AMRAP 组很累，注意动作变形；单次训练时间会略长。',
      source: 'John Sheaffer / Phrak',
      days: [
        { name: 'A 日', items: [['bench_press', 3, 5, 5, 20], ['barbell_row', 3, 5, 5, 30], ['squat', 3, 5, 5, 20]] },
        { name: 'B 日', items: [['ohp', 3, 5, 5, 15], ['lat_pulldown', 3, 5, 10, 30], ['deadlift', 1, 5, 5, 40]] }
      ],
      weekly: '周一 A / 周三 B / 周五 A（或按 3 天轮换）'
    },
    {
      id: 'gzclp', name: 'GZCLP', en: 'GZCLP', kind: 'program',
      level: '新手', daysPerWeek: 3, weeks: 12, minutes: 55,
      scheme: 'T1 主项 5×3+ → 6×2 → 10×1（三阶段）；T2 3×10 → 3×8 → 3×6；T3 3×15+',
      intensity: 'T1 接近极限，T2 中等，T3 轻重量高次数',
      progression: '完成全部组次就加重（上半身 +2.5 kg、下半身 +5 kg）；某个阶段失败就退到下一阶段（次数减少、组数增加）；三阶段全败 → 该动作减 10% 重启。',
      why: '把"加重量"和"加次数/组数"两条路结合起来，比单纯 5×5 更能持续进步，而且练到全身。',
      cautions: '结构比 5×5 复杂，要理解 T1/T2/T3 的区别；T3 高次数很磨人。',
      source: 'Cody Lefever（GZCL 体系）',
      days: [
        { name: 'A1', items: [['squat', 5, 3, 3, 40], ['bench_press', 3, 10, 10, 20], ['lat_pulldown', 3, 15, 15, 25]] },
        { name: 'A2', items: [['ohp', 5, 3, 3, 15], ['deadlift', 3, 10, 10, 40], ['db_row', 3, 15, 15, 8]] },
        { name: 'B1', items: [['deadlift', 5, 3, 3, 50], ['ohp', 3, 10, 10, 12], ['lat_pulldown', 3, 15, 15, 25]] },
        { name: 'B2', items: [['bench_press', 5, 3, 3, 20], ['squat', 3, 10, 10, 30], ['barbell_row', 3, 15, 15, 20]] }
      ],
      weekly: '周一 A1 / 周三 A2 / 周五 B1，下周 B2-A1-A2 轮换'
    },
    {
      id: 'wendler531', name: '5/3/1（Wendler）', en: "Wendler 5/3/1", kind: 'program',
      level: '中级', daysPerWeek: 4, weeks: 16, minutes: 60,
      scheme: '每周一个主项，4 天：推举/硬拉/卧推/深蹲。周内 3 组：65/75/85% → 70/80/90% → 75/85/95%，末组 AMRAP',
      intensity: '以训练上限 TM（= 90% 1RM）为基准算百分比',
      progression: '**每 4 周一个循环结束**，卧推/推举 +2.5 kg、深蹲/硬拉 +5 kg；第 4 周减载（重量降回 40–60%）。',
      why: '慢而稳、极其可持续，适合已经过了新手期、想长期练下去的人。',
      cautions: '单次训练量不大，想增肌要另配辅助（如 BBB 5×10）；AMRAP 末组不要做到动作变形。',
      source: 'Jim Wendler《5/3/1》',
      days: [
        { name: '推举日', items: [['ohp', 3, 5, 5, 15], ['lat_pulldown', 5, 10, 10, 25]] },
        { name: '硬拉日', items: [['deadlift', 3, 5, 5, 40], ['leg_press', 5, 10, 10, 60]] },
        { name: '卧推日', items: [['bench_press', 3, 5, 5, 20], ['db_row', 5, 10, 10, 8]] },
        { name: '深蹲日', items: [['squat', 3, 5, 5, 30], ['leg_curl', 5, 10, 10, 25]] }
      ],
      weekly: '周一推举 / 周二硬拉 / 周四卧推 / 周五深蹲，第 4 周减载'
    },
    {
      id: 'nsuns', name: 'nSuns 5/3/1 LP', en: 'nSuns 531 LP', kind: 'program',
      level: '中级', daysPerWeek: 5, weeks: 16, minutes: 75,
      scheme: '每天一个 T1 主项 9 组（5/3/1 加回降）+ 一个 T2 辅助 8 组',
      intensity: 'T1 高强度带 AMRAP，T2 50–70%',
      progression: '末组 AMRAP 次数决定加重：做到 2–3 次 +2.5 kg，4–5 次 +5 kg，6 次以上 +7.5 kg；只做 1 次则 1RM 估值下调 10%。',
      why: '训练量很大、进步快，AMRAP 的反馈非常直接。适合时间充裕的中级训练者。',
      cautions: '**量非常大**（每天 17 组主项），减脂期或睡眠不足时很难恢复；单次 75–90 分钟。',
      source: '/u/nSuns（Reddit）',
      days: [
        { name: '卧推日', items: [['bench_press', 9, 3, 5, 20], ['ohp', 8, 5, 8, 12]] },
        { name: '深蹲日', items: [['squat', 9, 3, 5, 40], ['leg_press', 8, 5, 8, 60]] },
        { name: '推举日', items: [['ohp', 9, 3, 5, 15], ['incline_bench', 8, 5, 8, 20]] },
        { name: '硬拉日', items: [['deadlift', 9, 3, 5, 50], ['front_squat', 8, 5, 8, 25]] },
        { name: '辅助日', items: [['barbell_row', 8, 5, 8, 30], ['lat_pulldown', 6, 8, 12, 30], ['barbell_curl', 4, 8, 12, 15]] }
      ],
      weekly: '周一卧推 / 周二深蹲 / 周四推举 / 周五硬拉 / 周六辅助'
    },
    {
      id: 'phul', name: 'PHUL（力量+增肌）', en: 'PHUL', kind: 'program',
      level: '新手–中级', daysPerWeek: 4, weeks: 12, minutes: 70,
      scheme: '上下肢各分"力量日"和"增肌日"：力量 3–5 组 × 3–5 次；增肌 3–4 组 × 8–12 次',
      intensity: '力量日 80–90%，增肌日 65–75%',
      progression: '双进阶：先把次数做到区间上限，再加重量并回到区间下限。',
      why: '同时兼顾力量和围度，一周 4 天比较好排，是很多人长期在用的结构。',
      cautions: '70 分钟以上、动作多，需要一定执行力；力量日强度高，别和有氧硬凑一起。',
      source: '社区通行版本（Power Hypertrophy Upper Lower）',
      days: [
        { name: '上肢力量', items: [['bench_press', 4, 3, 5, 25], ['barbell_row', 4, 3, 5, 30], ['ohp', 3, 5, 8, 15]] },
        { name: '下肢力量', items: [['squat', 4, 3, 5, 40], ['deadlift', 3, 3, 5, 50], ['leg_press', 3, 8, 10, 60]] },
        { name: '上肢增肌', items: [['incline_bench', 4, 8, 12, 15], ['lat_pulldown', 4, 8, 12, 25], ['lateral_raise', 3, 12, 15, 6]] },
        { name: '下肢增肌', items: [['front_squat', 3, 8, 12, 20], ['leg_curl', 4, 10, 15, 25], ['calf_raise', 4, 12, 15, 30]] }
      ],
      weekly: '周一上肢力量 / 周二下肢力量 / 周四上肢增肌 / 周五下肢增肌'
    },
    {
      id: 'ppl', name: '推拉腿（PPL）', en: 'Push Pull Legs', kind: 'program',
      level: '新手–中级', daysPerWeek: 6, weeks: 12, minutes: 60,
      scheme: '推（胸肩三头）/ 拉（背二头）/ 腿，各 5–6 个动作，主项 3–5 组 × 5–8，孤立 3 组 × 10–15',
      intensity: '主项 75–85%，孤立 60–70%',
      progression: '主项双进阶（先加次数再加重量）；孤立动作到次数上限就加重 1–2.5 kg。',
      why: '每块肌肉一周练两次、恢复安排自然，是增肌最常用的结构。',
      cautions: '一周 6 天对时间要求高；可先做 3 天（推拉腿各一次）。',
      source: '社区通行版本',
      days: [
        { name: '推', items: [['bench_press', 4, 6, 8, 25], ['ohp', 3, 6, 10, 15], ['db_press', 3, 8, 12, 12], ['triceps_pushdown', 3, 10, 15, 20]] },
        { name: '拉', items: [['barbell_row', 4, 6, 8, 30], ['lat_pulldown', 4, 8, 12, 30], ['face_pull', 3, 12, 15, 15], ['barbell_curl', 3, 10, 12, 15]] },
        { name: '腿', items: [['squat', 4, 6, 8, 40], ['romanian_dl', 3, 8, 10, 40], ['leg_press', 3, 10, 12, 60], ['calf_raise', 4, 12, 15, 30]] }
      ],
      weekly: '周一推 / 周二拉 / 周三腿 / 周四推 / 周五拉 / 周六腿'
    },
    {
      id: 'ul4', name: '上下肢 4 日', en: 'Upper/Lower 4x', kind: 'program',
      level: '新手–中级', daysPerWeek: 4, weeks: 12, minutes: 65,
      scheme: '上肢 A/B + 下肢 A/B，每个动作 3–4 组 × 6–10 次',
      intensity: '70–80%',
      progression: '双进阶；下肢动作步进 5 kg、上肢 2.5 kg。',
      why: '一周 4 天是最容易长期坚持的频率，上下肢交替给足恢复。',
      cautions: '动作选择要覆盖推/拉/蹲/髋四种模式，别只练喜欢的。',
      source: '社区通行版本',
      days: [
        { name: '上肢 A', items: [['bench_press', 4, 6, 8, 25], ['lat_pulldown', 4, 8, 10, 30], ['db_shoulder_press', 3, 8, 12, 12], ['barbell_curl', 3, 10, 12, 15]] },
        { name: '下肢 A', items: [['squat', 4, 6, 8, 40], ['romanian_dl', 3, 8, 10, 40], ['leg_curl', 3, 10, 12, 25], ['calf_raise', 4, 12, 15, 30]] },
        { name: '上肢 B', items: [['barbell_row', 4, 6, 8, 30], ['incline_bench', 3, 8, 12, 20], ['face_pull', 3, 12, 15, 15], ['triceps_pushdown', 3, 10, 15, 20]] },
        { name: '下肢 B', items: [['deadlift', 3, 5, 5, 45], ['leg_press', 3, 10, 12, 60], ['lunge', 3, 10, 12, 12], ['plank', 3, 30, 60, 0]] }
      ],
      weekly: '周一上肢A / 周二下肢A / 周四上肢B / 周五下肢B'
    },
    {
      id: 'texas', name: '德州法（Texas Method）', en: 'Texas Method', kind: 'program',
      level: '中级', daysPerWeek: 3, weeks: 12, minutes: 70,
      scheme: '周一容量日 5×5 约 77%、周三恢复日 2×5 约 62%、周五强度日 1×5 冲 PR',
      intensity: '周内波动，周三特意轻',
      progression: '**每周五刷个人记录**，成功后把周一的 5×5 重量 +2.5 kg，周三按比例上调。',
      why: '用"量—恢复—强度"的三段结构把新手线性计划延续到中级阶段。',
      cautions: '周一 5×5 很累，减脂期容易崩；需要严格睡眠与进食。',
      source: 'Rippetoe / Pendlay',
      days: [
        { name: '容量日', items: [['squat', 5, 5, 5, 40], ['bench_press', 5, 5, 5, 25], ['deadlift', 1, 5, 5, 50]] },
        { name: '恢复日', items: [['squat', 2, 5, 5, 25], ['ohp', 3, 5, 5, 12], ['lat_pulldown', 3, 8, 10, 25]] },
        { name: '强度日', items: [['squat', 1, 5, 5, 50], ['bench_press', 1, 5, 5, 30], ['barbell_row', 3, 5, 5, 30]] }
      ],
      weekly: '周一容量 / 周三恢复 / 周五强度'
    },
    {
      id: 'gvt', name: '德国容量训练 GVT 10×10', en: 'German Volume Training', kind: 'program',
      level: '中级', daysPerWeek: 4, weeks: 6, minutes: 60,
      scheme: '每个动作 10 组 × 10 次，组间 60–90 秒，用约 60% 1RM',
      intensity: '60% 1RM（很轻但组数极多）',
      progression: '能完整做完 10×10 就加重（常见 +2–5%）；也可以加组或加次数。',
      why: '用极大训练量冲击围度，短期（6 周）增肌效果明显。',
      cautions: '**恢复压力极大**，一周 4 次已是上限；不适合减脂期或睡眠不足的人；关节负担大。',
      source: 'Charles Poliquin / Charles Feser 推广',
      days: [
        { name: '胸背', items: [['bench_press', 10, 10, 10, 20], ['barbell_row', 10, 10, 10, 20]] },
        { name: '腿臀', items: [['squat', 10, 10, 10, 30], ['romanian_dl', 10, 10, 10, 30]] },
        { name: '肩臂', items: [['db_shoulder_press', 10, 10, 10, 8], ['lat_pulldown', 10, 10, 10, 20]] },
        { name: '腿+核心', items: [['leg_press', 10, 10, 10, 50], ['leg_curl', 10, 10, 10, 20]] }
      ],
      weekly: '周一胸背 / 周二腿臀 / 周四肩臂 / 周五腿核心'
    },
    {
      id: 'fullbody3', name: '全身 3 日', en: 'Full Body 3x', kind: 'program',
      level: '新手', daysPerWeek: 3, weeks: 12, minutes: 50,
      scheme: '每次练全身，每个动作 3 组 × 5–8 次，覆盖蹲/推/拉/髋',
      intensity: '70–80%',
      progression: '每次或每周线性加重（上肢 2.5 kg、下肢 5 kg），做不到就保持重量加次数。',
      why: '频率高、每次都能练到所有动作模式，新手学动作最快；时间要求也最低。',
      cautions: '单次训练量有限，进阶后需要分化；深蹲/硬拉同日要控制总量。',
      source: '社区通行版本',
      days: [
        { name: '全身 A', items: [['squat', 3, 5, 8, 35], ['bench_press', 3, 5, 8, 20], ['barbell_row', 3, 8, 10, 30], ['plank', 3, 30, 60, 0]] },
        { name: '全身 B', items: [['deadlift', 3, 5, 5, 45], ['ohp', 3, 6, 10, 12], ['lat_pulldown', 3, 8, 12, 25], ['crunch', 3, 12, 20, 0]] },
        { name: '全身 C', items: [['leg_press', 3, 10, 12, 60], ['incline_bench', 3, 8, 12, 20], ['seated_row', 3, 8, 12, 30], ['back_extension', 3, 12, 15, 0]] }
      ],
      weekly: '周一全身 A / 周三全身 B / 周五全身 C'
    }
  ];

  /* ---------- 训练技巧（强度手法，不能生成计划） ---------- */
  var TECHNIQUES = [
    { id: 'dropset', name: '递减组 Drop Set', en: 'Drop Set', schedule: '最后一组力竭后，立刻减重 20–30% 继续做到力竭（可连做 2–3 次递减）',
      progression: '能完成预设的递减次数 → 下次加重首组', why: '在很短时间内堆高训练量，省时间。', cautions: '很累，不适合每个动作都用；建议只用在最后 1–2 个孤立动作。', source: '传统健美训练法' },
    { id: 'restpause', name: '休息-暂停组 Rest-Pause', en: 'Rest-Pause', schedule: '力竭后休息 15–20 秒，再补 2–5 次，重复 2–3 轮',
      progression: '同一重量下总次数增加 → 下次加重', why: '延长力竭前的有效次数，时间效率高。', cautions: '神经消耗大，每周最多对 1–2 个动作使用。', source: 'Dante Trudel（DC 训练）' },
    { id: 'myoreps', name: 'Myo-reps', en: 'Myo-reps', schedule: '激活组做到接近力竭（12–20 次），然后每休息 5–10 秒做 3–5 次迷你组，共 3–5 轮',
      progression: '迷你组总次数到达上限 → 加重', why: '用较少的疲劳获得接近最大有效训练量。', cautions: '激活组必须接近力竭才有效；总组数别失控。', source: 'Borge Fagerli' },
    { id: 'cluster', name: '集群组 Cluster Set', en: 'Cluster Set', schedule: '3–5 组 × 1–3 次，组内每 1–3 次就休息 15–30 秒',
      progression: '次数或重量到达目标 → 加负荷', why: '在保持动作质量的前提下用更重的重量完成更多次数。', cautions: '组内休息要计时，否则变成普通组。', source: '力量举常用方法' },
    { id: 'reverse_pyramid', name: '反向金字塔', en: 'Reverse Pyramid', schedule: '第一组最重（约 6 次 RPE 9），之后每组减重约 10%、多做 2 次',
      progression: '首组重量或次数进阶', why: '在体力最好时做最重的组，动作质量最高。', cautions: '需要准确的热身，第一组就上大重量有风险。', source: '社区通行版本' },
    { id: 'pyramid', name: '金字塔组', en: 'Pyramid Set', schedule: '重量递增（次数递减）或重量递减（次数递增）逐组变化',
      progression: '顶组重量进阶', why: '兼顾大重量与技术练习，热身与正式组合二为一。', cautions: '组数多、时间较长。', source: '传统训练法' },
    { id: 'superset', name: '超级组 / 巨型组', en: 'Superset / Giant Set', schedule: '2 个（超级组）或 3–4 个（巨型组）动作连续做完再休息',
      progression: '增加重量或缩短组间休息', why: '省时间、提高训练密度。', cautions: '会降低每个动作的最大重量，别把主项放进去；心肺负担大。', source: '传统训练法' },
    { id: 'emom', name: 'EMOM（每分钟一组）', en: 'EMOM', schedule: '每分钟开始做一组，做完剩下时间休息，持续 8–20 分钟',
      progression: '轻松完成 → 加重；或缩短总时长', why: '把休息时间标准化，训练节奏清晰。', cautions: '重量选不好会越做越慢，最后变成纯心肺。', source: 'CrossFit 体系' },
    { id: 'amrap', name: 'AMRAP（限时做最多次数）', en: 'AMRAP', schedule: '在固定时间内（如 5 分钟）用标准动作做尽可能多的次数',
      progression: '同时间内总次数增加 → 加重', why: '进度可量化、有挑战感。', cautions: '时间压力下容易动作变形，要先保证质量。', source: 'CrossFit 体系' },
    { id: 'density', name: '递增密度训练 EDT', en: 'Escalating Density Training', schedule: '在 15 分钟窗口内，两个动作交替，尽量多做总次数',
      progression: '**同时间内总次数↑** 或 同次数用时↓', why: '用"密度"代替"重量"作为进阶指标，很适合减脂期。', cautions: '需要记录总次数，否则无法进阶。', source: 'Charles Staley' },
    { id: 'rpe', name: '自动调节 RPE', en: 'Autoregulation / RPE', schedule: '按当天状态选重量：目标 RPE 8 = 还能再做 2 次',
      progression: '同一 RPE 下重量上升，或同重量下 RPE 下降', why: '状态好坏自动调节负荷，避免"计划写着做不动"。', cautions: '需要一段时间才能准确判断 RPE；新手容易高估自己。', source: 'Mike Tuchscherer' },
    { id: 'deload', name: '减载周 Deload', en: 'Deload', schedule: '每 4–8 周或感觉明显疲劳时：训练量减 40–60%，或强度降 10–20%',
      progression: '不是超负荷，而是为了之后能继续超负荷', why: '消化累积疲劳，避免停滞与伤病。', cautions: '减载周不要偷偷加练；它不是"休息一周什么都不做"，而是降低量保留动作模式。', source: '通行做法（5/3/1、Sheiko 等体系均含）' }
  ];

  /* ---------- 周期化策略 ---------- */
  var PERIODIZATION = [
    { id: 'linear', name: '线性周期化', en: 'Linear Periodization', desc: '12–16 周内从高量低强度逐步过渡到低量高强度，按阶段表加负荷。', fit: '新手到中级、目标明确的备赛或有终点日期时。', source: '传统力量训练理论' },
    { id: 'undulating', name: '波状周期化 Waves', en: 'Undulating / Wave', desc: '负荷在周内或周间波浪起伏（如 3 周递增 + 1 周回落），波浪峰值逐周期上移。', fit: '想在同一周期内兼顾力量与围度。', source: '传统力量训练理论' },
    { id: 'dup', name: 'DUP 日波动周期化', en: 'Daily Undulating Periodization', desc: '一周内不同日子用不同次数区间（如重 5 次 / 中 8 次 / 轻 12 次），各自独立进阶。', fit: '一周能练 3 次以上、不想只练单一区间的人。', source: '学术界研究较多（Rhea 等）' },
    { id: 'block', name: '区块周期化', en: 'Block Periodization', desc: '把训练分成"累积（高量）→ 转化 → 实现（低量高强度）"几个区块，每块只盯 1–2 个目标。', fit: '高级训练者、有明确比赛或测试日期。', source: 'Issurin / Verkhoshansky' },
    { id: 'auto', name: '自动调节', en: 'Autoregulation', desc: '不预设固定重量，按当天 RPE 与疲劳度决定负荷与组数。', fit: '睡眠/工作不规律、状态波动大的人。', source: 'Mike Tuchscherer' }
  ];

  /* ---------- 减脂期安排 ---------- */
  var FATLOSS = [
    { id: 'fl_base', name: '减脂期训练主线', en: 'Fat-loss training', desc: '**力量 2–4 次/周保住肌肉**（复合动作为主、维持强度不追量），有氧作为辅助增加消耗。热量缺口主要靠饮食，别指望用有氧"练掉"吃进去的。',
      cautions: '热量缺口大时恢复变差：主动降低组数（保留强度）、接受进步变慢、优先保证睡眠。', source: 'WHO 身体活动指南 + 同期训练研究（Wilson 2012 meta）' },
    { id: 'fl_cardio', name: '有氧怎么配', en: 'Cardio pairing', desc: '每周 150–300 分钟中等强度：可拆成 2 次 HIIT（每次 ≤30 分钟，如挪威 4×4）+ 2–3 次 LISS/Zone 2（30–45 分钟）。',
      cautions: '**腿日前后 24 小时不跑跳**（改单车/划船）；HIIT 与腿日隔 24–48 小时；优先项目排在前面（要保力量就先练力量）。', source: '同期训练研究综述' },
    { id: 'fl_order', name: '同一天怎么排', en: 'Same-day order', desc: '力量放在前面（技术型动作需要新鲜状态），有氧在后；能分开就间隔 6 小时以上。',
      cautions: '有氧产生的食欲补偿很常见，注意别把消耗吃回来。', source: '同期训练研究综述' }
  ];

  /* ---------- 有氧方案库 ---------- */
  var CARDIO = [
    { id: 'liss', name: 'LISS 低强度稳态', en: 'LISS', structure: '连续 30–60 分钟', intensity: '40–55% HRmax，RPE 9–11（能轻松聊天）',
      freq: '每周 3–6 次', who: '新手、体重大、关节不适', pros: '最容易坚持、恢复压力小', cons: '比较耗时、单位时间消耗低', met: 3.5, source: '传统有氧安排' },
    { id: 'miss', name: 'MISS 中等强度稳态', en: 'MISS', structure: '连续 20–60 分钟', intensity: '55–70% HRmax（40–59% HRR），能说话但唱不了歌',
      freq: '每周 3–5 次', who: '大多数人的基础有氧', pros: '证据最充分、心肺与减脂都有效', cons: '效率中等', met: 5.0, source: 'ACSM / WHO 指南' },
    { id: 'zone2', name: 'Zone 2 有氧底盘', en: 'Zone 2', structure: '45–90 分钟', intensity: '60–70% HRmax（约 50–60% HRR），能说完整句子',
      freq: '每周 3–4 次', who: '想打好有氧基础的人', pros: '提升有氧底盘、疲劳低', cons: '定义有三种口径（%HRmax / %HRR / Coggan），慢且费时', met: 6.0, source: '耐力训练通行做法' },
    { id: 'norwegian4x4', name: '挪威 4×4', en: 'Norwegian 4x4', structure: '热身 10 分钟 → 4×（4 分钟高强度 + 3 分钟主动恢复）',
      intensity: '高强度段 90–95% HRmax，恢复段约 70%', freq: '每周 2–3 次', who: '有基础、想快速提升 VO₂max',
      pros: '**提升最大摄氧量效果最强的方案之一**（Helgerud 2007 / Wisløff 2007）', cons: '非常痛苦，新手做不了', met: 9.0, source: 'Helgerud 2007 MSSE；Wisløff 2007 Circulation' },
    { id: 'gibala', name: 'Gibala 10×60 秒', en: 'Gibala 10x60s', structure: '10×（60 秒高强度 + 60 秒恢复）',
      intensity: '高强度段约 90% HRmax，RPE 17', freq: '每周 3 次', who: '有基础、时间紧', pros: '研究充分、总时长只约 20 分钟', cons: '枯燥', met: 8.5, source: 'Little 2010 J Appl Physiol' },
    { id: 'tabata', name: 'Tabata 4 分钟', en: 'Tabata', structure: '20 秒全力 / 10 秒休息 × 8 = 4 分钟',
      intensity: '**原版要求达到约 170% VO₂max**（多数人实际做不达标）', freq: '每周 1–2 次', who: '有基础', pros: '极省时', cons: '大多数人达不到真正强度；不能替代基础有氧', met: 11.0, source: 'Tabata 1996 MSSE' },
    { id: 'sit', name: 'SIT 冲刺间歇', en: 'Sprint Interval Training', structure: '4–6×（30 秒全力冲刺 + 4 分钟恢复）',
      intensity: '超过 100% VO₂max', freq: '每周 2–3 次', who: '运动员或有训练基础者', pros: '省时、对无氧能力提升明显', cons: '强度极高，非大众方案', met: 12.0, source: '运动生理学研究' },
    { id: 'fartlek', name: '法特莱克跑', en: 'Fartlek', structure: '20–45 分钟内随意插入 1–3 分钟加速段',
      intensity: '70–90% HRmax 波动', freq: '每周 1–2 次', who: '跑步爱好者', pros: '有趣、贴近真实跑步', cons: '难以量化与追踪', met: 8.0, source: '北欧跑步训练传统' },
    { id: 'tempo', name: '节奏跑 / 阈值跑', en: 'Tempo / Threshold', structure: '连续 20–40 分钟，或 3–5×8–10 分钟',
      intensity: '80–88% HRmax，RPE 15–16（"舒适地很难"）', freq: '每周 1–2 次', who: '进阶跑者', pros: '显著提高乳酸阈', cons: '挤占恢复，别和腿日挨着', met: 9.5, source: '耐力训练通行做法' },
    { id: 'c25k', name: 'Couch to 5K（9 周跑起来）', en: 'C25K', structure: '每周 3 次，走跑交替渐进到连续跑 30 分钟',
      intensity: 'RPE 12–14（能说话）', freq: '每周 3 次', who: '**零基础、完全没跑过步的人**', pros: '结构化、循序渐进、成功率高的入门方案', cons: '终点只是 5 公里，之后要另接计划', met: 7.0, source: 'NHS Couch to 5K 计划（按事实重写）',
      weeks: [
        [['跑 1 分钟', '走 1.5 分钟', '×7'], '共约 20 分钟'],
        [['跑 1.5 分钟', '走 2 分钟', '×5'], '共约 20 分钟'],
        [['跑 1.5 分钟', '走 1.5 分钟', '跑 3 分钟', '走 3 分钟', '×2'], '共约 20 分钟'],
        [['跑 3 分钟', '走 1.5 分钟', '跑 5 分钟', '走 2.5 分钟', '跑 3 分钟', '走 1.5 分钟', '跑 5 分钟'], '共约 25 分钟'],
        [['跑 5 分钟 ×3（中间走 3 分钟）'], '第 3 次改为连续跑 20 分钟'],
        [['跑 5 分钟', '走 3 分钟', '跑 8 分钟', '走 3 分钟', '跑 5 分钟'], '之后过渡到连续跑 25 分钟'],
        [['连续跑 25 分钟 ×3'], '共 75 分钟'],
        [['连续跑 28 分钟 ×3'], '共 84 分钟'],
        [['连续跑 30 分钟 ×3'], '达成 5 公里']
      ]
    },
    { id: 'brisk_walk', name: '快走 / 步行计划', en: 'Brisk Walking', structure: '每天 30 分钟，或每周累计 150 分钟；能到 6000–8000 步收益就已接近饱和',
      intensity: '3.5–5 MET，步频约 120 步/分', freq: '几乎每天', who: '**门槛最低，几乎所有人都能做**',
      pros: '零门槛、几乎无受伤风险、容易坚持', cons: '单位时间消耗低，需要靠时长累积', met: 4.3, source: 'WHO 指南（"每天 1 万步"其实是计步器营销数字，研究显示 6000–8000 步后收益趋缓）' },
    { id: 'rowing', name: '划船机', en: 'Rowing', structure: 'LISS 20–40 分钟（18–22 桨/分）；或 6×500 米间歇',
      intensity: '心率区间，或按 500 米配速', freq: '每周 2–4 次', who: '想全身参与、又不想冲击关节的人',
      pros: '全身、低冲击、对力量训练干扰相对小', cons: '技术门槛高，动作不对会腰疼', met: 7.5, source: '划船训练通行做法' },
    { id: 'cycling', name: '单车 / 动感单车', en: 'Cycling', structure: 'Zone 2 45–90 分钟；或 5×3 分钟；或 4–6×30 秒冲刺',
      intensity: '%FTP 或心率区间', freq: '每周 2–4 次', who: '**腿部力量训练者的首选有氧**（对下肢干扰最小）',
      pros: '对力量训练干扰最小、关节友好', cons: '需要器械', met: 7.0, source: '同期训练研究（Wilson 2012）' },
    { id: 'elliptical', name: '椭圆机', en: 'Elliptical', structure: '30–45 分钟；或 10×（2 分钟快 + 1 分钟慢）',
      intensity: '60–75% HRmax', freq: '每周 2–3 次', who: '关节不适、大体重', pros: '零冲击', cons: '强度上限低，容易越做越轻松', met: 5.0, source: '健身房常见器械' },
    { id: 'jumprope', name: '跳绳', en: 'Jump Rope', structure: '10×（30 秒快 + 30 秒歇）',
      intensity: '8.8–12.3 MET', freq: '每周 2–3 次', who: '有基础、场地有限', pros: '省地方、耗能高', cons: '跟腱与小腿冲击大，体重偏大者慎用', met: 10.0, source: '2024 Compendium of Physical Activities' },
    { id: 'swimming', name: '游泳', en: 'Swimming', structure: '连续 20–40 分钟；或 6–10×100 米（CSS 配速）',
      intensity: '5.8–9.8 MET', freq: '每周 2–3 次', who: '关节问题、想全身锻炼', pros: '零冲击、全身参与', cons: '需要场地与泳姿基础', met: 7.0, source: '2024 Compendium of Physical Activities' },
    { id: 'stair', name: '爬楼机 / 爬楼梯', en: 'Stair Climber', structure: '20–30 分钟连续；或 10×（1 分钟快 + 1 分钟慢）',
      intensity: '8–11 MET，心率约 70–85% HRmax', freq: '每周 2–3 次', who: '想练臀腿又想省时间的人',
      pros: '单位时间消耗高、对臀腿刺激明显', cons: '**身体不要趴在扶手上**，否则强度大打折扣；膝盖不适者慎用', met: 9.0, source: '2024 Compendium of Physical Activities' },
    { id: 'incline_walk', name: '爬坡走', en: 'Incline Walking', structure: '坡度 10–15%、速度 4–5 km/h，走 20–40 分钟',
      intensity: '约 60–75% HRmax，能说话', freq: '每周 2–4 次', who: '膝关节不适合跑步、又想有强度的人',
      pros: '跑步的强度、走路的关节压力，**强烈推荐给大体重减脂人群**', cons: '必须用跑步机；不扶扶手才有效果', met: 6.5, source: '健身房通行做法' }
  ];

  global.HD_PROGRAMS = { PROGRAMS: PROGRAMS, TECHNIQUES: TECHNIQUES, PERIODIZATION: PERIODIZATION, FATLOSS: FATLOSS, CARDIO: CARDIO };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.HD_PROGRAMS;
})(typeof window !== 'undefined' ? window : globalThis);
