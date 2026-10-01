/* insights2.js — 体重波动归因 + 洞察置信度分级
 *
 * 为什么要有这两块：
 *   · 体重归因：单日 ±0.5–1.5 kg 的正常波动常被误当成"反弹"，是放弃的高发点。
 *     把水分（糖原/钠/经期/新训练）的原因讲清楚，比多画一条曲线有用。
 *   · 置信度分级：样本少时看到的"差异"很可能只是巧合。不隐瞒不确定性（参考 Daylio 做法）。
 */
(function (global) {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(n(v) * 10) / 10; }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shift(d, k) {
    var p = String(d).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    dt.setDate(dt.getDate() + k);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function hd() { return global.__hd; }

  /** 置信度标签：样本越多越可信 */
  function confTag(k, hi) {
    if (k >= (hi || 14)) return '<span class="tag on" style="font-size:10px">较高置信度</span>';
    if (k >= 6) return '<span class="tag" style="font-size:10px">中等置信度</span>';
    return '<span class="tag" style="font-size:10px;background:var(--warn-weak);color:var(--warn)">样本偏少</span>';
  }

  /** 体重波动归因 */
  function attrHtml(db, today, W) {
    var w = db.entries.filter(function (e) { return e.type === 'weight' && n(e.value) > 0; })
      .map(function (e) { return { date: e.date, kg: n(e.value) }; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (w.length < 3) return '';
    var last = w[w.length - 1];
    if (last.date !== today) return '';                 /* 今天还没称重就不提示 */
    var prev = w.slice(-8, -1);
    if (!prev.length) return '';
    var avgPrev = prev.reduce(function (a, b) { return a + b.kg; }, 0) / prev.length;
    var diff = r1(last.kg - avgPrev);
    if (Math.abs(diff) < 0.8) return '';
    var y = shift(today, -1), why = [], c = 0, kcal = 0, trained = 0, water = 0;
    db.entries.forEach(function (e) {
      if (e.date !== y) return;
      if (e.type === 'food') { c += n(e.c); kcal += n(e.kcal); }
      if (e.type === 'water') water += n(e.value);
    });
    if (W) W.state().sessions.forEach(function (s) { if (s.date === y) trained = 1; });
    var period = db.entries.some(function (e) { return e.type === 'period' && e.date >= shift(today, -5); });
    var goal = n(db.goals.kcal);
    if (c >= 250) why.push('前一天碳水 ' + Math.round(c) + ' g 偏高 —— 糖原会同时锁住水分（1 g 糖原约带 3–4 g 水）');
    if (trained) why.push('前一天练了力量 —— 新训练或大重量后肌肉会暂时潴留水分修复，通常 1–3 天消退');
    if (period) why.push('近期有经期标记 —— 黄体期水潴留常见，幅度可达 0.5–2 kg');
    if (goal > 0 && kcal > goal + 500) why.push('前一天比预算多吃 ' + Math.round(kcal - goal) + ' 千卡 —— 食物本身的重量、钠和水都会反映在秤上');
    if (water < 800) why.push('前一天饮水偏少（' + Math.round(water) + ' ml）—— 身体倾向于保水');
    if (!why.length) why.push('没找到明显原因（可能是钠、睡眠或称重时间不同）');
    return '<section class="panel" style="border-left:3px solid ' + (diff > 0 ? 'var(--warn)' : 'var(--accent)') + '">' +
      '<div class="row"><h2>今天体重的解释</h2><span class="hint">单日波动很正常</span></div>' +
      '<div style="font-size:22px;font-weight:700;margin:2px 0 6px">今天 ' + last.kg + ' kg，比近 7 天均值' +
      (diff > 0 ? '高' : '低') + ' ' + Math.abs(diff) + ' kg</div>' +
      '<div class="hint" style="line-height:1.8">' + why.map(function (x) { return '· ' + esc(x); }).join('<br>') +
      '<br><b>判断进步请看 7 天移动平均，不要看单日数字。</b></div>' +
      '</section>';
  }

  /** 洞察的总览：样本量 + 置信度（避免"自信地胡说"） */
  function confidenceHtml(db, today, W) {
    var sleepN = 0, trainN = 0;
    var sleepBy = {};
    db.entries.forEach(function (e) { if (e.type === 'rest') sleepBy[e.date] = (sleepBy[e.date] || 0) + n(e.value); });
    Object.keys(sleepBy).forEach(function (d) { if (sleepBy[d] > 0) sleepN++; });
    if (W) trainN = W.state().sessions.length;
    var paired = 0;
    if (W) {
      W.state().sessions.forEach(function (s) { if (sleepBy[shift(s.date, -1)] > 0) paired++; });
    }
    return '<div class="hint" style="margin-top:8px">' +
      '数据量：睡眠 ' + sleepN + ' 天 · 训练 ' + trainN + ' 次 · 可配对（前夜有睡眠记录的训练）' + paired + ' 次。' +
      (paired >= 14 ? '配对样本已够做<b>较高置信度</b>的对比。' :
        paired >= 6 ? '配对样本够做<b>中等置信度</b>的对比；到 14 次会更稳。' :
          '配对样本还少，任何"差异"都可能只是巧合 —— 这也是为什么上面的结论都标了置信度。') +
      '</div>';
  }

  function render() {
    var box = $('#xAttr'); if (!box) return;
    var host = hd(); if (!host) return;
    var today = host.today ? host.today() : host.date();
    var W = global.HDWorkout;
    var html = attrHtml(host.db, today, W) + confidenceHtml(host.db, today, W);
    box.innerHTML = html;
  }

  global.HDInsights2 = { render: render, confTag: confTag };
})(window);
