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

  /* ==================== 首页：今日概览 + 热力图 + 下周建议 + 还能吃什么 ==================== */
  var HEAT_BG = ['var(--surface-3)', 'var(--accent-weak)', 'var(--accent)', '#15704f'];

  function renderHome() {
    var box = $('#xHome'); if (!box) return;
    var host = hd(); if (!host) return;
    var W = global.HDWorkout, db = host.db;
    var today = host.today ? host.today() : host.date();
    var t = host.totals(today), g = db.goals;
    var remain = g.kcal - t.kcal;
    var pT = (g.macro && g.macro.p) ? g.kcal * g.macro.p / 100 / 4 : 0;
    var pLeft = Math.max(0, pT - t.p);
    var over = remain < 0;
    var eats = [];   /* 已移除「今天还能吃什么」：保留空数组让渲染走空分支 */
    fillQuickRows(t, g, db);

    var days = [], i;
    for (i = 83; i >= 0; i--) days.push(shiftDate(today, -i));
    var kcalOf = {}, wtOf = {}, exOf = {};
    db.entries.forEach(function (e) {
      if (e.type === 'food') kcalOf[e.date] = (kcalOf[e.date] || 0) + n(e.kcal);
      else if (e.type === 'weight') wtOf[e.date] = n(e.value);
    });
    if (W) W.state().sessions.forEach(function (s) { exOf[s.date] = 1; });
    var heat = days.map(function (d) {
      var lv = (kcalOf[d] > 200 ? 1 : 0) + (wtOf[d] > 0 ? 1 : 0) + (exOf[d] ? 1 : 0);
      return '<span title="' + d + '：记录 ' + lv + ' 项" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin:2px;background:' + HEAT_BG[lv] + '"></span>';
    }).join('');
    var doneDays = days.filter(function (d) { return kcalOf[d] > 200 || wtOf[d] > 0 || exOf[d]; }).length;

  function renderNextWeek() {
    var box = $('#xNextWeek'); if (!box) return;
    var host = hd(); if (!host) return;
    var W = global.HDWorkout, db = host.db;
    var today = host.today ? host.today() : host.date();
    if (!W) { box.innerHTML = ''; return; }
    var plan = '', deload = [];
    var r = W ? W.activeRoutine() : null, plan = '', deload = [];
    if (r) {
      plan = r.days.map(function (d) {
        var items = d.items.slice(0, 4).map(function (it) {
          if (it.mode === 'cardio') return exName(it.exId) + ' ' + (it.targetMin || 30) + ' 分';
          var s = W.suggest(it);
          return exName(it.exId) + ' ' + it.sets + '×' + it.repsMin + '–' + it.repsMax + ' @' + s.weight + 'kg';
        }).join('；');
        var label = d.weekday >= 0 ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.weekday] : '不排程';
        return '<div class="trItem"><b>' + esc(d.name) + '</b><span class="hint">' + esc(label) + ' · ' + esc(items) + '</span></div>';
      }).join('');
      r.days.forEach(function (d) {
        d.items.forEach(function (it) { if (n(it.miss) >= 2) deload.push(exName(it.exId) + '连续 ' + it.miss + ' 次未达标'); });
      });
      var SS = W.state().sessions, v14 = 0, v28 = 0;
      SS.forEach(function (s) {
        if (s.date >= shiftDate(today, -13)) v14 += W.volumeOf(s);
        else if (s.date >= shiftDate(today, -27)) v28 += W.volumeOf(s);
      });
      if (v28 > 0 && v14 < v28 * 0.75) deload.push('近两周容量比前两周降 ' + Math.round((1 - v14 / v28) * 100) + '%');
      var badSleep = 0;
      db.entries.forEach(function (e) { if (e.type === 'rest' && e.date >= shiftDate(today, -6) && n(e.value) < 6) badSleep++; });
      if (badSleep >= 3) deload.push('近 7 天有 ' + badSleep + ' 天睡眠不足 6 小时');
    }

    box.innerHTML = r ? ('<div class="row" style="margin-top:18px"><b>下周该练什么</b><span class="hint">按渐进超负荷自动推算</span></div>' +      (deload.length ? '<div class="trReason"><b>提示：考虑减载</b> —— ' + esc(deload.join('；')) +        '。减载周把训练量减 40–60% 或强度降 10–20%，别停练。</div>' : '') +      plan +      '<div class="hint" style="margin-top:6px">重量是"下次该用的建议值"：上次每组都做到次数上限就加重，否则保持重量、目标每组 +1 次。</div>')      : '';
  }


    box.innerHTML =
      '<section class="panel" style="border-left:3px solid ' + (over ? 'var(--danger)' : 'var(--accent)') + '">' +
      '<div class="row"><h2>' + (over ? '今天已超出预算' : '今天还能吃') + '</h2><span class="hint">' + today + '</span></div>' +
      '<div style="font-size:30px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:2px 0 2px">' +
      Math.abs(Math.round(remain)) + '<span style="font-size:15px;font-weight:400;color:var(--text-3)"> 千卡' + (over ? '（超）' : '') + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, g.kcal > 0 ? t.kcal / g.kcal * 100 : 0) + '%"' + (over ? ' class="over"' : '') + '></i></div>' +
      '<div class="stats4" style="margin-top:12px">' +
      '<div><small>已摄入</small><b>' + Math.round(t.kcal) + '</b><span>/ ' + Math.round(g.kcal) + ' 千卡</span></div>' +
      '<div><small>蛋白质还差</small><b>' + Math.round(pLeft) + '</b><span>g（已 ' + Math.round(t.p) + '）</span></div>' +
      '<div><small>饮水</small><b>' + Math.round(t.water) + '</b><span>/ ' + Math.round(g.water) + ' ml</span></div>' +
      '<div><small>睡眠</small><b>' + r1(t.rest || 0) + '</b><span>小时</span></div>' +
      '</div><details style="margin-top:10px"><summary class="hint" style="cursor:pointer">'
      + '近 84 天记录情况（' + doneDays + ' 天有记录）</summary>'
      + '<div class="hint" style="margin-top:6px">' + heat + '</div></details>' +
      (eats.length ? '<details style="margin-top:12px"><summary class="hint" style="cursor:pointer">'
        + '今天还能吃什么（' + eats.length + ' 个建议）</summary>' +
        eats.map(function (f) {
          return '<span class="tag" style="margin:3px 4px 0 0;padding:5px 10px;font-size:12px">' + esc(fname(f)) +
            ' <b>' + Math.round(n(f.kcal)) + ' kcal</b> · 蛋白 ' + r1(n(f.p)) + 'g</span>';
        }).join('') +
        '<div class="hint" style="margin-top:6px">数值按每 100 克计；想精确记录点「食物库」搜索添加。</div></details>'
        : (remain > 150 ? '' : '<div class="hint" style="margin-top:10px">今天热量余量不多了，优先补蛋白质和蔬菜。</div>')) +
      '</section>' +

      '';
  }


  /* 一行入口里显示当前数值（在 renderHome 内调用） */
  function fillQuickRows(t, g, db) {
      var qw = $('#qWater');
      if (qw) qw.textContent = Math.round(t.water) + ' / ' + Math.round(g.water) + ' ml';
      var qr = $('#qRest');
      if (qr) qr.textContent = r1(t.rest) + ' / ' + r1(g.rest) + ' 小时';
      var qwt = $('#qWeight');
      if (qwt) {
        var last = null, i;
        for (i = db.entries.length - 1; i >= 0; i--) {
          if (db.entries[i].type === 'weight') { last = db.entries[i]; break; }
        }
        qwt.textContent = last ? (n(last.value) + ' kg（' + last.date + '）') : '还没记录';
      }
    }

  /* ==================== AI 问诊摘要（导出给豆包等 AI） ====================
   * 不接 API：不用密钥、不加服务器、数据不外流。只在本地算好「线索」，
   * 让 AI 有方向地回答，而不是从一堆数字里瞎猜。
   */
  function buildAiText(includeMoney) {
    var host = hd(); if (!host) return '';
    var W = global.HDWorkout, db = host.db, today = host.today ? host.today() : host.date();
    var days = [], i; for (i = 27; i >= 0; i--) days.push(shiftDate(today, -i));
    var per = {};
    days.forEach(function (d) { per[d] = { kcal: 0, p: 0, c: 0, f: 0, rest: 0, logged: false }; });
    db.entries.forEach(function (e) {
      var x = per[e.date]; if (!x) return;
      if (e.type === 'food') { x.logged = true; x.kcal += n(e.kcal); x.p += n(e.p); x.c += n(e.c); x.f += n(e.f); }
      else if (e.type === 'rest') x.rest += n(e.value);
    });
    var wt = db.entries.filter(function (e) { return e.type === 'weight' && n(e.value) > 0; })
      .map(function (e) { return { date: e.date, kg: n(e.value) }; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var l7 = days.slice(-7);
    var val = function (f) { return l7.map(f).filter(function (v) { return v > 0; }); };
    var mean = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; };
    var goal = n(db.profile && db.profile.targetWeight) || 0;
    var budget = n(db.goals.kcal) || 0;
    var kg = n(db.profile && db.profile.weight) || (wt.length ? wt[wt.length - 1].kg : 0);
    var fc = F.weight(wt, goal, today, 0);
    var kcal = Math.round(mean(val(function (d) { return per[d].kcal; })));
    var prot = Math.round(mean(val(function (d) { return per[d].p; })));
    var rest = r1(mean(val(function (d) { return per[d].rest; })));
    var poorSleep = l7.filter(function (d) { return per[d].rest > 0 && per[d].rest < 6; }).length;
    var logged = l7.filter(function (d) { return per[d].kcal > 200; }).length;
    var deficit = budget > 0 && kcal > 0 ? budget - kcal : 0;
    var ppk = kg > 0 && prot > 0 ? r1(prot / kg) : 0;
    var S = W.state().sessions;
    var s14 = S.filter(function (s) { return s.date >= shiftDate(today, -13); });
    var s28 = S.filter(function (s) { return s.date >= shiftDate(today, -27) && s.date < shiftDate(today, -13); });
    var vol = function (l) { return Math.round(l.reduce(function (a, s) { return a + W.volumeOf(s); }, 0)); };
    var cardio = s14.reduce(function (a, s) { return a + W.cardioMinOf(s); }, 0);
    var e1 = {}, ids = {};
    S.forEach(function (s) { s.entries.forEach(function (e) { if (e.mode !== 'cardio') ids[e.exId] = 1; }); });
    Object.keys(ids).slice(0, 5).forEach(function (id) {
      var ser = W.e1rmSeries(id);
      if (ser.length >= 2) e1[id] = { now: r1(ser[ser.length - 1].v), d: r1(ser[ser.length - 1].v - ser[Math.max(0, ser.length - 4)].v) };
    });
    var mo = null;
    if (includeMoney && global.HDMoney && global.HDMoney.state()) {
      var MM = global.HDMoney.state(), ym = today.slice(0, 7);
      var st = global.HDMoney.monthStats(MM, ym, today), fi = global.HDMoney.foodInsight(MM);
      var tdays = MM.items.filter(function (e) { return e.cat === 'food' && e.sub === '外卖' && e.date.slice(0, 7) === ym; }).map(function (e) { return e.date; });
      var tk = [], ok2 = [];
      tdays.forEach(function (d) { if (per[d] && per[d].kcal > 0) tk.push(per[d].kcal); });
      days.forEach(function (d) { if (tdays.indexOf(d) < 0 && per[d].kcal > 0) ok2.push(per[d].kcal); });
      mo = { spent: st.spent, budget: st.budget, food: fi.total, takeout: fi.takeoutSpend, rate: fi.takeoutRate, tk: Math.round(mean(tk)), ok: Math.round(mean(ok2)), tn: tk.length, on: ok2.length };
    }
    var L = [];
    L.push('【我的减重数据摘要】' + today);
    L.push('');
    L.push('一、体重');
    if (kg > 0) L.push('- 当前 ' + kg + ' kg' + (goal > 0 ? '，目标 ' + goal + ' kg' : ''));
    if (fc.ok) L.push('- 近 28 天：' + (fc.rateWeek > 0 ? '+' : '') + fc.rateWeek + ' kg/周（平滑值 ' + fc.level + '，记录 ' + fc.pts + ' 次，波动 ±' + fc.residual + ' kg）');
    else L.push('- 趋势暂不可算：' + fc.reason);
    if (wt.length >= 8) {
      var w3 = wt.filter(function (p) { return p.date >= shiftDate(today, -20); });
      if (w3.length >= 3) {
        var dd = r1(w3[w3.length - 1].kg - w3[0].kg);
        if (kg > 0 && Math.abs(dd) < kg * 0.006) L.push('- 近 3 周体重仅变化 ' + dd + ' kg（**可能处于平台期**）');
      }
    }
    L.push('');
    L.push('二、饮食（近 7 天）');
    L.push('- 平均 ' + kcal + ' 千卡' + (budget > 0 ? ' / 预算 ' + budget + '（日均缺口约 ' + Math.round(deficit) + '）' : ''));
    L.push('- 蛋白质 ' + prot + ' g' + (ppk > 0 ? '（' + ppk + ' g/kg）' : '') + '，碳水 ' + Math.round(mean(val(function (d) { return per[d].c; }))) + ' g，脂肪 ' + Math.round(mean(val(function (d) { return per[d].f; }))) + ' g');
    L.push('- 7 天中有 ' + logged + ' 天记录了饮食');
    L.push('');
    L.push('三、训练（近 14 天）');
    L.push('- 力量 ' + s14.length + ' 次，容量 ' + vol(s14) + ' kg' + (s28.length ? '（前 14 天 ' + vol(s28) + ' kg）' : '') + '，有氧 ' + cardio + ' 分钟');
    var e1k = Object.keys(e1);
    if (e1k.length) L.push('- e1RM：' + e1k.map(function (k) { return exName(k) + ' ' + e1[k].now + 'kg(' + (e1[k].d >= 0 ? '+' : '') + e1[k].d + ')'; }).join('、'));
    L.push('');
    L.push('四、睡眠');
    L.push('- 平均 ' + (rest || '—') + ' 小时' + (poorSleep ? '，' + poorSleep + ' 天不足 6 小时' : ''));
    if (mo) {
      L.push('');
      L.push('五、花费（本月）');
      L.push('- 总支出 ' + mo.spent + (mo.budget > 0 ? ' / 预算 ' + mo.budget : '') + '；餐饮 ' + mo.food + '，外卖 ' + mo.takeout + '（外卖率 ' + mo.rate + '%）');
      if (mo.tn >= 3 && mo.on >= 3) L.push('- 外卖日平均摄入 ' + mo.tk + ' 千卡（' + mo.tn + ' 天），非外卖日 ' + mo.ok + ' 千卡（' + mo.on + ' 天）');
    }
    var c = [];
    if (deficit > 0 && fc.ok) {
      var pred = deficit * 7 / 7700;
      if (Math.abs(pred - Math.abs(fc.rateWeek)) > Math.max(0.25, pred * 0.5)) c.push('按缺口静态推算应减 ' + r1(pred) + ' kg/周，实际只有 ' + Math.abs(fc.rateWeek) + ' kg/周（可能代谢适应，或记录漏记）');
    }
    if (ppk > 0 && ppk < 1.6) c.push('蛋白质 ' + ppk + ' g/kg 低于常见建议 1.6 g/kg');
    if (poorSleep >= 2) c.push('近 7 天有 ' + poorSleep + ' 天睡眠不足 6 小时');
    if (logged < 7) c.push('7 天只记录了 ' + logged + ' 天饮食，数据不完整');
    if (s28.length >= 3 && vol(s28) > 0) {
      var ch = Math.round((vol(s14) - vol(s28)) / vol(s28) * 100);
      if (ch <= -25) c.push('训练容量比前两周下降 ' + Math.abs(ch) + '%');
      else if (ch >= 40) c.push('训练容量比前两周增加 ' + ch + '%');
    }
    if (s14.length === 0 && S.length > 0) c.push('近 14 天没有力量训练');
    if (mo && mo.rate >= 55) c.push('外卖占餐饮 ' + mo.rate + '%');
    if (mo && mo.tn >= 3 && mo.on >= 3 && mo.tk > mo.ok + 150) c.push('外卖日摄入比非外卖日高 ' + (mo.tk - mo.ok) + ' 千卡');
    L.push('');
    L.push('六、我在本地先算出的线索（供参考，不一定是答案）');
    L.push(c.length ? c.map(function (x) { return '- ' + x; }).join('\n') : '- 没发现明显异常，请从数据里找我没注意到的规律');
    L.push('');
    L.push('七、我的问题');
    L.push('最近体重没有明显变化，帮我看看问题最可能出在哪里？请指出最值得先改的 2–3 件事并说明依据。');
    return L.join('\n');
  }

  function renderAi() {
    var box = $('#xAi'); if (!box) return;
    box.innerHTML = '<div class="hint">把数据整理成一段结构化摘要，复制到豆包（或任何 AI）里提问即可。' +
      '<b>不接 API、不用密钥、不加服务器</b>，发什么由你勾选决定。</div>' +
      '<div class="controls" style="margin-top:10px">' +
      '<label class="trNoProg hint"><input type="checkbox" id="xAiMoney"> 包含花费数据</label>' +
      '<button class="mini primary" id="xAiBuild">生成摘要</button>' +
      '<button class="mini" id="xAiCopy" disabled>复制</button></div>' +
      '<div id="xAiOut" style="margin-top:10px"></div>';
  }
  function doBuild() {
    var txt = buildAiText($('#xAiMoney') && $('#xAiMoney').checked);
    $('#xAiOut').innerHTML = '<textarea id="xAiText" readonly style="width:100%;height:280px;font:12px/1.6 ui-monospace,Consolas,monospace;' +
      'border:1px solid var(--border-strong);border-radius:8px;padding:10px;background:var(--surface);color:var(--text);white-space:pre"></textarea>' +
      '<div class="hint">共 ' + txt.length + ' 字。复制后到豆包粘贴，最后一段的问题可以改成你自己的。</div>';
    $('#xAiText').value = txt;
    $('#xAiCopy').disabled = false;
  }
  function copyAi() {
    var ta = $('#xAiText'); if (!ta) return;
    ta.select(); var okc = false;
    try { okc = document.execCommand('copy'); } catch (e) { }
    if (!okc && navigator.clipboard) { navigator.clipboard.writeText(ta.value); okc = true; }
    alert(okc ? '已复制，到豆包里粘贴即可。' : '复制失败，请手动全选复制。');
  }

  /* ==================== 互补洞察：睡眠 ↔ 训练 ↔ 饮食 ====================
   * 口径与门槛来自调研（Nedeltcheva 2010 / Craven 2022 / Knowles 2022 / Spiegel 2004 等）：
   *   · Load = Σ(重量 × 次数)；对比「前夜 <6h」与「≥7h」的次日训练容量
   *   · 睡眠达标周（≥5 天睡 ≥7h）vs 未达标周的体重变化速率
   *   · 睡眠不足次日的热量摄入差异
   *   样本门槛：配对每条件 ≥6 个训练日才显示；周级每类 ≥3 周。不够就明说"还不够"。
   */
  function shiftDate(d, k) {
    var p = String(d).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    dt.setDate(dt.getDate() + k);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function pad(v) { return (v < 10 ? '0' : '') + v; }

  function insights() {
    var host = hd(); if (!host) return null;
    var W = global.HDWorkout; if (!W) return null;
    var S = W.state();
    var sleepBy = {}, kcalBy = {}, wtBy = {};
    host.db.entries.forEach(function (e) {
      if (e.type === 'rest') sleepBy[e.date] = (sleepBy[e.date] || 0) + n(e.value);
      else if (e.type === 'food') kcalBy[e.date] = (kcalBy[e.date] || 0) + n(e.kcal);
      else if (e.type === 'weight') wtBy[e.date] = n(e.value);
    });
    /* ① 前夜睡眠 vs 次日训练容量 */
    var goodLoad = [], poorLoad = [];
    S.sessions.forEach(function (s) {
      var prev = shiftDate(s.date, -1);
      var sl = sleepBy[prev];
      if (!(sl > 0)) return;
      var load = 0;
      s.entries.forEach(function (e) { if (e.mode !== 'cardio') e.sets.forEach(function (x) { if (x.done) load += n(x.w) * n(x.r); }); });
      if (load <= 0) return;
      if (sl < 6) poorLoad.push(load); else if (sl >= 7) goodLoad.push(load);
    });
    /* ② 睡眠不足次日的热量摄入 */
    var kcalPoor = [], kcalGood = [];
    Object.keys(kcalBy).forEach(function (d) {
      var sl = sleepBy[shiftDate(d, -1)];
      if (!(sl > 0) || !(kcalBy[d] > 200)) return;
      if (sl < 6) kcalPoor.push(kcalBy[d]); else if (sl >= 7) kcalGood.push(kcalBy[d]);
    });
    /* ③ 睡眠达标周 vs 未达标周的体重速率 */
    var weeks = {};
    Object.keys(sleepBy).forEach(function (d) {
      var p = d.split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
      var mon = shiftDate(d, -((dt.getDay() + 6) % 7));
      (weeks[mon] = weeks[mon] || { days: 0, good: 0, w: [] });
      weeks[mon].days++;
      if (sleepBy[d] >= 7) weeks[mon].good++;
      if (wtBy[d] > 0) weeks[mon].w.push({ d: d, v: wtBy[d] });
    });
    var okW = [], badW = [];
    Object.keys(weeks).forEach(function (k) {
      var w = weeks[k];
      if (w.days < 4 || w.w.length < 2) return;
      var rate = (w.w[w.w.length - 1].v - w.w[0].v);
      if (w.good >= 5) okW.push(rate); else badW.push(rate);
    });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; };
    return {
      goodLoad: goodLoad.length, poorLoad: poorLoad.length,
      goodAvg: Math.round(avg(goodLoad)), poorAvg: Math.round(avg(poorLoad)),
      loadDiff: goodLoad.length && poorLoad.length ? Math.round((1 - avg(poorLoad) / avg(goodLoad)) * 100) : 0,
      kcalPoorAvg: Math.round(avg(kcalPoor)), kcalGoodAvg: Math.round(avg(kcalGood)),
      kcalDiff: kcalPoor.length && kcalGood.length ? Math.round(avg(kcalPoor) - avg(kcalGood)) : 0,
      kcalPoorN: kcalPoor.length, kcalGoodN: kcalGood.length,
      goodWeeks: okW.length, badWeeks: badW.length,
      goodWeekRate: r1(avg(okW)), badWeekRate: r1(avg(badW))
    };
  }

  function renderInsights() {
    var host = hd(); if (!host) return '';
    var ins = insights();
    if (!ins) return '';
    var rows = [];
    /* ① 训练容量 */
    if (ins.goodLoad >= 6 && ins.poorLoad >= 6) {
      rows.push('<div class="trItem"><b>睡眠不足次日</b><span class="hint">前夜睡 <6 小时的次日训练容量平均 <b>' + ins.poorAvg +
        ' kg</b>；睡 ≥7 小时是 <b>' + ins.goodAvg + ' kg</b>，相差 <b>' + (ins.loadDiff > 0 ? '−' : '+') + Math.abs(ins.loadDiff) +
        '%</b>（各 ' + ins.poorLoad + ' / ' + ins.goodLoad + ' 次训练）</span></div>');
    } else {
      rows.push('<div class="trItem"><b>睡眠与训练容量</b><span class="hint">还不够判断：需要"睡 <6 小时"和"睡 ≥7 小时"各至少 6 次训练（现在分别是 ' +
        ins.poorLoad + ' / ' + ins.goodLoad + '）</span></div>');
    }
    /* ② 热量摄入 */
    if (ins.kcalPoorN >= 6 && ins.kcalGoodN >= 6) {
      rows.push('<div class="trItem"><b>睡眠不足次日吃多少</b><span class="hint">前夜 <6 小时的次日平均摄入 <b>' + ins.kcalPoorAvg +
        ' 千卡</b>，≥7 小时是 <b>' + ins.kcalGoodAvg + ' 千卡</b>，' + (ins.kcalDiff > 0 ? '多吃 ' + ins.kcalDiff : '少吃 ' + Math.abs(ins.kcalDiff)) +
        ' 千卡（研究里睡眠限制会升高饥饿感，这里用你自己的数据看有没有应验）</span></div>');
    } else {
      rows.push('<div class="trItem"><b>睡眠与热量摄入</b><span class="hint">还不够判断：两类各需 ≥6 天（现在 ' + ins.kcalPoorN + ' / ' + ins.kcalGoodN + ' 天）</span></div>');
    }
    /* ③ 周级体重速率 */
    if (ins.goodWeeks >= 3 && ins.badWeeks >= 3) {
      rows.push('<div class="trItem"><b>睡眠达标周 vs 不达标周</b><span class="hint">睡得好（≥5 天 ≥7 小时）的周，体重变化平均 <b>' + ins.goodWeekRate +
        ' kg/周</b>；不达标周 <b>' + ins.badWeekRate + ' kg/周</b>（各 ' + ins.goodWeeks + ' / ' + ins.badWeeks + ' 周）</span></div>');
    } else {
      rows.push('<div class="trItem"><b>睡眠与体重速率</b><span class="hint">还不够判断：两类周各需 ≥3 周（现在 ' + ins.goodWeeks + ' / ' + ins.badWeeks + ' 周）</span></div>');
    }
    return '<div class="row" style="margin-top:18px"><b>互补洞察：睡眠 ↔ 训练 ↔ 饮食</b><span class="hint">只做相关，不下因果结论</span></div>' +
      rows.join('') +
      '<div class="hint" style="margin-top:8px">这些是<b>你自己的数据</b>里的相关性，样本小、且睡眠与训练往往同时被作息/压力影响，' +
      '所以只用来"发现自己身上的规律"，不能当因果。研究支持的背景：睡眠限制会降低训练容量与脂肪减少比例（Nedeltcheva 2010）、' +
      '升高饥饿感（Spiegel 2004）；而力量训练反过来能改善主观睡眠质量（Kovacevic 2018）。</div>';
  }


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
    /* 自适应 TDEE：用你自己的体重趋势反推实际消耗 */
    var at = F.adaptiveTdee(pts, host.db.entries, host.today ? host.today() : host.date());
    if (at.ok) {
      var formulaTdee = n(host.db.profile && host.db.profile.tdee) || 0;
      html += '<div class="result" style="margin-top:12px"><b>实际消耗约 ' + at.tdee + ' 千卡/天</b>' +
        '（置信度' + at.conf + '，基于近 ' + at.span + ' 天体重趋势 + ' + at.days + ' 天饮食记录）<br>' +
        '<span class="hint">平均摄入 ' + at.intake + ' 千卡，体重 ' + (at.perWeek > 0 ? '+' : '') + at.perWeek + ' kg/周 → 反推消耗 = 摄入 − 体重变化×7700÷天数。' +
        (formulaTdee > 0 && Math.abs(formulaTdee - at.tdee) > 150 ? '与公式估算的 ' + formulaTdee + ' 千卡相差 ' + Math.abs(Math.round(formulaTdee - at.tdee)) + '，<b>以实测为准</b>。' : '') +
        '<br>静态公式（缺口×7700）通常会高估减重速度约一倍，所以这里改用你自己的数据反推。</span></div>';
    } else if (at.reason) {
      html += '<div class="hint" style="margin-top:10px">自适应消耗还无法计算：' + esc(at.reason) + '</div>';
    }
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
    box.innerHTML = html + renderInsights();
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
      if (!ev.target || !ev.target.id) return;
      if (ev.target.id === 'xAiBuild') { doBuild(); return; }
      if (ev.target.id === 'xAiCopy') { copyAi(); return; }
      if (ev.target.id === 'xHrGo') {
        var age = n($('#xHrAge') && $('#xHrAge').value), rest = n($('#xHrRest') && $('#xHrRest').value);
        paintZones(F.hrZones(age, rest || 60));
      }
    });
  }

  global.HDExtras = {
    render: function () { try { renderHome(); renderNextWeek(); renderMethods(); renderCardio(); renderForecast(); renderAi(); } catch (e) { console.warn('扩展模块渲染失败', e); } },
    bind: bind, applyProgram: applyProgram, addCardio: addCardio,
    _renderMethods: renderMethods, _renderForecast: renderForecast,
    setFilter: function (k) { methodFilter = k; }
  };
})(window);
