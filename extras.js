/* extras.js — 训练方法库 / 有氧计划 / 目标预测 的渲染与交互
 *
 * 依赖：programs-db.js（HD_PROGRAMS）、forecast.js（HDForecast）、
 *       workout.js（HDWorkout，提供动作库与计划状态）、app.js 暴露的 window.__hd
 */
(function (global) {
  'use strict';

  var P = global.HD_PROGRAMS || { PROGRAMS: [], TECHNIQUES: [], PERIODIZATION: [], FATLOSS: [], CARDIO: [] };
  var F = global.HDForecast;
  var EX = {};

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** 把 **强调** 与换行渲染成 HTML（内容由我们自己撰写，只做最简标记） */
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }
  function hd() { return global.__hd; }
  function exName(id) {
    var W = global.HDWorkout;
    return (W && W.EX_BY_ID[id] && W.EX_BY_ID[id].name) || id;
  }

  /* ==================== 训练方法库 ==================== */
  var methodFilter = 'program';
  var KIND_LABEL = { program: '完整计划', technique: '训练技巧', period: '周期化', lose: '减脂安排' };

  function methodCard(m) {
    var canApply = m.kind === 'program' && m.days && m.days.length;
    var html = '<div class="card"><div class="cTop"><b>' + esc(m.name) + '</b>' +
      '<span class="hint">' + esc(m.en || '') + '</span></div>';
    html += '<div class="cBody">';
    if (m.level) html += '<span class="lbl">适合</span>' + esc(m.level) + ' · 每周 ' + m.daysPerWeek + ' 次 · 约 ' + m.weeks + ' 周 · 单次 ' + m.minutes + ' 分钟<br>';
    if (m.scheme) html += '<span class="lbl">结构</span>' + rich(m.scheme) + '<br>';
    if (m.intensity) html += '<span class="lbl">强度</span>' + rich(m.intensity) + '<br>';
    if (m.structure) html += '<span class="lbl">结构</span>' + rich(m.structure) + '<br>';
    html += '</div>';
    /* 渐进超负荷单独高亮 —— 这是本模块的主线 */
    if (m.progression) html += '<div class="trReason"><b>渐进超负荷：</b>' + rich(m.progression) + '</div>';
    if (m.schedule) html += '<div class="hint" style="margin-top:6px"><b>做法：</b>' + rich(m.schedule) + '</div>';
    if (m.desc) html += '<div class="cBody">' + rich(m.desc) + '</div>';
    if (m.why) html += '<div class="hint" style="margin-top:6px"><b>为什么：</b>' + rich(m.why) + '</div>';
    if (m.fit) html += '<div class="hint" style="margin-top:6px"><b>适合：</b>' + rich(m.fit) + '</div>';
    if (m.cautions) html += '<div class="hint trErr" style="margin-top:6px"><b>注意：</b>' + rich(m.cautions) + '</div>';
    if (m.freq) html += '<div class="hint" style="margin-top:6px"><b>频次：</b>' + esc(m.freq) + ' · <b>强度：</b>' + esc(m.intensity) + '</div>';
    if (m.pros) html += '<div class="hint" style="margin-top:6px"><b>优点：</b>' + esc(m.pros) + '　<b>缺点：</b>' + esc(m.cons || '') + '</div>';
    if (m.weeks && Array.isArray(m.weeks)) {
      html += '<details><summary>展开 9 周逐周安排</summary><div class="dBody hint">' +
        m.weeks.map(function (w, i) {
          return '<div style="padding:3px 0"><b>第 ' + (i + 1) + ' 周</b>：' + esc(w[0].join(' → ')) + '　<span style="color:var(--text-3)">' + esc(w[1]) + '</span></div>';
        }).join('') + '</div></details>';
    }
    html += '<div class="cFoot"><span class="hint">来源：' + esc(m.source || '—') + '</span>' +
      (canApply ? '<button class="primary mini" data-x-apply="' + m.id + '">套用为我的计划</button>' : '') +
      (m.met ? '<button class="mini" data-x-addcardio="' + m.id + '">加入训练计划</button>' : '') + '</div>';
    html += '</div>';
    return html;
  }

  function renderMethods() {
    var box = $('#xMethods'); if (!box) return;
    var chips = [
      ['program', '完整计划', P.PROGRAMS.length],
      ['technique', '训练技巧', P.TECHNIQUES.length],
      ['period', '周期化', P.PERIODIZATION.length],
      ['lose', '减脂安排', P.FATLOSS.length]
    ];
    var html = '<div class="groupFilter" id="xMethodFilter">' + chips.map(function (c) {
      return '<button data-x-mkind="' + c[0] + '"' + (methodFilter === c[0] ? ' class="on"' : '') + '>' + c[1] + ' <span class="hint">' + c[2] + '</span></button>';
    }).join('') + '</div>';
    var list = methodFilter === 'program' ? P.PROGRAMS : methodFilter === 'technique' ? P.TECHNIQUES : methodFilter === 'period' ? P.PERIODIZATION : P.FATLOSS;
    html += list.map(methodCard).join('');
    box.innerHTML = html;
  }

  /** 一键把方法套用成计划：用当前计划里同动作的重量作为起始重量 */
  function applyProgram(id) {
    var W = global.HDWorkout, host = hd();
    if (!W || !host) return;
    var prog = P.PROGRAMS.filter(function (p) { return p.id === id; })[0];
    if (!prog) return;
    var S = W.state();
    var cur = W.activeRoutine();
    /* 收集现有重量：优先当前计划，其次历史最好成绩 */
    function startWeight(exId) {
      var hit = null;
      (cur ? cur.days : []).forEach(function (d) {
        d.items.forEach(function (i) { if (i.exId === exId && i.weight > 0 && !hit) hit = i.weight; });
      });
      if (hit) return hit;
      var perf = W.lastPerf(exId, '', '');
      if (perf) {
        var mx = 0;
        perf.done.forEach(function (x) { mx = Math.max(mx, n(x.w)); });
        if (mx > 0) return mx;
      }
      return 0;
    }
    var days = prog.days.map(function (d, di) {
      return {
        id: 'd_' + prog.id + '_' + (di + 1),
        name: d.name,
        weekday: [1, 2, 4, 5, 3, 6][di % 6],
        items: d.items.map(function (it) {
          var exId = it[0];
          return {
            uid: 'i_' + exId + '_' + di + '_' + Math.random().toString(36).slice(2, 6),
            exId: exId, sets: it[1], repsMin: it[2], repsMax: it[3],
            weight: startWeight(exId) || it[4] || 0,
            restSec: it[1] >= 8 ? 180 : 120, note: '', miss: 0,
            mode: (W.EX_BY_ID[exId] && W.EX_BY_ID[exId].cat === '有氧') ? 'cardio' : 'strength'
          };
        })
      };
    });
    var routine = { id: 'r_' + prog.id + '_' + Date.now().toString(36).slice(-4), name: prog.name, desc: prog.desc || prog.weekly || '', days: days };
    S.routines.push(routine);
    S.activeId = routine.id;
    host.save(); host.render();
    var host2 = $('#xApplyHint');
    if (host2) host2.textContent = '已套用「' + prog.name + '」，共 ' + days.length + ' 个训练日；起始重量取自你已有的记录，去上面的「训练计划」里核对/调整。';
  }

  /** 把有氧方案加入当前计划的某一天 */
  function addCardio(id, dayId) {
    var W = global.HDWorkout, host = hd();
    if (!W || !host) return;
    var c = P.CARDIO.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var r = W.activeRoutine();
    var d = (r.days.filter(function (x) { return x.id === dayId; })[0]) || r.days[0];
    if (!d) return;
    var exId = ({ rowing: 'rowing_machine', cycling: 'cycling', elliptical: 'elliptical', jumprope: 'jump_rope', swimming: 'swimming', brisk_walk: 'brisk_walk', incline_walk: 'incline_walk', stair: 'stair_climber', liss: 'treadmill_walk', miss: 'outdoor_run', zone2: 'treadmill_walk', norwegian4x4: 'treadmill_run', gibala: 'treadmill_run', tabata: 'hiit', sit: 'treadmill_run', fartlek: 'outdoor_run', tempo: 'outdoor_run', c25k: 'outdoor_run' })[id] || 'treadmill_walk';
    d.items.push({ uid: 'i_' + exId + '_' + Date.now().toString(36).slice(-4), exId: exId, mode: 'cardio', targetMin: id === 'norwegian4x4' ? 28 : id === 'gibala' ? 20 : id === 'tabata' ? 4 : 30, restSec: 0, note: c.name, miss: 0 });
    host.save(); host.render();
    var hint = $('#xApplyHint');
    if (hint) hint.textContent = '已把「' + c.name + '」加入「' + d.name + '」。';
  }

  /* ==================== 有氧强度区间 ==================== */
  function renderCardio() {
    var box = $('#xCardio'); if (!box) return;
    var host = hd();
    var age = host && host.db && host.db.profile ? n(host.db.profile.age) : 0;
    var rest = 60;
    var z = age > 0 ? F.hrZones(age, rest) : null;
    var html = '<div class="row"><b>心率区间（按 30 岁、静息 60 计算可自行改）</b></div>';
    html += '<div class="editLine" style="margin-top:8px">' +
      '<label>年龄<input type="number" id="xHrAge" value="' + (age || 30) + '" min="10" max="90"></label>' +
      '<label>静息心率<input type="number" id="xHrRest" value="' + rest + '" min="35" max="100"></label>' +
      '<button class="mini" id="xHrGo">重新计算</button></div>';
    html += '<div id="xHrOut"></div>';
    html += '<div class="row" style="margin-top:16px"><b>有氧方案库</b><span class="hint">' + P.CARDIO.length + ' 个方案</span></div>';
    html += '<div id="xCardioList"></div>';
    box.innerHTML = html;
    paintZones(z);
    paintCardioList();
  }
  function paintZones(z) {
    var out = $('#xHrOut'); if (!out) return;
    if (!z) { out.innerHTML = '<div class="empty">填入年龄后可计算心率区间</div>'; return; }
    out.innerHTML = '<div class="hint" style="margin-top:8px">最大心率按 <b>Tanaka 公式</b> 208 − 0.7×年龄 = <b>' + z.hrmax + '</b> 次/分' +
      '（常说的「220−年龄」= ' + z.naive + '，误差 ±10–12，已不推荐）。' +
      '区间用 <b>储备心率法（Karvonen）</b>：%HRR 与摄氧量百分比接近 1:1，比单纯按最大心率百分比更准。</div>' +
      '<div class="tableWrap"><table class="history"><tr><th>区间</th><th>强度（%HRR）</th><th>心率范围</th><th>约 %最大心率</th><th>体感</th></tr>' +
      z.zones.map(function (x) {
        return '<tr><td><b>' + x.z + '</b> ' + esc(x.name) + '</td><td>' + x.hrr[0] + '–' + x.hrr[1] + '%</td>' +
          '<td><b>' + x.bpm[0] + '–' + x.bpm[1] + '</b> 次/分</td><td>' + x.pctMax + '%</td><td class="hint">' + esc(x.feel) + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="hint" style="margin-top:8px">提醒：常说的「Zone 2」用 %最大心率算是 60–70%，换算成 %HRR 只有约 50–57%，' +
      '<b>其实低于 ACSM 的中等强度下限</b>。按 %HRR 的 <b>Z2（60–70%）</b> 更接近"能聊天但有点吃力"的那个强度。</div>';
  }
  function paintCardioList() {
    var box = $('#xCardioList'); if (!box) return;
    var r = global.HDWorkout ? global.HDWorkout.activeRoutine() : null;
    box.innerHTML = P.CARDIO.map(function (c) {
      return methodCard(c) + (r ? '' : '');
    }).join('');
  }

  /* ==================== 目标预测 ==================== */
  function weightPoints() {
    var host = hd(); if (!host) return [];
    return host.db.entries.filter(function (e) { return e.type === 'weight' && n(e.value) > 0; })
      .map(function (e) { return { date: e.date, kg: n(e.value) }; });
  }

  function svgForecast(pts, fc, targetKg) {
    var W = 560, H = 190, pad = 34;
    var levels = F.holt(pts.map(function (p) { return p.kg; }));
    var base = pts[0].date;
    function dn(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
    var xs = pts.map(function (p, i) { return { x: dn(p.date) - dn(base), y: levels[i], raw: p.kg }; });
    var spanX = xs[xs.length - 1].x;
    var projX = fc.ok ? (fc.days || 0) : 0;
    var totalX = Math.max(spanX, spanX + projX, 1);
    var vs = xs.map(function (p) { return p.y; }).concat(xs.map(function (p) { return p.raw; }));
    if (targetKg > 0) vs.push(targetKg);
    if (fc.ok && fc.projected) vs.push(fc.projected);
    var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    if (max - min < 1) { max = min + 1; }
    min -= 0.4; max += 0.4;
    var X = function (x) { return pad + (W - pad * 2) * (x / totalX); };
    var Y = function (v) { return H - pad - (H - pad * 2) * (v - min) / (max - min); };
    var s = '<div class="chartWrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重趋势与预测">';
    [0, 1, 2].forEach(function (g) {
      var v = min + (max - min) * g / 2, y = Y(v);
      s += '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + y.toFixed(1) + '" style="stroke:var(--border)"/>' +
        '<text x="' + (pad - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10" style="fill:var(--text-3)">' + r1(v) + '</text>';
    });
    if (targetKg > 0) {
      var ty = Y(targetKg);
      s += '<line x1="' + pad + '" y1="' + ty.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + ty.toFixed(1) + '" style="stroke:var(--warn)" stroke-width="1.4" stroke-dasharray="5 4"/>' +
        '<text x="' + (W - pad) + '" y="' + (ty - 6).toFixed(1) + '" text-anchor="end" font-size="10" style="fill:var(--warn)">目标 ' + targetKg + ' kg</text>';
    }
    xs.forEach(function (p) { s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.raw).toFixed(1) + '" r="1.9" style="fill:var(--text-3)" opacity="0.45"/>'; });
    s += '<path d="' + xs.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ') +
      '" fill="none" style="stroke:var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>';
    if (fc.ok && fc.days > 0) {
      var lx = xs[xs.length - 1];
      var endX = lx.x + fc.days;
      var endY = targetKg > 0 ? targetKg : lx.y + fc.rateWeek / 7 * fc.days;
      s += '<path d="M' + X(lx.x).toFixed(1) + ' ' + Y(lx.y).toFixed(1) + ' L' + X(endX).toFixed(1) + ' ' + Y(endY).toFixed(1) +
        '" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="6 4" opacity="0.7"/>';
      /* 不确定区间：用斜率 ±1.96SE 得到的两种情形，越远越宽 */
      if (fc.rangeDays) {
        var e1 = lx.x + fc.rangeDays[0], e2 = lx.x + fc.rangeDays[1];
        s += '<path d="M' + X(e1).toFixed(1) + ' ' + Y(endY).toFixed(1) + ' L' + X(e2).toFixed(1) + ' ' + Y(endY).toFixed(1) +
          '" style="stroke:var(--accent)" stroke-width="5" opacity="0.18" stroke-linecap="round"/>';
      }
      s += '<text x="' + X((lx.x + endX) / 2).toFixed(1) + '" y="' + (Y((lx.y + endY) / 2) - 8).toFixed(1) + '" text-anchor="middle" font-size="10" style="fill:var(--accent)">预测</text>';
      s += '<text x="' + X(endX).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end" font-size="10" style="fill:var(--text-3)">' + fc.date.slice(5) + '</text>';
    }
    s += '<text x="' + X(0).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" style="fill:var(--text-3)">' + pts[0].date.slice(5) + '</text>';
    s += '<text x="' + X(spanX).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" style="fill:var(--text-3)">' + pts[pts.length - 1].date.slice(5) + '</text>';
    s += '</svg></div>';
    return s;
  }

  function renderForecast() {
    var box = $('#xForecast'); if (!box) return;
    var host = hd(); if (!host) return;
    var pts = weightPoints();
    /* 目标体重存在 profile.targetWeight（「减重目标」面板里填的那个） */
    var goal = n(host.db.profile && host.db.profile.targetWeight) || 0;
    var t = host.totals(host.date());
    var deficit = n(host.db.goals.kcal) - n(t.kcal);
    if (!(deficit > 0)) deficit = 0;
    var fc = F.weight(pts, goal, host.today ? host.today() : host.date(), deficit);

    var html = '';
    if (pts.length < 2) {
      html = '<div class="empty">还没有体重记录。记录几次之后这里会显示趋势与预测。</div>';
      box.innerHTML = html; return;
    }
    if (goal > 0) html += svgForecast(pts, fc, goal);
    else html += svgForecast(pts, fc, 0);

    html += '<div class="stats4" style="margin-top:12px">' +
      '<div><small>当前平滑体重</small><b>' + fc.level + '</b><span>kg（7 天 ' + fc.ema7 + '）</span></div>' +
      '<div><small>最近速度</small><b>' + (fc.rateWeek > 0 ? '+' : '') + fc.rateWeek + '</b><span>kg / 周</span></div>' +
      '<div><small>记录点</small><b>' + fc.pts + '</b><span>次，近 28 天用 ' + (fc.usedPoints || 0) + ' 个</span></div>' +
      '<div><small>波动（残差）</small><b>' + (fc.residual || '—') + '</b><span>kg</span></div>' +
      '</div>';
    html += '<div class="' + (fc.ok ? 'result' : 'hint') + '" style="margin-top:12px">' +
      (fc.ok ? '<b>' + esc(fc.reason) + '</b>' : esc(fc.reason || '数据还不足')) + '</div>';
    if (fc.warn) html += '<div class="hint trErr" style="margin-top:6px">' + esc(fc.warn) + '</div>';
    if (fc.cross) html += '<div class="hint" style="margin-top:6px">热量缺口交叉校验：' + esc(fc.cross) + '</div>';
    html += '<div class="hint" style="margin-top:8px">预测基于最近 28 天的平滑趋势（Holt 线性趋势），区间用斜率 ±1.96 倍标准误估算。' +
      '体重受水分、糖原、钠和生理周期影响，日间波动 ±0.5–1.5 kg 很正常，<b>只看趋势，不看单日数字</b>。</div>';

    /* 力量预测 */
    var W = global.HDWorkout;
    if (W) {
      var ids = {};
      W.state().sessions.forEach(function (s) { s.entries.forEach(function (e) { if (e.mode !== 'cardio') ids[e.exId] = 1; }); });
      var list = Object.keys(ids);
      html += '<div class="row" style="margin-top:18px"><b>力量目标预测（e1RM）</b><span class="hint">%1RM 估算自带 ±3–5% 误差</span></div>';
      if (!list.length) html += '<div class="empty">完成几次力量训练后这里会显示力量趋势与预测。</div>';
      else {
        html += list.map(function (id) {
          var f = F.strength(W.e1rmSeries(id), 56);
          if (!f.ok) return '<div class="trItem"><b>' + esc(exName(id)) + '</b><span class="hint">' + esc(f.reason) + '</span></div>';
          return '<div class="trItem"><b>' + esc(exName(id)) + '</b><span class="hint">现在 ' + f.now + ' kg（R² ' + f.r2 + '）→ ' +
            f.weeks + ' 周后约 <b>' + f.projected + ' kg</b>（+' + f.gain + '）' + (f.uncertain ? ' · ' + esc(f.uncertain) : '') + '</span></div>';
        }).join('');
      }
    }
    box.innerHTML = html;
  }

  /* ==================== 事件 ==================== */
  function bind(root) {
    root = root || document;
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-x-mkind],[data-x-apply],[data-x-addcardio],[data-x-cardio-day]') : null;
      if (!t) return;
      var d = t.dataset;
      if (d.xMkind) { methodFilter = d.xMkind; renderMethods(); }
      else if (d.xApply) { applyProgram(d.xApply); }
      else if (d.xAddcardio) {
        var W = global.HDWorkout, r = W && W.activeRoutine();
        if (!r) return;
        var opts = r.days.map(function (dd, i) { return (i + 1) + '. ' + dd.name; }).join('\n');
        var pick = prompt('把有氧加入哪一天？\n' + opts, '1');
        var dd = r.days[n(pick) - 1];
        if (dd) addCardio(d.xAddcardio, dd.id);
      }
    });
    root.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'xHrGo') {
        var age = n($('#xHrAge') && $('#xHrAge').value), rest = n($('#xHrRest') && $('#xHrRest').value);
        paintZones(F.hrZones(age, rest || 60));
      }
    });
  }

  global.HDExtras = {
    render: function () { try { renderMethods(); renderCardio(); renderForecast(); } catch (e) { console.warn('扩展模块渲染失败', e); } },
    bind: bind, applyProgram: applyProgram, addCardio: addCardio,
    _renderMethods: renderMethods, _renderForecast: renderForecast,
    setFilter: function (k) { methodFilter = k; }
  };
})(window);
