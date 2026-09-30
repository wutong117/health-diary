/* =========================================================================
 * diet-library.js — 减重饮食方法库（40 种）
 * 字段说明：
 *   principle 机制（它为什么能减重）/ content 具体内容（到底怎么吃）
 *   record 需要记录什么 / evidence 证据强度与结论 / source 参考链接
 *   caution 禁忌与风险人群 / myth 常见误区
 *   macro 三大营养素比例（null 表示该方法不规定宏量比例）
 *   proteinPerKg 蛋白质目标（g/kg 体重，null 表示不适用）
 *   fasting 断食窗口（null 表示不涉及）/ clinical 是否属于需要医学监督的方案
 *   group 分组，用于界面归类
 *
 * 说明：证据栏是"研究结论的指路牌"，不是医疗建议；具体研究请点链接自行核对。
 * ========================================================================= */
var HD_DIET_LIBRARY = [
  /* ---------- 一、热量缺口类 ---------- */
  {
    id: 'cico', group: '热量缺口', name: 'CICO 热量缺口', en: 'Calories In, Calories Out', tag: '最底层原理',
    principle: '摄入热量长期低于消耗，身体只能动用储备能量——所有饮食法最终都靠这一步起作用。',
    content: '不限定食物种类，只设每日缺口：常用 500 千卡左右，对应每周约 0.45 kg。可以正常吃米饭面条，只要总热量在预算内。',
    record: ['每日总热量', '体重'],
    evidence: '证据最强、最普适。CDC 明确"每天少摄入约 500 千卡，每周约减 1 磅"。',
    source: 'https://www.cdc.gov/healthyweight/losing_weight/index.html',
    caution: '孕哺期、有进食障碍史者不宜严格计数。',
    myth: '以为"热量都一样"——同样热量下，蛋白质和纤维多的吃法更抗饿、更容易坚持。',
    macro: { c: 50, p: 25, f: 25 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'volumetrics', group: '热量缺口', name: '体积饮食', en: 'Volumetrics', tag: '不数热量',
    principle: '用低能量密度食物（水分、纤维多）把胃填满，饱腹感先于热量被满足。',
    content: '多吃汤、蔬菜、水果、全谷、豆类；少碰油炸、坚果酱、精炼油和糖。核心是"每口的热量低"，不需要精确称重。',
    record: ['蔬果份数', '体重'],
    evidence: '能量密度与饱腹感的研究支持短期控食效果，长期减重数据仍不足。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=energy+density+satiety+weight+loss',
    caution: '胃肠动力差者别突然大量加纤维。',
    myth: '把"低能量密度"当成"可以无限吃"——总量仍然是关键。',
    macro: null, proteinPerKg: null, fasting: null
  },
  {
    id: 'mealreplace', group: '热量缺口', name: '代餐替换', en: 'Meal Replacement', tag: '省决策',
    principle: '用固定热量的奶昔/能量棒替掉 1–2 餐，直接压缩总摄入，并省掉"今天吃什么"的决策成本。',
    content: '每日 1–2 餐用代餐，剩下 1 餐正常吃（多蛋白多蔬菜），全天大致 1200–1500 千卡。记录替代了几餐。',
    record: ['替代餐数', '总热量', '体重'],
    evidence: '多项研究显示代餐组减重不劣于、甚至略优于常规饮食；长期维持仍需过渡到真实食物。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=meal+replacement+weight+loss+meta-analysis',
    caution: '肾病、孕哺期慎用；代餐产品需留意添加糖。',
    myth: '代餐之外随意加餐，缺口被抵消。',
    macro: { c: 45, p: 30, f: 25 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'vlcd', group: '热量缺口', name: '极低热量饮食', en: 'VLCD（<800 kcal）', tag: '需医学监督',
    principle: '每日 800 千卡以下，制造很大的缺口，早期减重速度明显更快。',
    content: '全部用配方代餐或严格配餐，通常限 8–12 周，之后必须逐步过渡回正常饮食，全程需要医生/营养师随访与血检。',
    record: ['总热量', '电解质与不适症状', '体重', '围度'],
    evidence: 'NHS 将其列为需监督的肥胖治疗手段，可用于 2 型糖尿病缓解；自行模仿风险高。',
    source: 'https://www.cuh.nhs.uk/patient-information/intensive-weight-management-programme-phase-i-initial-weight-loss-plan-solid-food/',
    caution: '孕哺期、1 型糖尿病、进食障碍史、青少年、老年人禁用；可能胆结石、电解质紊乱。',
    myth: '把它当成"更狠的节食"自己在家做。',
    macro: { c: 40, p: 40, f: 20 }, proteinPerKg: 1.5, fasting: null, clinical: true
  },
  {
    id: 'psmf', group: '热量缺口', name: '蛋白质节约改性禁食', en: 'PSMF', tag: '需医学监督',
    principle: '极低热量下把蛋白质补足，尽量只掉脂肪、保住瘦体重。',
    content: '蛋白质约 1.2–1.5 g/kg 体重，脂肪和碳水极低（主要来自鱼油与蔬菜），通常只做数周，需医生监测。',
    record: ['蛋白质克数', '体重', '围度', '不适症状'],
    evidence: '在肥胖治疗中被证实能较好保留瘦体重，但样本小、随访短。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=protein+sparing+modified+fast',
    caution: '肾病、肝病、痛风、孕哺期禁用。',
    myth: '当成普通的"多吃肉减肥"长期执行。',
    macro: { c: 10, p: 60, f: 30 }, proteinPerKg: 1.5, fasting: null, clinical: true
  },

  /* ---------- 二、宏量调整类 ---------- */
  {
    id: 'lowcarb', group: '宏量调整', name: '低碳水饮食', en: 'Low-Carb', tag: '饱腹好',
    principle: '碳水占比降下来后血糖波动变小、饱腹感增强，实际起作用的仍是热量缺口。',
    content: '碳水约 50–130 g/日，可以吃肉蛋鱼、非淀粉蔬菜、油脂，限制主食、含糖饮料与甜点。',
    record: ['碳水克数', '体重', '腰围'],
    evidence: '短期减重常优于低脂，但 6–12 个月后差异基本消失。',
    source: 'https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
    caution: '肾病、孕哺期、服用 SGLT2 抑制剂者需医生评估。',
    myth: '低碳 = 可以随便吃饱和脂肪。',
    macro: { c: 20, p: 30, f: 50 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'keto', group: '宏量调整', name: '生酮饮食', en: 'Ketogenic Diet', tag: '需了解风险',
    principle: '碳水压到 <20–50 g/日诱导酮症，早期掉的是水分所以很快，长期减重仍来自热量缺口。',
    content: '脂肪 70–80%、蛋白 15–20%、碳水 5–10%。需要监测酮体、电解质（钠钾镁）与血脂，注意便秘与"生酮流感"。',
    record: ['碳水克数', '酮体（可选）', '体重', '不适症状', '血脂（复查）'],
    evidence: '短期减重常优于低脂，12 个月后优势消失；部分人 LDL 升高。',
    source: 'https://nutritionsource.hsph.harvard.edu/',
    caution: '胰腺炎史、肝病、脂代谢异常、1 型糖尿病、孕哺期慎用。',
    myth: '"生酮就是随便吃油和肉"。',
    macro: { c: 8, p: 22, f: 70 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'atkins', group: '宏量调整', name: '阿特金斯饮食', en: 'Atkins Diet', tag: '分阶段',
    principle: '先极低碳水、再逐级加回，靠蛋白与脂肪的饱腹感自然降低总摄入。',
    content: '四阶段：诱导期碳水 <20 g/日 → 持续减重期逐步加 → 巩固期 → 维持期。只数"净碳水"，不限制脂肪蛋白。',
    record: ['净碳水克数', '体重', '所处阶段'],
    evidence: '多项 RCT 显示 6–12 个月减重与低脂饮食相当。',
    source: 'https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
    caution: '肾病、孕哺期慎用；加工肉摄入过多反而增加风险。',
    myth: '只看净碳水，忽略加工肉的危害。',
    macro: { c: 12, p: 30, f: 58 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'protein', group: '宏量调整', name: '高蛋白保肌', en: 'High-Protein', tag: '可与任意方案叠加',
    principle: '蛋白质饱腹感最强、食物热效应最高（消化它本身要耗能），限热量时还能保住瘦体重。',
    content: '蛋白质 1.2–1.6 g/kg 体重（约占总热量 25–35%），每餐 20–40 g，配合每周 ≥2 次抗阻训练。',
    record: ['蛋白质克数', '力量训练次数', '体重', '围度'],
    evidence: '等热量条件下减重不劣，且更能保留瘦体重，中老年尤其受益。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=high+protein+diet+weight+loss+meta-analysis',
    caution: '中重度肾病、肝性脑病者需医生指导。',
    myth: '只盯蛋白质不看总热量。',
    macro: { c: 40, p: 30, f: 30 }, proteinPerKg: 1.6, fasting: null
  },
  {
    id: 'lowfat', group: '宏量调整', name: '低脂饮食', en: 'Low-Fat', tag: '传统方案',
    principle: '脂肪能量密度最高（9 千卡/克），减少脂肪自然就降低了总热量。',
    content: '脂肪 <30% 总热量，主吃全谷、蔬果、瘦肉、低脂乳制品；少油炸与奶油点心。',
    record: ['脂肪克数', '总热量', '体重'],
    evidence: '可减重并改善血脂，是长期研究最充分的方案之一。',
    source: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    caution: '胆囊疾病者、极低脂饮食需注意必需脂肪酸摄入。',
    myth: '把"低脂饼干/低脂糖果"当健康食品——往往糖更多。',
    macro: { c: 60, p: 20, f: 20 }, proteinPerKg: 1.3, fasting: null
  },
  {
    id: 'zone', group: '宏量调整', name: '区域饮食', en: 'Zone Diet', tag: '固定比例',
    principle: '按 40:30:30（碳水/蛋白/脂肪）配比，声称能平稳胰岛素、减少炎症，但仍靠热量限制。',
    content: '每餐按"手掌法则"配比，蛋白约 1/3 餐盘，碳水选低 GI，脂肪以单不饱和为主。',
    record: ['三餐比例', '总热量', '体重'],
    evidence: '等热量下与常规饮食的减重差异很小。',
    source: 'https://nutritionsource.hsph.harvard.edu/',
    caution: '无特殊禁忌；糖尿病用药者需调整剂量。',
    myth: '以为 40:30:30 本身有额外魔力。',
    macro: { c: 40, p: 30, f: 30 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'carbcycle', group: '宏量调整', name: '碳水循环', en: 'Carb Cycling', tag: '健身向',
    principle: '训练日多碳水、休息日少碳水，兼顾训练表现与减脂，但周总热量仍是决定因素。',
    content: '例如"3 高 4 低"：低碳日 50–100 g，高碳日 150–250 g，高碳日安排在力量训练日。',
    record: ['每日碳水克数', '训练记录', '体重'],
    evidence: '缺乏独立的高质量 RCT，效果主要来自总热量控制（证据不足）。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=carbohydrate+cycling+weight+loss',
    caution: '有进食障碍史者慎用"高低日"这种规则化吃法。',
    myth: '以为循环可以绕过热量缺口。',
    macro: { c: 45, p: 30, f: 25 }, proteinPerKg: 1.6, fasting: null
  },
  {
    id: 'ketoif', group: '宏量调整', name: '生酮 + 断食', en: 'Keto + Intermittent Fasting', tag: '进阶叠加',
    principle: '两个方法叠加：进食窗口更短、酮症更容易达成，缺口被放大。',
    content: '生酮比例 + 16:8（或 18:6）。要逐步过渡，注意起床后眩晕、抽筋（电解质不足）。',
    record: ['碳水克数', '进食窗口', '体重', '不适症状'],
    evidence: '联合方案短期减重较快，长期数据有限（证据不足）。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=ketogenic+diet+intermittent+fasting',
    caution: '使用降糖药或胰岛素者、孕哺期、进食障碍史者禁用。',
    myth: '"叠加一定更好"——低血糖与脱水风险同时升高。',
    macro: { c: 8, p: 22, f: 70 }, proteinPerKg: 1.5, fasting: { start: '12:00', end: '20:00' }
  },

  /* ---------- 三、时间限制类 ---------- */
  {
    id: 'if168', group: '时间限制', name: '16:8 限时进食', en: '16:8 TRE', tag: '执行简单',
    principle: '把进食压缩到 8 小时，多数人会自然少吃，从而形成热量缺口。',
    content: '例如 12:00–20:00 进食，其余时间只喝水、无糖茶或黑咖啡。窗口内也要注意总量与蛋白质。',
    record: ['进食窗口起止', '总热量', '体重'],
    evidence: '减重效果与常规热量限制相近；主要优势是规则简单、容易坚持。',
    source: 'https://www.health.harvard.edu/blog/eating-breakfast-wont-help-you-lose-weight-but-skipping-it-might-not-either-2019041916457',
    caution: '孕哺期、进食障碍史、1 型糖尿病、需随餐服药者禁用。',
    myth: '"8 小时内随便吃"——照样会长胖。',
    macro: { c: 45, p: 25, f: 30 }, proteinPerKg: 1.4, fasting: { start: '12:00', end: '20:00' }
  },
  {
    id: 'if52', group: '时间限制', name: '5:2 轻断食', en: '5:2 Diet', tag: '每周两天',
    principle: '每周挑 2 天极低热量（约 500–600 千卡），制造整周的额外缺口。',
    content: '5 天正常吃（也要注意别报复性进食），2 天断食日安排在不连续的两天。断食日优先蛋白与蔬菜。',
    record: ['断食日热量', '断食日日期', '体重'],
    evidence: '12 个月减重与每日限热量相当，依从性因人而异。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=%225%3A2+diet%22',
    caution: '孕哺期、糖尿病用药者、青少年不适合。',
    myth: '"5 天可以随便吃"——把两天的缺口全吃回来。',
    macro: { c: 45, p: 30, f: 25 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'adf', group: '时间限制', name: '隔日断食', en: 'Alternate-Day Fasting', tag: '节奏强',
    principle: '断食日几乎不吃、进食日正常吃，平均下来形成缺口。',
    content: '常用改良版：断食日约 500 千卡，进食日不刻意限制但别补偿性暴食。',
    record: ['断食日/进食日标记', '两类的热量', '体重'],
    evidence: '减重与每日热量限制相当，但依从性通常更低。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=alternate+day+fasting+weight+loss',
    caution: '孕哺期、进食障碍史、体重偏低者不宜。',
    myth: '进食日可以无限制补偿。',
    macro: { c: 45, p: 30, f: 25 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'omad', group: '时间限制', name: '一日一餐', en: 'OMAD', tag: '窗口极窄',
    principle: '一天只吃一餐，窗口极窄，很难吃够维持热量，缺口自动出现。',
    content: '固定 1 小时进食，这一餐必须覆盖足量蛋白、蔬菜和健康脂肪，否则容易掉肌肉、缺微量营养素。',
    record: ['进食时间', '总热量', '蛋白质克数', '体重'],
    evidence: '缺乏长期 RCT，短期减重与普通热量限制相近（证据不足）。',
    source: 'https://www.health.harvard.edu/blog/eating-breakfast-wont-help-you-lose-weight-but-skipping-it-might-not-either-2019041916457',
    caution: '糖尿病、孕哺期、胃病、进食障碍史者禁用。',
    myth: '这一餐可以任意高糖高油。',
    macro: { c: 40, p: 30, f: 30 }, proteinPerKg: 1.6, fasting: { start: '18:00', end: '19:00' }
  },
  {
    id: 'dawn', group: '时间限制', name: '日出到日落断食', en: 'Dawn-to-Sunset Fasting', tag: '宗教/文化',
    principle: '白天完全禁食，实质是把夜间断食延长到 12–18 小时的时间限制法。',
    content: '日出前与日落后各一餐，白天只喝水。两餐要吃得均衡，避免夜间补偿性暴食。',
    record: ['两餐时间与内容', '饮水', '体重'],
    evidence: '斋月间歇性断食研究显示体重轻度下降，多数在恢复饮食后部分回升。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=ramadan+intermittent+fasting+weight',
    caution: '糖尿病、孕哺期、经期不适明显者、重体力劳动者需谨慎或调整。',
    myth: '夜里两餐可以敞开吃。',
    macro: { c: 50, p: 25, f: 25 }, proteinPerKg: 1.4, fasting: { start: '18:30', end: '04:30' }
  },
  {
    id: 'etre', group: '时间限制', name: '早限时进食', en: 'Early Time-Restricted Eating', tag: '顺应生物钟',
    principle: '把进食窗口前移到上午，让吃饭与昼夜节律同步，改善胰岛素敏感性。',
    content: '例如 8:00–16:00 或 7:00–15:00 进食，晚间禁食。晚餐社交多的人较难执行。',
    record: ['进食窗口', '总热量', '体重'],
    evidence: '对血糖、血压有改善信号，减重的独立证据还不充分。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=early+time+restricted+eating+randomized',
    caution: '夜班工作者、低血糖风险人群不适合。',
    myth: '只把时间提前、总量不减，效果有限。',
    macro: { c: 50, p: 25, f: 25 }, proteinPerKg: 1.4, fasting: { start: '08:00', end: '16:00' }
  },

  /* ---------- 四、膳食模式类 ---------- */
  {
    id: 'mediterranean', group: '膳食模式', name: '地中海饮食', en: 'Mediterranean Diet', tag: '长期最推荐',
    principle: '用橄榄油、坚果、鱼类替代饱和脂肪，饱腹感好、口味可持续，减重幅度温和但能长期维持。',
    content: '每餐蔬菜 + 全谷，每周鱼 2 次，红肉少吃，用橄榄油代替黄油，坚果适量。',
    record: ['蔬果/全谷份数', '鱼类次数', '体重'],
    evidence: 'PREDIMED 显示心血管获益显著，是长期健康结局证据最强的膳食模式。',
    source: 'https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
    caution: '无绝对禁忌；橄榄油和坚果的热量仍要计入。',
    myth: '把大量橄榄油当成"零热量"。',
    macro: { c: 50, p: 20, f: 30 }, proteinPerKg: 1.3, fasting: null
  },
  {
    id: 'dash', group: '膳食模式', name: 'DASH 饮食', en: 'DASH Diet', tag: '降压友好',
    principle: '低钠、高钾钙镁的膳食结构，在降压的同时限制糖与饱和脂肪，形成中等缺口。',
    content: '蔬果 4–5 份、低脂乳制品、全谷、瘦肉；钠 <2300 mg（理想 1500 mg），少含糖饮料。',
    record: ['钠摄入', '蔬果份数', '血压（若有）', '体重'],
    evidence: '降压证据最强；减重幅度与地中海饮食相近。',
    source: 'https://diet.mayoclinic.org/us/blog/2025/comparing-dash-and-mediterranean-diets-benefits-differences-and-ideal-fit/',
    caution: '肾功能不全者需限制钾的摄入。',
    myth: '只限盐、不管总热量。',
    macro: { c: 55, p: 20, f: 25 }, proteinPerKg: 1.3, fasting: null
  },
  {
    id: 'mind', group: '膳食模式', name: 'MIND 饮食', en: 'MIND Diet', tag: '护脑向',
    principle: '地中海 + DASH 的神经保护改良版，减少加工食品，顺带降低能量密度。',
    content: '鼓励 10 类：绿叶菜、浆果、坚果、豆类、全谷、鱼、禽、橄榄油、红酒（可不喝）；限制 5 类：红肉、黄油、奶酪、糕点、油炸。',
    record: ['推荐食物份数', '体重'],
    evidence: '为认知与阿尔茨海默风险设计，专门的减重证据较弱。',
    source: 'https://nutritionsource.hsph.harvard.edu/',
    caution: '无特殊禁忌。',
    myth: '把它当成专门的减重方案。',
    macro: { c: 50, p: 20, f: 30 }, proteinPerKg: 1.3, fasting: null
  },
  {
    id: 'flexitarian', group: '膳食模式', name: '弹性素食', en: 'Flexitarian', tag: '容易落地',
    principle: '以植物性食物为主、偶尔吃动物性食物，整体能量密度与饱和脂肪都下降。',
    content: '每周 2–3 天全素，其余日子少量禽肉、鱼、蛋、奶。多豆类与全谷。',
    record: ['素食天数', '豆类份数', '体重'],
    evidence: '植物性饮食者 BMI 普遍更低；干预研究显示减重与常规饮食相近。',
    source: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    caution: '注意铁、锌、B12 的摄入，必要时补充。',
    myth: '素鸡、素饼等加工素食不等于低热量。',
    macro: { c: 55, p: 20, f: 25 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'vegetarian', group: '膳食模式', name: '素食 / 纯素食', en: 'Vegetarian / Vegan', tag: '需补 B12',
    principle: '排除动物性食物后纤维更高、能量密度更低，通常自然少吃。',
    content: '全谷、豆类、蔬果、坚果为主；纯素必须补 B12，注意铁、钙、omega-3 与足量蛋白。',
    record: ['蛋白质来源', 'B12 补充', '体重', '围度'],
    evidence: '等热量条件下减重与杂食饮食相当，但血脂改善更明显。',
    source: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    caution: '纯素者、孕哺期建议咨询营养师。',
    myth: '纯素零食和炸物照样会增重。',
    macro: { c: 55, p: 20, f: 25 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'nordic', group: '膳食模式', name: '北欧饮食', en: 'Nordic / Baltic Diet', tag: '本地食材',
    principle: '用本地全谷（黑麦、燕麦）、浆果、菜籽油、鱼类替代精制食品。',
    content: '全谷主食、根茎蔬菜、浆果、菜籽油，每周鱼 2–3 次，少吃加工肉。',
    record: ['全谷份数', '鱼次数', '体重'],
    evidence: '可改善血脂并带来轻度减重。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=nordic+diet+weight+loss+randomized',
    caution: '无特殊禁忌。',
    myth: '与地中海饮食完全等同（脂肪来源不同）。',
    macro: { c: 50, p: 20, f: 30 }, proteinPerKg: 1.3, fasting: null
  },
  {
    id: 'jiangnan', group: '膳食模式', name: '江南饮食 / 东方健康膳食', en: 'Jiangnan Diet', tag: '适合中国胃',
    principle: '多蔬果、鱼虾、豆制品，用植物油代替动物油，控制红肉与精制糖。',
    content: '主食粗细搭配，清蒸水煮为主，少油少盐，适量奶类与坚果，每天蔬菜 300–500 g。',
    record: ['蔬菜份数', '烹饪方式', '体重'],
    evidence: '中国队列研究与中国居民膳食指南支持其心血管获益，专门的减重 RCT 较少。',
    source: 'http://dg.cnsoc.org/',
    caution: '无特殊禁忌。',
    myth: '把"清淡"理解成只喝粥——蛋白会严重不足。',
    macro: { c: 55, p: 20, f: 25 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'cn2022', group: '膳食模式', name: '中国居民膳食指南 + 5%/10%/15% 里程碑', en: 'Chinese Dietary Guidelines 2022', tag: '本土权威',
    principle: '按平衡膳食宝塔安排结构，靠"吃动平衡"制造温和缺口；目标按《肥胖症诊疗指南（2024）》设为 3–6 个月减 5%–15%。',
    content: '谷类 200–300 g（全谷杂豆 50–150 g）、蔬菜 300–500 g、水果 200–350 g、奶 300 ml、盐 <5 g、油 25–30 g、添加糖 <25 g，每周 150 分钟活动。',
    record: ['谷薯/蔬果/奶豆份数', '盐油糖', '步数', '体重'],
    evidence: '中国最权威的膳食与诊疗基线，减重速度温和、可持续。',
    source: 'http://dg.cnsoc.org/',
    caution: '减重速度过快会流失肌肉，指南建议温和缺口。',
    myth: '照着指南吃但不控总量——一样不会瘦。',
    macro: { c: 55, p: 20, f: 25 }, proteinPerKg: 1.2, fasting: null
  },
  {
    id: 'okinawa', group: '膳食模式', name: '冲绳饮食', en: 'Okinawan Diet', tag: '八分饱',
    principle: '高蔬菜、低能量密度、少肉，加上传统的"八分饱"习惯，总热量天然偏低。',
    content: '以红薯、蔬菜、豆制品、少量鱼为主，细嚼慢咽、吃到八分饱就停。',
    record: ['蔬菜份数', '饱腹度', '体重'],
    evidence: '属于观察性长寿研究，专门的减重干预证据薄弱。',
    source: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    caution: '无特殊禁忌。',
    myth: '现代冲绳饮食已西化，不能直接照搬老照片里的食谱。',
    macro: { c: 60, p: 15, f: 25 }, proteinPerKg: 1.2, fasting: null
  },

  /* ---------- 五、商业 / 结构化方案 ---------- */
  {
    id: 'ww', group: '商业方案', name: 'WW 积分制', en: 'WeightWatchers', tag: '行为支持',
    principle: '把食物换算成积分、限制每日点数，本质是简化版热量管理 + 社群行为支持。',
    content: '按个人点数配额吃，蔬果多为零点；每周参加称重/社群活动。需要记录每日积分。',
    record: ['每日积分', '体重', '出勤/社群'],
    evidence: '多项 RCT 中 WW 的减重优于自助式饮食，是商业方案里证据较好的。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=weight+watchers+randomized+controlled+trial+weight+loss',
    caution: '无特殊禁忌。',
    myth: '零点食物吃太多照样增重。',
    macro: null, proteinPerKg: null, fasting: null
  },
  {
    id: 'noom', group: '商业方案', name: 'Noom 行为方案', en: 'Noom', tag: '心理向',
    principle: '以心理学与行为干预为主，配合热量记录和每日课程，改变的是习惯而不只是菜单。',
    content: '按"红/黄/绿"给食物分级，设定每日热量预算，每天打卡 + 读一节小课。',
    record: ['每日热量', '课程完成', '体重', '情绪/触发点'],
    evidence: '有 2 年随访显示减重效果，但独立复现研究有限。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=noom+weight+loss+randomized',
    caution: '进食障碍史者慎用严格计数。',
    myth: '打卡本身不等于减重。',
    macro: null, proteinPerKg: null, fasting: null
  },
  {
    id: 'jennycraig', group: '商业方案', name: 'Jenny Craig 预制餐', en: 'Jenny Craig', tag: '省事',
    principle: '预制餐 + 一对一教练，靠便利性和问责制减少每天的决策负担。',
    content: '以品牌预制餐为主，额外补充蔬果，逐步过渡到自己做饭。',
    record: ['预制餐使用', '蔬果补充', '体重'],
    evidence: '1–2 年减重略优于常规饮食；停用后若不建立习惯容易反弹。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=jenny+craig+weight+loss+randomized',
    caution: '无特殊禁忌；注意钠含量。',
    myth: '停用即回到旧习惯。',
    macro: null, proteinPerKg: null, fasting: null
  },
  {
    id: 'hmr', group: '商业方案', name: 'HMR 计划', en: 'HMR Program', tag: '代餐+课程',
    principle: '代餐（奶昔、主菜）+ 大量蔬果制造较大缺口，属结构化行为项目。',
    content: '每日 3 次代餐 + 蔬果 5 份以上，参加每周课程；后期逐步加入自煮食物。',
    record: ['代餐次数', '蔬果份数', '课程出勤', '体重'],
    evidence: 'RCT 中短期减重显著，长期效果依赖维持课程。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=HMR+program+weight+loss',
    caution: '慢性病患者需医生评估。',
    myth: '只买产品、不参加行为课程。',
    macro: { c: 45, p: 30, f: 25 }, proteinPerKg: 1.5, fasting: null
  },
  {
    id: 'optifast', group: '商业方案', name: 'Optifast 医疗代餐', en: 'Optifast', tag: '需医学监督',
    principle: '医疗级全代餐，800–1000 千卡/日快速减重，之后进入重建期。',
    content: '每日 3–5 次代餐，2–3 周过渡期逐步加回真实食物，全程需医疗监督与血检。',
    record: ['代餐次数', '总热量', '血检指标', '体重'],
    evidence: '属临床验证过的低能量方案，用于肥胖治疗与 2 型糖尿病缓解。',
    source: 'https://www.cypdiabetesnetwork.nhs.uk/national-network/wp-content/uploads/sites/14/2024/04/4-The-Low-Energy-Diet-Theoretical-underpinnings-and-clinical-considerations-in-Type-2-Diabetes.pdf',
    caution: '孕哺期、进食障碍史、1 型糖尿病、青少年禁用。',
    myth: '自行长期用它替代所有正餐。',
    macro: { c: 40, p: 40, f: 20 }, proteinPerKg: 1.5, fasting: null, clinical: true
  },

  /* ---------- 六、行为方法 ---------- */
  {
    id: 'intuitive', group: '行为方法', name: '直觉饮食', en: 'Intuitive Eating', tag: '反节食',
    principle: '按饥饿/饱腹信号进食，取消"好食物/坏食物"的划分，改善饮食行为而不是追求快速减重。',
    content: '没有食物清单：练习觉察信号、允许所有食物、把运动当作愉悦而非惩罚。共 10 条原则。',
    record: ['饥饿/饱腹评分', '情绪', '体重（可不记）'],
    evidence: '能改善进食行为与情绪状态，减重效果通常不明显。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=intuitive+eating+weight+loss',
    caution: '需要快速减重的代谢病患者不宜单独使用。',
    myth: '等同于"想吃就吃"。',
    macro: null, proteinPerKg: null, fasting: null
  },
  {
    id: 'mindfuleating', group: '行为方法', name: '正念饮食', en: 'Mindful Eating', tag: '抑制情绪进食',
    principle: '放慢速度、专注觉察，减少无意识进食与情绪性进食。',
    content: '每口咀嚼约 20 次、吃饭不看屏幕、一餐用 20 分钟以上；记录情绪触发点。',
    record: ['进食速度', '情绪触发点', '体重'],
    evidence: '可减少暴食与情绪进食，减重幅度较小，适合与其他方案叠加。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=mindful+eating+weight+loss+randomized',
    caution: '无特殊禁忌。',
    myth: '把它当成快速减重的主力手段。',
    macro: null, proteinPerKg: null, fasting: null
  },

  /* ---------- 七、其他 ---------- */
  {
    id: 'glp1', group: '其他', name: 'GLP-1 药物辅助饮食', en: 'Diet with GLP-1 Therapy', tag: '需处方',
    principle: '药物增强饱腹感、延缓胃排空，热量摄入自然下降，但饮食结构决定掉的是脂肪还是肌肉。',
    content: '药物 + 高蛋白（≥1.2 g/kg）、每周 ≥2 次抗阻训练、足量纤维与水分，预防肌少与便秘。',
    record: ['蛋白质克数', '力量训练', '饮水', '体重', '围度'],
    evidence: '司美格鲁肽等显著减重，但停药后常反弹，肌肉流失是主要关注点。',
    source: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2032183',
    caution: '甲状腺髓样癌史、胰腺炎史、孕哺期、严重胃轻瘫禁用；需医生处方与随访。',
    myth: '"打了针就可以随便吃"。',
    macro: { c: 40, p: 30, f: 30 }, proteinPerKg: 1.6, fasting: null, clinical: true
  },
  {
    id: 'fiber', group: '其他', name: '高纤维 / 肠道菌群饮食', en: 'High-Fiber / Gut Microbiome', tag: '饱腹+代谢',
    principle: '纤维增加饱腹与短链脂肪酸生成；菌群差异让不同人对同一食物的血糖反应不同。',
    content: '每日纤维 25–38 g：全谷、豆类、蔬果为主，适量发酵食品；加量要循序渐进并多喝水。',
    record: ['纤维克数', '饮水', '体重', '腹胀等反应'],
    evidence: '个性化营养研究提示菌群影响餐后血糖，但减重的因果关系仍在验证中。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=gut+microbiome+weight+loss+randomized',
    caution: '肠易激综合征、有肠梗阻风险者需缓慢加量。',
    myth: '吃点益生菌补充剂就能减重。',
    macro: { c: 50, p: 22, f: 28 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'lowgi', group: '其他', name: '低 GI 饮食', en: 'Low Glycemic Index', tag: '血糖平稳',
    principle: '选升糖慢的食物让血糖平稳，减少餐后困倦与下一餐的暴食冲动。',
    content: '用全谷、豆类、多数蔬果替换白米白面与含糖饮料；同时配上蛋白质与脂肪进一步降 GI。',
    record: ['主食种类', '体重', '血糖（若有）'],
    evidence: '减重与常规饮食相近，但糖化血红蛋白改善更明显，对糖尿病前期人群价值更大。',
    source: 'https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
    caution: '运动员需考虑碳水可用性；使用降糖药者需监测血糖。',
    myth: '低 GI 不等于低热量。',
    macro: { c: 50, p: 22, f: 28 }, proteinPerKg: 1.4, fasting: null
  },
  {
    id: 'dukan', group: '其他', name: '杜坎饮食', en: 'Dukan Diet', tag: '高蛋白分阶段',
    principle: '四阶段高蛋白、极低碳水，靠蛋白饱腹与热量缺口减重。',
    content: '攻击期纯蛋白 5–7 天 → 巡航期加蔬菜 → 巩固期加水果与两份淀粉 → 稳定期每周一天纯蛋白 + 每日燕麦麸。',
    record: ['所处阶段', '蛋白质克数', '饮水', '体重'],
    evidence: '证据质量低、以观察性研究为主。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=dukan+diet+weight+loss',
    caution: '肾病、肝病、孕哺期、胆结石风险者慎用。',
    myth: '无碳水就可以无限量吃。',
    macro: { c: 15, p: 45, f: 40 }, proteinPerKg: 1.6, fasting: null
  },
  {
    id: 'southbeach', group: '其他', name: '南海滩饮食', en: 'South Beach Diet', tag: '三阶段',
    principle: '三阶段降低 GI 并限制饱和脂肪，减少血糖波动与饥饿感。',
    content: '阶段一 2 周几乎无淀粉与糖 → 阶段二逐步加全谷与水果 → 阶段三长期维持。',
    record: ['所处阶段', '主食种类', '体重'],
    evidence: '少量 RCT 提示短期减重与血脂改善，长期数据有限。',
    source: 'https://pubmed.ncbi.nlm.nih.gov/?term=south+beach+diet+weight+loss',
    caution: '肾病、孕哺期慎用。',
    myth: '永远停在最严格的阶段一。',
    macro: { c: 35, p: 30, f: 35 }, proteinPerKg: 1.5, fasting: null
  }
];
if (typeof module !== 'undefined' && module.exports) { module.exports = HD_DIET_LIBRARY; }
