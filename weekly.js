/* weekly.js — 周报一张图（近 7 天五项数据汇总）
 *
 * 设计依据：跨模块信息只在「固定时刻」汇总一次，不做实时推送 —— 这是防止通知疲劳的关键。
 * 五项：体重 / 饮食 / 训练 / 睡眠 / 花费，各给「本周数字 + 与上周对比」。
 */
(function (global) {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(n(v) * 10) / 10; }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shift(d, k) { var p = String(d).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]); dt.setDate(dt.getDate() + k); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function hd() { return global.__hd; }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }

  function weekOf(db, from, to, W) {
    var per = {};
    db.entries.forEach(function (e) {
      if (e.date < from || e.date > to) return;
      var x = per[e.date] || (per[e.date] = { kcal: 0, p: 0, rest: 0, wt: 0 });
      if (e.type === 'food') { x.kcal += n(e.kcal); x.p += n(e.p); }
      else if (e.type === 'rest') x.rest += n(e.value);
      else if (e.type === 'weight') x.wt = n(e.value);
    });
    var days = Object.keys(per).sort();
    var wts = days.map(function (d) { return per[d].wt; }).filter(function (v) { return v > 0; });
    var vol = 0, sess = 0, cardio = 0;
    if (W) W.state().sessions.forEach(function (s) {
      if (s.date < from || s.date > to) return;
      sess++; vol += W.volumeOf(s); cardio += W.cardioMinOf(s);
    });
    return {
      logged: days.filter(function (d) { return per[d].kcal > 200; }).length,
      kcal: Math.round(mean(days.map(function (d) { return per[d].kcal; }).filter(function (v) { return v > 0; }))),
      prot: Math.round(mean(days.map(function (d) { return per[d].p; }).filter(function (v) { return v > 0; }))),
      rest: r1(mean(days.map(function (d) { return per[d].rest; }).filter(function (v) { return v > 0; }))),
      wtFirst: wts.length ? wts[0] : 0, wtLast: wts.length ? wts[wts.length - 1] : 0,
      sessions: sess, vol: Math.round(vol), cardio: cardio
    };
  }

  function row(label, now, prev, unit, goodDown) {
    var d = null;
    if (prev > 0 && now > 0) d = r1(now - prev);
    var arrow = d === null ? '' : (d === 0 ? '→' : (d > 0 ? '▲' : '▼'));
    var cls = '';
    if (d !== null && d !== 0) {
      var good = goodDown ? d < 0 : d > 0;
      cls = good ? 'delta-down' : 'delta-up';
    }
    return '<div class="wkRow"><span class="wkL">' + esc(label) + '</span>' +
      '<span class="wkV">' + (now || '—') + '<i>' + esc(unit) + '</i></span>' +
      '<span class="wkD ' + cls + '">' + (d === null ? '—' : arrow + ' ' + Math.abs(d)) + '</span></div>';
  }

  function render() {
    var box = $('#xWeekly'); if (!box) return;
    var host = hd(); if (!host) return;
    var db = host.db, W = global.HDWorkout;
    var today = host.today ? host.today() : host.date();
    var w1from = shift(today, -6), w1 = weekOf(db, w1from, today, W);
    var w0from = shift(today, -13), w0 = weekOf(db, w0from, shift(today, -7), W);
    var goal = n(db.goals.kcal), pT = (db.goals.macro && db.goals.macro.p) ? goal * db.goals.macro.p / 100 / 4 : 0;
    var wtChg = (w1.wtFirst && w1.wtLast) ? r1(w1.wtLast - w1.wtFirst) : 0;
    var protPct = (pT > 0 && w1.prot) ? Math.round(w1.prot / pT * 100) : 0;
    var spend = 0, spendPrev = 0;
    if (global.HDMoney && global.HDMoney.state()) {
      var M = global.HDMoney.state();
      M.items.forEach(function (e) {
        if ((e.type || 'expense') !== 'expense') return;
        if (e.date >= w1from && e.date <= today) spend += e.amount;
        else if (e.date >= w0from && e.date < w1from) spendPrev += e.amount;
      });
    }
    box.innerHTML = '<section class="panel">' +
      '<div class="row"><h2>本周周报</h2><span class="hint">' + w1from + ' → ' + today + '（对比上周）</span></div>' +
      '<div class="wk">' +
      row('体重变化', wtChg, (w0.wtFirst && w0.wtLast) ? r1(w0.wtLast - w0.wtFirst) : 0, ' kg', true) +
      row('平均摄入', w1.kcal, w0.kcal, ' 千卡', true) +
      row('蛋白质达标率', protPct, (pT > 0 && w0.prot) ? Math.round(w0.prot / pT * 100) : 0, ' %', false) +
      row('训练次数', w1.sessions, w0.sessions, ' 次', false) +
      row('训练容量', w1.vol, w0.vol, ' kg', false) +
      row('平均睡眠', w1.rest, w0.rest, ' 小时', false) +
      (spend > 0 ? row('本周花费', Math.round(spend), Math.round(spendPrev), ' 元', true) : '') +
      '</div>' +
      '<div class="hint" style="margin-top:10px">记录天数 ' + w1.logged + '/7' +
      (w1.logged < 5 ? ' —— <b>记录不完整会让所有趋势判断失真</b>，先把记录补上再谈调整' : '') +
      '。这张周报把所有模块放在一起看一次，避免每天被单个数字影响情绪。</div>' +
      '</section>';
  }

  global.HDWeekly = { render: render };
})(window);
