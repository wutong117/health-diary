/* exercise-db.js — 中文健身动作库（64 个动作，9 个分类）
 *
 * 内容为常见力量与有氧动作的通用训练常识整理（动作要领、常见错误），
 * 不复制任何受版权保护的教材原文；供个人训练记录使用。
 * 字段：id / name 中文名 / en 英文名 / cat 分类 / m 主要肌群 / a 协同肌群
 *       eq 器械 / lv 难度 / w 是否记录重量 / cue 要领 / err 常见错误 / uni 单侧动作
 */
var EXERCISE_DB = {
  "胸": [
    {"id":"bench_press","name":"杠铃卧推","en":"Barbell Bench Press","cat":"胸","m":"胸大肌","a":"三角肌前束、肱三头肌","eq":"杠铃+卧推凳","lv":"基础","w":true,"cue":"肩胛后收下沉贴凳，杠铃下放到胸骨中下部（乳头连线），前臂始终垂直地面","err":"肘部过度外展成 90°、臀部离凳、半程不触胸","uni":false},
    {"id":"incline_bench","name":"上斜杠铃卧推","en":"Incline Bench Press","cat":"胸","m":"胸大肌上部","a":"三角肌前束、肱三头肌","eq":"杠铃+上斜凳","lv":"基础","w":true,"cue":"凳角 30° 左右，下放到锁骨下方，保持肩胛收紧","err":"凳角过高（>45°）变成练肩、耸肩","uni":false},
    {"id":"db_press","name":"哑铃平板卧推","en":"Dumbbell Bench Press","cat":"胸","m":"胸大肌","a":"三角肌前束、肱三头肌","eq":"哑铃+平凳","lv":"基础","w":true,"cue":"哑铃下放到胸两侧，行程比杠铃更长，顶端不锁死","err":"哑铃互相磕碰、下放过深拉伤肩","uni":false},
    {"id":"db_fly","name":"哑铃飞鸟","en":"Dumbbell Fly","cat":"胸","m":"胸大肌","a":"三角肌前束","eq":"哑铃+平凳","lv":"进阶","w":true,"cue":"肘微屈固定角度，像抱大树一样画弧，感受胸部拉伸","err":"把飞鸟做成卧推（肘角变化）、重量过大","uni":false},
    {"id":"pec_deck","name":"蝴蝶机夹胸","en":"Pec Deck","cat":"胸","m":"胸大肌","a":"三角肌前束","eq":"固定器械","lv":"基础","w":true,"cue":"背部贴紧靠垫，用胸部发力夹合，顶端停 1 秒","err":"用惯性甩、肩前引","uni":false},
    {"id":"cable_crossover","name":"绳索夹胸","en":"Cable Crossover","cat":"胸","m":"胸大肌","a":"三角肌前束","eq":"龙门架","lv":"进阶","w":true,"cue":"身体前倾 15°，双手交叉过身体中线，全程保持张力","err":"重量过大导致耸肩、躯干晃动","uni":false},
    {"id":"pushup","name":"俯卧撑","en":"Push-up","cat":"胸","m":"胸大肌","a":"肱三头肌、核心","eq":"自重","lv":"基础","w":false,"cue":"身体成一条直线，下放到胸口离地一拳，肩胛全程稳定","err":"塌腰、撅臀、幅度过小","uni":false},
    {"id":"dip_chest","name":"双杠臂屈伸（偏胸）","en":"Chest Dip","cat":"胸","m":"胸大肌下部","a":"肱三头肌","eq":"双杠","lv":"进阶","w":false,"cue":"躯干前倾、肘略外展，下放到肩略低于肘","err":"下放过深压迫肩关节","uni":false}
  ],
  "背": [
    {"id":"deadlift","name":"杠铃硬拉","en":"Barbell Deadlift","cat":"背","m":"竖脊肌、臀大肌、腘绳肌","a":"斜方肌、前臂、核心","eq":"杠铃","lv":"高阶","w":true,"cue":"杠铃贴小腿，背部中立，靠伸髋伸膝把杠铃\"推\"起来，顶端夹臀不后仰","err":"弓背、杠铃离身、用腰硬拽","uni":false},
    {"id":"romanian_dl","name":"罗马尼亚硬拉","en":"Romanian Deadlift","cat":"背","m":"腘绳肌、臀大肌","a":"竖脊肌","eq":"杠铃","lv":"进阶","w":true,"cue":"膝盖微屈固定，靠屈髋把杠铃沿大腿下放，感受大腿后侧拉伸","err":"变成深蹲、弓背、下放过深","uni":false},
    {"id":"barbell_row","name":"杠铃划船","en":"Barbell Row","cat":"背","m":"背阔肌、菱形肌","a":"肱二头肌、竖脊肌","eq":"杠铃","lv":"进阶","w":true,"cue":"屈髋约 45°，把杠铃拉向肚脐，肘沿身体两侧走","err":"用腰甩、含胸、拉向胸口","uni":false},
    {"id":"lat_pulldown","name":"高位下拉","en":"Lat Pulldown","cat":"背","m":"背阔肌","a":"肱二头肌、大圆肌","eq":"固定器械","lv":"基础","w":true,"cue":"握距略宽于肩，把横杆拉到锁骨前方，肘向斜下方发力","err":"身体大幅后仰借力、拉到颈后","uni":false},
    {"id":"pullup","name":"引体向上","en":"Pull-up","cat":"背","m":"背阔肌","a":"肱二头肌、核心","eq":"单杠","lv":"高阶","w":false,"cue":"肩胛先下沉再屈肘，胸口找杠，下放到底部完全伸展","err":"耸肩、用腿蹬、只做半程","uni":false},
    {"id":"seated_row","name":"坐姿划船","en":"Seated Cable Row","cat":"背","m":"背阔肌、菱形肌","a":"肱二头肌","eq":"固定器械","lv":"基础","w":true,"cue":"躯干稳定不后倒，把手拉向腹部，肩胛主动后收","err":"躯干前后大幅摆动、耸肩","uni":false},
    {"id":"db_row","name":"单臂哑铃划船","en":"One-arm Dumbbell Row","cat":"背","m":"背阔肌","a":"菱形肌、肱二头肌","eq":"哑铃+凳","lv":"基础","w":true,"cue":"一手一膝撑凳，背部保持水平，肘贴近身体把哑铃拉向髋部","err":"躯干旋转、耸肩、甩动","uni":true},
    {"id":"face_pull","name":"面拉","en":"Face Pull","cat":"背","m":"三角肌后束、菱形肌","a":"肩袖肌群","eq":"龙门架+绳","lv":"基础","w":true,"cue":"绳索拉向面部，肘高于手，末端外旋打开","err":"重量过大变成划船、耸肩","uni":false}
  ],
  "肩": [
    {"id":"ohp","name":"站姿杠铃推举","en":"Overhead Press","cat":"肩","m":"三角肌前中束","a":"肱三头肌、核心","eq":"杠铃","lv":"进阶","w":true,"cue":"核心收紧夹臀，杠铃从锁骨上方垂直推起，头略后让出路径","err":"腰部过度反弓、推举路径绕圈","uni":false},
    {"id":"db_shoulder_press","name":"坐姿哑铃推举","en":"Seated Dumbbell Press","cat":"肩","m":"三角肌前中束","a":"肱三头肌","eq":"哑铃+靠背凳","lv":"基础","w":true,"cue":"上背贴靠垫，哑铃从耳侧推起，顶端不完全锁死","err":"耸肩、下放过低","uni":false},
    {"id":"lateral_raise","name":"哑铃侧平举","en":"Lateral Raise","cat":"肩","m":"三角肌中束","a":"斜方肌","eq":"哑铃","lv":"基础","w":true,"cue":"肘微屈，抬到与肩同高即可，想象\"倒水\"的角度","err":"重量过大靠甩、抬过肩","uni":false},
    {"id":"rear_delt_fly","name":"俯身哑铃反向飞鸟","en":"Rear Delt Fly","cat":"肩","m":"三角肌后束","a":"菱形肌","eq":"哑铃","lv":"基础","w":true,"cue":"屈髋俯身，背部平直，向两侧抬起到与肩同高","err":"用背阔肌借力、甩动","uni":false},
    {"id":"front_raise","name":"哑铃前平举","en":"Front Raise","cat":"肩","m":"三角肌前束","a":"胸大肌上部","eq":"哑铃","lv":"基础","w":true,"cue":"抬到与肩同高，控制下放","err":"甩动、抬过头","uni":true},
    {"id":"upright_row","name":"直立划船","en":"Upright Row","cat":"肩","m":"三角肌中束、斜方肌","a":"肱二头肌","eq":"杠铃/哑铃","lv":"进阶","w":true,"cue":"握距略宽于肩，拉到胸口高度，肘高于手","err":"拉太高（过肩）易夹挤肩峰","uni":false}
  ],
  "腿": [
    {"id":"squat","name":"杠铃深蹲","en":"Barbell Back Squat","cat":"腿","m":"股四头肌、臀大肌","a":"腘绳肌、核心","eq":"杠铃+深蹲架","lv":"基础","w":true,"cue":"双脚与肩同宽略外八，膝盖顺脚尖方向，蹲到大腿平行或略低","err":"膝盖内扣、脚跟离地、弓背","uni":false},
    {"id":"front_squat","name":"前蹲","en":"Front Squat","cat":"腿","m":"股四头肌","a":"臀大肌、核心","eq":"杠铃","lv":"高阶","w":true,"cue":"杠铃置于前三角，肘部高抬，躯干尽量直立","err":"肘下沉导致杠铃滑落、含胸","uni":false},
    {"id":"leg_press","name":"腿举","en":"Leg Press","cat":"腿","m":"股四头肌、臀大肌","a":"腘绳肌","eq":"固定器械","lv":"基础","w":true,"cue":"下放到膝约 90°，下背始终贴紧靠垫，不要锁死膝盖","err":"下放过深使腰离垫、膝盖锁死","uni":false},
    {"id":"lunge","name":"哑铃箭步蹲","en":"Dumbbell Lunge","cat":"腿","m":"股四头肌、臀大肌","a":"腘绳肌、核心","eq":"哑铃","lv":"基础","w":true,"cue":"前腿膝盖不超过脚尖太多，后腿膝盖接近地面，躯干直立","err":"步子过小、膝盖内扣、身体前倾","uni":true},
    {"id":"leg_extension","name":"坐姿腿屈伸","en":"Leg Extension","cat":"腿","m":"股四头肌","a":"—","eq":"固定器械","lv":"基础","w":true,"cue":"顶端停 1 秒主动收缩，下放控制 2 秒","err":"甩腿借力、重量过大","uni":false},
    {"id":"leg_curl","name":"俯卧/坐姿腿弯举","en":"Leg Curl","cat":"腿","m":"腘绳肌","a":"腓肠肌","eq":"固定器械","lv":"基础","w":true,"cue":"髋部贴紧靠垫，靠大腿后侧发力弯举","err":"臀部抬起借力","uni":false},
    {"id":"calf_raise","name":"站姿提踵","en":"Standing Calf Raise","cat":"腿","m":"腓肠肌、比目鱼肌","a":"—","eq":"固定器械/自重","lv":"基础","w":true,"cue":"脚前掌踩在台沿，落到最低点充分拉伸，再踮到最高点停 1 秒","err":"幅度小、速度过快","uni":false}
  ],
  "臀": [
    {"id":"hip_thrust","name":"杠铃臀推","en":"Barbell Hip Thrust","cat":"臀","m":"臀大肌","a":"腘绳肌","eq":"杠铃+凳","lv":"基础","w":true,"cue":"上背靠凳，下巴微收，用臀把杠铃顶到躯干与地面平行，顶端夹臀 1 秒","err":"用腰过度反弓代替伸髋","uni":false},
    {"id":"glute_bridge","name":"臀桥","en":"Glute Bridge","cat":"臀","m":"臀大肌","a":"腘绳肌、核心","eq":"自重","lv":"基础","w":false,"cue":"脚跟发力把髋顶起，顶端夹臀，下放不完全落地","err":"用腰发力、幅度过小","uni":false},
    {"id":"cable_kickback","name":"绳索后踢腿","en":"Cable Kickback","cat":"臀","m":"臀大肌","a":"腘绳肌","eq":"龙门架","lv":"基础","w":true,"cue":"躯干微前倾固定，腿向后上方伸展，膝盖保持微屈","err":"用腰摆动、幅度过大","uni":true},
    {"id":"hip_abduction","name":"坐姿髋外展","en":"Hip Abduction","cat":"臀","m":"臀中肌","a":"臀小肌","eq":"固定器械","lv":"基础","w":true,"cue":"身体前倾可更多刺激臀中肌，向外打开到最大停 1 秒","err":"靠惯性弹开","uni":false}
  ],
  "手臂": [
    {"id":"barbell_curl","name":"杠铃弯举","en":"Barbell Curl","cat":"手臂","m":"肱二头肌","a":"肱肌、前臂","eq":"杠铃","lv":"基础","w":true,"cue":"大臂夹紧体侧不摆动，肘为定点把杠铃弯起","err":"甩腰借力、大臂前移","uni":false},
    {"id":"db_curl","name":"哑铃交替弯举","en":"Alternating Dumbbell Curl","cat":"手臂","m":"肱二头肌","a":"肱肌","eq":"哑铃","lv":"基础","w":true,"cue":"弯举时略微外旋手腕，顶端充分收缩","err":"晃动身体、下放不控制","uni":true},
    {"id":"hammer_curl","name":"锤式弯举","en":"Hammer Curl","cat":"手臂","m":"肱肌、肱桡肌","a":"肱二头肌","eq":"哑铃","lv":"基础","w":true,"cue":"拇指朝上握法，大臂固定，控制下放","err":"耸肩、摆臂","uni":true},
    {"id":"triceps_pushdown","name":"绳索下压","en":"Triceps Pushdown","cat":"手臂","m":"肱三头肌","a":"—","eq":"龙门架+绳/直杆","lv":"基础","w":true,"cue":"大臂夹紧体侧，只做肘关节伸展，末端外旋打开绳索","err":"大臂前后摆动、身体压上去借力","uni":false},
    {"id":"skull_crusher","name":"仰卧臂屈伸","en":"Skull Crusher","cat":"手臂","m":"肱三头肌","a":"—","eq":"曲杆+平凳","lv":"进阶","w":true,"cue":"上臂垂直地面固定，只让肘屈伸，杠铃下放到额头上方","err":"肘部外张、肩部代偿","uni":false},
    {"id":"overhead_ext","name":"过顶臂屈伸","en":"Overhead Triceps Extension","cat":"手臂","m":"肱三头肌长头","a":"—","eq":"哑铃/绳索","lv":"基础","w":true,"cue":"大臂贴近耳侧，肘尖朝前，下放到最大拉伸再伸直","err":"肘部外张、腰部反弓","uni":false},
    {"id":"close_grip_bench","name":"窄距卧推","en":"Close-grip Bench Press","cat":"手臂","m":"肱三头肌","a":"胸大肌、三角肌前束","eq":"杠铃+平凳","lv":"进阶","w":true,"cue":"握距与肩同宽，肘贴近身体，下放到胸骨下方","err":"握距过窄压手腕","uni":false}
  ],
  "核心": [
    {"id":"plank","name":"平板支撑","en":"Plank","cat":"核心","m":"腹直肌、腹横肌","a":"臀大肌、肩","eq":"自重","lv":"基础","w":false,"cue":"肘在肩正下方，臀部夹紧、骨盆后倾，身体成一条直线","err":"塌腰、撅臀、憋气","uni":false},
    {"id":"side_plank","name":"侧平板支撑","en":"Side Plank","cat":"核心","m":"腹斜肌","a":"臀中肌","eq":"自重","lv":"基础","w":false,"cue":"肘在肩下，髋部顶高，身体侧面成一条直线","err":"髋部下坠、耸肩","uni":true},
    {"id":"crunch","name":"卷腹","en":"Crunch","cat":"核心","m":"腹直肌","a":"—","eq":"自重","lv":"基础","w":false,"cue":"下巴微收，用腹部把肩胛卷离地面，下放控制","err":"用手拉脖子、用惯性","uni":false},
    {"id":"hanging_leg_raise","name":"悬垂举腿","en":"Hanging Leg Raise","cat":"核心","m":"腹直肌下部、髂腰肌","a":"前臂","eq":"单杠","lv":"高阶","w":false,"cue":"肩胛下沉稳定，骨盆后倾把腿抬起，避免摆荡","err":"摆动借力、只抬大腿","uni":false},
    {"id":"cable_crunch","name":"绳索卷腹","en":"Cable Crunch","cat":"核心","m":"腹直肌","a":"—","eq":"龙门架+绳","lv":"进阶","w":true,"cue":"跪姿固定髋部，用腹部把上身卷向膝盖","err":"用手臂拉、髋部前后移动","uni":false},
    {"id":"russian_twist","name":"俄罗斯转体","en":"Russian Twist","cat":"核心","m":"腹斜肌","a":"腹直肌","eq":"自重/哑铃","lv":"基础","w":true,"cue":"上背后仰约 45°，靠躯干旋转带动双手触地两侧","err":"只动手臂不转躯干","uni":false},
    {"id":"back_extension","name":"山羊挺身","en":"Back Extension","cat":"核心","m":"竖脊肌","a":"臀大肌、腘绳肌","eq":"罗马椅","lv":"基础","w":false,"cue":"髋部为支点，抬起躯干到与腿成一条线，不要过度后仰","err":"过顶后仰、速度过快","uni":false}
  ],
  "有氧": [
    {"id":"treadmill_walk","name":"跑步机快走","en":"Treadmill Walking","cat":"有氧","m":"全身（下肢为主）","a":"—","eq":"跑步机","lv":"基础","w":false,"cue":"坡度 5–10%、速度以能说话但不能唱歌为准（中等强度）","err":"扶扶手把坡度当摆设","uni":false},
    {"id":"treadmill_run","name":"跑步机跑步","en":"Treadmill Running","cat":"有氧","m":"全身（下肢为主）","a":"—","eq":"跑步机","lv":"基础","w":false,"cue":"前脚掌或全掌落地，步频比步幅优先，从慢速开始热身","err":"速度过快、抓扶手","uni":false},
    {"id":"outdoor_run","name":"户外跑步","en":"Outdoor Running","cat":"有氧","m":"全身（下肢为主）","a":"—","eq":"无","lv":"基础","w":false,"cue":"配速以能完整说一句话为准；每周增量不超过上周的 10%","err":"突然加量、忽略跑鞋磨损","uni":false},
    {"id":"cycling","name":"动感单车 / 骑行","en":"Cycling","cat":"有氧","m":"股四头肌、心肺","a":"臀大肌、小腿","eq":"单车","lv":"基础","w":false,"cue":"座位高度以脚踏最低点时膝微屈为准，保持踏频 80–100","err":"座位过低导致膝痛","uni":false},
    {"id":"elliptical","name":"椭圆机","en":"Elliptical","cat":"有氧","m":"全身","a":"臀大肌、核心","eq":"椭圆机","lv":"基础","w":false,"cue":"脚掌贴实踏板，靠推拉把手带动上肢，阻力比速度更重要","err":"只踩不推、身体前倾","uni":false},
    {"id":"rowing_machine","name":"划船机","en":"Rowing Machine","cat":"有氧","m":"背部、腿部、心肺","a":"核心","eq":"划船机","lv":"基础","w":false,"cue":"顺序：蹬腿 → 后仰 → 拉手；回程相反。发力 60% 来自腿","err":"只用手臂拉、弓背","uni":false},
    {"id":"stair_climber","name":"爬楼机 / 爬楼梯","en":"Stair Climber","cat":"有氧","m":"臀大肌、股四头肌","a":"小腿、心肺","eq":"爬楼机","lv":"基础","w":false,"cue":"全脚掌踩实，身体直立不要趴在扶手上","err":"抓扶手把体重压上去","uni":false},
    {"id":"jump_rope","name":"跳绳","en":"Jump Rope","cat":"有氧","m":"小腿、心肺","a":"肩、核心","eq":"跳绳","lv":"基础","w":false,"cue":"手腕摇绳、跳起 2–3 厘米，落地缓冲","err":"跳太高、全脚掌砸地","uni":false},
    {"id":"swimming","name":"游泳","en":"Swimming","cat":"有氧","m":"全身","a":"背、肩、核心","eq":"泳池","lv":"基础","w":false,"cue":"匀速游＋短休息，注意呼吸节奏；肩部不适立即减少量","err":"忽略热身直接冲刺","uni":false},
    {"id":"hiit","name":"HIIT 间歇","en":"HIIT","cat":"有氧","m":"全身","a":"心肺","eq":"自重/器械","lv":"进阶","w":false,"cue":"高强度 30 秒 + 低强度 90 秒为一轮，共 6–10 轮；每周不超过 2–3 次","err":"天天做、恢复不足","uni":false},
    {"id":"incline_walk","name":"爬坡走","en":"Incline Walk","cat":"有氧","m":"臀大肌、心肺","a":"腘绳肌","eq":"跑步机","lv":"基础","w":false,"cue":"坡度 10–15%、速度 4–5 km/h，不扶扶手，走 20–40 分钟","err":"扶扶手导致强度打折","uni":false},
    {"id":"brisk_walk","name":"快走","en":"Brisk Walking","cat":"有氧","m":"全身","a":"—","eq":"无","lv":"基础","w":false,"cue":"步频约 120 步/分，微微出汗、能说话但不能唱歌","err":"当成散步、速度过慢","uni":false}
  ],
  "全身": [
    {"id":"kettlebell_swing","name":"壶铃摆动","en":"Kettlebell Swing","cat":"全身","m":"臀大肌、腘绳肌","a":"核心、肩","eq":"壶铃","lv":"进阶","w":true,"cue":"屈髋把壶铃甩到胸口高度，靠伸髋爆发，不是靠手臂抬","err":"当深蹲做、用手臂抬","uni":false},
    {"id":"farmers_walk","name":"农夫行走","en":"Farmer's Walk","cat":"全身","m":"前臂、斜方肌、核心","a":"臀、腿","eq":"哑铃/壶铃","lv":"基础","w":true,"cue":"挺胸沉肩，小步快走，全程核心收紧不侧倾","err":"耸肩、含胸、走得太大步","uni":false},
    {"id":"clean_and_press","name":"杠铃翻站推举","en":"Clean and Press","cat":"全身","m":"全身","a":"核心","eq":"杠铃","lv":"高阶","w":true,"cue":"先学翻站再练推举，肘部快速前送接杠","err":"用手臂硬拉、弓背接杠","uni":false},
    {"id":"burpee","name":"波比跳","en":"Burpee","cat":"全身","m":"全身","a":"心肺","eq":"自重","lv":"进阶","w":false,"cue":"下蹲撑地 → 跳成平板 → 收腿 → 起身跳，全程保持节奏","err":"塌腰、追求速度牺牲动作质量","uni":false},
    {"id":"battle_rope","name":"战绳","en":"Battle Rope","cat":"全身","m":"肩、核心","a":"心肺","eq":"战绳","lv":"基础","w":false,"cue":"膝微屈、核心收紧，用肩快速交替甩出波浪，20–40 秒一组","err":"只用手臂、躯干僵硬","uni":false}
  ],
};

if (typeof module !== 'undefined' && module.exports) module.exports = { EXERCISE_DB: EXERCISE_DB };