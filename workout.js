/* workout.js — 训练模块：可编辑计划 / 复用模板 / 渐进超负荷 / 执行记录 / 统计
 *
 * 设计依据（开源项目调研结论）：
 *   数据模型      —— 计划(处方)与记录(实际)物理分开；动作只按 exId 引用，不复制；条目有稳定 uid
 *   渐进超负荷    —— Double progression 为主：每组都到次数上限才加重，否则目标每组 +1 次
 *   自动减重      —— 连续 N 次未达标 → 重量 ×0.9 并对齐到最小重量步进（deload）
 *   1RM 估算      —— Epley: w*(1+r/30)，不外推 >12 次
 *   热身组        —— 按工作组重量百分比，不计入 1RM / 容量 / 渐进
 *   统计取舍      —— e1RM 曲线、周训练量、肌群分布、PR、训练频率；不做饼图/雷达/疲劳地图
 */
(function (global) {
  'use strict';

  var EX = global.EXERCISE_DB || {};
  var EX_BY_ID = {};
  Object.keys(EX).forEach(function (c) {
    EX[c].forEach(function (e) { EX_BY_ID[e.id] = e; e.cat = e.cat || c; });
  });
  var CATS = Object.keys(EX);

  /* ===================== 小工具 ===================== */
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid(p) { return (p || 'i') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayOfWeek(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function addDays(s, k) {
    var p = String(s).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + k); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function daysBetween(a, b) {
    var x = String(a).split('-'), y = String(b).split('-');
    return Math.round((new Date(+y[0], +y[1] - 1, +y[2]) - new Date(+x[0], +x[1] - 1, +x[2])) / 86400000);
  }
  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ===================== 内置计划（可直接编辑） ===================== */
  function it(exId, sets, repsMin, repsMax, weight, restSec, note) {
    return { uid: 'i_' + exId + '_' + sets + repsMin, exId: exId, sets: sets, repsMin: repsMin, repsMax: repsMax, weight: weight || 0, restSec: restSec || 120, note: note || '', miss: 0 };
  }
  function cardio(exId, targetMin) {
    return { uid: 'i_' + exId, exId: exId, mode: 'cardio', targetMin: targetMin || 30, restSec: 0, note: '', miss: 0 };
  }
  function day(id, name, weekday, items) { return { id: id, name: name, weekday: weekday, items: items }; }

  function builtinRoutines() {
    return [
      {
        id: 'r_ul4', name: '上下肢 4 日', desc: '每周 4 练：上肢推 / 下肢蹲 / 上肢拉 / 下肢髋。适合能每周去 4 次健身房的人。',
        days: [
          day('d_ua', '上肢 A（推）', 1, [
            it('bench_press', 4, 6, 8, 40, 150, '肩胛后收下沉'),
            it('db_shoulder_press', 3, 8, 12, 12, 120),
            it('lat_pulldown', 3, 8, 12, 40, 120),
            it('triceps_pushdown', 3, 10, 15, 20, 90),
            it('lateral_raise', 3, 12, 15, 6, 75)
          ]),
          day('d_la', '下肢 A（蹲）', 2, [
            it('squat', 4, 6, 8, 50, 180, '膝盖顺脚尖方向'),
            it('romanian_dl', 3, 8, 10, 50, 150),
            it('leg_press', 3, 10, 12, 100, 120),
            it('leg_curl', 3, 10, 12, 30, 90),
            it('calf_raise', 4, 12, 15, 40, 60)
          ]),
          day('d_ub', '上肢 B（拉）', 4, [
            it('barbell_row', 4, 6, 8, 40, 150),
            it('pullup', 3, 5, 10, 0, 150, '做不动可用助力带/弹力带'),
            it('incline_bench', 3, 8, 12, 30, 120),
            it('face_pull', 3, 12, 15, 15, 75),
            it('barbell_curl', 3, 10, 12, 20, 90)
          ]),
          day('d_lb', '下肢 B（髋）', 5, [
            it('deadlift', 3, 5, 5, 60, 210, '背部中立，杠铃贴身'),
            it('leg_extension', 3, 12, 15, 30, 90),
            it('hip_thrust', 3, 8, 12, 50, 120),
            it('lunge', 3, 10, 12, 12, 120, '左右各算一组'),
            it('plank', 3, 30, 60, 0, 60, '按秒记，填在次数里')
          ])
        ]
      },
      {
        id: 'r_ppl3', name: '推拉腿 3 日', desc: '经典三分化，每周 3 练，每次 5–6 个动作。',
        days: [
          day('d_push', '推（胸肩三头）', 1, [
            it('bench_press', 4, 6, 8, 40, 150),
            it('ohp', 3, 6, 10, 25, 150),
            it('db_press', 3, 8, 12, 14, 120),
            it('cable_crossover', 3, 12, 15, 15, 75),
            it('triceps_pushdown', 3, 10, 15, 20, 75)
          ]),
          day('d_pull', '拉（背二头）', 3, [
            it('deadlift', 3, 5, 5, 60, 210),
            it('lat_pulldown', 4, 8, 12, 40, 120),
            it('seated_row', 3, 8, 12, 40, 120),
            it('face_pull', 3, 12, 15, 15, 75),
            it('db_curl', 3, 10, 12, 10, 90)
          ]),
          day('d_legs', '腿（蹲髋小腿）', 5, [
            it('squat', 4, 6, 8, 50, 180),
            it('leg_press', 3, 10, 12, 100, 120),
            it('romanian_dl', 3, 8, 10, 50, 150),
            it('leg_curl', 3, 10, 12, 30, 90),
            it('calf_raise', 4, 12, 15, 40, 60)
          ])
        ]
      },
      {
        id: 'r_fb3', name: '全身 3 日 + 有氧', desc: '每次练全身，穿插有氧。适合一周 3 练、想兼顾心肺的人。',
        days: [
          day('d_fb1', '全身 A', 1, [
            it('squat', 3, 6, 8, 50, 180),
            it('bench_press', 3, 6, 8, 40, 150),
            it('barbell_row', 3, 8, 10, 40, 120),
            cardio('treadmill_walk', 20),
            it('plank', 3, 30, 60, 0, 60)
          ]),
          day('d_fb2', '全身 B', 3, [
            it('deadlift', 3, 5, 5, 60, 210),
            it('ohp', 3, 6, 10, 25, 150),
            it('lat_pulldown', 3, 8, 12, 40, 120),
            cardio('cycling', 25),
            it('crunch', 3, 12, 20, 0, 60)
          ]),
          day('d_fb3', '全身 C', 5, [
            it('leg_press', 3, 10, 12, 100, 120),
            it('incline_bench', 3, 8, 12, 30, 120),
            it('seated_row', 3, 8, 12, 40, 120),
            cardio('outdoor_run', 20),
            it('back_extension', 3, 12, 15, 0, 60)
          ])
        ]
      }
    ];
  }

  /* ===================== 状态规范化 ===================== */
  function normalizeItem(raw) {
    if (!raw || !EX_BY_ID[raw.exId]) return null;
    var ex = EX_BY_ID[raw.exId];
    var mode = raw.mode === 'cardio' || ex.cat === '有氧' ? 'cardio' : 'strength';
    var o = { uid: String(raw.uid || uid('i')), exId: raw.exId, mode: mode, note: String(raw.note || ''), miss: Math.max(0, n(raw.miss)) };
    if (mode === 'cardio') {
      o.targetMin = n(raw.targetMin) > 0 ? n(raw.targetMin) : 30;
      o.restSec = 0;
    } else {
      o.sets = Math.min(10, Math.max(1, n(raw.sets) || 3));
      o.repsMin = Math.max(1, n(raw.repsMin) || 8);
      o.repsMax = Math.max(o.repsMin, n(raw.repsMax) || o.repsMin);
      o.weight = Math.max(0, n(raw.weight));
      o.restSec = n(raw.restSec) >= 0 ? n(raw.restSec) : 120;
    }
    return o;
  }
  function normalizeDay(raw) {
    if (!raw || !Array.isArray(raw.items)) return null;
    var items = raw.items.map(normalizeItem).filter(Boolean);
    return {
      id: String(raw.id || uid('d')), name: String(raw.name || '训练日'),
      weekday: (n(raw.weekday) >= 0 && n(raw.weekday) <= 6) ? n(raw.weekday) : -1,
      items: items
    };
  }
  function normalizeRoutine(raw) {
    if (!raw || !Array.isArray(raw.days)) return null;
    var days = raw.days.map(normalizeDay).filter(Boolean);
    if (!days.length) return null;
    /* 一个动作都不剩的计划没有意义，丢弃（回退到内置计划） */
    if (!days.some(function (d) { return d.items.length > 0; })) return null;
    return { id: String(raw.id || uid('r')), name: String(raw.name || '训练计划'), desc: String(raw.desc || ''), days: days };
  }
  function normalizeState(raw) {
    var out = { version: 1, activeId: '', routines: [], templates: [], sessions: [], settings: { unit: 'kg', stepUpper: 2.5, stepLower: 5, deloadAfter: 3, deloadFactor: 0.9, cardoGoalMin: 150 }, log: {} };
    var rs = (raw && Array.isArray(raw.routines)) ? raw.routines.map(normalizeRoutine).filter(Boolean) : [];
    out.routines = rs.length ? rs : builtinRoutines();
    if (raw && Array.isArray(raw.templates)) {
      out.templates = raw.templates.map(function (t) {
        var r = normalizeRoutine(t);
        if (!r) return null;
        r.frozen = true;
        return r;
      }).filter(Boolean);
    }
    out.activeId = out.routines.some(function (r) { return r.id === (raw && raw.activeId); }) ? raw.activeId : out.routines[0].id;
    if (raw && raw.settings) {
      ['stepUpper', 'stepLower', 'deloadAfter', 'deloadFactor', 'cardoGoalMin'].forEach(function (k) {
        if (n(raw.settings[k]) > 0) out.settings[k] = n(raw.settings[k]);
      });
    }
    if (raw && Array.isArray(raw.sessions)) {
      var seen = {};
      raw.sessions.forEach(function (s) {
        if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return;
        var id = String(s.id || ('s_' + s.date));
        if (seen[id]) return;
        seen[id] = 1;
        var entries = (Array.isArray(s.entries) ? s.entries : []).map(function (e) {
          if (!e || !EX_BY_ID[e.exId]) return null;
          var sets = (Array.isArray(e.sets) ? e.sets : []).map(function (x) {
            if (!x) return null;
            return { w: n(x.w), r: n(x.r), min: n(x.min), done: !!x.done };
          }).filter(Boolean);
          return {
            uid: String(e.uid || ''), exId: e.exId, mode: e.mode === 'cardio' ? 'cardio' : 'strength',
            planned: e.planned || null, noProg: !!e.noProg, note: String(e.note || ''), sets: sets,
            restTarget: n(e.restTarget) > 0 ? n(e.restTarget) : 0,
            rests: (Array.isArray(e.rests) ? e.rests : []).filter(function (x) { return n(x) > 0 && n(x) < 1800; }).map(function (x) { return Math.round(n(x)); }).slice(-30)
          };
        }).filter(Boolean);
        if (!entries.length) return;
        out.sessions.push({
          id: id, date: s.date, routineId: s.routineId || '', dayId: s.dayId || '',
          dayName: String(s.dayName || ''), start: s.start || '', end: s.end || '',
          startTs: n(s.startTs), endTs: n(s.endTs),
          feeling: n(s.feeling), note: String(s.note || ''), entries: entries
        });
      });
      out.sessions.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      out.sessions = out.sessions.slice(-500);
    }
    if (raw && raw.log && typeof raw.log === 'object') out.log = raw.log;
    return out;
  }

  /* ===================== 渐进超负荷 ===================== */
  /** Epley 1RM 估算；超过 12 次不外推（误差过大） */
  function e1rm(w, r) {
    w = n(w); r = n(r);
    if (!(w > 0) || !(r > 0) || r > 12) return 0;
    return r1(w * (1 + r / 30));
  }
  function snapTo(w, step) {
    step = n(step) > 0 ? n(step) : 2.5;
    return Math.max(step, Math.round(w / step) * step);
  }
  function stepFor(exId) {
    var ex = EX_BY_ID[exId];
    var big = ['腿', '背', '臀'];
    return (ex && big.indexOf(ex.cat) >= 0) ? (S.settings.stepLower || 5) : (S.settings.stepUpper || 2.5);
  }
  /** 找同一动作最近一次有效记录（优先同一 uid，其次同一 routine） */
  function lastPerf(exId, uidv, routineId) {
    var best = null, bestUid = null;
    for (var i = S.sessions.length - 1; i >= 0; i--) {
      var s = S.sessions[i];
      for (var j = 0; j < s.entries.length; j++) {
        var e = s.entries[j];
        if (e.exId !== exId || e.noProg) continue;
        var done = e.sets.filter(function (x) { return x.done; });
        if (!done.length) continue;
        var rec = { date: s.date, entry: e, done: done, session: s };
        if (!bestUid && uidv && e.uid === uidv) { bestUid = rec; }
        if (!best) best = rec;
      }
    }
    return bestUid || best;
  }
  /** 给出本次建议：重量 / 目标次数 / 理由 / 是否 PR */
  function suggest(item) {
    var ex = EX_BY_ID[item.exId] || {};
    if (item.mode === 'cardio') {
      var lastC = lastPerf(item.exId, item.uid, '');
      var tm = item.targetMin || 30;
      var lmin = lastC ? Math.max.apply(null, lastC.done.map(function (x) { return n(x.min); })) : 0;
      return {
        mode: 'cardio', targetMin: tm,
        reason: lastC ? ('上次 ' + lastC.date + ' 完成 ' + r1(lmin) + ' 分钟' + (lmin >= tm ? '，可尝试加到 ' + (tm + 5) + ' 分钟' : '，先稳定在 ' + tm + ' 分钟')) : '首次，按计划时长开始'
      };
    }
    var last = lastPerf(item.exId, item.uid, '');
    var plan = { sets: item.sets, repsMin: item.repsMin, repsMax: item.repsMax, weight: item.weight };
    var out = { mode: 'strength', weight: item.weight, reps: item.repsMin, sets: item.sets, reason: '', pr: false, last: last };
    if (!last) {
      out.reason = '首次训练该动作，按计划重量 ' + item.weight + ' kg 开始';
      return out;
    }
    var p = last.entry.planned || plan;
    var need = n(p.sets) || item.sets;
    var working = last.done.slice(0, need);
    var minReps = Math.min.apply(null, working.map(function (x) { return n(x.r); }));
    var allHit = working.length >= need && working.every(function (x) { return n(x.r) >= n(p.repsMax || item.repsMax); });
    var e1 = Math.max.apply(null, working.map(function (x) { return e1rm(x.w, x.r); }));
    var lastW = n(p.weight);

    if (item.miss >= (S.settings.deloadAfter || 3)) {
      var dw = snapTo((item.weight || lastW) * (S.settings.deloadFactor || 0.9), stepFor(item.exId));
      if (dw >= (item.weight || lastW)) dw = Math.max(stepFor(item.exId), (item.weight || lastW) - stepFor(item.exId));
      out.weight = dw; out.reps = item.repsMin;
      out.reason = '连续 ' + item.miss + ' 次未达标 → 减重到 ' + dw + ' kg（deload），把动作质量做回来';
      return out;
    }
    /* 计划的重量已经在「结束训练」时按成绩调整过了，这里只做解释与次数目标，不能重复加重 */
    if (lastW > item.weight + 0.01) {
      out.weight = item.weight; out.reps = item.repsMin;
      out.reason = '上次连续未达标 → 已减重到 ' + item.weight + ' kg（deload），先把动作质量做回来';
      return out;
    }
    if (allHit) {
      out.weight = item.weight; out.reps = item.repsMin;
      out.reason = '上次每组都达到 ' + n(p.repsMax || item.repsMax) + ' 次 → 本次已加重到 ' + item.weight + ' kg，次数回到 ' + item.repsMin;
    } else {
      out.weight = item.weight;
      out.reps = Math.min(item.repsMax, minReps + 1);
      out.reason = '保持 ' + item.weight + ' kg，目标每组 ≥ ' + out.reps + ' 次（每组都到 ' + item.repsMax + ' 次才加重）';
    }
    if (e1 > 0 && e1 >= (S.log['pr_' + item.exId] || 0)) { out.pr = true; out.reason += ' · 本次有望刷新 e1RM 记录（' + e1 + ' kg）'; }
    return out;
  }
  /** 一次训练结束后，按实际完成情况推进计划（这是"日积月累"的核心） */
  function applyProgression(session) {
    var routine = S.routines.filter(function (r) { return r.id === session.routineId; })[0] || activeRoutine();
    var d = routine && routine.days.filter(function (x) { return x.id === session.dayId; })[0];
    session.entries.forEach(function (e) {
      var item = d && d.items.filter(function (x) { return x.uid === e.uid; })[0];
      if (!item || item.mode === 'cardio') return;
      var need = (e.planned && n(e.planned.sets)) || item.sets;
      var done = e.sets.filter(function (x) { return x.done; });
      var working = done.slice(0, need);
      var ok = working.length >= need && working.every(function (x) { return n(x.r) >= item.repsMax; });
      if (ok) {
        item.weight = r1(item.weight + stepFor(item.exId));
        item.miss = 0;
      } else {
        item.miss = (item.miss || 0) + 1;
        if (item.miss >= (S.settings.deloadAfter || 3)) {
          var dw = snapTo(item.weight * (S.settings.deloadFactor || 0.9), stepFor(item.exId));
          item.weight = dw >= item.weight ? Math.max(stepFor(item.exId), item.weight - stepFor(item.exId)) : dw;
          item.miss = 0;
        }
      }
      session.entries.filter(function (x) { return x.uid === e.uid; })[0].progressionApplied = { weight: item.weight, miss: item.miss };
    });
    /* PR 记录 */
    session.entries.forEach(function (e) {
      var best = 0;
      e.sets.filter(function (x) { return x.done; }).forEach(function (x) { best = Math.max(best, e1rm(x.w, x.r)); });
      if (best > 0 && best > (S.log['pr_' + e.exId] || 0)) S.log['pr_' + e.exId] = best;
    });
  }

  /* ===================== 计时 ===================== */
  /** 按次数区间推断合理的组间休息（秒）：力量留足、增肌适中、耐力短一些 */
  function defaultRest(item, exId) {
    var ex = EX_BY_ID[exId] || {};
    var small = ['手臂', '肩', '核心'].indexOf(ex.cat) >= 0;
    var big = ['腿', '背', '臀'].indexOf(ex.cat) >= 0;
    var r = n(item.repsMax) || 10;
    var base;
    if (r <= 5) base = 210;          /* 最大力量：3–4 分钟 */
    else if (r <= 8) base = 150;     /* 力量偏增肌 */
    else if (r <= 12) base = 100;    /* 增肌：1.5–2 分钟 */
    else base = 60;                  /* 耐力/泵感：1 分钟 */
    if (small) base = Math.min(base, 90);
    if (big && r <= 5) base = 240;   /* 大重量复合动作需要更久 */
    return base;
  }
  /** 单组用时估算（秒）：向心 1 + 离心 2 + 组内停顿 ≈ 次数 × 3 + 5 */
  function setSeconds(item) {
    var r = n(item.repsMax) || 10;
    return Math.round(r * 3 + 5);
  }
  /** 本次训练的密度指标 */
  function densityOf(session) {
    if (!session) return null;
    var est = 0, sets = 0;
    session.entries.forEach(function (e) {
      if (e.mode === 'cardio') return;
      var done = e.sets.filter(function (x) { return x.done; });
      sets += done.length;
      est += done.length * setSeconds({ repsMax: (e.planned && e.planned.repsMax) || 10 });
    });
    var rests = [];
    var targets = [];
    session.entries.forEach(function (e) {
      if (e.mode !== 'cardio' && n(e.restTarget) > 0) targets.push(n(e.restTarget));
      (e.rests || []).forEach(function (r) { if (r > 0) rests.push(r); });
    });
    rests.sort(function (a, b) { return a - b; });
    var med = rests.length ? (rests.length % 2 ? rests[(rests.length - 1) / 2] : Math.round((rests[rests.length / 2 - 1] + rests[rests.length / 2]) / 2)) : 0;
    /* 建议休息取本次各动作休息目标的中位数 */
    targets.sort(function (a, b) { return a - b; });
    var rec = targets.length ? (targets.length % 2 ? targets[(targets.length - 1) / 2] : Math.round((targets[targets.length / 2 - 1] + targets[targets.length / 2]) / 2)) : 0;
    var over = rec > 0 ? rests.filter(function (r) { return r > rec * 1.5; }).length : 0;
    var durMin = session.startTs && session.endTs ? Math.max(1, Math.round((session.endTs - session.startTs) / 60000)) : 0;
    var vol = volumeOf(session);
    return {
      sets: sets, estWorkSec: est, rests: rests.length, restMedian: med, restTarget: rec, overRest: over,
      durationMin: durMin, workRatio: durMin > 0 ? Math.min(1, r1(est / (durMin * 60))) : 0,
      volumePerHour: durMin > 0 ? Math.round(vol / (durMin / 60)) : 0, volume: vol
    };
  }

  /* ===================== 会话 ===================== */
  function activeRoutine() {
    return S.routines.filter(function (r) { return r.id === S.activeId; })[0] || S.routines[0];
  }
  function todayDay() {
    var r = activeRoutine();
    if (!r) return null;
    var wd = new Date().getDay();
    return r.days.filter(function (d) { return d.weekday === wd; })[0] || null;
  }
  function sessionOn(date) {
    return S.sessions.filter(function (s) { return s.date === date; })[0] || null;
  }
  /** 开始一次训练（把计划快照进记录） */
  function startSession(dayId, date) {
    date = date || host.today();
    if (sessionOn(date)) return sessionOn(date);
    var r = activeRoutine();
    var d = r.days.filter(function (x) { return x.id === dayId; })[0];
    if (!d) return null;
    var sg = {};
    d.items.forEach(function (i) { sg[i.uid] = suggest(i); });
    var s = {
      id: 's_' + date, date: date, routineId: r.id, dayId: d.id, dayName: d.name,
      start: new Date().toTimeString().slice(0, 5), end: '', startTs: Date.now(), endTs: 0,
      feeling: 0, note: '',
      entries: d.items.map(function (i) {
        var sug = sg[i.uid];
        /* 休息时长：计划里没设（0）就按次数区间自动给一个合理值 */
        var rest = i.mode === 'cardio' ? 0 : (n(i.restSec) > 0 ? n(i.restSec) : defaultRest(i, i.exId));
        if (i.mode !== 'cardio' && !(n(i.restSec) > 0)) i.restSec = rest;
        var entry = {
          uid: i.uid, exId: i.exId, mode: i.mode, note: '', rests: [], restTarget: rest,
          planned: i.mode === 'cardio'
            ? { mode: 'cardio', targetMin: sug.targetMin }
            : { sets: i.sets, repsMin: i.repsMin, repsMax: i.repsMax, weight: sug.weight, restSec: rest, reason: sug.reason },
          noProg: false, sets: []
        };
        if (i.mode === 'cardio') {
          entry.sets = [{ min: sug.targetMin, done: false }];
        } else {
          for (var k = 0; k < i.sets; k++) entry.sets.push({ w: sug.weight, r: sug.reps, done: false });
        }
        return entry;
      })
    };
    S.sessions.push(s);
    S.sessions.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return s;
  }
  function finishSession(date) {
    var s = sessionOn(date);
    if (!s) return;
    s.end = new Date().toTimeString().slice(0, 5);
    s.endTs = Date.now();
    if (!s.startTs) s.startTs = s.endTs - 3600000;
    s.entries.forEach(function (e) { e.sets = e.sets.filter(function (x) { return x.done || x.w || x.r || x.min; }); });
    applyProgression(s);
  }
  function dropSession(date) {
    S.sessions = S.sessions.filter(function (s) { return s.date !== date; });
  }

  /* ===================== 统计 ===================== */
  function volumeOf(session) {
    var v = 0;
    if (!session) return 0;
    session.entries.forEach(function (e) {
      if (e.mode === 'cardio' || e.noProg) return;
      e.sets.forEach(function (x) { if (x.done) v += n(x.w) * n(x.r); });
    });
    return Math.round(v);
  }
  function cardioMinOf(session) {
    var m = 0;
    if (!session) return 0;
    session.entries.forEach(function (e) {
      if (e.mode !== 'cardio') return;
      e.sets.forEach(function (x) { if (x.done) m += n(x.min); });
    });
    return m;
  }
  function weekStart(dateStr) { return addDays(dateStr, -((dayOfWeek(dateStr) + 6) % 7)); }
  function weeklyStats(weeks) {
    var out = [], thisWeek = weekStart(host.today());
    for (var i = weeks - 1; i >= 0; i--) {
      var ws = addDays(thisWeek, -7 * i), we = addDays(ws, 6);
      var ss = S.sessions.filter(function (s) { return s.date >= ws && s.date <= we; });
      var vol = 0, sets = 0, cardio = 0;
      ss.forEach(function (s) {
        vol += volumeOf(s); cardio += cardioMinOf(s);
        s.entries.forEach(function (e) { sets += e.sets.filter(function (x) { return x.done; }).length; });
      });
      out.push({ start: ws, end: we, sessions: ss.length, volume: vol, sets: sets, cardio: cardio });
    }
    return out;
  }
  function muscleVolume(days) {
    var from = addDays(host.today(), -days), map = {};
    S.sessions.forEach(function (s) {
      if (s.date < from) return;
      s.entries.forEach(function (e) {
        var ex = EX_BY_ID[e.exId]; if (!ex || e.mode === 'cardio') return;
        var c = ex.cat; map[c] = map[c] || { sets: 0, volume: 0 };
        e.sets.forEach(function (x) { if (x.done) { map[c].sets++; map[c].volume += n(x.w) * n(x.r); } });
      });
    });
    return map;
  }
  function e1rmSeries(exId) {
    var out = [];
    S.sessions.forEach(function (s) {
      var best = 0;
      s.entries.forEach(function (e) {
        if (e.exId !== exId || e.noProg) return;
        e.sets.forEach(function (x) { if (x.done) best = Math.max(best, e1rm(x.w, x.r)); });
      });
      if (best > 0) out.push({ date: s.date, v: best });
    });
    return out;
  }
  function prTable() {
    var out = [];
    S.sessions.forEach(function (s) {
      s.entries.forEach(function (e) {
        var b = { e1: 0, w: 0, vol: 0, reps: 0, date: s.date };
        e.sets.forEach(function (x) {
          if (!x.done) return;
          b.e1 = Math.max(b.e1, e1rm(x.w, x.r)); b.w = Math.max(b.w, n(x.w)); b.reps = Math.max(b.reps, n(x.r)); b.vol += n(x.w) * n(x.r);
        });
        if (b.w > 0 || b.reps > 0) out.push({ exId: e.exId, date: s.date, e1: r1(b.e1), w: b.w, reps: b.reps, vol: Math.round(b.vol) });
      });
    });
    var best = {};
    out.forEach(function (x) {
      var c = best[x.exId] || (best[x.exId] = { exId: x.exId, e1: 0, e1date: '', w: 0, wdate: '', vol: 0, voldate: '', reps: 0, repsdate: '' });
      if (x.e1 > c.e1) { c.e1 = x.e1; c.e1date = x.date; }
      if (x.w > c.w) { c.w = x.w; c.wdate = x.date; }
      if (x.vol > c.vol) { c.vol = x.vol; c.voldate = x.date; }
      if (x.reps > c.reps) { c.reps = x.reps; c.repsdate = x.date; }
    });
    return Object.keys(best).map(function (k) { return best[k]; }).filter(function (c) { return c.w > 0 || c.reps > 0; })
      .sort(function (a, b) { return b.e1 - a.e1; });
  }
  /** 近 N 天打卡情况（含休息日也算完成排程） */
  function adherence(days) {
    var r = activeRoutine(), out = [], d = host.today();
    for (var i = days - 1; i >= 0; i--) {
      var ds = addDays(d, -i), wd = dayOfWeek(ds);
      var planned = r ? r.days.filter(function (x) { return x.weekday === wd; })[0] : null;
      var s = sessionOn(ds);
      out.push({ date: ds, wd: wd, planned: !!planned, done: !!s, volume: volumeOf(s) });
    }
    return out;
  }

  /* ===================== 渲染 ===================== */
  var host = null;
  var S = null;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function exName(id) { return (EX_BY_ID[id] && EX_BY_ID[id].name) || id; }
  function exCat(id) { return (EX_BY_ID[id] && EX_BY_ID[id].cat) || ''; }
  function hhmm2min(t) { if (!t) return 0; var p = String(t).split(':'); return n(p[0]) * 60 + n(p[1]); }

  function fmtSets(e) {
    var out = e.sets.filter(function (x) { return x.done; }).map(function (x) {
      return e.mode === 'cardio' ? (r1(x.min) + '分') : (r1(x.w) + '×' + r1(x.r));
    });
    return out.join(' · ') || '—';
  }

  function renderToday() {
    var r = activeRoutine(), d = todayDay(), s = sessionOn(host.today());
    var hint = $('#trTodayHint'), box = $('#trToday');
    var rest = r ? r.days.filter(function (x) { return x.weekday === -1; }) : [];
    hint.textContent = r ? (r.name + ' · ' + WD[new Date().getDay()]) : '未选择计划';
    if (!d) {
      box.innerHTML = '<div class="empty">今天是休息日。' + (r ? '当前计划：' + esc(r.name) + '（' + r.days.map(function (x) { return esc(x.name); }).join(' / ') + '）' : '') +
        '</div>' + (s ? '<div class="result">今天已记录一次训练：' + esc(s.dayName) + ' · 训练量 ' + volumeOf(s) + ' kg</div>' : '');
      return;
    }
    var sugDone = s && s.entries.length;
    var vol = volumeOf(s), cm = cardioMinOf(s);
    box.innerHTML =
      '<div class="card on"><div class="cTop"><b>' + esc(d.name) + '</b><span class="tag on">' + WD[d.weekday] + '</span></div>' +
      '<div class="cBody">' + d.items.map(function (i) {
        return '<span class="lbl">' + esc(exName(i.exId)) + '</span> ' + (i.mode === 'cardio' ? (i.targetMin + ' 分钟') : (i.sets + ' 组 × ' + i.repsMin + '–' + i.repsMax + ' 次 · ' + i.weight + ' kg')) + '<br>';
      }).join('') + '</div>' +
      '<div class="cFoot">' + (s
        ? '<span class="hint">已完成记录：训练量 <b>' + vol + '</b> kg' + (cm ? ' · 有氧 ' + cm + ' 分钟' : '') + '</span><button class="mini" data-tr-open="' + s.date + '">查看/继续</button>'
        : '<span class="hint">共 ' + d.items.length + ' 个动作</span><button class="primary" data-tr-start="' + d.id + '">开始训练</button>') +
      '</div></div>';
  }

  function renderSession() {
    var viewing = S.log.openDate && S.log.openDate !== host.today();
    var date = S.log.openDate || host.today(), s = sessionOn(date);
    var panel = $('#trSessionPanel'), box = $('#trSession');
    if (!s) { panel.classList.add('hide'); return; }
    panel.classList.remove('hide');
    $('#trSessionTitle').textContent = s.date + ' · ' + s.dayName + (viewing ? '（历史记录）' : '');
    $('#trSessionInfo').textContent = '训练量 ' + volumeOf(s) + ' kg · 有氧 ' + cardioMinOf(s) + ' 分钟 · ' + (s.end ? ('用时 ' + (densityOf(s).durationMin || '—') + ' 分钟') : ('开始于 ' + s.start));

    var html = '';
    s.entries.forEach(function (e, idx) {
      var ex = EX_BY_ID[e.exId] || {};
      var last = lastPerf(e.exId, e.uid, s.routineId);
      var doneAll = e.sets.length > 0 && e.sets.every(function (x) { return x.done; });
      html += '<div class="trEx' + (doneAll ? ' done' : '') + '">' +
        '<div class="row"><b>' + esc(ex.name || e.exId) + '</b><span class="hint">' + esc(ex.cat || '') + ' · ' + esc(ex.eq || '') + '</span></div>';
      if (last) {
        html += '<div class="hint">上次 ' + last.date + '：' + esc(fmtSets(last.entry)) +
          (function () { var b = 0; last.done.forEach(function (x) { b = Math.max(b, e1rm(x.w, x.r)); }); return b ? ' · e1RM ' + b + ' kg' : ''; })() + '</div>';
      }
      if (e.planned && e.planned.reason) html += '<div class="hint trReason">建议：' + esc(e.planned.reason) + '</div>';
      if (ex.cue) html += '<div class="hint trCue">要领：' + esc(ex.cue) + '</div>';

      html += '<div class="trSets">';
      e.sets.forEach(function (x, si) {
        html += '<div class="trSet' + (x.done ? ' on' : '') + '">' +
          '<button class="trCheck" data-tr-set="' + idx + ':' + si + '">' + (x.done ? '✓' : '') + '</button>';
        if (e.mode === 'cardio') {
          html += '<label class="trNum">分钟<input type="number" step="1" min="0" data-tr-min="' + idx + ':' + si + '" value="' + (x.min || '') + '"></label>';
        } else {
          html += '<label class="trNum">kg<input type="number" step="' + stepFor(e.exId) + '" min="0" data-tr-w="' + idx + ':' + si + '" value="' + (x.w || '') + '"></label>' +
            '<label class="trNum">次<input type="number" step="1" min="0" data-tr-r="' + idx + ':' + si + '" value="' + (x.r || '') + '"></label>' +
            '<button class="mini" data-tr-timer="' + (e.planned && e.planned.restSec || 120) + '">休息</button>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="controls trExFoot">' +
        '<button class="mini" data-tr-addset="' + idx + '">+ 加一组</button>' +
        (e.mode === 'cardio' ? '' : '<button class="mini" data-tr-drop-last="' + idx + '">− 减一组</button>') +
        '<label class="hint trNoProg"><input type="checkbox" data-tr-noprog="' + idx + '"' + (e.noProg ? ' checked' : '') + '> 本次不计入渐进（deload/康复）</label>' +
        '</div></div>';
    });
    html += '<div class="row end trSessionFoot">' +
      '<button class="mini" id="trDiscard">删除本次记录</button>' +
      (viewing
        ? '<button class="primary" id="trBackToday">回到今天</button>'
        : '<button class="primary" id="trFinish">' + (s.end ? '已结束（重新计算渐进）' : '结束训练并按成绩调整计划') + '</button>') +
      '</div>';
    box.innerHTML = html;
  }

  function renderPlan() {
    var box = $('#trPlanPicker');
    box.innerHTML = S.routines.map(function (r) {
      var on = r.id === S.activeId;
      return '<div class="card' + (on ? ' on' : '') + '"><div class="cTop"><b>' + esc(r.name) + '</b>' +
        (on ? '<span class="tag on">使用中</span>' : '<button class="mini" data-tr-use="' + r.id + '">使用</button>') + '</div>' +
        '<div class="cBody">' + esc(r.desc || '') + '</div>' +
        '<div class="cFoot"><span class="hint">' + r.days.length + ' 个训练日 · ' + r.days.reduce(function (a, d) { return a + d.items.length; }, 0) + ' 个动作</span>' +
        '<span class="controls"><button class="mini" data-tr-dup-plan="' + r.id + '">复制为新计划</button>' +
        '<button class="mini del" data-tr-del-plan="' + r.id + '">删除</button></span></div></div>';
    }).join('') +
      '<div class="controls" style="margin-top:8px"><button class="mini" id="trAddPlan">+ 新建空白计划</button>' +
      '<button class="mini" id="trImportTpl">从模板新建</button></div>' +
      (S.templates.length ? '<div class="hint" style="margin-top:8px">已保存模板：' + S.templates.map(function (t) { return esc(t.name); }).join('、') + '</div>' : '');

    var r = activeRoutine();
    $('#trDays').innerHTML = r.days.map(function (d) {
      return '<div class="trDay"><div class="row"><b>' + esc(d.name) + '</b>' +
        '<span class="controls"><select data-tr-wd="' + d.id + '">' +
        '<option value="-1"' + (d.weekday === -1 ? ' selected' : '') + '>不排程</option>' +
        [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<option value="' + w + '"' + (d.weekday === w ? ' selected' : '') + '>' + WD[w] + '</option>'; }).join('') +
        '</select><button class="mini" data-tr-copy-day="' + d.id + '">复制这天</button>' +
        '<button class="mini" data-tr-del-day="' + d.id + '">删除</button></span></div>' +
        '<div class="trItems">' + d.items.map(function (i) {
          if (i.mode === 'cardio') {
            return '<div class="trItem"><b>' + esc(exName(i.exId)) + '</b><span class="hint">有氧 · 目标 ' + i.targetMin + ' 分钟</span>' +
              '<span class="controls"><button class="mini" data-tr-edit="' + d.id + ':' + i.uid + '">编辑</button>' +
              '<button class="mini del" data-tr-rm="' + d.id + ':' + i.uid + '">移除</button></span></div>';
          }
          return '<div class="trItem"><b>' + esc(exName(i.exId)) + '</b>' +
            '<span class="hint">' + i.sets + ' 组 × ' + i.repsMin + '–' + i.repsMax + ' 次 · ' + i.weight + ' kg · 休息 ' + i.restSec + 's' +
            (i.miss ? ' · 连续未达标 ' + i.miss + ' 次' : '') + '</span>' +
            '<span class="controls"><button class="mini" data-tr-edit="' + d.id + ':' + i.uid + '">编辑</button>' +
            '<button class="mini del" data-tr-rm="' + d.id + ':' + i.uid + '">移除</button></span></div>';
        }).join('') + '</div>' +
        '<div class="controls trAddRow"><select data-tr-pick="' + d.id + '"><option value="">选择动作…</option>' +
        CATS.map(function (c) {
          return '<optgroup label="' + esc(c) + '">' + EX[c].map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select><button class="mini" data-tr-add-item="' + d.id + '">+ 添加动作</button></div>' +
        '</div>';
    }).join('') + '<div class="controls" style="margin-top:8px"><button class="mini" id="trAddDay">+ 新建训练日</button></div>';
  }

  function renderLibrary() {
    var filter = S.log.exFilter || '*';
    $('#trExFilter').innerHTML = ['*'].concat(CATS).map(function (c) {
      return '<button data-tr-cat="' + esc(c) + '"' + (filter === c ? ' class="on"' : '') + '>' + (c === '*' ? '全部' : esc(c)) + ' <span class="hint">' + (c === '*' ? Object.keys(EX_BY_ID).length : EX[c].length) + '</span></button>';
    }).join('');
    var list = [];
    CATS.forEach(function (c) { if (filter === '*' || filter === c) list = list.concat(EX[c]); });
    $('#trExList').innerHTML = list.map(function (e) {
      return '<div class="trLibItem"><div class="row"><b>' + esc(e.name) + '</b><span class="hint">' + esc(e.m) + ' · ' + esc(e.eq) + ' · ' + esc(e.lv) + '</span></div>' +
        '<div class="hint">' + esc(e.cue) + '</div>' +
        '<div class="hint trErr">常见错误：' + esc(e.err) + '</div></div>';
    }).join('');
  }

  function svgLine(points, opt) {
    opt = opt || {};
    var W = 560, H = opt.h || 150, pad = 26;
    if (!points.length) return '<div class="empty">暂无数据</div>';
    var vs = points.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    if (max === min) { max = min + 1; }
    var X = function (i) { return pad + (W - pad * 2) * (points.length === 1 ? 0.5 : i / (points.length - 1)); };
    var Y = function (v) { return H - pad - (H - pad * 2) * (v - min) / (max - min); };
    var s = '<div class="chartWrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    [0, 1, 2].forEach(function (g) {
      var v = min + (max - min) * g / 2, y = Y(v);
      s += '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + y.toFixed(1) + '" style="stroke:var(--border)"/>' +
        '<text x="' + (pad - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10" style="fill:var(--text-3)">' + r1(v) + '</text>';
    });
    s += '<path d="' + points.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ') + '" fill="none" style="stroke:var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>';
    points.forEach(function (p, i) { s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.6" style="fill:var(--accent)"/>'; });
    s += '<text x="' + X(0).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" style="fill:var(--text-3)">' + points[0].date.slice(5) + '</text>';
    if (points.length > 1) s += '<text x="' + X(points.length - 1).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" style="fill:var(--text-3)">' + points[points.length - 1].date.slice(5) + '</text>';
    return s + '</svg></div>';
  }
  function barChart(items, unit) {
    if (!items.length) return '<div class="empty">暂无数据</div>';
    var max = Math.max.apply(null, items.map(function (x) { return x.v; })) || 1;
    return '<div class="barRows">' + items.map(function (x) {
      var pct = Math.round(x.v / max * 100);
      return '<div class="barRow"><span class="bl">' + esc(x.k) + '</span><span class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></span>' +
        '<span class="bv">' + x.v + (unit || '') + '</span></div>';
    }).join('') + '</div>';
  }
  function heatmap(ad) {
    return '<div class="heat">' + ad.map(function (d) {
      var cls = d.done ? 'lv2' : (d.planned ? 'lv0p' : 'lv0');
      return '<span class="' + cls + '" title="' + d.date + (d.planned ? ' 计划训练' : ' 休息日') + (d.done ? ' 已完成' : '') + '"></span>';
    }).join('') + '</div>' +
      '<div class="hint">近 ' + ad.length + ' 天：训练 ' + ad.filter(function (d) { return d.done; }).length + ' 天 / 计划 ' + ad.filter(function (d) { return d.planned; }).length + ' 天</div>';
  }

  function renderStats() {
    var wk = weeklyStats(8);
    var thisW = wk[wk.length - 1], lastW = wk[wk.length - 2] || { volume: 0, sessions: 0, cardio: 0 };
    var mv = muscleVolume(28);
    var ad = adherence(70);
    var pr = prTable().slice(0, 8);
    var goal = S.settings.cardoGoalMin || 150;
    var biggest = Object.keys(mv).map(function (k) { return { k: k, v: mv[k].sets }; }).sort(function (a, b) { return b.v - a.v; });

    $('#trStats').innerHTML =
      '<div class="stats4">' +
      '<div><small>本周训练</small><b>' + thisW.sessions + ' 次</b><span>上周 ' + lastW.sessions + ' 次</span></div>' +
      '<div><small>本周训练量</small><b>' + thisW.volume + '</b><span>kg（上周 ' + lastW.volume + '）</span></div>' +
      '<div><small>本周有氧</small><b>' + thisW.cardio + ' 分</b><span>目标 ' + goal + ' 分（WHO 150–300）</span></div>' +
      '<div><small>累计训练</small><b>' + S.sessions.length + ' 次</b><span>共 ' + S.sessions.reduce(function (a, s) { return a + volumeOf(s); }, 0) + ' kg</span></div>' +
      '</div>' +
      /* 训练密度：把计时变成效率指标 */
      (function () {
        var recent = S.sessions.filter(function (x) { return x.endTs && x.startTs; }).slice(-10).map(densityOf).filter(Boolean);
        if (!recent.length) return '';
        var medDur = Math.round(recent.reduce(function (a, x) { return a + x.durationMin; }, 0) / recent.length);
        var medRatio = Math.round(recent.reduce(function (a, x) { return a + x.workRatio; }, 0) / recent.length * 100);
        var rests = [];
        recent.forEach(function (x) { if (x.restMedian) rests.push(x.restMedian); });
        var medRest = rests.length ? Math.round(rests.reduce(function (a, b) { return a + b; }, 0) / rests.length) : 0;
        var over = recent.reduce(function (a, x) { return a + x.overRest; }, 0);
        var vph = Math.round(recent.reduce(function (a, x) { return a + x.volumePerHour; }, 0) / recent.length);
        return '<div class="row" style="margin-top:16px"><b>训练密度（最近 ' + recent.length + ' 次）</b>' +
          '<span class="hint">有效训练时间 ÷ 总时长</span></div>' +
          '<div class="stats4">' +
          '<div><small>平均时长</small><b>' + medDur + '</b><span>分钟 / 次</span></div>' +
          '<div><small>有效训练占比</small><b>' + medRatio + '%</b><span>其余是组间休息</span></div>' +
          '<div><small>组间休息中位数</small><b>' + (medRest || '—') + '</b><span>秒</span></div>' +
          '<div><small>训练密度</small><b>' + vph + '</b><span>kg 容量 / 小时</span></div>' +
          '</div>' +
          '<div class="hint" style="margin-top:8px">' +
          (over > 0 ? '有 <b>' + over + '</b> 次休息超过建议值的 1.5 倍 —— 不一定要压缩，但如果你觉得"练得久又累"，先看这个数。' : '组间休息基本都在建议范围内。') +
          (medRatio > 0 && medRatio < 35 ? ' 有效训练占比偏低（' + medRatio + '%），如果是聊天或刷手机拉长的，把休息计时用起来。' : '') +
          '</div>';
      })() +
      '<div class="row" style="margin-top:16px"><b>近 8 周训练量</b><span class="hint">重量 × 次数（不含热身与有氧）</span></div>' +
      barChart(wk.map(function (w) { return { k: w.start.slice(5), v: w.volume }; }), '') +
      '<div class="row" style="margin-top:16px"><b>近 28 天各肌群组数</b><span class="hint">按完成组数统计</span></div>' +
      (biggest.length ? barChart(biggest, ' 组') : '<div class="empty">还没有训练记录</div>') +
      '<div class="row" style="margin-top:16px"><b>训练打卡（近 70 天）</b></div>' +
      heatmap(ad) +
      '<div class="row" style="margin-top:16px"><b>力量进步（e1RM）</b><span class="hint">选一个动作看曲线</span></div>' +
      (function () {
        var ids = {};
        S.sessions.forEach(function (s) { s.entries.forEach(function (e) { if (e.mode !== 'cardio') ids[e.exId] = 1; }); });
        var list = Object.keys(ids);
        if (!list.length) return '<div class="empty">还没有力量训练记录</div>';
        var cur = S.log.e1ex && ids[S.log.e1ex] ? S.log.e1ex : list[0];
        return '<div class="groupFilter">' + list.map(function (id) {
          return '<button data-tr-e1="' + id + '"' + (id === cur ? ' class="on"' : '') + '>' + esc(exName(id)) + '</button>';
        }).join('') + '</div>' + svgLine(e1rmSeries(cur));
      })() +
      '<div class="row" style="margin-top:16px"><b>个人记录（PR）</b></div>' +
      (pr.length ? '<div class="tableWrap"><table class="history"><tr><th>动作</th><th>最佳 e1RM</th><th>最大重量</th><th>最多次数</th><th>单次容量</th></tr>' +
        pr.map(function (c) {
          return '<tr><td>' + esc(exName(c.exId)) + '</td><td>' + c.e1 + ' kg <span class="hint">' + c.e1date.slice(5) + '</span></td>' +
            '<td>' + c.w + ' kg <span class="hint">' + c.wdate.slice(5) + '</span></td><td>' + c.reps + ' <span class="hint">' + c.repsdate.slice(5) + '</span></td>' +
            '<td>' + c.vol + ' <span class="hint">' + c.voldate.slice(5) + '</span></td></tr>';
        }).join('') + '</table></div>' : '<div class="empty">完成一次训练后这里会出现 PR 记录</div>');
  }

  function renderHistory() {
    var list = S.sessions.slice().reverse().slice(0, 40);
    $('#trHistory').innerHTML = list.length ? list.map(function (s) {
      return '<div class="item"><div><b>' + s.date + ' · ' + esc(s.dayName) + '</b><small>' +
        s.entries.map(function (e) { return esc(exName(e.exId)) + ' ' + esc(fmtSets(e)); }).join(' / ') + '</small></div>' +
        '<div class="acts"><span class="hint">' + volumeOf(s) + ' kg</span><button class="mini" data-tr-open="' + s.date + '">查看</button>' +
        '<button class="mini del" data-tr-drop="' + s.date + '">删除</button></div></div>';
    }).join('') : '<div class="empty">还没有训练记录。今天练完点「结束训练」就会出现在这里。</div>';
  }

  function render() {
    if (!S || !$('#trainTab')) return;
    renderToday(); renderSession(); renderPlan(); renderLibrary(); renderStats(); renderHistory();
  }

  /* ===================== 事件 ===================== */
  var titleFlashT = null;
  function flashTitle(msg) {
    var orig = document.title;
    var on = false;
    clearInterval(titleFlashT);
    titleFlashT = setInterval(function () {
      document.title = on ? orig : msg;
      on = !on;
    }, 700);
    setTimeout(function () { clearInterval(titleFlashT); document.title = orig; }, 6000);
  }
  function restTimer(sec) {
    var box = $('#trTimer');
    if (!box) { box = document.createElement('div'); box.id = 'trTimer'; box.className = 'trTimer'; document.body.appendChild(box); }
    var total = n(sec) || 120, left = total;
    box.classList.remove('hide');
    clearInterval(restTimer._t);
    function paint() { box.textContent = '休息 ' + Math.floor(left / 60) + ':' + pad(Math.round(left % 60)) + ' / ' + Math.round(total / 60) + ' 分钟 · 点这里关闭'; }
    paint();
    restTimer._t = setInterval(function () {
      left -= 1; paint();
      if (left <= 0) {
        clearInterval(restTimer._t);
        box.textContent = '休息结束，开始下一组';
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { }
        flashTitle('⏱ 休息结束');
        setTimeout(function () { box.classList.add('hide'); }, 5000);
      }
    }, 1000);
    box.onclick = function () { clearInterval(restTimer._t); box.classList.add('hide'); };
  }

  function bind(root) {
    root = root || document;
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-tr-start],[data-tr-check],[data-tr-set],[data-tr-addset],[data-tr-drop-last],[data-tr-timer],[data-tr-open],[data-tr-use],[data-tr-copy-day],[data-tr-del-day],[data-tr-add-item],[data-tr-rm],[data-tr-edit],[data-tr-cat],[data-tr-e1],[data-tr-drop],[data-tr-dup-plan],[data-tr-del-plan]') : null;
      if (!t) return;
      var d = t.dataset;
      if (d.trStart) { var d0 = activeRoutine().days.filter(function (x) { return x.id === d.trStart; })[0]; if (d0) { startSession(d0.id); persist(); } }
      else if (d.trSet) {
        var p = d.trSet.split(':'), s = sessionOn(curDate());
        var ent = s && s.entries[+p[0]];
        if (ent && ent.sets[+p[1]]) {
          var st = ent.sets[+p[1]];
          st.done = !st.done;
          if (st.done && ent.mode !== 'cardio') {
            /* 记录两次完成之间的实际休息时长（用于训练密度分析） */
            var now = Date.now();
            if (s.lastDoneTs) {
              var gap = Math.round((now - s.lastDoneTs) / 1000);
              if (gap > 0 && gap < 1800) { ent.rests = ent.rests || []; ent.rests.push(gap); }
            }
            s.lastDoneTs = now;
            restTimer(ent.restTarget || (ent.planned && ent.planned.restSec) || 120);
          }
          persist();
        }
      }
      else if (d.trAddset) { var s2 = sessionOn(curDate()); if (s2 && s2.entries[+d.trAddset]) { var e2 = s2.entries[+d.trAddset]; var last = e2.sets[e2.sets.length - 1] || {}; e2.sets.push(e2.mode === 'cardio' ? { min: last.min || 20, done: false } : { w: last.w || 0, r: last.r || 8, done: false }); persist(); } }
      else if (d.trDropLast) { var s3 = sessionOn(curDate()); if (s3 && s3.entries[+d.trDropLast] && s3.entries[+d.trDropLast].sets.length > 1) { s3.entries[+d.trDropLast].sets.pop(); persist(); } }
      else if (d.trTimer) { restTimer(n(d.trTimer)); }
      else if (d.trOpen) { S.log.openDate = d.trOpen; persist(); }
      else if (d.trUse) { S.activeId = d.trUse; persist(); }
      else if (d.trDupPlan) { var src = S.routines.filter(function (r) { return r.id === d.trDupPlan; })[0]; if (src) { var cp = clone(src); cp.id = uid('r'); cp.name = src.name + ' 副本'; cp.days.forEach(function (dd) { dd.id = uid('d'); dd.items.forEach(function (ii) { ii.uid = uid('i'); }); }); S.routines.push(cp); S.activeId = cp.id; persist(); } }
      else if (d.trDelPlan) { if (S.routines.length > 1 && confirm('删除这个计划？')) { S.routines = S.routines.filter(function (r) { return r.id !== d.trDelPlan; }); if (S.activeId === d.trDelPlan) S.activeId = S.routines[0].id; persist(); } }
      else if (d.trCopyDay) { var r0 = activeRoutine(); var dd0 = r0.days.filter(function (x) { return x.id === d.trCopyDay; })[0]; if (dd0) { var nd = clone(dd0); nd.id = uid('d'); nd.name = dd0.name + ' 副本'; nd.weekday = -1; nd.items.forEach(function (ii) { ii.uid = uid('i'); }); r0.days.push(nd); persist(); } }
      else if (d.trDelDay) { var r1x = activeRoutine(); if (r1x.days.length > 1 && confirm('删除这个训练日？')) { r1x.days = r1x.days.filter(function (x) { return x.id !== d.trDelDay; }); persist(); } }
      else if (d.trAddItem) { var sel = $('[data-tr-pick="' + d.trAddItem + '"]'); if (sel && sel.value) { var rA = activeRoutine(); var dA = rA.days.filter(function (x) { return x.id === d.trAddItem; })[0]; var exA = EX_BY_ID[sel.value]; if (dA && exA) { dA.items.push(exA.cat === '有氧' ? cardio(exA.id, 30) : it(exA.id, 3, 8, 12, 0, 120)); persist(); } } }
      else if (d.trRm) { var p2 = d.trRm.split(':'); var r2x = activeRoutine(); var d2 = r2x.days.filter(function (x) { return x.id === p2[0]; })[0]; if (d2) { d2.items = d2.items.filter(function (i) { return i.uid !== p2[1]; }); persist(); } }
      else if (d.trEdit) { S.log.edit = d.trEdit; persist(); }
      else if (d.trCat) { S.log.exFilter = d.trCat; persist(); }
      else if (d.trE1) { S.log.e1ex = d.trE1; persist(); }
      else if (d.trDrop) { if (confirm('删除 ' + d.trDrop + ' 的训练记录？')) { dropSession(d.trDrop); persist(); } }
    });

    root.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.trWd) { var r = activeRoutine(); var dd = r.days.filter(function (x) { return x.id === t.dataset.trWd; })[0]; if (dd) { dd.weekday = n(t.value); persist(); } }
      else if (t.dataset && t.dataset.trNoprog != null) { var s = sessionOn(curDate()); if (s && s.entries[+t.dataset.trNoprog]) { s.entries[+t.dataset.trNoprog].noProg = t.checked; persist(); } }
    });

    root.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t.dataset) return;
      var s = sessionOn(curDate());
      if (!s) return;
      if (t.dataset.trW) { var p = t.dataset.trW.split(':'); s.entries[+p[0]].sets[+p[1]].w = n(t.value); markDirty(); }
      else if (t.dataset.trR) { var p2 = t.dataset.trR.split(':'); s.entries[+p2[0]].sets[+p2[1]].r = n(t.value); markDirty(); }
      else if (t.dataset.trMin) { var p3 = t.dataset.trMin.split(':'); s.entries[+p3[0]].sets[+p3[1]].min = n(t.value); markDirty(); }
    });

    document.addEventListener('click', function (ev) {
      if (ev.target.id === 'trFinish') { var s = sessionOn(curDate()); if (s) { finishSession(curDate()); persist(); alert('已按本次成绩调整计划：达标就加重，未达标累计 3 次自动减重。'); } }
      else if (ev.target.id === 'trBackToday') { S.log.openDate = ''; persist(); }
      else if (ev.target.id === 'trDiscard') { if (confirm('删除今天的训练记录？')) { dropSession(host.today()); persist(); } }
      else if (ev.target.id === 'trAddDay') { var r = activeRoutine(); var nd = day(uid('d'), '新训练日 ' + (r.days.length + 1), -1, []); r.days.push(nd); persist(); }
      else if (ev.target.id === 'trAddPlan') { var np = { id: uid('r'), name: '新计划', desc: '', days: [day(uid('d'), '训练日 1', 1, [])] }; S.routines.push(np); S.activeId = np.id; persist(); }
      else if (ev.target.id === 'trSaveTpl') { var nm = prompt('模板名称', activeRoutine().name + ' 模板'); if (nm) { var t = clone(activeRoutine()); t.id = uid('t'); t.name = nm; t.frozen = true; S.templates.push(t); persist(); } }
      else if (ev.target.id === 'trImportTpl') { if (!S.templates.length) { alert('还没有保存过模板。先在一个计划上点「另存为模板」。'); return; } var names = S.templates.map(function (t, i) { return (i + 1) + '. ' + t.name; }).join('\n'); var pick = prompt('选择要新建的模板编号：\n' + names, '1'); var i = n(pick) - 1; if (S.templates[i]) { var cp = clone(S.templates[i]); cp.id = uid('r'); cp.frozen = false; cp.days.forEach(function (d) { d.id = uid('d'); d.items.forEach(function (ii) { ii.uid = uid('i'); }); }); S.routines.push(cp); S.activeId = cp.id; persist(); } }
    });
  }

  var dirtyT = null;
  function markDirty() { clearTimeout(dirtyT); dirtyT = setTimeout(function () { persist(); }, 600); }
  function persist() { if (host && host.save) host.save(); render(); }
  /** 当前正在编辑的会话日期（可能是从历史点进来的那天） */
  function curDate() { return (S.log.openDate && sessionOn(S.log.openDate)) ? S.log.openDate : host.today(); }

  global.HDWorkout = {
    CATS: CATS, EX_BY_ID: EX_BY_ID,
    normalizeState: normalizeState,
    create: function (h) { host = h; return this; },
    attach: function (state) { S = state || normalizeState(null); return S; },
    render: render, bind: bind,
    /* 供测试与外部调用 */
    suggest: function (item) { return suggest(item); },
    e1rm: e1rm, volumeOf: volumeOf, cardioMinOf: cardioMinOf, weeklyStats: weeklyStats,
    defaultRest: defaultRest, setSeconds: setSeconds, densityOf: densityOf,
    muscleVolume: muscleVolume, e1rmSeries: e1rmSeries, prTable: prTable, adherence: adherence,
    lastPerf: lastPerf, startSession: startSession, finishSession: finishSession,
    activeRoutine: function () { return activeRoutine(); }, todayDay: todayDay, sessionOn: sessionOn,
    state: function () { return S; }
  };
})(window);
