/* =========================================================================
 * plans.js — 减肥计划与能量引擎（纯函数，无 DOM 依赖，便于单独测试）
 * 依据：Mifflin–St Jeor / Harris–Benedict / 中国 DRI / Katch–McArdle；
 *       WHO 身体活动指南；《中国居民膳食指南（2022）》；
 *       《中国超重/肥胖症诊疗指南（2024）》的 5%/10%/15% 减重目标。
 * ========================================================================= */
var HD_PLANS = (function () {
  'use strict';

  var KCAL_PER_KG_FAT = 7700;         // 1 kg 体脂 ≈ 7700 kcal
  var SAFE_LOSS_MIN = 0.25;           // kg/周
  var SAFE_LOSS_MAX = 1.0;            // kg/周
  var KCAL_FLOOR = { male: 1500, female: 1200 };
  var MAX_ADJUST = 0.15;              // 单次自动调整上限 ±15%
  var PLATEAU_WEEKS = 3;              // 连续多少周趋势不降才算平台期
  var MIN_COMPLETENESS = 0.8;         // 记录完整度低于此值不调参

  var FORMULAS = [
    ['mifflin', 'Mifflin–St Jeor（推荐）'],
    ['harris', 'Harris–Benedict 修订版'],
    ['dri', '中国 DRI（2013/2023）'],
    ['katch', 'Katch–McArdle（需体脂率）']
  ];

  var ACTIVITY = [
    [1.2, '久坐（几乎不运动）'],
    [1.375, '轻度（每周 1–3 次运动）'],
    [1.55, '中度（每周 3–5 次）'],
    [1.725, '高度（每周 6–7 次）'],
    [1.9, '极高（重体力或一天两练）']
  ];

  /* ---------------- 能量计算 ---------------- */
  function num(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function round(v, d) { var m = Math.pow(10, d == null ? 0 : d); return Math.round(num(v) * m) / m; }

  function bmr(p) {
    p = p || {};
    var w = num(p.weight), h = num(p.height), a = num(p.age), bf = num(p.bodyFat);
    var male = p.sex !== 'female';
    switch (p.formula) {
      case 'harris':
        return male ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a : 447.593 + 9.247 * w + 3.098 * h - 4.330 * a;
      case 'dri': {
        var base;
        if (a < 45) base = male ? 15.3 * w + 679 : 14.7 * w + 496;
        else if (a < 60) base = male ? 11.6 * w + 879 : 8.7 * w + 829;
        else base = male ? 13.5 * w + 487 : 10.5 * w + 596;
        return base * (a < 60 ? 0.95 : 1);
      }
      case 'katch':
        if (!(bf > 0)) return null;
        return 370 + 21.6 * w * (1 - bf / 100);
      default:
        return male ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    }
  }
  function tdee(p) {
    var b = bmr(p);
    if (b == null) return null;
    return b * (num(p && p.activity) || 1.375);
  }
  function deficitFor(kgPerWeek) { return num(kgPerWeek) * KCAL_PER_KG_FAT / 7; }
  function weeklyLossFor(deficitPerDay) { return num(deficitPerDay) * 7 / KCAL_PER_KG_FAT; }

  /** 由 TDEE 与目标周减重推出每日热量预算（floorEnabled === false 时不做安全下限兜底） */
  function budget(tdeeKcal, kgPerWeek, sex, floorEnabled) {
    var target = num(tdeeKcal) - deficitFor(kgPerWeek);
    var floor = KCAL_FLOOR[sex === 'female' ? 'female' : 'male'];
    var useFloor = floorEnabled !== false;
    return {
      kcal: useFloor ? Math.max(Math.round(target), floor) : Math.round(target),
      floored: useFloor && target < floor,
      floor: floor,
      floorEnabled: useFloor
    };
  }

  function bmi(weightKg, heightCm) {
    var h = num(heightCm) / 100;
    if (!(h > 0) || !(num(weightKg) > 0)) return null;
    return round(num(weightKg) / (h * h), 1);
  }
  function bmiClass(v) {
    if (v == null) return '';
    if (v < 18.5) return '偏瘦';
    if (v < 24) return '正常';
    if (v < 28) return '超重';
    return '肥胖';           // 《中国超重/肥胖症诊疗指南（2024）》以 BMI≥28 为肥胖症
  }
  function whtr(waistCm, heightCm) {
    if (!(num(waistCm) > 0) || !(num(heightCm) > 0)) return null;
    return round(num(waistCm) / num(heightCm), 3);
  }
  /** 美国海军围度法体脂率（厘米输入，公式按英寸推导后换算） */
  function navyBodyFat(sex, heightCm, waistCm, neckCm, hipCm) {
    if (!(num(heightCm) > 0) || !(num(waistCm) > 0) || !(num(neckCm) > 0)) return null;
    var h = num(heightCm) / 2.54, w = num(waistCm) / 2.54, nk = num(neckCm) / 2.54;
    var v;
    if (sex === 'female') {
      if (!(num(hipCm) > 0)) return null;
      v = 163.205 * Math.log10(w + num(hipCm) / 2.54 - nk) - 97.684 * Math.log10(h) - 78.387;
    } else {
      v = 86.010 * Math.log10(w - nk) - 70.041 * Math.log10(h) + 36.76;
    }
    return round(v, 1);
  }
  function macroFromKcal(kcal, macro) {
    macro = macro || { c: 0, p: 0, f: 0 };
    return { c: round(num(kcal) * num(macro.c) / 100 / 4, 1), p: round(num(kcal) * num(macro.p) / 100 / 4, 1), f: round(num(kcal) * num(macro.f) / 100 / 9, 1) };
  }
  function proteinTarget(weightKg, goal) {
    var g = { maintain: 1.2, loss: 1.6, gain: 1.8 }[goal] || 1.4;
    return round(num(weightKg) * g, 0);
  }

  /* ---------------- 运动 ---------------- */
  var METS = [
    ['散步 3 km/h', 2.5], ['快走 5.6 km/h', 4.3], ['快走 6.4 km/h', 5.0],
    ['跑步 8 km/h', 8.3], ['跑步 10 km/h', 9.8], ['跑步 12 km/h', 11.8],
    ['骑行 16–19 km/h', 6.8], ['骑行 20–22 km/h', 8.0],
    ['游泳（自由泳中速）', 7.0], ['跳绳（中速）', 11.8],
    ['力量训练（一般）', 5.0], ['力量训练（大重量）', 6.0],
    ['爬楼梯', 8.8], ['篮球', 6.5], ['羽毛球（单打）', 6.0], ['足球', 7.0],
    ['健身操 / 广场舞', 6.0], ['瑜伽', 2.5], ['太极拳', 3.0], ['家务（打扫）', 3.0]
  ];
  /** 运动消耗（MET × 体重kg × 小时），误差通常 ±20% */
  function exerciseKcal(met, weightKg, minutes) {
    return round(num(met) * num(weightKg) * num(minutes) / 60, 0);
  }
  /** 步数粗估：约 0.04 kcal/步·kg（仅供参考） */
  function stepsKcal(steps, weightKg) { return round(num(steps) * 0.04 * num(weightKg) / 60, 1); }

  /* ---------------- 计划模板 ---------------- */
  /* 饮食方法库位于 diet-library.js（40 种），这里只做引用与兜底 */
  var DIET_PLANS = (typeof HD_DIET_LIBRARY !== 'undefined' && HD_DIET_LIBRARY.length)
    ? HD_DIET_LIBRARY
    : [{
        id: 'cico', group: '热量缺口', name: 'CICO 热量缺口', en: 'CICO', tag: '最底层原理',
        principle: '摄入热量长期低于消耗，身体只能动用储备能量。',
        content: '不限定食物种类，只设每日缺口（常用 500 千卡）。',
        record: ['每日总热量', '体重'], evidence: '证据最强。', source: '',
        caution: '孕哺期、进食障碍史者不宜严格计数。', myth: '以为热量都一样。',
        macro: { c: 50, p: 25, f: 25 }, proteinPerKg: 1.4, fasting: null
      }];

  var EXERCISE_PLANS = [
    {
      id: 'starter', name: '久坐初学者', for: 'BMI 偏高、没有运动习惯',
      week: [
        { d: 1, title: '快走 30 分钟', met: 4.3, minutes: 30 },
        { d: 2, title: '居家力量 20 分钟（深蹲/俯卧撑/弹力带）', met: 3.5, minutes: 20, strength: true },
        { d: 3, title: '快走 30 分钟', met: 4.3, minutes: 30 },
        { d: 4, title: '居家力量 20 分钟', met: 3.5, minutes: 20, strength: true },
        { d: 5, title: '快走 30 分钟', met: 4.3, minutes: 30 },
        { d: 6, title: '散步 + 拉伸 30 分钟', met: 2.5, minutes: 30 },
        { d: 0, title: '休息', met: 0, minutes: 0 }
      ],
      weekly: '约 150 分钟中等强度有氧 + 2 次力量'
    },
    {
      id: 'office', name: '上班族（时间紧）', for: '每周能挤出 3 次 30 分钟',
      week: [
        { d: 1, title: '力量 25 分钟（复合动作）', met: 5.0, minutes: 25, strength: true },
        { d: 2, title: '快走 40 分钟', met: 4.3, minutes: 40 },
        { d: 3, title: '力量 25 分钟', met: 5.0, minutes: 25, strength: true },
        { d: 4, title: '快走 40 分钟', met: 4.3, minutes: 40 },
        { d: 5, title: '力量 25 分钟', met: 5.0, minutes: 25, strength: true },
        { d: 6, title: '每小时起身 2 分钟（NEAT）', met: 2.0, minutes: 20 },
        { d: 0, title: '休息', met: 0, minutes: 0 }
      ],
      weekly: '3 次力量 + 2 次快走'
    },
    {
      id: 'advanced', name: '进阶加速', for: '有训练基础、关节无问题',
      week: [
        { d: 1, title: '力量 40 分钟（4×8 复合）', met: 6.0, minutes: 40, strength: true },
        { d: 2, title: 'HIIT 20 分钟（30 s 冲刺 / 90 s 慢跑 × 8）', met: 9.0, minutes: 20 },
        { d: 3, title: '力量 40 分钟', met: 6.0, minutes: 40, strength: true },
        { d: 4, title: '长距离快走 60 分钟', met: 4.3, minutes: 60 },
        { d: 5, title: '力量 40 分钟', met: 6.0, minutes: 40, strength: true },
        { d: 6, title: 'HIIT 20 分钟', met: 9.0, minutes: 20 },
        { d: 0, title: '休息', met: 0, minutes: 0 }
      ],
      weekly: '3 次力量 + 2 次 HIIT + 1 次长走（HIIT 每周不超过 2 次）'
    }
  ];

  /* ---------------- 体重趋势 ---------------- */
  /** 取某天最后一条体重记录（同一天多条以 created 最大的为准） */
  function weightOn(entries, day) {
    var list = entries.filter(function (x) { return x.type === 'weight' && x.date === day; });
    list.sort(function (a, b) { return num(b.created) - num(a.created); });
    return list.length ? num(list[0].value) : null;
  }
  /** 生成截至 endDate 的 days 天趋势序列（含 7 日移动平均，缺失日沿用上一次体重） */
  function weightTrend(entries, endDate, days) {
    var out = [], last = null, raw = [];
    var end = new Date(endDate + 'T12:00:00');
    var start = new Date(end.getTime());
    start.setDate(start.getDate() - (days - 1));
    /* 为了 7 日平均，向前多取 6 天 */
    var pre = new Date(start.getTime());
    pre.setDate(pre.getDate() - 6);
    var cur = new Date(pre.getTime());
    while (cur <= end) {
      var ds = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      var w = weightOn(entries, ds);
      if (w != null) last = w;
      var entry = { date: ds, weight: w, carried: last };
      raw.push(entry);
      if (cur >= start) {
        var win = raw.slice(-7).filter(function (x) { return x.carried != null; });
        var ma = win.length ? win.reduce(function (s, x) { return s + x.carried; }, 0) / win.length : null;
        out.push({ date: ds, weight: w, trend: ma == null ? null : round(ma, 2) });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
  /** 用趋势曲线首尾差估算体重变化（kg） */
  function trendDelta(trend, daysBack) {
    var pts = trend.filter(function (x) { return x.trend != null; });
    if (pts.length < 2) return null;
    var back = Math.min(daysBack == null ? 14 : daysBack, pts.length - 1);
    var last = pts[pts.length - 1], first = pts[pts.length - 1 - back];
    var spanDays = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (spanDays <= 0) return null;
    return { deltaKg: round(last.trend - first.trend, 2), days: spanDays, perDay: (last.trend - first.trend) / spanDays };
  }

  /* ---------------- 每周复盘与自动调参 ---------------- */
  function sumIntake(entries, days, endDate) {
    var map = {}, end = new Date(endDate + 'T12:00:00'), cur = new Date(end.getTime());
    cur.setDate(cur.getDate() - (days - 1));
    var list = [];
    while (cur <= end) {
      var ds = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      var dayKcal = entries.reduce(function (s, x) {
        if (x.date !== ds) return s;
        if (x.type === 'food') return s + num(x.kcal);
        if (x.type === 'adjust' && x.field === 'kcal') return s + num(x.value);
        return s;
      }, 0);
      list.push({ date: ds, kcal: dayKcal, logged: dayKcal > 0 });
      cur.setDate(cur.getDate() + 1);
    }
    var logged = list.filter(function (x) { return x.logged; });
    return {
      days: list,
      loggedDays: logged.length,
      completeness: round(logged.length / days, 2),
      avgKcal: logged.length ? round(logged.reduce(function (s, x) { return s + x.kcal; }, 0) / logged.length, 0) : 0
    };
  }

  /**
   * 周复盘：用"实际摄入 + 体重趋势变化"反推真实 TDEE，并给出新的热量预算建议。
   * 护栏：单次调整 ≤ ±15%；记录完整度 <80% 不调参；连续 3 周趋势不降才判平台期。
   */
  function review(state, opts) {
    opts = opts || {};
    var entries = state.entries || [];
    var profile = state.profile || {};
    var goals = state.goals || {};
    var endDate = opts.endDate;
    var window_ = 14;                                   // 用 14 天窗口估算
    var intake = sumIntake(entries, window_, endDate);
    var trend = weightTrend(entries, endDate, window_ + 7);
    var delta = trendDelta(trend, window_);
    var currentKcal = num(goals.kcal);
    var result = {
      windowDays: window_, intake: intake, trend: trend, delta: delta,
      currentKcal: currentKcal, measuredTdee: null, suggestedKcal: null,
      adjustPct: 0, plateau: false, canAdjust: false, reasons: [], notes: []
    };
    if (intake.completeness < MIN_COMPLETENESS) {
      result.reasons.push('记录完整度只有 ' + Math.round(intake.completeness * 100) + '%，低于 80%，本次不调整，先把记录补齐。');
    }
    if (!delta) {
      result.reasons.push('体重记录不足（至少需要两次有效趋势点），无法反推消耗。');
    }
    if (intake.completeness >= MIN_COMPLETENESS && delta && intake.avgKcal > 0) {
      /* 实测 TDEE = 平均摄入 + 体重下降对应的能量（下降为正） */
      var measured = intake.avgKcal + (-delta.perDay * KCAL_PER_KG_FAT);
      result.measuredTdee = round(measured, 0);
      var planned = deficitFor(num(profile.kgPerWeek) || 0.5);
      var target = result.measuredTdee - planned;
      var floor = KCAL_FLOOR[profile.sex === 'female' ? 'female' : 'male'];
      var useFloor = !(state.plan && state.plan.floorEnabled === false);
      /* 先做 ±15% 限幅，再看安全下限：这样最终值一定同时满足两条护栏，
         而且提示语反映的正是"真正决定了这个数字"的那条规则 */
      var capped = target;
      var maxUp = currentKcal * (1 + MAX_ADJUST), maxDown = currentKcal * (1 - MAX_ADJUST);
      if (capped > maxUp) { capped = maxUp; result.notes.push('单次上调不超过 15%，已限幅。'); }
      if (capped < maxDown) { capped = maxDown; result.notes.push('单次下调不超过 15%，已限幅。'); }
      if (useFloor && capped < floor) { capped = floor; result.notes.push('已触及安全下限 ' + floor + ' 千卡，不再下调。'); }
      if (!useFloor && target < floor) { result.notes.push('安全下限已关闭，本次建议低于常规下限 ' + floor + ' 千卡。'); }
      result.suggestedKcal = Math.round(capped);
      result.adjustPct = currentKcal > 0 ? round((result.suggestedKcal - currentKcal) / currentKcal * 100, 1) : 0;
      result.canAdjust = true;

      /* 平台期判定：连续 3 周趋势不降 */
      var longTrend = weightTrend(entries, endDate, PLATEAU_WEEKS * 7 + 7);
      var longDelta = trendDelta(longTrend, PLATEAU_WEEKS * 7);
      if (longDelta && longDelta.deltaKg > -0.2) {
        result.plateau = true;
        result.notes.push('最近 ' + PLATEAU_WEEKS + ' 周趋势体重几乎没有下降，可能进入平台期（先排除经期、水分与漏记）。');
      }
    }
    if (result.canAdjust) {
      var d = result.suggestedKcal - currentKcal;
      result.reasons.push('按 14 天实测：平均摄入 ' + intake.avgKcal + ' 千卡，趋势体重变化 ' + result.delta.deltaKg + ' kg（' + result.delta.days + ' 天）。');
      result.reasons.push('反推实际 TDEE ≈ ' + result.measuredTdee + ' 千卡，建议预算 ' + result.suggestedKcal + ' 千卡（' + (d >= 0 ? '+' : '') + d + '，' + result.adjustPct + '%）。');
    }
    return result;
  }

  /** 里程碑：以起始体重为基准的 5% / 10% / 15% 目标 */
  function milestones(startWeight, currentWeight, targetWeight) {
    var s = num(startWeight), c = num(currentWeight), t = num(targetWeight);
    if (!(s > 0)) return [];
    var out = [];
    [0.05, 0.10, 0.15].forEach(function (pct) {
      var goal = round(s * (1 - pct), 1);
      out.push({ pct: pct * 100, goalKg: goal, reached: c > 0 && c <= goal + 0.05, remaining: c > 0 ? round(c - goal, 1) : null });
    });
    if (t > 0 && t < s) {
      out.push({ pct: round((s - t) / s * 100, 1), goalKg: t, reached: c > 0 && c <= t + 0.05, remaining: c > 0 ? round(c - t, 1) : null, custom: true });
    }
    return out;
  }

  /** 断食窗口：给定窗口与当前时间，返回状态 */
  function fastingState(startHHMM, endHHMM, now) {
    now = now || new Date();
    function mins(s) { var p = String(s || '').split(':'); return num(p[0]) * 60 + num(p[1]); }
    var s = mins(startHHMM), e = mins(endHHMM), cur = now.getHours() * 60 + now.getMinutes();
    if (!(e > s)) return { valid: false, eating: false, text: '窗口设置无效' };
    var eating = cur >= s && cur < e;
    var left = eating ? e - cur : (cur < s ? s - cur : 1440 - cur + s);
    var dur = Math.floor(left / 60) + ' 小时 ' + (left % 60) + ' 分钟';
    return {
      valid: true, eating: eating, minutesLeft: left,
      text: eating ? ('进食窗口还剩 ' + dur) : ('距离开窗还有 ' + dur)
    };
  }

  return {
    KCAL_PER_KG_FAT: KCAL_PER_KG_FAT, SAFE_LOSS_MIN: SAFE_LOSS_MIN, SAFE_LOSS_MAX: SAFE_LOSS_MAX,
    MAX_ADJUST: MAX_ADJUST, PLATEAU_WEEKS: PLATEAU_WEEKS, MIN_COMPLETENESS: MIN_COMPLETENESS,
    FORMULAS: FORMULAS, ACTIVITY: ACTIVITY, METS: METS,
    DIET_PLANS: DIET_PLANS, EXERCISE_PLANS: EXERCISE_PLANS,
    bmr: bmr, tdee: tdee, deficitFor: deficitFor, weeklyLossFor: weeklyLossFor, budget: budget,
    bmi: bmi, bmiClass: bmiClass, whtr: whtr, navyBodyFat: navyBodyFat,
    macroFromKcal: macroFromKcal, proteinTarget: proteinTarget,
    exerciseKcal: exerciseKcal, stepsKcal: stepsKcal,
    weightOn: weightOn, weightTrend: weightTrend, trendDelta: trendDelta, sumIntake: sumIntake,
    review: review, milestones: milestones, fastingState: fastingState, round: round
  };
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = HD_PLANS; }
