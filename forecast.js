/* forecast.js — 目标预测（体重 / 力量 / 有氧强度区间）
 *
 * 算法依据（调研结论）：
 *   体重：Holt 线性趋势平滑（α≈0.18 约等于 10 天 EMA，β≈0.08）→ 对最近 28 天的平滑值做最小二乘
 *         → 斜率 ± 1.96·SE 给出达成区间。禁用最近 3 天外推（日体重 SD 0.5–1.5 kg，信噪比 <1）。
 *   门槛：有效点 <10 或跨度 <14 天不给日期；残差 >0.8 kg 视为波动过大；斜率置信区间含 0 视为趋势不显著。
 *   速率：CDC 建议每周 0.45–0.9 kg；经验上限 1% 体重/周 —— 超限只警告，不改数字。
 *   力量：力量增长递减 → 用对数模型 e1RM(t)=a+b·ln t，短期（<3 个月）可用；必须设上限，避免线性外推荒谬值。
 *   强度：HRmax 用 Tanaka 208−0.7×年龄（220−年龄 误差 ±10–12，不推荐）；区间用 Karvonen 储备心率法。
 */
(function (global) {
  'use strict';

  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function dayNum(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function addDays(s, k) {
    var p = String(s).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + k);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ---------- Holt 线性趋势 ---------- */
  function holt(vals, alpha, beta) {
    alpha = alpha || 0.18; beta = beta || 0.08;
    var out = [], l = n(vals[0]), b = 0;
    out.push(l);
    for (var i = 1; i < vals.length; i++) {
      var prev = l;
      l = alpha * n(vals[i]) + (1 - alpha) * (l + b);
      b = beta * (l - prev) + (1 - beta) * b;
      out.push(l);
    }
    return out;
  }

  /* ---------- 最小二乘（x 可为不规则间距） ---------- */
  function ols(pts) {
    var m = pts.length, sx = 0, sy = 0;
    pts.forEach(function (p) { sx += p.x; sy += p.y; });
    var mx = sx / m, my = sy / m, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sxx += (p.x - mx) * (p.x - mx); sxy += (p.x - mx) * (p.y - my); });
    var slope = sxx ? sxy / sxx : 0;
    var ss = 0;
    pts.forEach(function (p) { var e = p.y - (my + slope * (p.x - mx)); ss += e * e; });
    var sd = m > 2 ? Math.sqrt(ss / (m - 2)) : 0;
    var se = sxx ? sd / Math.sqrt(sxx) : 0;
    var sst = 0;
    pts.forEach(function (p) { sst += (p.y - my) * (p.y - my); });
    var r2 = sst ? 1 - ss / sst : 0;
    return { slope: slope, intercept: my - slope * mx, sd: sd, se: se, r2: r2, n: m, mx: mx };
  }

  /* ---------- 体重预测 ---------- */
  /**
   * @param pts   [{date:'YYYY-MM-DD', kg:Number}] 按日期升序
   * @param target 目标体重 kg
   * @param today  'YYYY-MM-DD'
   * @param deficit 日均热量缺口（可选，用于交叉校验）
   */
  function forecastWeight(pts, target, today, deficit) {
    var list = (pts || []).filter(function (p) { return p && p.kg > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    /* 同一天多条取最后一条 */
    var dedup = [];
    list.forEach(function (p) { if (dedup.length && dedup[dedup.length - 1].date === p.date) dedup[dedup.length - 1] = p; else dedup.push(p); });
    list = dedup;

    var out = { ok: false, pts: list.length, level: 0, rateWeek: 0, warn: '', cross: '' };
    if (list.length < 10) { out.reason = '还需要更多记录：目前 ' + list.length + ' 次，至少 10 次（约再记 2 周）'; return out; }
    var span = dayNum(list[list.length - 1].date) - dayNum(list[0].date);
    out.spanDays = span;
    if (span < 14) { out.reason = '记录跨度只有 ' + span + ' 天，至少需要 14 天'; return out; }

    var levels = holt(list.map(function (p) { return p.kg; }));
    var base = dayNum(list[0].date);
    var series = list.map(function (p, i) { return { x: dayNum(p.date) - base, y: levels[i] }; });
    var use = series.slice(-28);
    var o = ols(use);
    /* 关键：噪声与标准误要用**原始体重**相对趋势线的残差来算。
       用平滑值算会把 3–4 倍的水分波动"平滑掉"，得出虚窄的置信区间与虚假的信心。 */
    var raw = list.slice(-28), ss = 0;
    raw.forEach(function (p) {
      var x = dayNum(p.date) - base;
      var e = p.kg - (o.intercept + o.slope * x);
      ss += e * e;
    });
    var sdRaw = Math.sqrt(ss / Math.max(1, raw.length - 2));
    var sxx = use.reduce(function (a, p) { return a + (p.x - o.mx) * (p.x - o.mx); }, 0) || 1;
    var seRaw = sdRaw / Math.sqrt(sxx);
    o.sd = sdRaw; o.se = seRaw;
    out.level = r1(levels[levels.length - 1]);
    out.ema7 = r1(levels.slice(-7).reduce(function (a, b) { return a + b; }, 0) / Math.min(7, levels.length));
    out.residual = r1(o.sd);
    out.r2 = r1(o.r2 * 100) / 100;
    out.usedPoints = use.length;
    out.rateWeek = r1(7 * o.slope);

    if (o.sd > 0.8) { out.reason = '最近体重波动较大（残差 ±' + r1(o.sd) + ' kg），先稳定记录一段时间再预测'; return out; }
    if (Math.abs(o.slope) < 1.96 * o.se) { out.reason = '目前趋势不明显（斜率 ±' + r1(7 * 1.96 * o.se) + ' kg/周 区间含 0），暂不给日期'; return out; }

    target = n(target);
    if (target > 0) {
      if (Math.sign(target - out.level) !== Math.sign(o.slope)) {
        out.reason = '按最近趋势是' + (o.slope > 0 ? '上升' : '下降') + '，与目标方向相反';
        return out;
      }
      var d1 = (target - out.level) / o.slope;
      var hi = o.slope + 1.96 * o.se, lo = o.slope - 1.96 * o.se;
      var far = Math.max((target - out.level) / (hi || 1e-6), (target - out.level) / (lo || -1e-6));
      var near = Math.min((target - out.level) / (hi || 1e-6), (target - out.level) / (lo || -1e-6));
      if (d1 < 0) { out.reason = '已经达到目标体重了'; return out; }
      out.days = Math.round(d1);
      out.date = addDays(today, Math.round(d1));
      out.rangeDays = [Math.max(0, Math.round(near)), Math.round(far)];
      out.rangeDates = [addDays(today, out.rangeDays[0]), addDays(today, out.rangeDays[1])];
      if (out.days > 730) { out.reason = '按当前速度需要 2 年以上，先只关注方向、不追日期'; out.ok = true; out.noDate = true; return out; }
      if (Math.abs(target - out.level) < 1) { out.reason = '距目标不到 1 kg，基本可以认为已经达成'; out.ok = true; out.noDate = true; return out; }
    }
    /* 速率提示：1% 体重/周 为经验上限；CDC 建议 0.45–0.9 kg/周 */
    var cap = 0.01 * out.level;
    if (Math.abs(out.rateWeek) > cap) out.warn = '当前速度约 ' + Math.abs(out.rateWeek) + ' kg/周，超过体重的 1%/周，偏快（可能掉肌肉/水分）。建议放慢到 0.5–1 kg/周。';
    else if (Math.abs(out.rateWeek) > 0.9) out.warn = '速度略快于常见建议（0.45–0.9 kg/周），注意保证蛋白质与力量训练。';
    /* 与热量缺口交叉校验 */
    if (n(deficit) > 0) {
      var byKcal = 7 * n(deficit) / 7700;
      out.cross = '按日均缺口 ' + Math.round(deficit) + ' 千卡推算约 ' + r1(byKcal) + ' kg/周';
      if (byKcal > 0 && Math.abs(byKcal - Math.abs(out.rateWeek)) > Math.max(0.2, byKcal * 0.35)) {
        out.cross += '，与实际趋势差得较多 —— 可能已出现代谢适应，或饮食记录不完整。';
      } else { out.cross += '，与实际趋势基本吻合。'; }
    }
    if (target > 0) out.reason = '按最近 ' + use.length + ' 个平滑点估计，约 ' + Math.round(out.days / 7) + ' 周后（' + out.rangeDates[0].slice(5) + ' – ' + out.rangeDates[1].slice(5) + '）达到 ' + target + ' kg';
    else out.reason = '当前趋势 ' + (out.rateWeek < 0 ? '下降' : '上升') + ' 约 ' + Math.abs(out.rateWeek) + ' kg/周';
    out.ok = true;
    return out;
  }

  /* ---------- 力量预测（e1RM 对数模型 + 上限保护） ---------- */
  /**
   * @param series [{date, v}] 某动作的 e1RM 历史
   * @param horizonDays 预测天数，默认 56（8 周）
   */
  function forecastStrength(series, horizonDays) {
    var list = (series || []).filter(function (p) { return p && p.v > 0; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var out = { ok: false, pts: list.length, horizonDays: horizonDays || 56 };
    if (list.length < 3) { out.reason = '至少需要 3 次同动作记录才能看趋势'; return out; }
    var base = dayNum(list[0].date);
    var xs = list.map(function (p) { return { x: Math.log(Math.max(1, dayNum(p.date) - base + 1)), y: p.v }; });
    var o = ols(xs);
    out.now = r1(list[list.length - 1].v);
    out.r2 = r1(o.r2 * 100) / 100;
    out.perWeek = r1(7 * o.slope / Math.max(1, (dayNum(list[list.length - 1].date) - base) / 30 || 1));
    var t = Math.log(dayNum(list[list.length - 1].date) - base + 1 + out.horizonDays);
    var proj = o.intercept + o.slope * t;
    /* 上限保护：8 周内涨幅不超过当前值的 15%（约相当于每月 ~7%，已是很快的速度） */
    var cap = out.now * 1.15;
    if (proj > cap) { proj = cap; out.capped = true; }
    out.projected = r1(proj);
    out.gain = r1(out.projected - out.now);
    out.weeks = Math.round(out.horizonDays / 7);
    out.ok = true;
    /* 需要多少周达到某个目标（可选） */
    out.weeksTo = function (target) {
      target = n(target);
      if (!(target > out.now) || o.slope <= 0) return 0;
      var tt = Math.exp((target - o.intercept) / o.slope);
      return Math.max(1, Math.round((tt - (dayNum(list[list.length - 1].date) - base + 1)) / 7));
    };
    out.reason = '按最近 ' + list.length + ' 次记录的趋势，约 ' + out.weeks + ' 周后 e1RM 约 ' + out.projected + ' kg（+' + out.gain + '）' +
      (out.capped ? '，已按"每月约 7% 上限"做了限制' : '');
    out.uncertain = o.sd > out.now * 0.12 ? '数据波动较大，仅供参考' : '';
    return out;
  }

  /* ---------- 有氧强度区间 ---------- */
  function hrZones(age, restingHR) {
    age = n(age); restingHR = n(restingHR) || 60;
    if (!(age > 0)) return null;
    var hrmax = Math.round(208 - 0.7 * age);           // Tanaka（推荐）
    var naive = 220 - age;                              // 仅作对比
    var out = { hrmax: hrmax, naive: naive, resting: Math.round(restingHR), zones: [] };
    var defs = [
      { z: 'Z1', name: '恢复', lo: 50, hi: 60, feel: '非常轻松，可以随意聊天' },
      { z: 'Z2', name: '有氧底盘', lo: 60, hi: 70, feel: '能说完整句子（常说的"能聊但不能唱"）' },
      { z: 'Z3', name: '节奏', lo: 70, hi: 80, feel: '只能短句，呼吸明显加快' },
      { z: 'Z4', name: '阈值', lo: 80, hi: 90, feel: '很吃力，几乎说不出话' },
      { z: 'Z5', name: '最大', lo: 90, hi: 100, feel: '全力，只能维持很短时间' }
    ];
    defs.forEach(function (d) {
      var bpmLo = Math.round((hrmax - restingHR) * d.lo / 100 + restingHR);
      var bpmHi = Math.round((hrmax - restingHR) * d.hi / 100 + restingHR);
      var pctMaxLo = Math.round(bpmLo / hrmax * 100);
      out.zones.push({ z: d.z, name: d.name, hrr: [d.lo, d.hi], bpm: [bpmLo, bpmHi], pctMax: pctMaxLo, feel: d.feel });
    });
    return out;
  }

  /** MET 消耗：kcal = MET × 3.5 × 体重kg ÷ 200 × 分钟 */
  function kcalFromMet(met, kg, minutes) {
    return Math.round(n(met) * 3.5 * n(kg) / 200 * n(minutes));
  }

  global.HDForecast = {
    holt: holt, ols: ols,
    weight: forecastWeight, strength: forecastStrength,
    hrZones: hrZones, kcalFromMet: kcalFromMet, addDays: addDays
  };
})(window);
