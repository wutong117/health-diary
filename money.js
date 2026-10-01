/* money.js — 记账模块（记一笔 / 分类预算 / 消费分析 / 与饮食·健身打通）
 *
 * 设计依据（调研结论）：
 *   · 单人自用推荐「分类定额 + 月度总额封顶」，餐饮/外卖单独盯住（外卖=高热量与高支出的同一行为）
 *   · 执行率必须减掉时间进度：超支率 = 已花/预算 − 已过天数/当月天数，否则月初永远"没超支"
 *   · 降摩擦：金额优先、常用分类置顶 ≤6、一键重复上次、只在用到 80% 或预测超支时提醒、不用负罪感文案
 *   · 不做：饼图、消费人格评分、打卡积分
 */
(function (global) {
  'use strict';

  /* ---------- 分类（两级：大类 + 常用小类） ---------- */
  var CATS = [
    { id: 'food', name: '饮食', color: '#2f8f6b', subs: ['早餐', '午餐', '晚餐', '外卖', '买菜', '饮料', '零食', '下馆子'] },
    { id: 'fitness', name: '健身', color: '#3f7fbf', subs: ['会员卡', '私教', '运动装备', '补给', '场地', '比赛'] },
    { id: 'daily', name: '日常', color: '#8a7fb0', subs: ['交通', '日用', '购物', '通讯', '房租水电'] },
    { id: 'health', name: '健康', color: '#c07f3f', subs: ['体检', '药品', '保健品', '看诊'] },
    { id: 'fun', name: '娱乐', color: '#b06f8a', subs: ['聚餐', '影音', '游戏', '旅行'] },
    { id: 'other', name: '其他', color: '#7d8794', subs: ['人情', '学习', '宠物', '杂项'] }
  ];
  var PAYS = ['微信', '支付宝', '银行卡', '现金', '其他'];
  var CAT_BY_ID = {}; CATS.forEach(function (c) { CAT_BY_ID[c.id] = c; });

  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function r0(v) { return Math.round(n(v)); }
  function r1(v) { return Math.round(n(v) * 10) / 10; }
  function r2(v) { return Math.round(n(v) * 100) / 100; }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthOf(date) { return String(date).slice(0, 7); }
  function daysInMonth(ym) { var p = ym.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  /** 千分位；小数只在需要时显示（12.5 → 12.5，12.50 → 12.5，12 → 12） */
  function money(v) {
    var s = (Math.round(n(v) * 100) / 100).toFixed(2);
    s = s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ---------- 状态 ---------- */
  function normalize(raw) {
    var out = { version: 1, items: [], budgets: { total: 0, byCat: {} }, recurring: [], log: { quickCat: 'food' }, settings: { warnAt: 0.8 } };
    if (raw && Array.isArray(raw.items)) {
      raw.items.forEach(function (e) {
        if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return;
        var amt = n(e.amount);
        if (!(amt > 0) || amt > 1e7) return;
        out.items.push({
          id: String(e.id || uid()), date: e.date, amount: r2(amt),
          type: ['expense', 'income', 'transfer'].indexOf(e.type) >= 0 ? e.type : 'expense',
          cat: CAT_BY_ID[e.cat] ? e.cat : 'other',
          sub: String(e.sub || ''), note: String(e.note || '').slice(0, 60),
          pay: PAYS.indexOf(e.pay) >= 0 ? e.pay : '微信',
          toAccount: String(e.toAccount || ''),
          meal: ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(e.meal) >= 0 ? e.meal : '',
          ts: n(e.ts) || Date.now()
        });
      });
      out.items.sort(function (a, b) { return a.date === b.date ? b.ts - a.ts : (a.date < b.date ? -1 : 1); });
    }
    if (raw && raw.budgets) {
      out.budgets.total = Math.max(0, n(raw.budgets.total));
      if (raw.budgets.byCat) {
        Object.keys(raw.budgets.byCat).forEach(function (k) {
          if (CAT_BY_ID[k] && n(raw.budgets.byCat[k]) > 0) out.budgets.byCat[k] = n(raw.budgets.byCat[k]);
        });
      }
    }
    if (raw && Array.isArray(raw.recurring)) {
      raw.recurring.forEach(function (rr) {
        if (!rr || !(n(rr.amount) > 0)) return;
        out.recurring.push({
          id: String(rr.id || uid()), name: String(rr.name || '固定支出').slice(0, 24),
          amount: r2(n(rr.amount)), months: Math.max(1, n(rr.months) || 12),
          cat: CAT_BY_ID[rr.cat] ? rr.cat : 'fitness', start: /^\d{4}-\d{2}$/.test(rr.start) ? rr.start : monthOf(todayStr()),
          note: String(rr.note || '')
        });
      });
    }
    if (raw && raw.log && typeof raw.log === 'object') out.log = Object.assign(out.log, raw.log);
    return out;
  }

  /* ---------- 统计 ---------- */
  /** 某月的基础统计（含时间进度修正）。只有 type=expense 计入支出，转账/收入不污染统计。 */
  function monthStats(M, ym, today) {
    ym = ym || monthOf(today || todayStr());
    var all = M.items.filter(function (e) { return monthOf(e.date) === ym; });
    var list = all.filter(function (e) { return (e.type || 'expense') === 'expense'; });
    var transfers = all.filter(function (e) { return e.type === 'transfer'; });
    var incomes = all.filter(function (e) { return e.type === 'income'; });
    var spent = list.reduce(function (a, b) { return a + b.amount; }, 0);
    var total = n(M.budgets.total);
    var dim = daysInMonth(ym);
    var isCur = ym === monthOf(today || todayStr());
    var passed = isCur ? Math.min(dim, n(String(today || todayStr()).slice(8, 10))) : dim;
    var remainDays = Math.max(0, dim - passed);
    var p = dim ? passed / dim : 1;
    var byCat = {};
    list.forEach(function (e) { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
    var catRows = CATS.map(function (c) {
      var b = n(M.budgets.byCat[c.id]);
      var s = byCat[c.id] || 0;
      return {
        id: c.id, name: c.name, color: c.color, spent: r2(s), budget: b,
        ratio: b > 0 ? r2(s / b) : 0, over: b > 0 ? r2(s / b - p) : 0, count: list.filter(function (e) { return e.cat === c.id; }).length
      };
    }).filter(function (x) { return x.spent > 0 || x.budget > 0; });
    var recur = M.recurring.filter(function (rr) { return rr.start <= ym; });
    var recurMonthly = recur.reduce(function (a, rr) { return a + rr.amount / rr.months; }, 0);
    var pace = passed > 0 ? spent / passed : 0;
    return {
      ym: ym, list: list, all: all, spent: r2(spent), count: list.length, budget: total,
      transferSum: r2(transfers.reduce(function (a, b) { return a + b.amount; }, 0)), transferCount: transfers.length,
      incomeSum: r2(incomes.reduce(function (a, b) { return a + b.amount; }, 0)), incomeCount: incomes.length,
      dim: dim, passed: passed, remainDays: remainDays, progress: p,
      remain: total > 0 ? r2(total - spent) : 0,
      overRate: total > 0 ? r2(spent / total - p) : 0,
      safeDaily: total > 0 && remainDays > 0 ? r2((total - spent) / remainDays) : 0,
      forecast: r2(spent + pace * remainDays),
      byCat: byCat, catRows: catRows, pace: r2(pace),
      recurMonthly: r2(recurMonthly)
    };
  }

  /** 外卖率 / 自炊成本（和饮食记录对照） */
  function foodInsight(M) {
    var food = M.items.filter(function (e) { return e.cat === 'food'; });
    var takeout = food.filter(function (e) { return e.sub === '外卖'; });
    var cook = food.filter(function (e) { return e.sub === '买菜'; });
    var sum = function (l) { return l.reduce(function (a, b) { return a + b.amount; }, 0); };
    return {
      total: r2(sum(food)), takeoutCount: takeout.length, foodCount: food.length,
      takeoutRate: food.length ? r1(takeout.length / food.length * 100) : 0,
      takeoutSpend: r2(sum(takeout)), cookSpend: r2(sum(cook)),
      cookAvg: cook.length ? r2(sum(cook) / cook.length) : 0
    };
  }

  /** 健身摊销：年卡/私教摊到每次到店训练 */
  function fitnessInsight(M, workoutState) {
    var fit = M.items.filter(function (e) { return e.cat === 'fitness'; });
    var sum = function (l) { return l.reduce(function (a, b) { return a + b.amount; }, 0); };
    var recurring = M.recurring.filter(function (r) { return r.cat === 'fitness'; });
    var months = {};
    M.items.forEach(function (e) { if (e.cat === 'fitness') months[monthOf(e.date)] = 1; });
    var span = Math.max(1, Object.keys(months).length);
    var totalFit = sum(fit);
    var visits = 0, since = null;
    if (workoutState && Array.isArray(workoutState.sessions)) {
      var dates = workoutState.sessions.map(function (s) { return s.date; }).sort();
      if (dates.length) since = dates[0];
      visits = workoutState.sessions.filter(function (s) { return s.entries.some(function (e) { return e.mode !== 'cardio'; }); }).length;
    }
    return {
      total: r2(totalFit), monthly: r2(totalFit / span), visits: visits, since: since,
      perVisit: visits > 0 ? r2(totalFit / visits) : 0,
      recurringMonthly: r2(recurring.reduce(function (a, r) { return a + r.amount / r.months; }, 0)),
      hasRecurring: recurring.length > 0
    };
  }

  /**
   * 每千卡成本：把饮食支出与同期的热量记录对齐。
   * 外卖/自炊的拆分用「支出占比」做比例分摊 —— 这是**估算**，不是精确归因（没有逐餐关联时只能这样）。
   */
  function kcalCost(M, ym, entries) {
    var food = M.items.filter(function (e) { return e.cat === 'food' && (e.type || 'expense') === 'expense' && monthOf(e.date) === ym; });
    var sum = function (l) { return l.reduce(function (a, b) { return a + b.amount; }, 0); };
    var spend = sum(food);
    var takeoutSpend = sum(food.filter(function (e) { return e.sub === '外卖' || e.sub === '下馆子'; }));
    var cookSpend = sum(food.filter(function (e) { return e.sub === '买菜'; }));
    var kcal = 0, kcalDays = 0, prot = 0;
    var byDay = {};
    (entries || []).forEach(function (e) {
      if (e.type !== 'food' || monthOf(e.date) !== ym) return;
      kcal += n(e.kcal); prot += n(e.p);
      (byDay[e.date] = byDay[e.date] || { kcal: 0, spend: 0, takeout: 0, cook: 0 });
      byDay[e.date].kcal += n(e.kcal);
    });
    Object.keys(byDay).forEach(function (d) { if (byDay[d].kcal > 0) kcalDays++; });
    /* 逐日按当天支出结构分摊热量 */
    Object.keys(byDay).forEach(function (d) {
      var ds = food.filter(function (e) { return e.date === d; });
      var tot = sum(ds);
      if (tot <= 0) return;
      byDay[d].takeout = sum(ds.filter(function (e) { return e.sub === '外卖' || e.sub === '下馆子'; })) / tot;
      byDay[d].cook = sum(ds.filter(function (e) { return e.sub === '买菜'; })) / tot;
    });
    var kcalTakeout = 0, kcalCook = 0;
    Object.keys(byDay).forEach(function (d) {
      kcalTakeout += byDay[d].kcal * (byDay[d].takeout || 0);
      kcalCook += byDay[d].kcal * (byDay[d].cook || 0);
    });
    return {
      ym: ym, spend: r2(spend), kcal: Math.round(kcal), prot: Math.round(prot), days: kcalDays,
      per1000: kcal >= 500 ? r2(spend / kcal * 1000) : 0,
      per1000Cook: kcalCook >= 500 ? r2(cookSpend / kcalCook * 1000) : 0,
      per1000Takeout: kcalTakeout >= 500 ? r2(takeoutSpend / kcalTakeout * 1000) : 0,
      perProt: prot >= 50 ? r2(spend / prot) : 0,
      takeoutShare: r2(takeoutSpend), cookShare: r2(cookSpend)
    };
  }

  /* ---------- 渲染 ---------- */
  var host = null, M = null;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function renderOverview(st) {
    var box = $('#mnOverview'); if (!box) return;
    if (st.budget <= 0) {
      box.innerHTML = '<div class="hint">还没设预算。设一个月度总额后，这里会显示剩余、安全日均和超支提醒。' +
        '（也可以只记流水不设预算，同样能用。）</div>';
      return;
    }
    var over = st.overRate > 0.001, warn = !over && st.spent / st.budget >= (M.settings.warnAt || 0.8);
    var forecastOver = st.forecast > st.budget;
    box.innerHTML =
      '<div class="stats4">' +
      '<div><small>本月已花</small><b>' + money(st.spent) + '</b><span>元 / 预算 ' + money(st.budget) + '</span></div>' +
      '<div><small>剩余</small><b>' + money(st.remain) + '</b><span>元 · 还剩 ' + st.remainDays + ' 天</span></div>' +
      '<div><small>安全日均</small><b>' + money(st.safeDaily) + '</b><span>元 / 天</span></div>' +
      '<div><small>月末预测</small><b>' + money(st.forecast) + '</b><span>按当前速度</span></div>' +
      '</div>' +
      '<div class="' + (over || forecastOver ? 'hint trErr' : 'hint') + '" style="margin-top:8px">' +
      (over ? '⚠️ 已超出时间进度：本月过了 ' + Math.round(st.progress * 100) + '%，钱花了 ' + Math.round(st.spent / st.budget * 100) + '%（超 ' + money(st.overRate * st.budget) + ' 元）'
        : forecastOver ? '⚠️ 按当前速度月底预计花 ' + money(st.forecast) + ' 元，会超预算 ' + money(st.forecast - st.budget) + ' 元'
          : warn ? '本月已用 ' + Math.round(st.spent / st.budget * 100) + '%，注意后面的花销'
            : '进度正常：时间过了 ' + Math.round(st.progress * 100) + '%，钱花了 ' + Math.round(st.spent / st.budget * 100) + '%') +
      '</div>' +
      '<div class="bar" style="margin-top:8px"><i style="width:' + Math.min(100, st.spent / st.budget * 100) + '%"' + (st.spent > st.budget ? ' class="over"' : '') + '></i></div>';
  }

  /** 最近一笔（注意 items 是「日期升序 + 同日新→旧」，所以不能直接取末位） */
  function latest() {
    var best = null;
    M.items.forEach(function (e) {
      if (!best || e.date > best.date || (e.date === best.date && e.ts > best.ts)) best = e;
    });
    return best;
  }

  function renderQuick() {
    var box = $('#mnQuick'); if (!box) return;
    var last = latest();
    var type = M.log.quickType || 'expense';
    var quickCats = ['food', 'fitness', 'daily', 'health', 'fun', 'other'];
    var cur = M.log.quickCat || 'food';
    var cat = CAT_BY_ID[cur] || CATS[0];
    var types = [['expense', '支出'], ['income', '收入'], ['transfer', '转账']];
    box.innerHTML =
      '<div class="mnCats">' + types.map(function (t) {
        return '<button data-mn-type="' + t[0] + '"' + (t[0] === type ? ' class="on"' : '') + '>' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="mnAmount" style="margin-top:10px"><span>¥</span><input id="mnAmt" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00"></div>' +
      (type === 'transfer'
        ? '<div class="editLine" style="margin-top:10px">' +
          '<label>从哪个账户<select id="mnPay">' + PAYS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></label>' +
          '<label>转到<select id="mnTo">' + PAYS.filter(function (p) { return p !== '微信'; }).map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></label>' +
          '</div>' +
          '<div class="hint" style="margin-top:6px">信用卡还款、微信→银行卡、借还钱都记作<b>转账</b>：只移动钱，不算消费，不会影响支出统计。</div>'
        : '<div class="mnCats">' + quickCats.map(function (id) {
            var c = CAT_BY_ID[id];
            return '<button data-mn-cat="' + id + '"' + (id === cur ? ' class="on"' : '') + '>' + esc(c.name) + '</button>';
          }).join('') + '</div>' +
          '<div class="mnSubs">' + cat.subs.map(function (s) {
            return '<button data-mn-sub="' + esc(s) + '"' + (M.log.quickSub === s ? ' class="on"' : '') + '>' + esc(s) + '</button>';
          }).join('') + '</div>') +
      '<div class="editLine" style="margin-top:10px">' +
      '<label>备注<input id="mnNote" maxlength="20" placeholder="选填"></label>' +
      (type === 'transfer' ? '' : '<label>支付方式<select id="mnPay">' + PAYS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></label>') +
      '<button class="primary" id="mnSave">' + (type === 'expense' ? '记一笔' : type === 'income' ? '记收入' : '记转账') + '</button>' +
      (last ? '<button class="mini" id="mnAgain">重复上次（' + money(last.amount) + ' 元 · ' + esc(CAT_BY_ID[last.cat].name) + (last.sub ? '/' + esc(last.sub) : '') + '）</button>' : '') +
      '</div>' +
      '<div class="hint" id="mnHint" style="margin-top:6px"></div>';
  }

  function renderList() {
    var box = $('#mnList'); if (!box) return;
    var st = monthStats(M, M.log.ym, host.today());
    if (!st.list.length) { box.innerHTML = '<div class="empty">本月还没有记录。上面输入金额、点「记一笔」即可，最快 3 秒。</div>'; return; }
    var byDay = {};
    st.list.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var days = Object.keys(byDay).sort().reverse();
    box.innerHTML = days.map(function (d) {
      var sum = byDay[d].reduce(function (a, b) { return a + b.amount; }, 0);
      return '<div class="mnDay"><div class="row"><b>' + d.slice(5) + '</b><span class="hint">共 ' + money(sum) + ' 元</span></div>' +
        byDay[d].map(function (e) {
          var c = CAT_BY_ID[e.cat];
          return '<div class="item"><div><b>' + money(e.amount) + ' 元</b> <span class="tag" style="background:' + c.color + '22;color:' + c.color + '">' + esc(c.name) + (e.sub ? ' · ' + esc(e.sub) : '') + '</span>' +
            '<small>' + esc(e.note || e.pay || '') + '</small></div>' +
            '<div class="acts"><button class="mini del" data-mn-del="' + e.id + '">删</button></div></div>';
        }).join('') + '</div>';
    }).join('');
  }

  function renderCatBars() {
    var box = $('#mnCats'); if (!box) return;
    var st = monthStats(M, M.log.ym, host.today());
    if (!st.catRows.length) { box.innerHTML = '<div class="empty">本月暂无数据</div>'; return; }
    var max = Math.max.apply(null, st.catRows.map(function (c) { return c.spent; })) || 1;
    box.innerHTML = st.catRows.sort(function (a, b) { return b.spent - a.spent; }).map(function (c) {
      var pct = st.spent > 0 ? Math.round(c.spent / st.spent * 100) : 0;
      var overB = c.budget > 0 && c.spent > c.budget;
      return '<div class="barRow"><span class="bl">' + esc(c.name) + ' · ' + pct + '%</span>' +
        '<span class="bar"><i style="width:' + Math.max(2, Math.round(c.spent / max * 100)) + '%;background:' + (overB ? 'var(--danger)' : c.color) + '"></i></span>' +
        '<span class="bv">' + money(c.spent) + (c.budget > 0 ? ' / ' + money(c.budget) : '') + '</span></div>';
    }).join('');
  }

  function renderBudget() {
    var box = $('#mnBudget'); if (!box) return;
    var st = monthStats(M, M.log.ym, host.today());
    var html = '<div class="editLine">' +
      '<label>月度总预算（元）<input type="number" id="mnBTotal" min="0" step="100" value="' + (M.budgets.total || '') + '" placeholder="不设留空"></label>' +
      '<button class="mini" id="mnBSave">保存预算</button></div>' +
      '<div class="hint">各分类预算（留空＝不单独限制）：</div>' +
      '<div class="editLine">' + CATS.map(function (c) {
        return '<label>' + esc(c.name) + '<input type="number" data-mn-bcat="' + c.id + '" min="0" step="50" value="' + (M.budgets.byCat[c.id] || '') + '" placeholder="—"></label>';
      }).join('') + '</div>' +
      '<div class="hint" style="margin-top:6px">执行率＝已花/预算，和「时间进度」比较才有意义（本月过了 ' + Math.round(st.progress * 100) + '%）。</div>';
    if (st.recurMonthly > 0) html += '<div class="hint">固定/摊销支出：每月约 ' + money(st.recurMonthly) + ' 元（' + M.recurring.length + ' 项）</div>';
    box.innerHTML = html;
  }

  function renderHealth() {
    var box = $('#mnHealth'); if (!box) return;
    var fi = foodInsight(M);
    var W = global.HDWorkout;
    var fit = fitnessInsight(M, W ? W.state() : null);
    var kc = kcalCost(M, M.log.ym, host && host.entries ? host.entries() : []);
    var html = '<div class="stats4">' +
      '<div><small>外卖率</small><b>' + fi.takeoutRate + '%</b><span>' + fi.takeoutCount + ' / ' + fi.foodCount + ' 笔餐饮</span></div>' +
      '<div><small>外卖支出</small><b>' + money(fi.takeoutSpend) + '</b><span>自炊买菜 ' + money(fi.cookSpend) + '</span></div>' +
      '<div><small>健身支出</small><b>' + money(fit.total) + '</b><span>月均 ' + money(fit.monthly) + ' 元</span></div>' +
      '<div><small>单次训练成本</small><b>' + (fit.perVisit > 0 ? money(fit.perVisit) : '—') + '</b><span>' +
      (fit.visits > 0 ? fit.visits + ' 次力量训练' : '还没有训练记录') + '</span></div>' +
      '</div>';
    html += '<div class="hint" style="margin-top:8px">' +
      (fi.takeoutRate >= 60 ? '外卖占了 ' + fi.takeoutRate + '% 的餐饮笔数 —— 这是"花更多钱吃更多热量"的典型组合，可以先从每周减 1–2 次开始。'
        : fi.foodCount >= 5 ? '外卖率 ' + fi.takeoutRate + '%，自己做饭的部分记录得不错。' : '再多记几笔餐饮，就能看出外卖和自炊的比例。') +
      '</div>';
    if (fit.visits > 0 && fit.perVisit > 0) {
      html += '<div class="hint" style="margin-top:4px">按目前累计支出算，每次到店训练约 <b>' + money(fit.perVisit) + ' 元</b>' +
        (fit.since ? '（自 ' + fit.since + ' 起）' : '') + '。' +
        (fit.perVisit > 150 ? '偏高了 —— 多去几次最直接地把它降下来。' : '这个数字越低说明卡用得越值。') + '</div>';
    }
    var sub = {};
    M.items.filter(function (e) { return e.cat === 'fitness' && e.sub; }).forEach(function (e) { sub[e.sub] = (sub[e.sub] || 0) + e.amount; });
    var subs = Object.keys(sub).map(function (k) { return { k: k, v: sub[k] }; }).sort(function (a, b) { return b.v - a.v; });
    if (subs.length) html += '<div class="row" style="margin-top:12px"><b>健身支出构成</b></div>' +
      subs.map(function (s) {
        var max = Math.max.apply(null, subs.map(function (x) { return x.v; })) || 1;
        return '<div class="barRow"><span class="bl">' + esc(s.k) + '</span><span class="bar"><i style="width:' + Math.round(s.v / max * 100) + '%;background:var(--info)"></i></span><span class="bv">' + money(s.v) + '</span></div>';
      }).join('');
    /* 每千卡成本 */
    html += '<div class="row" style="margin-top:16px"><b>每千卡成本</b><span class="hint">' + kc.ym + ' · 饮食支出 ÷ 同期摄入热量</span></div>';
    if (kc.per1000 > 0) {
      html += '<div class="stats4">' +
        '<div><small>整体</small><b>' + kc.per1000 + '</b><span>元 / 1000 千卡</span></div>' +
        '<div><small>自炊（估算）</small><b>' + (kc.per1000Cook > 0 ? kc.per1000Cook : '—') + '</b><span>元 / 1000 千卡</span></div>' +
        '<div><small>外卖 · 下馆子（估算）</small><b>' + (kc.per1000Takeout > 0 ? kc.per1000Takeout : '—') + '</b><span>元 / 1000 千卡</span></div>' +
        '<div><small>每克蛋白质</small><b>' + (kc.perProt > 0 ? kc.perProt : '—') + '</b><span>元 / 克（当月）</span></div>' +
        '</div>';
      html += '<div class="hint" style="margin-top:8px">本月记录到 <b>' + kc.days + '</b> 天饮食、共 <b>' + kc.kcal + '</b> 千卡，饮食支出 <b>' + money(kc.spend) + '</b> 元。' +
        (kc.per1000Cook > 0 && kc.per1000Takeout > 0
          ? (kc.per1000Takeout > kc.per1000Cook
            ? '外卖每千卡比自炊贵 <b>' + r2(kc.per1000Takeout - kc.per1000Cook) + ' 元</b> —— 同样的钱，自己做饭能吃到更多。'
            : '这个月自炊的每千卡成本反而更高（可能买了高价食材或记录不完整）。')
          : '再多记几笔买菜和外卖，就能对比两者的每千卡成本。') +
        '<br>外卖/自炊的拆分是按<b>当天支出比例</b>分摊热量得到的估算，不是逐餐精确归因。</div>';
    } else {
      html += '<div class="hint">本月饮食热量记录还不够（需要 ≥500 千卡），先在「每日记录」里记几餐，这里就会出现每千卡成本。</div>';
    }
    box.innerHTML = html;
  }

  function render() {
    if (!M || !$('#moneyTab')) return;
    if (!M.log.ym) M.log.ym = monthOf(host.today());
    var st = monthStats(M, M.log.ym, host.today());
    var mi = $('#mnMonthInfo');
    if (mi) mi.textContent = M.log.ym + ' · ' + st.count + ' 笔 · 共 ' + money(st.spent) + ' 元';
    renderOverview(st); renderQuick(); renderList(); renderCats(); renderCatBars(); renderBudget(); renderHealth();
  }
  function renderCats() {
    var box = $('#mnMonthCats'); if (!box) return;
    box.innerHTML = '<div class="groupFilter">' + CATS.map(function (c) {
      var on = M.log.catFilter === c.id;
      return '<button data-mn-fcat="' + c.id + '"' + (on ? ' class="on"' : '') + '>' + esc(c.name) + '</button>';
    }).join('') + '</div>';
  }

  function persist() { if (host && host.save) host.save(); render(); }

  function addExpense(amount, cat, sub, note, pay, type, toAccount) {
    var amt = r2(amount);
    if (!(amt > 0)) return false;
    type = ['expense', 'income', 'transfer'].indexOf(type) >= 0 ? type : 'expense';
    M.items.push({
      id: uid(), date: host.today(), amount: amt, type: type,
      cat: type === 'transfer' ? 'other' : (CAT_BY_ID[cat] ? cat : 'other'),
      sub: type === 'transfer' ? '' : (sub || ''),
      note: (note || '').slice(0, 60), pay: pay || '微信',
      toAccount: type === 'transfer' ? (toAccount || '') : '',
      meal: '', ts: Date.now()
    });
    M.items.sort(function (a, b) { return a.date === b.date ? b.ts - a.ts : (a.date < b.date ? -1 : 1); });
    if (type === 'expense') { M.log.quickCat = cat; M.log.quickSub = sub || ''; }
    return true;
  }

  function bind(root) {
    root = root || document;
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-mn-type],[data-mn-cat],[data-mn-sub],[data-mn-del],[data-mn-fcat],[data-mn-prev],[data-mn-next]') : null;
      if (t) {
        var d = t.dataset;
        if (d.mnType) { M.log.quickType = d.mnType; render(); var a0 = $('#mnAmt'); if (a0) a0.focus(); return; }
        if (d.mnCat) { M.log.quickCat = d.mnCat; M.log.quickSub = ''; render(); var a = $('#mnAmt'); if (a) a.focus(); return; }
        if (d.mnSub) { M.log.quickSub = (M.log.quickSub === d.mnSub) ? '' : d.mnSub; render(); var a2 = $('#mnAmt'); if (a2) a2.focus(); return; }
        if (d.mnDel) { if (confirm('删除这笔记录？')) { M.items = M.items.filter(function (x) { return x.id !== d.mnDel; }); persist(); } return; }
        if (d.mnFcat) { M.log.catFilter = (M.log.catFilter === d.mnFcat) ? '' : d.mnFcat; render(); return; }
        if (d.mnPrev) { var p1 = M.log.ym.split('-'); var dt = new Date(+p1[0], +p1[1] - 2, 1); M.log.ym = dt.getFullYear() + '-' + pad(dt.getMonth() + 1); render(); return; }
        if (d.mnNext) { var p2 = M.log.ym.split('-'); var dt2 = new Date(+p2[0], +p2[1], 1); M.log.ym = dt2.getFullYear() + '-' + pad(dt2.getMonth() + 1); render(); return; }
      }
      if (!ev.target || !ev.target.id) return;
      var id = ev.target.id;
      if (id === 'mnSave') {
        var amt = $('#mnAmt').value;
        var tp = M.log.quickType || 'expense';
        var to = $('#mnTo') ? $('#mnTo').value : '';
        var ok = addExpense(amt, M.log.quickCat, M.log.quickSub, $('#mnNote') ? $('#mnNote').value : '', $('#mnPay') ? $('#mnPay').value : '微信', tp, to);
        if (!ok) { $('#mnHint').textContent = '请输入大于 0 的金额'; return; }
        persist();
        var h = $('#mnHint');
        if (h) h.textContent = tp === 'transfer'
          ? ('已记转账：' + money(amt) + ' 元 → ' + to + '（不计入支出）')
          : ('已记' + (tp === 'income' ? '收入' : '') + '：' + money(amt) + ' 元 · ' + CAT_BY_ID[M.log.quickCat].name + (M.log.quickSub ? ' / ' + M.log.quickSub : ''));
      } else if (id === 'mnAgain') {
        var last = latest();
        if (last) {
          M.log.quickCat = last.cat; M.log.quickSub = last.sub;
          render();                       /* 先重绘，再回填金额 —— 否则会被重绘清空 */
          var a3 = $('#mnAmt'); if (a3) { a3.value = String(last.amount); a3.focus(); }
          if ($('#mnPay')) $('#mnPay').value = last.pay || '微信';
          var h2 = $('#mnHint'); if (h2) h2.textContent = '已带入上次：' + money(last.amount) + ' 元，改完点「记一笔」';
        }
      } else if (id === 'mnBSave') {
        M.budgets.total = Math.max(0, n($('#mnBTotal').value));
        $$('[data-mn-bcat]').forEach(function (inp) {
          var v = n(inp.value);
          if (v > 0) M.budgets.byCat[inp.dataset.mnBcat] = v; else delete M.budgets.byCat[inp.dataset.mnBcat];
        });
        persist();
      }
    });
  }

  global.HDMoney = {
    CATS: CATS, PAYS: PAYS,
    normalize: normalize, monthStats: monthStats, foodInsight: foodInsight, fitnessInsight: fitnessInsight, kcalCost: kcalCost,
    create: function (h) { host = h; return this; },
    attach: function (s) { M = s || normalize(null); return M; },
    render: render, bind: bind, money: money,
    add: function (a, c, s, nt, p) { var r = addExpense(a, c, s, nt, p); if (r) persist(); return r; },
    state: function () { return M; }
  };
})(window);
