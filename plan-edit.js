/* plan-edit.js — 训练计划自由编辑（添加 / 删除 / 排序 / 改名 / 搜索动作）
 *
 * 设计立场：这是个人提升的软件 —— 工具由应用提供，计划由你决定。
 *   · 不预设、不自动套用任何计划；本模块只提供编辑能力。
 *   · 不改 workout.js（训练引擎已验证），只读写它的 state。
 */
(function (global) {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hd() { return global.__hd; }
  function W() { return global.HDWorkout; }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }

  /* 动作库：兼容 扁平数组 / 按分类分组 两种形态 */
  function allEx() {
    var db = global.EXERCISE_DB;
    if (!db) return [];
    if (Array.isArray(db)) return db;
    var out = [];
    Object.keys(db).forEach(function (k) {
      var v = db[k];
      if (Array.isArray(v)) out = out.concat(v);
    });
    return out;
  }
  function exName(id) {
    var w = W();
    if (w && w.EX_BY_ID && w.EX_BY_ID[id]) {
      var e = w.EX_BY_ID[id];
      return (e && (e.name || e.n)) || id;
    }
    var hit = allEx().filter(function (e) { return (e.id || e.exId) === id; })[0];
    return hit ? (hit.name || hit.n) : id;
  }

  var pickFor = null;   /* 当前正在为哪个训练日挑动作 */
  var pickQ = '';

  function active() {
    var w = W();
    return w ? w.activeRoutine() : null;
  }
  function saveAndRender() {
    var host = hd();
    if (host && host.save) host.save();
    render();
    if (host && host.render) host.render();
  }
  function uid() {
    var host = hd();
    if (host && host.uid) return host.uid();
    return 'i-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7);
  }

  /* ---------------- 变更操作 ---------------- */
  function addItem(dayId, exId) {
    var r = active(); if (!r) return;
    var d = r.days.filter(function (x) { return x.id === dayId; })[0]; if (!d) return;
    var e = allEx().filter(function (x) { return (x.id || x.exId) === exId; })[0] || {};
    var cardio = (e.cat === '有氧' || e.m === 'cardio' || e.mode === 'cardio');
    d.items.push({
      uid: uid(), exId: exId, mode: cardio ? 'cardio' : 'strength',
      sets: cardio ? 1 : 3, repsMin: cardio ? 0 : 8, repsMax: cardio ? 0 : 12,
      restSec: 0, weight: 0, step: 2.5, miss: 0, noProg: false,
      targetMin: cardio ? 30 : 0
    });
    saveAndRender();
  }
  function removeItem(dayId, iuid) {
    var r = active(); if (!r) return;
    var d = r.days.filter(function (x) { return x.id === dayId; })[0]; if (!d) return;
    var i = d.items.map(function (x) { return x.uid; }).indexOf(iuid);
    if (i < 0) return;
    if (!confirm('删除这个动作？\n' + exName(d.items[i].exId))) return;
    d.items.splice(i, 1);
    saveAndRender();
  }
  function moveItem(dayId, iuid, dir) {
    var r = active(); if (!r) return;
    var d = r.days.filter(function (x) { return x.id === dayId; })[0]; if (!d) return;
    var i = d.items.map(function (x) { return x.uid; }).indexOf(iuid);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= d.items.length) return;
    var t = d.items[i]; d.items[i] = d.items[j]; d.items[j] = t;
    saveAndRender();
  }
  function renameDay(dayId) {
    var r = active(); if (!r) return;
    var d = r.days.filter(function (x) { return x.id === dayId; })[0]; if (!d) return;
    var v = prompt('训练日名称', d.name || '');
    if (v === null) return;
    d.name = String(v).trim() || d.name;
    saveAndRender();
  }
  function removeDay(dayId) {
    var r = active(); if (!r) return;
    var d = r.days.filter(function (x) { return x.id === dayId; })[0];
    if (!d) return;
    if (!confirm('删除训练日「' + (d.name || '') + '」及其 ' + d.items.length + ' 个动作？')) return;
    r.days = r.days.filter(function (x) { return x.id !== dayId; });
    saveAndRender();
  }
  function addDay() {
    var host = hd(), w = W();
    if (!w) return;
    var S = w.state();
    if (!S.routines.length) {
      /* 没有任何计划时，建一个空计划承载你的训练日 */
      S.routines.push({ id: 'r_my_' + Date.now().toString(36).slice(-4), name: '我的计划', desc: '自己拼的', days: [] });
      S.activeId = S.routines[S.routines.length - 1].id;
    }
    var r = active();
    var v = prompt('新训练日名称（例如：推日 / 腿日 / 有氧）', '新训练日');
    if (v === null) return;
    r.days.push({ id: 'd_' + Date.now().toString(36).slice(-4), name: String(v).trim() || '新训练日', weekday: -1, items: [] });
    saveAndRender();
  }
  function renameRoutine() {
    var r = active(); if (!r) return;
    var v = prompt('计划名称', r.name || '');
    if (v === null) return;
    r.name = String(v).trim() || r.name;
    saveAndRender();
  }
  function newEmptyRoutine() {
    var w = W(); if (!w) return;
    if (!confirm('新建一个空白计划？\n（不会删除现有计划，可随时切回）')) return;
    var S = w.state();
    S.routines.push({ id: 'r_my_' + Date.now().toString(36).slice(-4), name: '我的计划 ' + (S.routines.length + 1), desc: '自己拼的', days: [] });
    S.activeId = S.routines[S.routines.length - 1].id;
    saveAndRender();
  }

  /* ---------------- 渲染 ---------------- */
  function pickerHtml() {
    var list = allEx();
    var q = pickQ.trim().toLowerCase();
    if (q) {
      list = list.filter(function (e) {
        var s = ((e.name || e.n || '') + ' ' + (e.en || '') + ' ' + (e.cat || '') + ' ' + (e.eq || '')).toLowerCase();
        return s.indexOf(q) >= 0;
      });
    }
    list = list.slice(0, 40);
    if (!list.length) return '<div class="empty" style="padding:12px">没找到动作，换个词试试</div>';
    return list.map(function (e) {
      var id = e.id || e.exId;
      var cat = e.cat || '';
      return '<button class="mini" data-pe-pick="' + esc(id) + '" style="margin:3px 4px 0 0">' +
        esc(e.name || e.n || id) + (cat ? '<span class="hint" style="margin-left:4px">' + esc(cat) + '</span>' : '') + '</button>';
    }).join('');
  }

  function render() {
    var box = $('#xPlanEdit'); if (!box) return;
    var w = W(); if (!w) { box.innerHTML = ''; return; }
    var r = active();
    var html = '<div class="row" style="margin-top:18px"><b>编辑训练计划</b>' +
      '<span class="controlz"><button class="mini" data-pe-newr>新建空白计划</button>' +
      (r ? ' <button class="mini" data-pe-renr>改计划名</button>' : '') + '</span></div>';

    if (!r) {
      html += '<div class="empty" style="padding:14px">还没有训练计划。点「新建空白计划」，然后自己添加动作。<br>' +
        '<span class="hint">想参考现成体系可以去下面的「训练方法库」，套用前会告诉你改什么。</span></div>';
      box.innerHTML = html;
      return;
    }

    html += '<div class="hint" style="margin-bottom:8px">当前计划：<b>' + esc(r.name) + '</b> · ' + r.days.length + ' 个训练日 · ' +
      r.days.reduce(function (a, d) { return a + d.items.length; }, 0) + ' 个动作</div>';

    if (!r.days.length) {
      html += '<div class="empty" style="padding:12px">这个计划还没有训练日。点下面「+ 新建训练日」。</div>';
    }

    r.days.forEach(function (d) {
      html += '<div class="peDay"><div class="peHead"><b>' + esc(d.name || '未命名') + '</b>' +
        '<span class="controlz">' +
        '<button class="mini" data-pe-pick-open="' + d.id + '">+ 添加动作</button> ' +
        '<button class="mini ghost" data-pe-ren="' + d.id + '">改名</button> ' +
        '<button class="mini ghost" data-pe-delday="' + d.id + '">删除</button></span></div>';

      if (pickFor === d.id) {
        html += '<div class="pePick"><input id="peQ" placeholder="搜索动作（名称/部位/器械）" value="' + esc(pickQ) + '">' +
          '<div style="margin-top:8px;max-height:220px;overflow:auto">' + pickerHtml() + '</div>' +
          '<div style="margin-top:8px"><button class="mini ghost" data-pe-pick-close>关闭</button></div></div>';
      }

      if (!d.items.length) {
        html += '<div class="hint" style="padding:8px 0">（还没有动作）</div>';
      } else {
        d.items.forEach(function (i, idx) {
          var cardio = i.mode === 'cardio';
          html += '<div class="peRow">' +
            '<span class="peName">' + esc(exName(i.exId)) + '</span>' +
            '<span class="hint">' + (cardio ? '有氧 ' + n(i.targetMin || 30) + ' 分' :
              (i.sets || 3) + '×' + (i.repsMin || 8) + '–' + (i.repsMax || 12)) + '</span>' +
            '<span class="controlz">' +
            '<button class="mini ghost" data-pe-up="' + d.id + '|' + i.uid + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="mini ghost" data-pe-dn="' + d.id + '|' + i.uid + '"' + (idx === d.items.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="mini ghost" data-pe-del="' + d.id + '|' + i.uid + '">×</button>' +
            '</span></div>';
        });
      }
      html += '</div>';
    });

    html += '<div style="margin-top:10px"><button class="mini primary" data-pe-newday>+ 新建训练日</button></div>';
    html += '<div class="hint" style="margin-top:8px">计划完全由你决定：添加动作、自己排序、随时删除。' +
      '应用不会替你排计划，也不会自动套用任何模板。</div>';
    box.innerHTML = html;
  }

  /* ---------------- 事件 ---------------- */
  function bind(root) {
    (root || document).addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-pe-pick],[data-pe-pick-open],[data-pe-pick-close],[data-pe-up],[data-pe-dn],[data-pe-del],[data-pe-delday],[data-pe-ren],[data-pe-newday],[data-pe-newr],[data-pe-renr]') : null;
      if (!t) return;
      if (t.hasAttribute('data-pe-newday')) { addDay(); return; }
      if (t.hasAttribute('data-pe-newr')) { newEmptyRoutine(); return; }
      if (t.hasAttribute('data-pe-renr')) { renameRoutine(); return; }
      var open = t.getAttribute('data-pe-pick-open');
      if (open) { pickFor = (pickFor === open ? null : open); pickQ = ''; render(); var q = $('#peQ'); if (q) q.focus(); return; }
      if (t.hasAttribute('data-pe-pick-close')) { pickFor = null; render(); return; }
      var pick = t.getAttribute('data-pe-pick');
      if (pick) { addItem(pickFor, pick); return; }
      var up = t.getAttribute('data-pe-up');
      if (up) { var a = up.split('|'); moveItem(a[0], a[1], -1); return; }
      var dn = t.getAttribute('data-pe-dn');
      if (dn) { var b = dn.split('|'); moveItem(b[0], b[1], 1); return; }
      var del = t.getAttribute('data-pe-del');
      if (del) { var c = del.split('|'); removeItem(c[0], c[1]); return; }
      var dd = t.getAttribute('data-pe-delday');
      if (dd) { removeDay(dd); return; }
      var rn = t.getAttribute('data-pe-ren');
      if (rn) { renameDay(rn); return; }
    });
    (root || document).addEventListener('input', function (e) {
      if (e.target && e.target.id === 'peQ') {
        pickQ = e.target.value;
        var box = e.target.parentElement.parentElement;
        var html = pickerHtml();
        var holder = box.querySelector('div[style*="max-height"]');
        if (holder) holder.innerHTML = html;
      }
    });
  }

  global.HDPlanEdit = { render: render, bind: bind };
})(window);
