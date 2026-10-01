(function () {
  'use strict';
  /* ===================== 常量 ===================== */
  var KEY = 'health-diary-v2', OLD_KEY = 'health-diary-v1';
  var MEALS = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐']];
  var MACROS = [['c', '碳水化合物', 4, '#2f7fd1'], ['p', '蛋白质', 4, '#2f9e63'], ['f', '脂肪', 9, '#d98a24']];
  var ADJ_LABEL = { kcal: '热量', water: '饮水', c: '碳水', p: '蛋白质', f: '脂肪' };
  var ACTIVITY = [[1.2, '久坐（几乎不运动）'], [1.375, '轻度（每周 1–3 次运动）'], [1.55, '中度（每周 3–5 次）'], [1.725, '高度（每周 6–7 次）'], [1.9, '极高（重体力或一天两练）']];
  var FORMULAS = [['mifflin', 'Mifflin–St Jeor（推荐）'], ['harris', 'Harris–Benedict 修订版'], ['dri', '中国 DRI（2013/2023）'], ['katch', 'Katch–McArdle（需体脂率）']];
  var PRESETS = [['均衡 50/20/30', 50, 20, 30], ['高蛋白 40/30/30', 40, 30, 30], ['低碳 25/35/40', 25, 35, 40], ['增肌 55/25/20', 55, 25, 20]];
  var DEFAULT_GOALS = { kcal: 2000, water: 2000, rest: 8, macro: { c: 50, p: 20, f: 30 } };
  var DEFAULT_PROFILE = { sex: 'male', formula: 'mifflin', age: 30, height: 170, weight: 65, bodyFat: '', activity: 1.375, startWeight: '', targetWeight: '', kgPerWeek: 0.5, waist: '', hip: '', neck: '', proteinPerKg: 0 };
  var DEFAULT_PLAN = {
    dietId: '', exerciseId: '',
    fasting: {
      enabled: false, start: '12:00', end: '20:00',
      protocolId: 'if168', hours: 16, session: null, history: []
    },
    meals: { breakfast: 25, lunch: 35, dinner: 30, snack: 10 },
    floorEnabled: true
  };
  var TAB_PANELS = { daily: 'daily', train: 'trainTab', plan: 'planTab', weight: 'weightTab', money: 'moneyTab', data: 'data' };

  /* ===================== 小工具 ===================== */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function r1(v) { return Math.round(n(v) * 10) / 10; }
  function r0(v) { return Math.round(n(v)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function local(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nowTime() { return new Date().toTimeString().slice(0, 5); }
  function today() { return local(new Date()); }
  function byId(a, b) { return a - b; }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  /* ===================== 食物库 ===================== */
  var FOODS = [];
  var BY_CODE = {};                       /* 条码 → 食物项 */
  /* 中国食物成分表（每 100 克） */
  (function () {
    for (var cat in FOOD_DB) {
      if (!Object.prototype.hasOwnProperty.call(FOOD_DB, cat)) continue;
      var arr = FOOD_DB[cat];
      for (var i = 0; i < arr.length; i++) {
        var r = arr[i];
        FOODS.push({ name: r[0], kcal: n(r[1]), p: n(r[2]), f: n(r[3]), c: n(r[4]), fb: n(r[5]), cat: cat, unit: '100g', src: 'cfct' });
      }
    }
  })();
  /* 台湾食品營養成分資料庫（OGDL v1.0，須署名 TFDA） */
  (function () {
    if (typeof HD_TW === 'undefined') return;
    for (var cat in HD_TW) {
      if (!Object.prototype.hasOwnProperty.call(HD_TW, cat)) continue;
      var arr = HD_TW[cat];
      for (var i = 0; i < arr.length; i++) {
        var r = arr[i];
        FOODS.push({ name: r[0], kcal: n(r[1]), p: n(r[2]), f: n(r[3]), c: n(r[4]), fb: n(r[5]), cat: cat, unit: '100g', src: 'tfnd', tw: r[6] || '' });
      }
    }
  })();
  /* 薄荷健康（个人自用补充，仅热量） */
  (function () {
    if (typeof HD_BOOHEE === 'undefined') return;
    for (var i = 0; i < HD_BOOHEE.length; i++) {
      var r = HD_BOOHEE[i];
      FOODS.push({ name: r[0], kcal: n(r[1]), p: 0, f: 0, c: n(r[2]), fb: 0, cat: '薄荷热门食物', unit: '100g', src: 'boohee', per: r[3] || '' });
    }
  })();
  /* 包装食品（Open Food Facts，每 100g/ml，可条码检索） */
  var PACK = (typeof HD_PACKAGED !== 'undefined') ? HD_PACKAGED : { off: [], brand: [] };
  (function () {
    (PACK.off || []).forEach(function (r) {
      var f = {
        code: r[0], name: r[1], brand: r[2] || '', kcal: n(r[3]), p: n(r[4]), f: n(r[5]), c: n(r[6]),
        fb: n(r[7]), serving: r[8] || '', cat: '包装食品（Open Food Facts）', unit: '100g', src: 'off'
      };
      FOODS.push(f);
      if (f.code) BY_CODE[f.code] = f;
    });
    /* 品牌食品（health-coach，多为「每份」） */
    (PACK.brand || []).forEach(function (b) {
      FOODS.push({
        name: b.name, brand: b.brand || '', kcal: n(b.k), p: n(b.p), f: n(b.f), c: n(b.c), fb: 0,
        cat: b.cat, unit: b.unit === '100ml' ? '100ml' : 'serving', serving: b.serving || '',
        note: b.note || '', kcalOnly: !!b.kcalOnly, wholeKcal: n(b.sk), src: 'brand'
      });
    });
  })();
  var CATS = Object.keys(FOOD_DB);
  (function () {
    var extra = [];
    FOODS.forEach(function (f) { if (f.src !== 'cfct' && extra.indexOf(f.cat) < 0) extra.push(f.cat); });
    extra.sort(function (a, b) { return (b === '包装食品（Open Food Facts）') - (a === '包装食品（Open Food Facts）') || a.localeCompare(b, 'zh'); });
    CATS = CATS.concat(extra);
  })();
  var COMMON = ['米饭', '馒头', '面条', '饺子', '包子', '粥', '鸡蛋', '牛奶', '酸奶', '豆浆', '豆腐', '鸡胸肉', '鸡腿', '猪肉', '牛肉', '羊肉', '草鱼', '带鱼', '虾', '白菜', '菠菜', '西兰花', '番茄', '黄瓜', '土豆', '红薯', '玉米', '燕麦', '苹果', '香蕉', '橙子', '西瓜', '葡萄', '花生', '核桃', '海带', '木耳', '香菇'];
  var COMMON_LIST = (function () {
    var out = [], seen = {};
    for (var k = 0; k < COMMON.length; k++) {
      for (var i = 0; i < FOODS.length; i++) {
        var f = FOODS[i];
        if (f.name.indexOf(COMMON[k]) >= 0 && f.name.length <= 10 && !seen[f.name]) { seen[f.name] = 1; out.push(f); }
      }
      if (out.length > 90) break;
    }
    return out.slice(0, 90);
  })();
  FOODS.forEach(function (f, i) { f.idx = i; });
  /** 把用户之前扫码缓存的包装食品加回索引（离线也能再用） */
  function restoreCustomFoods() {
    var cf = (db && db.customFoods) || {};
    Object.keys(cf).forEach(function (code) {
      if (BY_CODE[code]) return;
      var item = cf[code];
      item.idx = FOODS.length;
      FOODS.push(item);
      BY_CODE[code] = item;
      if (CATS.indexOf(item.cat) < 0) CATS.push(item.cat);
    });
  }
  /* 你记过的食物排前面 —— 扩库到 4000+ 条后，这是「更好找」而不是「更难找」的关键 */
  var _freqCache = null, _freqN = -1;
  function foodFreq() {
    if (!db || !Array.isArray(db.entries)) return {};
    if (_freqCache && _freqN === db.entries.length) return _freqCache;
    var m = {};
    for (var i = 0; i < db.entries.length; i++) {
      var e = db.entries[i];
      if (e && e.type === 'food' && e.name) m[e.name] = (m[e.name] || 0) + 1;
    }
    _freqCache = m; _freqN = db.entries.length;
    return m;
  }
  /* 小标记：区分「速食/包装」与「餐馆现做」—— 同名食物热量可能差好几倍 */
  var INSTANT_RE = /自热|速食|方便面|即食|泡面|袋装|桶装|杯装|杯面|速冻|代餐|能量棒|蛋白棒|薄荷生活|轻食主义|冷冻/;
  var CHAIN_RE = /麦当劳|肯德基|必胜客|星巴克|瑞幸|喜茶|奈雪|蜜雪冰城|华莱士|汉堡王|赛百味|吉野家|真功夫|沙县|黄焖鸡|兰州拉面|便利店|全家|罗森/;
  function foodKindTag(f) {
    var nm = String(f.name || '');
    if (INSTANT_RE.test(nm)) return '<i class="fk fk-instant" title="包装/速食产品，按包装标示">速食</i>';
    if (CHAIN_RE.test(nm)) return '<i class="fk fk-chain" title="连锁餐饮，不同门店可能略有差异">连锁</i>';
    return '';
  }
  function searchFood(q, cat, limit) {
    q = String(q || '').trim();
    var ql = q.toLowerCase();
    var freq = foodFreq();
    var out = [];
    for (var i = 0; i < FOODS.length; i++) {
      var f = FOODS[i];
      if (cat && cat !== '*' && f.cat !== cat) continue;
      var used = freq[f.name] || 0;
      if (q) {
        if (f.code && f.code === q) { out.push([-2, -used, 0, f]); continue; }   /* 条码精确命中最优先 */
        var idx = f.name.indexOf(q);
        var pr;
        if (f.name === q) pr = -1;                                              /* 名称完全一致 */
        else if (idx === 0) pr = 0;                                             /* 以关键词开头 */
        else if (idx > 0) pr = 1;                                               /* 包含关键词 */
        else if (f.brand && f.brand.toLowerCase().indexOf(ql) >= 0) pr = 2;      /* 品牌命中 */
        else continue;
        out.push([pr, -used, f.name.length, f]);                                /* used 越多越靠前 */
      } else if (!cat || cat === '*') continue;
      else out.push([0, -used, f.name.length, f]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
    return out.slice(0, limit || 150).map(function (x) { return x[3]; });
  }

  /* ===================== 数据层 ===================== */
  var db = null;
  function normalize(raw) {
    var out = { goals: clone(DEFAULT_GOALS), profile: clone(DEFAULT_PROFILE), plan: clone(DEFAULT_PLAN), review: { history: [] }, entries: [], customFoods: {}, savedAt: n(raw && raw.savedAt) };
    if (raw && raw.customFoods && typeof raw.customFoods === 'object') {
      Object.keys(raw.customFoods).forEach(function (code) {
        var f = raw.customFoods[code];
        if (f && f.name && n(f.kcal) >= 0) out.customFoods[String(code)] = f;
      });
    }
    if (raw && raw.plan) {
      out.plan.dietId = raw.plan.dietId || '';
      out.plan.exerciseId = raw.plan.exerciseId || '';
      out.plan.floorEnabled = raw.plan.floorEnabled !== false;
      if (raw.plan.fasting) {
        var rf = raw.plan.fasting;
        out.plan.fasting = {
          enabled: !!rf.enabled,
          start: /^\d{2}:\d{2}$/.test(rf.start) ? rf.start : DEFAULT_PLAN.fasting.start,
          end: /^\d{2}:\d{2}$/.test(rf.end) ? rf.end : DEFAULT_PLAN.fasting.end,
          protocolId: rf.protocolId || 'if168',
          hours: n(rf.hours) > 0 ? n(rf.hours) : 16,
          session: (rf.session && rf.session.start) ? { start: String(rf.session.start), protocolId: rf.session.protocolId || 'if168' } : null,
          history: []
        };
        if (Array.isArray(rf.history)) {
          rf.history.forEach(function (h) {
            if (h && h.start && h.end) {
              out.plan.fasting.history.push({
                start: String(h.start), end: String(h.end),
                hours: n(h.hours), protocolId: h.protocolId || '', note: h.note || ''
              });
            }
          });
          out.plan.fasting.history = out.plan.fasting.history.slice(-60);
        }
      }
      if (raw.plan.meals) {
        ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (k) {
          out.plan.meals[k] = n(raw.plan.meals[k]) >= 0 ? n(raw.plan.meals[k]) : DEFAULT_PLAN.meals[k];
        });
      }
    }
    if (raw && raw.review && Array.isArray(raw.review.history)) {
      out.review.history = raw.review.history.filter(function (h) { return h && isDate(h.date); }).slice(-50);
    }
    if (raw && raw.goals) {
      out.goals.kcal = n(raw.goals.kcal) > 0 ? n(raw.goals.kcal) : DEFAULT_GOALS.kcal;
      out.goals.water = n(raw.goals.water) > 0 ? n(raw.goals.water) : DEFAULT_GOALS.water;
      out.goals.rest = n(raw.goals.rest) > 0 ? n(raw.goals.rest) : DEFAULT_GOALS.rest;
      var m = raw.goals.macro || {};
      out.goals.macro = { c: n(m.c), p: n(m.p), f: n(m.f) };
      if (!(out.goals.macro.c + out.goals.macro.p + out.goals.macro.f > 0)) out.goals.macro = clone(DEFAULT_GOALS.macro);
    }
    if (raw && raw.profile) {
      for (var k in DEFAULT_PROFILE) if (Object.prototype.hasOwnProperty.call(raw.profile, k)) out.profile[k] = raw.profile[k];
    }
    var list = (raw && Array.isArray(raw.entries)) ? raw.entries : [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.type || !isDate(e.date)) continue;
      var item = {
        id: e.id || uid(), type: e.type, date: e.date,
        name: e.name == null ? '' : String(e.name),
        time: e.time || '', created: n(e.created) || Date.now()
      };
      if (e.type === 'food') {
        item.meal = ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(e.meal) >= 0 ? e.meal : 'lunch';
        item.grams = n(e.grams) > 0 ? n(e.grams) : null;
        item.servings = n(e.servings) > 0 ? n(e.servings) : null;
        item.unit = e.unit || '100g';
        item.servingLabel = e.servingLabel || '';
        item.kcal = n(e.kcal); item.c = n(e.c); item.p = n(e.p); item.f = n(e.f);
        if (!(item.kcal > 0) && !(item.c + item.p + item.f > 0)) continue;
      } else if (e.type === 'adjust') {
        if (['kcal', 'water', 'c', 'p', 'f'].indexOf(e.field) < 0) continue;
        item.field = e.field; item.value = n(e.value);
      } else if (e.type === 'measure') {
        item.waist = n(e.waist); item.hip = n(e.hip); item.neck = n(e.neck);
        if (!(item.waist > 0 || item.hip > 0 || item.neck > 0)) continue;
      } else if (e.type === 'exercise') {
        item.met = n(e.met); item.minutes = n(e.minutes); item.kcal = n(e.kcal);
        if (!(item.minutes > 0)) continue;
      } else if (e.type === 'period') {
        item.value = 1;
      } else if (e.type === 'water' || e.type === 'weight' || e.type === 'rest') {
        item.value = n(e.value);
      } else { continue; }
      out.entries.push(item);
    }
    /* 训练模块状态（计划、模板、训练记录、个人记录） */
    out.workout = HDWorkout.normalizeState(raw && raw.workout);
    out.money = HDMoney.normalize(raw && raw.money);
    return out;
  }
  function migrateV1(raw) {
    var out = { goals: clone(DEFAULT_GOALS), profile: clone(DEFAULT_PROFILE), plan: clone(DEFAULT_PLAN), review: { history: [] }, entries: [], savedAt: Date.now() };
    if (raw && raw.goals) {
      out.goals.kcal = n(raw.goals.cal) > 0 ? n(raw.goals.cal) : DEFAULT_GOALS.kcal;
      out.goals.water = n(raw.goals.water) > 0 ? n(raw.goals.water) : DEFAULT_GOALS.water;
      out.goals.rest = n(raw.goals.rest) > 0 ? n(raw.goals.rest) : DEFAULT_GOALS.rest;
    }
    var list = (raw && Array.isArray(raw.entries)) ? raw.entries : [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !isDate(e.date)) continue;
      if (e.type === 'food') {
        out.entries.push({ id: e.id || uid(), type: 'food', date: e.date, meal: 'lunch', name: e.name || '未命名食物', grams: null, kcal: n(e.value), c: 0, p: 0, f: 0, time: e.time || '', created: n(e.created) || Date.now() });
      } else if (e.type === 'water' || e.type === 'weight' || e.type === 'rest') {
        out.entries.push({ id: e.id || uid(), type: e.type, date: e.date, name: e.name || '', value: n(e.value), time: e.time || '', created: n(e.created) || Date.now() });
      }
    }
    return out;
  }
  /* ---------- 存储层：IndexedDB 为主，localStorage 为镜像与降级 ---------- */
  var Store = (function () {
    var DB_NAME = 'health-diary', STORE = 'state', REC = 'app-state';
    var handle = null, opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise(function (resolve) {
        var req;
        try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        };
        req.onsuccess = function () { handle = req.result; resolve(handle); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      });
      return opening;
    }
    function get() {
      return open().then(function (d) {
        if (!d) return null;
        return new Promise(function (resolve) {
          try {
            var r = d.transaction(STORE, 'readonly').objectStore(STORE).get(REC);
            r.onsuccess = function () { resolve(r.result || null); };
            r.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        });
      });
    }
    function set(value) {
      return open().then(function (d) {
        if (!d) return false;
        return new Promise(function (resolve) {
          try {
            var t = d.transaction(STORE, 'readwrite');
            t.objectStore(STORE).put(value, REC);
            t.oncomplete = function () { resolve(true); };
            t.onerror = function () { resolve(false); };
            t.onabort = function () { resolve(false); };
          } catch (e) { resolve(false); }
        });
      });
    }
    return { get: get, set: set, hasIdb: function () { return !!handle; } };
  })();

  function readLS(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeLS(key, obj) {
    try {
      var s = JSON.stringify(obj);
      if (s.length > 900000) { localStorage.removeItem(key); return false; }
      localStorage.setItem(key, s);
      return true;
    } catch (e) { return false; }
  }
  var storageInfo = { backend: '检测中', mirrored: false, source: 'new' };
  function boot() {
    return Store.get().then(function (idbState) {
      storageInfo.backend = Store.hasIdb() ? 'IndexedDB' : 'localStorage（IndexedDB 不可用）';
      var ls = readLS(KEY), best = null;
      if (idbState && Array.isArray(idbState.entries) && ls && Array.isArray(ls.entries)) {
        best = n(ls.savedAt) > n(idbState.savedAt) ? ls : idbState;
        storageInfo.source = (best === ls) ? 'localStorage（较新）' : 'IndexedDB';
      } else if (idbState && Array.isArray(idbState.entries)) { best = idbState; storageInfo.source = 'IndexedDB'; }
      else if (ls && Array.isArray(ls.entries)) { best = ls; storageInfo.source = 'localStorage'; }
      if (best) { db = normalize(best); return 'v2'; }
      var old = readLS(OLD_KEY);
      if (old && Array.isArray(old.entries)) { db = normalize(migrateV1(old)); save(); return 'v1→v2'; }
      db = normalize(null);
      return 'new';
    }).catch(function () {
      var ls = readLS(KEY);
      db = ls && Array.isArray(ls.entries) ? normalize(ls) : normalize(null);
      storageInfo.source = '降级';
      storageInfo.backend = 'localStorage（IndexedDB 不可用）';
      return 'fallback';
    });
  }
  function save() {
    db.savedAt = Date.now();
    storageInfo.mirrored = writeLS(KEY, db);
    var p = Store.set(db);
    if (p && p.then) {
      p.then(function (ok) {
        storageInfo.backend = ok ? 'IndexedDB' : (storageInfo.mirrored ? 'localStorage' : '不可用');
        if (!ok && !storageInfo.mirrored) alert('保存失败：浏览器本地存储不可用，请先导出备份。');
      });
    }
    return true;
  }
  function commit() { save(); render(); }

  /* ===================== 读取/统计 ===================== */
  var date = today();
  function entriesOn(d) { return db.entries.filter(function (x) { return x.date === d; }); }
  function typeOn(t, d) { return entriesOn(d).filter(function (x) { return x.type === t; }).sort(function (a, b) { return (b.created || 0) - (a.created || 0); }); }
  function sumOf(list, f) { return list.reduce(function (s, x) { return s + n(x[f]); }, 0); }
  function baseTotals(d) {
    var t = { kcal: 0, water: 0, c: 0, p: 0, f: 0, rest: 0, burn: 0 };
    entriesOn(d).forEach(function (x) {
      if (x.type === 'food') { t.kcal += n(x.kcal); t.c += n(x.c); t.p += n(x.p); t.f += n(x.f); }
      else if (x.type === 'water') t.water += n(x.value);
      else if (x.type === 'rest') t.rest += n(x.value);
      else if (x.type === 'exercise') t.burn += n(x.kcal);
    });
    return t;
  }
  function adjTotal(d, field) {
    return entriesOn(d).reduce(function (s, x) { return (x.type === 'adjust' && x.field === field) ? s + n(x.value) : s; }, 0);
  }
  function totals(d) {
    var t = baseTotals(d);
    ['kcal', 'water', 'c', 'p', 'f'].forEach(function (f) { t[f] = r1(t[f] + adjTotal(d, f)); });
    t.rest = r1(t.rest);
    return t;
  }
  function latestWeight(d) {
    var list = db.entries.filter(function (x) { return x.type === 'weight' && x.date <= d; });
    list.sort(function (a, b) { return b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0); });
    return list[0] || null;
  }
  function macroTargetGrams() {
    var kcal = n(db.goals.kcal), m = db.goals.macro;
    return { c: r1(kcal * n(m.c) / 100 / 4), p: r1(kcal * n(m.p) / 100 / 4), f: r1(kcal * n(m.f) / 100 / 9) };
  }

  /* ===================== 直接调整总数值 ===================== */
  function setTotal(field, input) {
    var want = parseFloat(input.value);
    if (!isFinite(want)) { render(); return; }
    var base = baseTotals(date)[field];
    var delta = r1(want - base);
    var existing = db.entries.filter(function (x) { return x.type === 'adjust' && x.date === date && x.field === field; });
    if (Math.abs(delta) < 0.05) {
      db.entries = db.entries.filter(function (x) { return !(x.type === 'adjust' && x.date === date && x.field === field); });
    } else if (existing.length) {
      existing[0].value = delta;
      db.entries = db.entries.filter(function (x) { return x === existing[0] || !(x.type === 'adjust' && x.date === date && x.field === field); });
    } else {
      db.entries.push({ id: uid(), type: 'adjust', date: date, field: field, value: delta, name: '手动调整', time: nowTime(), created: Date.now() });
    }
    commit();
  }
  function clearAdjust(field) {
    db.entries = db.entries.filter(function (x) { return !(x.type === 'adjust' && x.date === date && x.field === field); });
    commit();
  }
  function adjChip(field) {
    var adj = entriesOn(date).filter(function (x) { return x.type === 'adjust' && x.field === field; })[0];
    if (!adj) return '';
    var v = n(adj.value);
    return '<span class="chip">含手动调整 ' + (v > 0 ? '+' : '') + r1(v) + ' ' + esc(ADJ_LABEL[field]) + '<button data-clearadj="' + field + '" title="清除手动调整">清除</button></span>';
  }

  /* ===================== 渲染 ===================== */
  function render() {
    var d = new Date(date + 'T12:00:00');
    try {
      if (!db.workout) db.workout = HDWorkout.normalizeState(null);
      HDWorkout.attach(db.workout);
      HDWorkout.render();
      HDExtras.render(); HDInsights2.render(); HDWeekly.render();
      HDMoney.attach(db.money); HDMoney.render();
    } catch (e) { console.warn('训练/扩展模块渲染失败', e); }
    $('#title').textContent = (date === today()) ? '今天' : ((d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日');
    $('#subtitle').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(d);
    $('#date').value = date;

    var t = totals(date), g = db.goals;

    var kcalIn = $('#tKcal');
    if (document.activeElement !== kcalIn) kcalIn.value = r0(t.kcal);
    var waterIn = $('#tWater');
    if (document.activeElement !== waterIn) waterIn.value = r0(t.water);
    var restIn = $('#tRest');
    if (document.activeElement !== restIn) restIn.value = r1(t.rest);
    $('#kcalAdj').innerHTML = adjChip('kcal');
    $('#waterAdj').innerHTML = adjChip('water');

    $('#kcalGoal').textContent = '目标 ' + r0(g.kcal) + ' 千卡 · 剩余 ' + r0(g.kcal - t.kcal) + ' 千卡';
    $('#waterGoal').textContent = '目标 ' + r0(g.water) + ' 毫升';
    $('#restGoal').textContent = '目标 ' + r1(g.rest) + ' 小时';
    bar('#kcalBar', t.kcal, g.kcal);
    bar('#waterBar', t.water, g.water);
    bar('#restBar', t.rest, g.rest);

    var w = latestWeight(date);
    $('#weight').innerHTML = (w ? r1(w.value) : '--') + ' <span class="unit">公斤</span>';
    $('#weightDate').textContent = w ? ('记录于 ' + w.date) : '尚无记录';

    renderMacros(t);
    renderGoalInputs();
    renderFood();
    renderList('water', '#waterList', function (x) { return r1(x.value) + ' 毫升'; });
    renderList('weight', '#weightList', function (x) { return r1(x.value) + ' 公斤'; });
    renderList('rest', '#restList', function (x) { return r1(x.value) + ' 小时'; });
    renderTrend();
    renderWeightTab();
    renderTodayBar();
    renderPlanTab();
    renderReviewTab();
    renderBmrInputs();
  }
  function bar(sel, v, goal) {
    var el = $(sel);
    var pct = n(goal) > 0 ? Math.min(100, n(v) / n(goal) * 100) : 0;
    el.style.width = pct + '%';
    el.className = (n(goal) > 0 && n(v) > n(goal)) ? 'over' : '';
  }
  function renderMacros(t) {
    var tg = macroTargetGrams();
    var energy = t.c * 4 + t.p * 4 + t.f * 9;
    var rows = '';
    for (var i = 0; i < MACROS.length; i++) {
      var k = MACROS[i][0], label = MACROS[i][1], coef = MACROS[i][2], color = MACROS[i][3];
      var actual = roundMaybe(t[k]), target = tg[k];
      var pct = energy > 0 ? Math.round(t[k] * coef / energy * 1000) / 10 : 0;
      var goalPct = n(db.goals.macro[k]);
      var barPct = target > 0 ? Math.min(100, t[k] / target * 100) : 0;
      var advice = k === 'f' ? '建议 20%–30%' : (k === 'c' ? '建议 50%–65%' : '建议 10%–20%');
      var okPct = k === 'f' ? (pct >= 20 && pct <= 30) : (k === 'c' ? (pct >= 50 && pct <= 65) : (pct >= 10 && pct <= 20));
      rows += '<div class="macroRow">' +
        '<div class="mName" style="color:' + color + '">' + label + '<span>' + coef + ' 千卡/克</span></div>' +
        '<div class="macroCell"><small>实际（克，可直接改）</small>' +
        '<input type="number" min="0" step="0.1" data-macrototal="' + k + '" value="' + actual + '">' +
        '<div class="macroBar"><i style="width:' + barPct + '%;background:' + color + '"></i></div>' + adjChip(k) + '</div>' +
        '<div class="macroCell"><small>目标（克，可直接改）</small>' +
        '<input type="number" min="0" step="0.5" data-goalgram="' + k + '" value="' + target + '">' +
        '<small style="margin-top:5px">目标占比 ' + goalPct + '%</small></div>' +
        '<div class="macroCell"><small>实际占热量</small><b style="color:' + (okPct ? '#268261' : '#a2621f') + '">' + pct + '%</b>' +
        '<small>' + advice + '</small></div>' +
        '</div>';
    }
    $('#macroRows').innerHTML = rows;
    var sum = n(db.goals.macro.c) + n(db.goals.macro.p) + n(db.goals.macro.f);
    $('#macroSum').innerHTML = '三大营养素比例合计 <b style="color:' + (Math.abs(sum - 100) < 0.5 ? '#268261' : '#b4552f') + '">' + r1(sum) + '%</b>（应为 100%）';
    $('#mKcalTip').textContent = r0(db.goals.kcal);
    var kgEl = $('#mProteinKg');
    if (kgEl) {
      var perKg = n(db.profile.proteinPerKg);
      var w = currentWeight() || n(db.profile.weight);
      kgEl.textContent = (perKg > 0 && w > 0)
        ? ('当前方案的蛋白质依据 ' + perKg + ' g/kg 体重，约 ' + Math.round(perKg * w) + ' 克/天；与上面的目标克数不一致时，以你改的克数为准。')
        : '';
    }
  }
  function roundMaybe(v) { v = r1(v); return v; }
  function renderGoalInputs() {
    setVal('#gKcal', r0(db.goals.kcal)); setVal('#gWater', r0(db.goals.water)); setVal('#gRest', r1(db.goals.rest));
    setVal('#gCp', r1(db.goals.macro.c)); setVal('#gPp', r1(db.goals.macro.p)); setVal('#gFp', r1(db.goals.macro.f));
    var tg = macroTargetGrams();
    setVal('#gCg', tg.c); setVal('#gPg', tg.p); setVal('#gFg', tg.f);
  }
  function setVal(sel, v) { var el = $(sel); if (el && document.activeElement !== el) el.value = v; }
  function mealName(m) { for (var i = 0; i < MEALS.length; i++) if (MEALS[i][0] === m) return MEALS[i][1]; return '其他'; }
  function renderFood() {
    var list = typeOn('food', date);
    var html = '';
    for (var i = 0; i < MEALS.length; i++) {
      var mk = MEALS[i][0], ml = MEALS[i][1];
      var items = list.filter(function (x) { return x.meal === mk; });
      var sub = items.reduce(function (s, x) { return s + n(x.kcal); }, 0);
      var _lastSame = null;
      for (var _i = db.entries.length - 1; _i >= 0; _i--) {
        var _e = db.entries[_i];
        if (_e && _e.type === 'food' && _e.meal === mk) { _lastSame = _e; break; }
      }
      html += '<div class="meal"><div class="mealHead"><span><b>' + ml + '</b> · ' + items.length + ' 项</span>' +
        '<span>' + r0(sub) + ' 千卡 ' +
        (_lastSame ? '<button class="mini" data-againmeal="' + mk + '" title="把上次这个餐次吃的东西原样再加一次">又是这个</button> ' : '') +
        '<button class="mini" data-addmeal="' + mk + '">+ 添加</button></span></div>';
      html += items.length ? items.map(foodRow).join('') : '<div class="empty">暂无记录</div>';
      html += '</div>';
    }
    var adj = typeOn('adjust', date);
    if (adj.length) {
      html += '<div class="meal"><div class="mealHead"><span><b>手动调整</b></span><span></span></div>';
      html += adj.map(function (a) {
        return '<div class="item"><div><b>' + esc(ADJ_LABEL[a.field] || a.field) + '</b><small>手动调整值</small></div>' +
          '<div class="acts">' + (n(a.value) > 0 ? '+' : '') + r1(a.value) + ' <button class="del" data-del="' + esc(a.id) + '" title="删除">×</button></div></div>';
      }).join('');
      html += '</div>';
    }
    $('#foodList').innerHTML = html;
  }
  function foodRow(x) {
    var detail = [];
    if (x.servings) detail.push(r1(x.servings) + (x.servingLabel || ' 份'));
    else if (x.grams) detail.push(r0(x.grams) + ' 克');
    detail.push(r0(x.kcal) + ' 千卡');
    if (x.c || x.p || x.f) detail.push('碳 ' + r1(x.c) + ' / 蛋 ' + r1(x.p) + ' / 脂 ' + r1(x.f));
    if (x.time) detail.push(x.time);
    return '<div class="item"><div><b>' + esc(x.name || '未命名') + '</b><small>' + esc(detail.join(' · ')) + '</small></div>' +
      '<div class="acts"><button data-edit="' + esc(x.id) + '" title="编辑">✎</button>' +
      '<button class="del" data-del="' + esc(x.id) + '" title="删除">×</button></div></div>';
  }
  function renderList(type, sel, fmt) {
    var list = typeOn(type, date);
    $(sel).innerHTML = list.length ? list.map(function (x) {
      return '<div class="item"><div><b>' + esc(x.name || '') + '</b><small>' + esc(x.time || '') + '</small></div>' +
        '<div class="acts">' + esc(fmt(x)) +
        ' <button data-edit="' + esc(x.id) + '" title="编辑">✎</button>' +
        '<button class="del" data-del="' + esc(x.id) + '" title="删除">×</button></div></div>';
    }).join('') : '<div class="empty">这一天还没有记录</div>';
  }
  function renderTrend() {
    var cells = '', maxKcal = 1;
    var days = [];
    for (var i = 0; i < 14; i++) {
      var dd = new Date(date + 'T12:00:00'); dd.setDate(dd.getDate() - i);
      var ds = local(dd);
      var t = totals(ds);
      var lw = latestWeight(ds);
      var ww = lw ? n(lw.value) : null;
      if (t.kcal > maxKcal) maxKcal = t.kcal;
      days.push({ ds: ds, t: t, w: ww });
    }
    days.forEach(function (row) {
      var pct = Math.round(row.t.kcal / maxKcal * 100);
      cells += '<tr data-date="' + row.ds + '">' +
        '<td>' + row.ds.slice(5) + '</td>' +
        '<td class="kcalCell"><i style="width:' + pct + '%"></i><span>' + r0(row.t.kcal) + ' kcal</span></td>' +
        '<td>' + r1(row.t.c) + ' g</td><td>' + r1(row.t.p) + ' g</td><td>' + r1(row.t.f) + ' g</td>' +
        '<td>' + r0(row.t.water) + ' ml</td>' +
        '<td>' + (row.w == null ? '--' : r1(row.w)) + ' kg</td>' +
        '<td>' + r1(row.t.rest) + ' h</td></tr>';
    });
    $('#rows').innerHTML = cells;
  }

  /* ===================== 体重趋势模块 ===================== */
  function entriesOfType(type) { return db.entries.filter(function (x) { return x.type === type; }); }
  function latestOf(type, endDate) {
    var list = db.entries.filter(function (x) { return x.type === type && x.date <= (endDate || date); });
    list.sort(function (a, b) { return b.date.localeCompare(a.date) || n(b.created) - n(a.created); });
    return list[0] || null;
  }
  function startWeight() {
    var p = db.profile;
    if (n(p.startWeight) > 0) return n(p.startWeight);
    var first = db.entries.filter(function (x) { return x.type === 'weight'; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || n(a.created) - n(b.created); })[0];
    return first ? n(first.value) : 0;
  }
  function currentWeight() {
    var w = latestOf('weight');
    return w ? n(w.value) : (n(db.profile.weight) > 0 ? n(db.profile.weight) : 0);
  }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }

  function svgWeightChart(trend, goalKg, periodDates) {
    var pts = trend.filter(function (x) { return x.trend != null; });
    if (pts.length < 2) return '<div class="empty">至少需要两天的体重记录才能画曲线。到「每日记录」里点「+ 记录体重」即可。</div>';
    var W = 720, H = 250, padL = 50, padR = 18, padT = 18, padB = 32;
    var vals = [];
    pts.forEach(function (x) { if (x.weight != null) vals.push(x.weight); vals.push(x.trend); });
    if (goalKg > 0) vals.push(goalKg);
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 1) { var mid = (max + min) / 2; min = mid - 0.5; max = mid + 0.5; }
    var pad = (max - min) * 0.12; min -= pad; max += pad;
    function X(i) { return padL + (W - padL - padR) * i / (pts.length - 1); }
    function Y(v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); }
    var s = '<div class="chartWrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重趋势图">';
    for (var g = 0; g <= 4; g++) {
      var gv = min + (max - min) * g / 4, gy = Y(gv);
      s += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" style="stroke:var(--border)" stroke-width="1"/>' +
        '<text x="' + (padL - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="11" style="fill:var(--text-3)">' + gv.toFixed(1) + '</text>';
    }
    (periodDates || []).forEach(function (pd) {
      var i = -1;
      for (var k = 0; k < pts.length; k++) if (pts[k].date === pd) { i = k; break; }
      if (i >= 0) s += '<line x1="' + X(i).toFixed(1) + '" y1="' + padT + '" x2="' + X(i).toFixed(1) + '" y2="' + (H - padB) + '" style="stroke:var(--danger)" stroke-width="6" opacity="0.18"/>';
    });
    if (goalKg > 0) {
      var ty = Y(goalKg);
      s += '<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) + '" style="stroke:var(--warn)" stroke-width="1.5" stroke-dasharray="6 4"/>' +
        '<text x="' + (W - padR) + '" y="' + (ty - 7).toFixed(1) + '" text-anchor="end" font-size="11" style="fill:var(--warn)">目标 ' + goalKg + ' kg</text>';
    }
    pts.forEach(function (x, i) {
      if (x.weight != null) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x.weight).toFixed(1) + '" r="2.8" style="fill:var(--text-3)" opacity="0.5"/>';
    });
    var d = pts.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.trend).toFixed(1); }).join(' ');
    s += '<path d="' + d + '" fill="none" style="stroke:var(--accent)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>';
    [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach(function (i, k) {
      if (k === 1 && pts.length < 3) return;
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="' + (k === 0 ? 'start' : (k === 2 ? 'end' : 'middle')) + '" font-size="11" style="fill:var(--text-3)">' + pts[i].date.slice(5) + '</text>';
    });
    s += '</svg></div>';
    s += '<div class="legend"><span><i style="background:var(--accent)"></i>7 日移动平均（看趋势）</span>' +
      '<span><i style="background:var(--text-3)"></i>每日实测</span>' +
      (goalKg > 0 ? '<span><i style="background:var(--warn)"></i>目标体重</span>' : '') +
      '<span><i style="background:var(--danger)"></i>经期标记</span></div>';
    return s;
  }

  function renderWeightTab() {
    var p = db.profile;
    setVal('#pStart', p.startWeight === '' ? '' : r1(p.startWeight));
    setVal('#pTarget', p.targetWeight === '' ? '' : r1(p.targetWeight));
    setVal('#pRate', p.kgPerWeek);
    setVal('#pHeight', p.height);
    setVal('#pWaist', p.waist === '' ? '' : r1(p.waist));
    setVal('#pHip', p.hip === '' ? '' : r1(p.hip));
    setVal('#pNeck', p.neck === '' ? '' : r1(p.neck));

    var trend = HD_PLANS.weightTrend(db.entries, date, 30);
    var pts = trend.filter(function (x) { return x.trend != null; });
    var cur = currentWeight();
    var ma = pts.length ? pts[pts.length - 1].trend : null;
    var d7 = HD_PLANS.trendDelta(trend, 7);
    var sw = startWeight();
    var lost = (sw > 0 && cur > 0) ? r1(sw - cur) : null;
    var early = db.entries.filter(function (x) { return x.type === 'weight'; }).length < 2;

    $('#wStats').innerHTML =
      statBox('当前体重', cur > 0 ? cur + ' <span>公斤</span>' : '--', latestOf('weight') ? ('记录于 ' + latestOf('weight').date) : '还没有记录') +
      statBox('7 日移动平均', ma != null ? r1(ma) + ' <span>公斤</span>' : '--', '至少 2 天记录后可用') +
      statBox('近 7 天变化', d7 ? ((d7.deltaKg > 0 ? '+' : '') + d7.deltaKg + ' <span>公斤</span>') : '--',
        d7 ? (d7.deltaKg < 0 ? '<span class="delta-down">下降中</span>' : '<span class="delta-up">上升</span>') : '需要两次趋势点') +
      statBox('累计变化', lost == null ? '--' : ((lost > 0 ? '−' : '+') + Math.abs(lost) + ' <span>公斤</span>'),
        sw > 0 ? ('起始 ' + r1(sw) + ' 公斤') : '设置起始体重后可用');

    $('#wChart').innerHTML = svgWeightChart(trend, n(p.targetWeight), entriesOfType('period').map(function (x) { return x.date; }));
    $('#wChartHint').textContent = early ? '记录满 2 天后曲线会出现' : (pts.length + ' 个趋势点');

    /* 里程碑 */
    var ms = HD_PLANS.milestones(sw, cur, n(p.targetWeight));
    $('#wMilestones').innerHTML = ms.length ? ms.map(function (m) {
      var total = sw - m.goalKg;
      var done = sw - cur;
      var pct = total > 0 ? Math.max(0, Math.min(100, done / total * 100)) : (m.reached ? 100 : 0);
      return '<div class="msRow' + (m.reached ? ' done' : '') + '">' +
        '<div class="msTop"><b>' + (m.custom ? '自定义目标' : ('减 ' + m.pct + '%')) + ' · ' + m.goalKg + ' kg</b>' +
        '<span>' + (m.reached ? '已达成 ✓' : ('还差 ' + Math.max(0, r1(cur - m.goalKg)) + ' kg')) + '</span></div>' +
        '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="msNote">从 ' + r1(sw) + ' kg 到 ' + m.goalKg + ' kg（共 ' + r1(total) + ' kg），已完成 ' + Math.round(pct) + '%</div>' +
        '</div>';
    }).join('') : '<div class="empty">先填写起始体重（或记录一次体重）以生成 5% / 10% / 15% 里程碑。</div>';

    var eta = '';
    if (n(p.targetWeight) > 0 && cur > 0 && n(p.kgPerWeek) > 0) {
      var remain = cur - n(p.targetWeight);
      if (remain <= 0) eta = '已经达到目标体重 🎉';
      else {
        var weeks = remain / n(p.kgPerWeek);
        var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + Math.round(weeks * 7));
        eta = '按每周 ' + n(p.kgPerWeek) + ' 公斤，还需减 ' + r1(remain) + ' 公斤，预计约 ' + Math.ceil(weeks) + ' 周（' + local(d) + '）达成。';
      }
    } else if (!(n(p.targetWeight) > 0)) eta = '填写目标体重后可估算达成日期。';
    var tdee = HD_PLANS.tdee(p);
    if (tdee) eta += ' 当前 TDEE 估算 ' + Math.round(tdee) + ' 千卡，按每周 ' + n(p.kgPerWeek) + ' 公斤对应每日缺口 ' + Math.round(HD_PLANS.deficitFor(n(p.kgPerWeek) || 0.5)) + ' 千卡。';
    $('#wEta').textContent = eta;

    /* 围度与体脂 */
    var bmi = HD_PLANS.bmi(cur, p.height);
    var ratio = HD_PLANS.whtr(n(p.waist), n(p.height));
    var bf = HD_PLANS.navyBodyFat(p.sex, n(p.height), n(p.waist), n(p.neck), n(p.hip));
    var lastM = latestOf('measure', date);
    var html = '<div class="stats4" style="grid-template-columns:repeat(3,1fr)">' +
      statBox('BMI', bmi ? bmi + ' <span>' + HD_PLANS.bmiClass(bmi) + '</span>' : '--', 'BMI = 体重 ÷ 身高²') +
      statBox('腰高比', ratio ? ratio + ' <span>' + (ratio >= 0.5 ? '偏高' : '正常') + '</span>' : '--', '腰围 ÷ 身高，≥0.5 提示风险') +
      statBox('围度法体脂', bf != null ? bf + ' <span>%</span>' : '--', '美国海军公式，看趋势即可') +
      '</div>';
    if (lastM) html += '<p class="hint">最近一次围度记录：' + lastM.date + '（腰 ' + r1(lastM.waist) + ' / 臀 ' + r1(lastM.hip) + ' / 颈 ' + r1(lastM.neck) + ' 厘米）</p>';
    $('#wBody').innerHTML = html;

    /* 经期 */
    var periods = entriesOfType('period').map(function (x) { return x.date; }).sort();
    var markedToday = periods.indexOf(date) >= 0;
    $('#periodMark').disabled = markedToday;
    if (!periods.length) $('#wPeriod').textContent = '未记录经期。经期前后体重会有 1–2 公斤的水分波动，标记后在曲线上一眼能看出来。';
    else {
      /* 连续（间隔 ≤2 天）的标记算同一次经期，只取每次的第一天来算周期 */
      var starts = [];
      periods.forEach(function (d) { if (!starts.length || daysBetween(starts[starts.length - 1], d) > 2) starts.push(d); });
      var last = starts[starts.length - 1];
      var cycle = starts.length > 1 ? daysBetween(starts[starts.length - 2], last) : null;
      $('#wPeriod').innerHTML = '最近经期开始：' + last + '（' + daysBetween(last, date) + ' 天前）' +
        (cycle ? ' · 上一个周期 ' + cycle + ' 天' : ' · 记录 2 次以上可估算周期') +
        '<br>最近标记：' + periods.slice(-6).map(function (d) { return '<span class="periodMark">' + d.slice(5) + '</span>'; }).join('');
    }
  }
  function statBox(label, value, note) {
    return '<div><small>' + label + '</small><b>' + value + '</b><span>' + (note || '') + '</span></div>';
  }
  function saveWeightFor(day, value) {
    var v = n(value);
    if (!(v > 0)) { alert('请输入有效的体重（公斤）。'); return false; }
    var exist = db.entries.filter(function (x) { return x.type === 'weight' && x.date === day; })[0];
    if (exist) { exist.value = v; exist.created = Date.now(); }
    else db.entries.push({ id: uid(), type: 'weight', date: day, name: '体重', value: v, time: nowTime(), created: Date.now() });
    if (!(n(db.profile.startWeight) > 0)) {
      var first = db.entries.filter(function (x) { return x.type === 'weight'; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); })[0];
      if (first) db.profile.startWeight = n(first.value);
    }
    db.profile.weight = v;
    commit();
    return true;
  }
  function saveMeasureFor(day) {
    var p = db.profile;
    if (!(n(p.waist) > 0 || n(p.hip) > 0 || n(p.neck) > 0)) { alert('请至少填写腰围、臀围或颈围中的一项。'); return; }
    var exist = db.entries.filter(function (x) { return x.type === 'measure' && x.date === day; })[0];
    var rec = { id: exist ? exist.id : uid(), type: 'measure', date: day, name: '围度', time: nowTime(), created: exist ? exist.created : Date.now(), waist: n(p.waist), hip: n(p.hip), neck: n(p.neck) };
    if (exist) db.entries = db.entries.map(function (x) { return x.id === exist.id ? rec : x; });
    else db.entries.push(rec);
    if (n(db.profile.bodyFat) <= 0) {
      var bf = HD_PLANS.navyBodyFat(p.sex, n(p.height), n(p.waist), n(p.neck), n(p.hip));
      if (bf != null) db.profile.bodyFat = bf;
    }
    commit();
  }
  function togglePeriod(day, on) {
    var has = db.entries.some(function (x) { return x.type === 'period' && x.date === day; });
    if (on && !has) db.entries.push({ id: uid(), type: 'period', date: day, name: '经期', value: 1, time: '', created: Date.now() });
    if (!on && has) db.entries = db.entries.filter(function (x) { return !(x.type === 'period' && x.date === day); });
    commit();
  }

  /* ===================== 计划、今日提示条与断食 ===================== */
  function dietPlan() {
    return HD_PLANS.DIET_PLANS.filter(function (p) { return p.id === db.plan.dietId; })[0] || null;
  }
  function exercisePlan() {
    return HD_PLANS.EXERCISE_PLANS.filter(function (p) { return p.id === db.plan.exerciseId; })[0] || null;
  }
  function mealTargets() {
    var kcal = n(db.goals.kcal), m = db.plan.meals;
    var out = {};
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (k) { out[k] = Math.round(kcal * n(m[k]) / 100); });
    return out;
  }
  function mealUsed(day) {
    var out = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    typeOn('food', day).forEach(function (x) { if (out[x.meal] != null) out[x.meal] += n(x.kcal); });
    return out;
  }
  /** 今日食物记录中有多少落在进食窗口之外 */
  function outsideWindow(day, start, end) {
    function mins(s) { var p = String(s || '').split(':'); return n(p[0]) * 60 + n(p[1]); }
    var s = mins(start), e = mins(end);
    if (!(e > s)) return 0;
    return typeOn('food', day).filter(function (x) {
      if (!/^\d{1,2}:\d{2}$/.test(x.time || '')) return false;
      var t = mins(x.time);
      return t < s || t >= e;
    }).length;
  }
  function fastingInfo() {
    var f = db.plan.fasting;
    if (!f.enabled) return null;
    var st = HD_PLANS.fastingState(f.start, f.end, new Date());
    st.start = f.start; st.end = f.end;
    st.outside = outsideWindow(date, f.start, f.end);
    return st;
  }
  function renderTodayBar() {
    var el = $('#todayBar');
    if (!el) return;
    var t = totals(date), g = db.goals;
    var left = g.kcal - t.kcal;
    var proteinTarget = Math.round(macroTargetGrams().p);
    var perKg = n(db.profile.proteinPerKg);
    var pKg = perKg > 0 ? Math.round(perKg * (currentWeight() || n(db.profile.weight))) : 0;
    var plan = dietPlan();
    var f = fastingInfo();
    var cls = left < 0 ? 'bad' : (left < 200 ? 'warn' : 'good');
    var html = '<div class="tbRow">' +
      '<div><small>今日预算</small><b>' + r0(g.kcal) + ' <span>千卡</span></b></div>' +
      '<div><small>已摄入</small><b>' + r0(t.kcal) + ' <span>千卡</span></b></div>' +
      '<div><small>还可以吃</small><b class="' + (left < 0 ? 'delta-up' : '') + '">' + r0(left) + ' <span>千卡</span></b></div>' +
      '<div><small>蛋白质</small><b>' + r1(t.p) + ' <span>/ ' + proteinTarget + ' 克</span></b></div>' +
      '</div><div class="tbFoot">';
    html += '<span class="tbPill ' + cls + '">' + (left < 0 ? ('超出 ' + r0(-left) + ' 千卡') : ('剩 ' + r0(left) + ' 千卡')) + '</span>';
    html += '<span class="tbPill">蛋白质达标 ' + (proteinTarget > 0 ? Math.min(100, Math.round(t.p / proteinTarget * 100)) : 0) + '%</span>';
    if (pKg > 0 && Math.abs(pKg - proteinTarget) > 5) {
      html += '<span class="tbPill' + (pKg > proteinTarget ? ' warn' : '') + '">方案建议 ' + perKg + ' g/kg ≈ ' + pKg + ' 克蛋白质</span>';
    }
    if (t.burn > 0) html += '<span class="tbPill">运动消耗 ' + r0(t.burn) + ' 千卡</span>';
    var mt = mealTargets(), mu = mealUsed(date);
    html += '<span class="tbPill">' + MEALS.map(function (m) {
      return mealName(m[0]) + ' ' + r0(mu[m[0]]) + '/' + mt[m[0]];
    }).join(' · ') + '</span>';
    /* 断食药丸：内容由 tickFasting 实时刷新（有无计时/窗口都在） */
    html += '<span class="tbPill' + (db.plan.fasting.session ? '' : ' hide') + '" id="tbFast"></span>';
    html += '<span class="tbPill">' + (plan ? ('方案：' + plan.name) : '还没有选择饮食方案') + '</span>';
    var due = reviewDue();
    if (due.due) {
      var rvNow = HD_PLANS.review(db, { endDate: date });
      html += '<span class="tbPill warn" id="tbReview" style="cursor:pointer">' +
        (rvNow.canAdjust
          ? ('该复盘了 · 建议 ' + r0(rvNow.suggestedKcal) + ' 千卡 →')
          : ('距上次复盘 ' + (due.days == null ? '—' : due.days + ' 天') + '，去补记录 →')) + '</span>';
    }
    html += '</div>';
    el.innerHTML = html;
  }
  var planGroup = '全部', planQuery = '';
  function renderPlanCards() {
    var groups = ['全部'];
    HD_PLANS.DIET_PLANS.forEach(function (p) { if (p.group && groups.indexOf(p.group) < 0) groups.push(p.group); });
    $('#planFilter').innerHTML = groups.map(function (g) {
      return '<button class="' + (g === planGroup ? 'on' : '') + '" data-pgroup="' + esc(g) + '">' + esc(g) +
        '<span class="hint"> ' + (g === '全部' ? HD_PLANS.DIET_PLANS.length : HD_PLANS.DIET_PLANS.filter(function (p) { return p.group === g; }).length) + '</span></button>';
    }).join('');
    var q = planQuery.trim().toLowerCase();
    var list = HD_PLANS.DIET_PLANS.filter(function (p) {
      if (planGroup !== '全部' && p.group !== planGroup) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.en || '') + ' ' + (p.tag || '') + ' ' + (p.principle || '') + ' ' + (p.content || '')).toLowerCase().indexOf(q) >= 0;
    });
    $('#planCount').textContent = list.length;
    if (!list.length) { $('#planCards').innerHTML = '<div class="empty">没有匹配的方法，换个关键词试试。</div>'; return; }
    $('#planCards').innerHTML = list.map(function (p) {
      var on = db.plan.dietId === p.id;
      var grams = p.macro ? HD_PLANS.macroFromKcal(n(db.goals.kcal), effectiveMacro(p)) : null;
      var perKg = (p.proteinPerKg && currentWeight() > 0) ? r1(HD_PLANS.macroFromKcal(n(db.goals.kcal), effectiveMacro(p)).p / currentWeight()) : null;
      var derived = p.macro && (function () {
        var e = effectiveMacro(p);
        return e.c !== p.macro.c || e.p !== p.macro.p || e.f !== p.macro.f;
      })();
      var eff = p.macro ? effectiveMacro(p) : null;
      return '<div class="card' + (on ? ' on' : '') + '">' +
        '<div class="cTop"><b>' + esc(p.name) + (p.en ? '<span class="enName">' + esc(p.en) + '</span>' : '') + '</b>' +
        '<span class="tag' + (on ? ' on' : (p.clinical ? ' danger' : '')) + '">' + esc(p.tag || '') + '</span></div>' +
        '<div class="cBody">' +
        '<span class="lbl">机制</span>' + esc(p.principle || '') + '<br>' +
        '<span class="lbl">怎么吃</span>' + esc(p.content || '') + '<br>' +
        '<span class="lbl">要记录</span>' + esc((p.record || []).join('、')) +
        (p.macro ? '<br><span class="lbl">比例</span>碳水 ' + p.macro.c + '% / 蛋白质 ' + p.macro.p + '% / 脂肪 ' + p.macro.f + '%' +
          (derived ? '，按你的体重折算为 ' + eff.c + '/' + eff.p + '/' + eff.f + '%' : '') +
          '（≈ 碳 ' + grams.c + ' g、蛋 ' + grams.p + ' g、脂 ' + grams.f + ' g' + (perKg ? '，蛋白质约 ' + perKg + ' g/kg' : '') + '）'
          : '<br><span class="lbl">比例</span>该方法不规定宏量比例') +
        '<details><summary>证据、注意与常见误区</summary><div class="dBody hint">' +
        '<span class="lbl">证据</span>' + esc(p.evidence || '') +
        (p.source ? ' <a href="' + esc(p.source) + '" target="_blank" rel="noreferrer">参考链接</a>' : '') + '<br>' +
        '<span class="lbl">注意</span>' + esc(p.caution || '无特殊禁忌') + '<br>' +
        '<span class="lbl">误区</span>' + esc(p.myth || '无') +
        (p.clinical ? '<br><b style="color:#a24745">这类方案需要医生或营养师监督，不要自行长期执行。</b>' : '') +
        '</div></details></div>' +
        '<div class="cFoot"><button class="' + (on ? 'ghost' : 'primary') + ' mini" data-diet="' + p.id + '">' + (on ? '取消选用' : '采用这个方案') + '</button>' +
        (p.fasting ? '<span class="hint">含断食窗口 ' + p.fasting.start + '–' + p.fasting.end + '</span>' : '') +
        '</div></div>';
    }).join('');
  }
  function renderPlanTab() {
    var plan = dietPlan();
    $('#planCurrent').textContent = plan ? ('使用中：' + plan.name) : '未选择方案';
    renderPlanCards();
    var floorBox = $('#floorOn');
    if (floorBox) floorBox.checked = db.plan.floorEnabled !== false;

    /* 餐次分配 */
    var m = db.plan.meals;
    var sum = n(m.breakfast) + n(m.lunch) + n(m.dinner) + n(m.snack);
    $('#mealSumHint').innerHTML = '合计 <b style="color:' + (Math.abs(sum - 100) < 0.5 ? '#268261' : '#b4552f') + '">' + r1(sum) + '%</b>（应为 100%）';
    setVal('#mealB', r1(m.breakfast)); setVal('#mealL', r1(m.lunch)); setVal('#mealD', r1(m.dinner)); setVal('#mealS', r1(m.snack));
    var mt = mealTargets(), mu = mealUsed(date);
    $('#mealTargets').innerHTML = MEALS.map(function (mm) {
      var k = mm[0], target = mt[k], used = mu[k];
      var pct = target > 0 ? Math.max(0, Math.min(100, used / target * 100)) : 0;
      var over = target > 0 && used > target;
      return '<div class="macroRow" style="grid-template-columns:64px 1fr 88px">' +
        '<div class="mName">' + mm[1] + '</div>' +
        '<div class="macroCell"><div class="macroBar"><i style="width:' + pct.toFixed(0) + '%;background:' + (over ? '#c2703c' : '#30976c') + '"></i></div></div>' +
        '<div class="hint">' + r0(used) + ' / ' + target + ' 千卡</div></div>';
    }).join('');

    /* 断食计时 */
    renderFasting();

    /* 运动 */
    var ep = exercisePlan();
    $('#exCurrent').textContent = ep ? ('使用中：' + ep.name + '（' + ep.weekly + '）') : '未选择运动计划';
    $('#exCards').innerHTML = HD_PLANS.EXERCISE_PLANS.map(function (p) {
      var on = db.plan.exerciseId === p.id;
      return '<div class="card' + (on ? ' on' : '') + '">' +
        '<div class="cTop"><b>' + esc(p.name) + '</b><span class="tag' + (on ? ' on' : '') + '">' + esc(p.weekly) + '</span></div>' +
        '<div class="cBody"><span class="hint">适合：' + esc(p.for) + '</span></div>' +
        '<div class="cFoot"><button class="' + (on ? 'ghost' : 'primary') + ' mini" data-ex="' + p.id + '">' + (on ? '取消选用' : '采用这个计划') + '</button></div>' +
        '</div>';
    }).join('');
    if (!ep) $('#exWeek').innerHTML = '';
    else {
      var wd = new Date(date + 'T12:00:00').getDay();
      var w = n(db.profile.weight) || currentWeight() || 65;
      $('#exWeek').innerHTML = '<div style="margin-top:6px">' + ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(function (nm, i) {
        var s = ep.week.filter(function (x) { return x.d === i; })[0];
        var isToday = wd === i;
        var kcal = s && s.met > 0 ? HD_PLANS.exerciseKcal(s.met, w, s.minutes) : 0;
        return '<div class="exDay' + (isToday ? ' today' : '') + '"><span>' + nm + (isToday ? '（今天）' : '') + ' · ' + (s ? esc(s.title) : '休息') + '</span>' +
          '<span class="' + (kcal ? '' : 'muted') + '">' + (kcal ? ('≈ ' + kcal + ' 千卡') : '—') +
          (isToday && s && s.met > 0 ? ' <button class="mini" data-exlog="' + i + '">记录完成</button>' : '') + '</span></div>';
      }).join('') + '</div>';
    }
    var ex = typeOn('exercise', date);
    $('#exTodayKcal').textContent = ex.length ? ('共 ' + r0(sumOf(ex, 'kcal')) + ' 千卡') : '今天还没有运动记录';
    $('#exList').innerHTML = ex.length ? ex.map(function (x) {
      return '<div class="item"><div><b>' + esc(x.name) + '</b><small>' + r0(x.minutes) + ' 分钟 · MET ' + x.met + ' · ' + esc(x.time || '') + '</small></div>' +
        '<div class="acts">' + r0(x.kcal) + ' 千卡 <button class="del" data-del="' + esc(x.id) + '" title="删除">×</button></div></div>';
    }).join('') : '<div class="empty">用上面的计划表一键记录，或在下面手动添加。</div>' +
      '<div class="quick">' + HD_PLANS.METS.slice(0, 8).map(function (m, i) {
        return '<button class="mini" data-exquick="' + i + '">' + esc(m[0]) + '</button>';
      }).join('') + '</div>';
  }
  /** 方案在你当前体重与预算下的实际比例：蛋白质按 g/kg 折算，剩余热量按方案碳水:脂肪分配 */
  function effectiveMacro(p) {
    var kcal = n(db.goals.kcal);
    var w = currentWeight() || n(db.profile.weight);
    if (w > 0 && kcal > 0 && p.proteinPerKg > 0) {
      var pPct = p.proteinPerKg * w * 4 / kcal * 100;
      if (pPct > 0 && pPct < 60) {
        var rest = 100 - pPct, cf = p.macro.c + p.macro.f;
        var m = { p: r1(pPct), f: r1(rest * p.macro.f / cf) };
        m.c = r1(100 - m.p - m.f);
        return m;
      }
    }
    return clone(p.macro);
  }
  function adoptDiet(id) {
    if (db.plan.dietId === id) { db.plan.dietId = ''; commit(); return; }
    var p = HD_PLANS.DIET_PLANS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (p.clinical) {
      if (!confirm('「' + p.name + '」属于需要医学监督的方案。\n\n注意：' + p.caution + '\n\n我已知悉风险，仍要采用（本应用只做记录，不提供医疗监督）。')) return;
    } else if (p.macro && p.macro.p >= 30 && p.macro.c <= 20) {
      if (!confirm('「' + p.name + '」会大幅降低碳水。\n\n注意：' + p.caution + '\n\n确定采用吗？')) return;
    }
    db.plan.dietId = id;
    var msg = '已采用「' + p.name + '」。';
    if (!p.macro) {
      db.profile.proteinPerKg = 0;
      commit();
      alert(msg + '\n\n这个方案不规定三大营养素比例，所以没有改动你的热量与营养目标。\n需要记录：' + (p.record || []).join('、') + '\n注意：' + p.caution);
      return;
    }
    db.profile.proteinPerKg = p.proteinPerKg;
    var t = HD_PLANS.tdee(db.profile);
    if (t && n(db.profile.kgPerWeek) > 0) {
      var b = HD_PLANS.budget(t, n(db.profile.kgPerWeek), db.profile.sex, db.plan.floorEnabled !== false);
      db.goals.kcal = b.kcal;
      msg += '\n按 TDEE ' + Math.round(t) + ' 千卡、每周减 ' + n(db.profile.kgPerWeek) + ' 公斤，每日热量预算已设为 ' + b.kcal + ' 千卡。' +
        (b.floored ? '\n（原计算值低于安全下限，已按 ' + b.floor + ' 千卡兜底；如需更低请在「预算与护栏」里关掉下限）' : '');
    } else {
      msg += '\n提示：补齐年龄/身高/体重/减重速度后，可自动算出每日热量预算。';
    }
    /* 三大营养素：蛋白质按方案的 g/kg 体重反推克数，剩余热量按方案给出的碳水:脂肪比例分配 */
    var w = currentWeight() || n(db.profile.weight);
    var kcal = n(db.goals.kcal);
    var macro = effectiveMacro(p);
    db.goals.macro = macro;
    msg += '\n三大营养素比例已设为 碳水 ' + macro.c + '% / 蛋白质 ' + macro.p + '% / 脂肪 ' + macro.f + '%' +
      (w > 0 ? '（约 碳 ' + HD_PLANS.macroFromKcal(kcal, macro).c + ' g、蛋 ' + HD_PLANS.macroFromKcal(kcal, macro).p + ' g、脂 ' + HD_PLANS.macroFromKcal(kcal, macro).f + ' g；蛋白质约 ' + p.proteinPerKg + ' g/kg 体重）' : '') + '。';
    if (p.fasting) {
      /* 只更新窗口，保留计时相关字段（方案选择、目标小时数、进行中的计时、历史） */
      db.plan.fasting.enabled = true;
      db.plan.fasting.start = p.fasting.start;
      db.plan.fasting.end = p.fasting.end;
      db.plan.fasting.history = db.plan.fasting.history || [];
      if (p.id === 'if168' || p.id === 'ketoif') { db.plan.fasting.protocolId = 'if168'; db.plan.fasting.hours = 16; }
      msg += '\n断食窗口已设为 ' + p.fasting.start + '–' + p.fasting.end + '（到「计划 → 断食计时」里可以点「开始断食」开始计时）。';
    }
    commit();
    alert(msg);
  }
  function logExercise(metIndex, title, met, minutes) {
    var w = currentWeight() || n(db.profile.weight) || 65;
    var kcal = HD_PLANS.exerciseKcal(met, w, minutes);
    db.entries.push({
      id: uid(), type: 'exercise', date: date, name: title, met: met, minutes: minutes, kcal: kcal,
      value: kcal, time: nowTime(), created: Date.now()
    });
    commit();
  }

  /* ===================== 复盘与自动调参 ===================== */
  function lastReview() {
    var h = db.review.history;
    return h.length ? h[h.length - 1] : null;
  }
  function reviewDue() {
    var lr = lastReview();
    if (!lr) return { due: true, days: null };
    var d = daysBetween(lr.date, date);
    return { due: d >= 7, days: d };
  }
  function logReview(kind, rv, fromKcal, toKcal, note) {
    db.review.history.push({
      date: date, kind: kind, from: r0(fromKcal), to: r0(toKcal),
      measuredTdee: rv && rv.measuredTdee != null ? r0(rv.measuredTdee) : null,
      avgIntake: rv && rv.intake ? r0(rv.intake.avgKcal) : null,
      completeness: rv && rv.intake ? rv.intake.completeness : null,
      deltaKg: rv && rv.delta ? rv.delta.deltaKg : null,
      days: rv && rv.delta ? rv.delta.days : null,
      plateau: !!(rv && rv.plateau),
      note: note || ''
    });
    if (db.review.history.length > 50) db.review.history = db.review.history.slice(-50);
  }
  function renderReviewTab() {
    var rv = HD_PLANS.review(db, { endDate: date });
    var weeksEl = $('#rvPlateauWeeks');
    if (weeksEl) weeksEl.textContent = HD_PLANS.PLATEAU_WEEKS;
    $('#rvWindow').textContent = '数据窗口：最近 ' + rv.windowDays + ' 天（截至 ' + date + '）';

    var logged = rv.intake.loggedDays;
    var deltaTxt = rv.delta ? ((rv.delta.deltaKg > 0 ? '+' : '') + rv.delta.deltaKg + ' <span>公斤 / ' + rv.delta.days + ' 天</span>') : '--';
    $('#rvStats').innerHTML =
      statBox('平均摄入', logged ? r0(rv.intake.avgKcal) + ' <span>千卡</span>' : '--', '有记录的 ' + logged + ' / ' + rv.windowDays + ' 天') +
      statBox('趋势体重变化', deltaTxt, rv.delta ? (rv.delta.perDay < 0 ? '<span class="delta-down">下降中</span>' : '<span class="delta-up">上升</span>') : '需要至少两次体重记录') +
      statBox('实测 TDEE', rv.measuredTdee != null ? r0(rv.measuredTdee) + ' <span>千卡</span>' : '--', '用摄入 + 体重变化反推') +
      statBox('当前预算', r0(rv.currentKcal) + ' <span>千卡</span>', rv.canAdjust && rv.suggestedKcal ? ('建议调整为 ' + r0(rv.suggestedKcal)) : '数据不足时不调整');

    var advice = '';
    if (rv.canAdjust) {
      var diff = r0(rv.suggestedKcal) - r0(rv.currentKcal);
      advice += '<div class="result"><div><b>' + (Math.abs(diff) < 30 ? '保持当前预算即可' : ('建议把每日热量预算改为 ' + r0(rv.suggestedKcal) + ' 千卡')) + '</b>' +
        (Math.abs(diff) < 30 ? '　（与当前相差 ' + diff + ' 千卡，在误差范围内）' : '　（' + (diff > 0 ? '+' : '') + diff + ' 千卡，' + rv.adjustPct + '%）') + '</div>' +
        '<div class="hint" style="margin-top:8px">' + rv.reasons.map(function (r) { return '· ' + esc(r); }).join('<br>') +
        (rv.notes.length ? '<br>' + rv.notes.map(function (n) { return '· ' + esc(n); }).join('<br>') : '') + '</div></div>';
    } else {
      advice += '<div class="result" style="border-left-color:#c2703c"><div><b>本次不调整</b></div><div class="hint" style="margin-top:8px">' +
        rv.reasons.map(function (r) { return '· ' + esc(r); }).join('<br>') + '</div></div>';
    }
    if (rv.plateau) {
      advice += '<div class="result" style="border-left-color:#b4552f;background:#fdf3ee"><div><b>可能进入平台期</b></div>' +
        '<div class="hint" style="margin-top:8px">先排除这几种情况再谈代谢适应：①经期/高盐导致的水分滞留（看 7 日平均而不是单日）②漏记（完整度 ' +
        Math.round(rv.intake.completeness * 100) + '%）③体重没变但围度在变小。确认是平台期后，可以小幅下调预算或增加日常活动量（步数比加练更容易坚持）。</div></div>';
    }
    $('#rvAdvice').innerHTML = advice;

    var acts = '';
    if (rv.canAdjust) {
      acts += '<button class="primary" id="rvApply" data-kcal="' + r0(rv.suggestedKcal) + '">采用建议预算（' + r0(rv.suggestedKcal) + ' 千卡）</button>';
      acts += '<button id="rvKeep">保持当前预算（' + r0(rv.currentKcal) + ' 千卡）</button>';
    } else {
      acts += '<button class="primary" id="rvGoDaily">去补记录</button>';
    }
    acts += '<button class="ghost" id="rvManual">手动设置预算</button>';
    $('#rvActions').innerHTML = acts;

    var last7 = rv.intake.days.slice(-7);
    $('#rvComplete').innerHTML = '完整度 <b style="color:' + (rv.intake.completeness >= HD_PLANS.MIN_COMPLETENESS ? '#268261' : '#b4552f') + '">' +
      Math.round(rv.intake.completeness * 100) + '%</b>（14 天窗口）';
    $('#rvDays').innerHTML = '<div class="dayStrip">' + last7.map(function (d) {
      return '<div class="' + (d.logged ? 'ok' : '') + '"><b>' + d.date.slice(5) + '</b>' + (d.logged ? r0(d.kcal) : '未记录') + '</div>';
    }).join('') + '</div>';

    var hist = db.review.history.slice().reverse();
    $('#rvHistory').innerHTML = hist.length ? hist.map(function (h) {
      var kind = { apply: '<span class="tag on">已采用</span>', keep: '<span class="tag">保持</span>', manual: '<span class="tag">手动</span>' }[h.kind] || h.kind;
      return '<tr><td>' + h.date + '</td><td>' + kind + '</td><td>' + r0(h.from) + '</td><td>' + r0(h.to) + '</td>' +
        '<td>' + (h.measuredTdee == null ? '--' : r0(h.measuredTdee)) + '</td>' +
        '<td>' + esc((h.days ? (h.days + ' 天平均摄入 ' + r0(h.avgIntake) + ' 千卡，趋势 ' + (h.deltaKg > 0 ? '+' : '') + h.deltaKg + ' kg') : '') +
          (h.plateau ? '（判定平台期）' : '') + (h.note ? '　' + h.note : '')) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">还没有调整记录。每 1–2 周来一次复盘即可。</td></tr>';
  }

  /* ---------- 断食计时 ---------- */
  function fastProtocol() {
    var fid = db.plan.fasting.protocolId;
    return HD_PLANS.FAST_PROTOCOLS.filter(function (p) { return p.id === fid; })[0] || HD_PLANS.FAST_PROTOCOLS[0];
  }
  function startFasting() {
    if (db.plan.fasting.session) { alert('已经在计时中了。'); return; }
    var p = fastProtocol();
    db.plan.fasting.session = { start: new Date().toISOString(), protocolId: p.id };
    commit();
  }
  function endFasting(cancel) {
    var s = db.plan.fasting.session;
    if (!s) { alert('现在没有进行中的断食。'); return; }
    var end = new Date();
    var hours = Math.round((end - new Date(s.start)) / 36000) / 100;   // 保留两位
    if (!cancel) {
      var h = Math.round(hours * 10) / 10;
      if (h >= 0.2) {
        db.plan.fasting.history.push({
          start: s.start, end: end.toISOString(), hours: h,
          protocolId: s.protocolId, note: ''
        });
        if (db.plan.fasting.history.length > 60) db.plan.fasting.history = db.plan.fasting.history.slice(-60);
      }
    }
    db.plan.fasting.session = null;
    commit();
    if (!cancel) alert('本次断食 ' + (Math.round(hours * 10) / 10) + ' 小时，已记入断食记录。');
  }
  function renderFasting() {
    var f = db.plan.fasting;
    if (!f) { db.plan.fasting = f = clone(DEFAULT_PLAN.fasting); }
    if (!Array.isArray(f.history)) f.history = [];
    if (!f.protocolId) f.protocolId = 'if168';
    if (!(n(f.hours) > 0)) f.hours = 16;
    if (!f.start) f.start = DEFAULT_PLAN.fasting.start;
    if (!f.end) f.end = DEFAULT_PLAN.fasting.end;
    $('#fastProtocols').innerHTML = HD_PLANS.FAST_PROTOCOLS.map(function (p) {
      var on = f.protocolId === p.id;
      return '<button class="' + (on ? 'on' : '') + '" data-fproto="' + p.id + '" title="' + esc(p.desc) + '">' +
        esc(p.name) + '<span class="hint"> ' + esc(p.level) + '</span></button>';
    }).join('');
    $('#fastPlanName').textContent = fastProtocol().desc;
    setVal('#fastHours', f.hours);
    $('#fastOn').checked = !!f.enabled;
    setVal('#fastStart', f.start);
    setVal('#fastEnd', f.end);

    var st = HD_PLANS.fastingStats(f.history, date);
    $('#fastStats').innerHTML = statBox('最近 7 天', st.count + ' <span>次</span>', '平均 ' + st.avgHours + ' 小时') +
      statBox('最长一次', st.longest ? st.longest + ' <span>小时</span>' : '--', '近 7 天记录') +
      statBox('累计记录', f.history.length + ' <span>次</span>', '最多保留 60 次');

    var hist = f.history.slice().reverse().slice(0, 20);
    $('#fastHistory').innerHTML = hist.length ? hist.map(function (h, i) {
      var d = String(h.end).slice(0, 10);
      var pn = (HD_PLANS.FAST_PROTOCOLS.filter(function (p) { return p.id === h.protocolId; })[0] || {}).name || '自定义';
      return '<div class="item"><div><b>' + r1(h.hours) + ' 小时</b><small>' + d + ' · ' + esc(pn) +
        ' · ' + String(h.start).slice(11, 16) + ' → ' + String(h.end).slice(11, 16) + '</small></div>' +
        '<div class="acts"><button class="del" data-fdel="' + (f.history.length - 1 - i) + '" title="删除">×</button></div></div>';
    }).join('') : '<div class="empty">还没有断食记录。点「开始断食」，到开饭时点「结束断食」就会记下来。</div>';
    tickFasting();
  }
  function fastTimerHtml() {
    var f = db.plan.fasting;
    if (!f.session) {
      var win = f.enabled ? HD_PLANS.fastingState(f.start, f.end, new Date()) : null;
      return '<div><b>未在计时</b></div><div class="hint" style="margin-top:6px">' +
        '选择上面的方案，点「开始断食」开始计时；到进食时间点「结束断食」，会自动记入断食记录。' +
        (win ? '<br>当前进食窗口 ' + f.start + '–' + f.end + '：' + win.text : '') + '</div>';
    }
    var pr = HD_PLANS.fastingProgress(f.session.start, f.hours, new Date());
    if (!pr) return '';
    var pn = (HD_PLANS.FAST_PROTOCOLS.filter(function (p) { return p.id === f.session.protocolId; })[0] || {}).name || '自定义';
    var bar = '<div class="bar" style="margin-top:10px"><i style="width:' + pr.pct.toFixed(1) + '%;background:' +
      (pr.reached ? '#2f9e63' : '#3f8fd0') + '"></i></div>';
    return '<div><b>' + (pr.reached ? '✅ 已达成目标 ' + pr.targetHours + ' 小时' : '断食中 ' + pr.elapsedText) + '</b>' +
      '　<span class="hint">已进行 ' + pr.elapsedText + ' / 目标 ' + pr.targetHours + ' 小时' + (pr.reached ? '' : ('，还差 ' + pr.remainText)) + '</span></div>' +
      bar +
      '<div class="hint" style="margin-top:6px">方案 ' + esc(pn) + ' · 开始于 ' + String(f.session.start).slice(0, 16).replace('T', ' ') +
      ' · 预计 ' + pr.endAt.toTimeString().slice(0, 5) + ' 达成目标</div>';
  }
  function tickFasting() {
    var box = $('#fastTimer');
    if (box) box.innerHTML = fastTimerHtml();
    var tb = $('#tbFast');
    if (!tb) return;
    var f = db.plan.fasting;
    if (f.session) {
      var pr = HD_PLANS.fastingProgress(f.session.start, f.hours, new Date());
      tb.className = 'tbPill ' + (pr && pr.reached ? 'good' : 'warn');
      tb.innerHTML = '断食中 ' + (pr ? pr.elapsedText : '') + ' / ' + f.hours + ' 小时' + (pr && !pr.reached ? '（还差 ' + pr.remainText + '）' : '（已达标）');
      return;
    }
    if (!f.enabled) { tb.className = 'tbPill hide'; tb.innerHTML = ''; return; }
    var win = HD_PLANS.fastingState(f.start, f.end, new Date());
    var outside = outsideWindow(date, f.start, f.end);
    tb.className = 'tbPill ' + (outside ? 'warn' : (win.eating ? 'good' : ''));
    tb.innerHTML = (win.eating ? '进食中' : '断食中') + ' · ' + f.start + '–' + f.end + ' · ' + win.text +
      (outside ? (' · 有 ' + outside + ' 条记录在窗口外') : '');
  }

  /* ===================== 基础代谢 ===================== */
  function bmrValue() { return HD_PLANS.bmr(db.profile); }
  function renderBmrInputs() {
    var p = db.profile;
    setSel('#bFormula', p.formula); setSel('#bSex', p.sex); setSel('#bActivity', String(p.activity));
    setVal('#bAge', p.age); setVal('#bHeight', p.height); setVal('#bWeight', p.weight); setVal('#bBodyFat', p.bodyFat === '' ? '' : p.bodyFat);
  }
  function setSel(sel, v) { var el = $(sel); if (el && document.activeElement !== el) el.value = v; }
  function calcBmr() {
    var p = db.profile;
    p.formula = $('#bFormula').value; p.sex = $('#bSex').value;
    p.age = n($('#bAge').value); p.height = n($('#bHeight').value); p.weight = n($('#bWeight').value);
    p.bodyFat = $('#bBodyFat').value === '' ? '' : n($('#bBodyFat').value);
    p.activity = n($('#bActivity').value) || 1.375;
    save();
    renderBmrInputs();
    var bmr = bmrValue();
    if (bmr == null) {
      $('#bmrResult').innerHTML = 'Katch–McArdle 公式需要体脂率，请填写体脂率后再计算。';
      return;
    }
    bmr = Math.round(bmr);
    var tdee = Math.round(bmr * p.activity);
    var cut = Math.round(tdee * 0.85), gain = Math.round(tdee * 1.1);
    $('#bmrResult').innerHTML =
      '<div><b>' + bmr + '</b> 千卡／天 <span class="unit">基础代谢率 BMR</span></div>' +
      '<div class="rLine"><span><b>' + tdee + '</b> 千卡 <span class="unit">每日总消耗 TDEE（活动系数 ' + p.activity + '）</span></span>' +
      '<span class="hint">建议：减脂 ' + cut + ' · 维持 ' + tdee + ' · 增肌 ' + gain + ' 千卡</span></div>' +
      '<div class="quick" style="margin-top:12px">' +
      '<button class="primary mini" data-adopt="' + cut + '">采用 ' + cut + '（减脂 −15%）</button>' +
      '<button class="mini" data-adopt="' + tdee + '">采用 ' + tdee + '（维持）</button>' +
      '<button class="mini" data-adopt="' + gain + '">采用 ' + gain + '（增肌 +10%）</button>' +
      '<button class="mini" data-adoptmacro="1">按推荐比例分配三大营养素</button>' +
      '</div>' +
      '<p class="hint">计算公式：' + esc((FORMULAS.filter(function (f) { return f[0] === p.formula; })[0] || ['', ''])[1]) + '</p>';
  }

  /* ===================== 事件绑定 ===================== */
  function bind() {
    /* 日期导航 */
    $('#prev').onclick = function () { var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - 1); date = local(d); render(); };
    $('#next').onclick = function () { var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + 1); date = local(d); render(); };
    $('#today').onclick = function () { date = today(); render(); };
    $('#date').onchange = function (e) { if (isDate(e.target.value)) { date = e.target.value; render(); } };

    /* 标签页 */
    /* 顶部标签与移动端底部导航共用同一套切换逻辑（按 tab 键同步高亮） */
    $$('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        var key = b.dataset.tab;
        $$('[data-tab]').forEach(function (x) { x.classList.toggle('on', x.dataset.tab === key); });
        Object.keys(TAB_PANELS).forEach(function (k) { $('#' + TAB_PANELS[k]).classList.toggle('hide', key !== k); });
      };
    });

    /* 直接改总数 */
    $('#tKcal').onchange = function () { setTotal('kcal', this); };
    $('#tWater').onchange = function () { setTotal('water', this); };
    $('#tRest').onchange = function () {
      var want = parseFloat(this.value);
      if (!isFinite(want) || want < 0) { render(); return; }
      var rests = typeOn('rest', date);
      if (rests.length === 1) { rests[0].value = want; commit(); return; }
      db.entries = db.entries.filter(function (x) { return !(x.type === 'rest' && x.date === date); });
      if (want > 0) db.entries.push({ id: uid(), type: 'rest', date: date, name: '睡眠', value: want, time: nowTime(), created: Date.now() });
      commit();
    };

    /* 快捷饮水 */
    $$('[data-quick]').forEach(function (b) {
      b.onclick = function () {
        db.entries.push({ id: uid(), type: 'water', date: date, name: '饮水', value: n(b.dataset.quick), time: nowTime(), created: Date.now() });
        commit();
      };
    });
    $$('[data-add]').forEach(function (b) {
      b.onclick = function () { openEntry(b.dataset.add); };
    });

    /* 营养素：实际值直接改 */
    $('#macroRows').addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.macrototal) { setTotal(t.dataset.macrototal, t); }
      else if (t.dataset && t.dataset.goalgram) {
        var k = t.dataset.goalgram, grams = n(t.value), kcal = n(db.goals.kcal);
        if (kcal > 0) db.goals.macro[k] = Math.round(grams * (k === 'f' ? 9 : 4) / kcal * 1000) / 10;
        commit();
      }
    });

    /* 目标设置 */
    $('#gKcal').onchange = function () {
      var v = n(this.value) || DEFAULT_GOALS.kcal;
      if (Math.abs(v - n(db.goals.kcal)) > 0.5) {
        var rvNow = HD_PLANS.review(db, { endDate: date });
        logReview('manual', rvNow, n(db.goals.kcal), v, '在目标设置里手改');
      }
      db.goals.kcal = v;
      commit();
    };
    $('#gWater').onchange = function () { db.goals.water = n(this.value) || DEFAULT_GOALS.water; commit(); };
    $('#gRest').onchange = function () { db.goals.rest = n(this.value) || DEFAULT_GOALS.rest; commit(); };
    ['c', 'p', 'f'].forEach(function (k) {
      $('#g' + k.toUpperCase() + 'p').onchange = function () { db.goals.macro[k] = n(this.value); commit(); };
      $('#g' + k.toUpperCase() + 'g').onchange = function () {
        var grams = n(this.value), kcal = n(db.goals.kcal);
        if (kcal > 0) db.goals.macro[k] = Math.round(grams * (k === 'f' ? 9 : 4) / kcal * 1000) / 10;
        commit();
      };
    });
    $('#presetRow').innerHTML = PRESETS.map(function (p, i) { return '<button class="mini" data-preset="' + i + '">' + p[0] + '</button>'; }).join('');
    $('#presetRow').onclick = function (e) {
      var b = e.target.closest('[data-preset]');
      if (!b) return;
      var p = PRESETS[n(b.dataset.preset)];
      db.goals.macro = { c: p[1], p: p[2], f: p[3] };
      commit();
    };
    $('#resetGoals').onclick = function () {
      if (!confirm('恢复默认目标（2000 千卡 / 2000 毫升 / 8 小时 / 50-20-30）？')) return;
      db.goals = clone(DEFAULT_GOALS); commit();
    };

    /* 基础代谢 */
    $('#bCalc').onclick = calcBmr;
    $('#bmrResult').addEventListener('click', function (e) {
      var a = e.target.closest('[data-adopt]');
      if (a) { db.goals.kcal = n(a.dataset.adopt); commit(); alert('已把每日热量目标设为 ' + r0(db.goals.kcal) + ' 千卡'); return; }
      var m = e.target.closest('[data-adoptmacro]');
      if (m) { db.goals.macro = { c: 50, p: 20, f: 30 }; commit(); alert('已按 50%（碳水）/ 20%（蛋白质）/ 30%（脂肪）分配'); }
    });

    /* 体重趋势页 */
    $('#wSave').onclick = function () {
      if (saveWeightFor(date, $('#wQuick').value)) $('#wQuick').value = '';
    };
    $('#wQuick').onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (saveWeightFor(date, this.value)) this.value = ''; }
    };
    [['#pStart', 'startWeight'], ['#pTarget', 'targetWeight'], ['#pRate', 'kgPerWeek'], ['#pHeight', 'height'],
     ['#pWaist', 'waist'], ['#pHip', 'hip'], ['#pNeck', 'neck']].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.onchange = function () {
        var v = this.value === '' ? '' : n(this.value);
        db.profile[pair[1]] = v;
        if (pair[1] === 'height' && n(v) > 0) { /* 身高同时用于基础代谢面板 */ }
        commit();
      };
    });
    $('#measSave').onclick = function () { saveMeasureFor(date); };
    $('#periodMark').onclick = function () { togglePeriod(date, true); };
    $('#periodClear').onclick = function () { togglePeriod(date, false); };
    $('#wAdoptPlan').onclick = function () {
      var p = db.profile;
      var t = HD_PLANS.tdee(p);
      if (!t) { alert('请先在「基础代谢与每日消耗估算」里填写年龄、身高、体重；Katch–McArdle 还需要体脂率。'); return; }
      var b = HD_PLANS.budget(t, n(p.kgPerWeek) || 0.5, p.sex, db.plan.floorEnabled !== false);
      if (!confirm('按 TDEE ' + Math.round(t) + ' 千卡、每周减 ' + (n(p.kgPerWeek) || 0.5) + ' 公斤（每日缺口 ' +
        Math.round(HD_PLANS.deficitFor(n(p.kgPerWeek) || 0.5)) + ' 千卡），把每日热量目标设为 ' + b.kcal + ' 千卡？' +
        (b.floored ? '\n注意：原计算值低于安全下限，已按 ' + b.floor + ' 千卡兜底。' : ''))) return;
      db.goals.kcal = b.kcal;
      var pt = HD_PLANS.proteinTarget(currentWeight() || n(p.weight), 'loss');
      commit();
      alert('已把热量目标设为 ' + b.kcal + ' 千卡。参考蛋白质目标：约 ' + pt + ' 克/天（1.6 g/kg）。');
    };

    /* 计划页 */
    $('#planFilter').onclick = function (e) {
      var b = e.target.closest('[data-pgroup]');
      if (!b) return;
      planGroup = b.dataset.pgroup;
      renderPlanCards();
    };
    $('#planSearch').oninput = function () { planQuery = this.value; renderPlanCards(); };
    $('#floorOn').onchange = function () {
      db.plan.floorEnabled = this.checked;
      commit();
    };
    $('#planCards').onclick = function (e) {
      var b = e.target.closest('[data-diet]');
      if (b) adoptDiet(b.dataset.diet);
    };
    $('#exCards').onclick = function (e) {
      var b = e.target.closest('[data-ex]');
      if (!b) return;
      db.plan.exerciseId = (db.plan.exerciseId === b.dataset.ex) ? '' : b.dataset.ex;
      commit();
    };
    $('#exWeek').onclick = function (e) {
      var b = e.target.closest('[data-exlog]');
      if (!b) return;
      var ep = exercisePlan();
      if (!ep) return;
      var s = ep.week.filter(function (x) { return x.d === n(b.dataset.exlog); })[0];
      if (s) logExercise(null, s.title, s.met, s.minutes);
    };
    $('#exList').onclick = function (e) {
      var q = e.target.closest('[data-exquick]');
      if (!q) return;
      var m = HD_PLANS.METS[n(q.dataset.exquick)];
      var mins = parseFloat(prompt('「' + m[0] + '」运动了多少分钟？', '30'));
      if (!isFinite(mins) || mins <= 0) return;
      logExercise(null, m[0], m[1], mins);
    };
    [['#mealB', 'breakfast'], ['#mealL', 'lunch'], ['#mealD', 'dinner'], ['#mealS', 'snack']].forEach(function (pair) {
      $(pair[0]).onchange = function () { db.plan.meals[pair[1]] = n(this.value); commit(); };
    });
    $('#fastOn').onchange = function () { db.plan.fasting.enabled = this.checked; commit(); };
    $('#fastStart').onchange = function () { db.plan.fasting.start = this.value || DEFAULT_PLAN.fasting.start; commit(); };
    $('#fastEnd').onchange = function () { db.plan.fasting.end = this.value || DEFAULT_PLAN.fasting.end; commit(); };
    $('#fastHours').onchange = function () { db.plan.fasting.hours = Math.max(1, Math.min(72, n(this.value) || 16)); commit(); };
    $('#fastProtocols').onclick = function (e) {
      var b = e.target.closest('[data-fproto]');
      if (!b) return;
      var p = HD_PLANS.FAST_PROTOCOLS.filter(function (x) { return x.id === b.dataset.fproto; })[0];
      if (!p) return;
      db.plan.fasting.protocolId = p.id;
      if (p.id !== 'custom' && p.hours > 0) db.plan.fasting.hours = p.hours;
      if (p.eat > 0 && p.eat < 24 && p.hours > 0) {
        /* 按方案推算一个默认进食窗口：断食结束时间 = 现在 + 断食时长（只在没有自定义窗口时提示） */
        db.plan.fasting.enabled = true;
      }
      commit();
    };
    $('#fastBegin').onclick = startFasting;
    $('#fastEndBtn').onclick = function () {
      if (!db.plan.fasting.session) { alert('现在没有进行中的断食。'); return; }
      endFasting(false);
    };
    $('#fastCancel').onclick = function () {
      if (!db.plan.fasting.session) { alert('现在没有进行中的断食。'); return; }
      if (confirm('放弃本次断食？不会记入断食记录。')) endFasting(true);
    };
    $('#fastHistory').onclick = function (e) {
      var b = e.target.closest('[data-fdel]');
      if (!b) return;
      var i = n(b.dataset.fdel);
      if (!confirm('删除这条断食记录？')) return;
      db.plan.fasting.history.splice(i, 1);
      commit();
    };

    /* 复盘页 */
    $('#rvActions').onclick = function (e) {
      var rv = HD_PLANS.review(db, { endDate: date });
      if (e.target.closest('#rvApply')) {
        var to = n(e.target.closest('#rvApply').dataset.kcal);
        var from = n(db.goals.kcal);
        if (!confirm('把每日热量预算从 ' + r0(from) + ' 千卡改为 ' + r0(to) + ' 千卡？\n\n依据：' + rv.reasons.join(' '))) return;
        logReview('apply', rv, from, to, '');
        db.goals.kcal = to;
        commit();
        alert('已更新为 ' + r0(to) + ' 千卡。建议 1–2 周后再来复盘一次。');
        return;
      }
      if (e.target.closest('#rvKeep')) {
        logReview('keep', rv, n(db.goals.kcal), n(db.goals.kcal), '本次选择保持不变');
        commit();
        return;
      }
      if (e.target.closest('#rvGoDaily')) {
        $$('[data-tab]')[0].click();
        return;
      }
      if (e.target.closest('#rvManual')) {
        var v = parseFloat(prompt('手动设置每日热量预算（千卡）', String(r0(db.goals.kcal))));
        if (!isFinite(v) || v <= 0) return;
        logReview('manual', rv, n(db.goals.kcal), v, '手动修改');
        db.goals.kcal = v;
        commit();
      }
    };

    /* 食物库 / 手动录入 */
    $('#addFromDb').onclick = function () { openFoodDlg('lunch'); };
    $('#addManual').onclick = function () { openManual(null, 'lunch'); };

    /* 列表内的编辑 / 删除 / 按餐次添加 / 清除调整 */
    document.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        db.entries = db.entries.filter(function (x) { return x.id !== del.dataset.del; });
        commit(); return;
      }
      var ed = e.target.closest('[data-edit]');
      if (ed) {
        var item = db.entries.filter(function (x) { return x.id === ed.dataset.edit; })[0];
        if (!item) return;
        if (item.type === 'food') openManual(item, item.meal);
        else openEntry(item.type, item);
        return;
      }
      /* 一键「又是这个」：把该餐次最近一次的食物原样复制到今天 */
      var again = e.target.closest('[data-againmeal]');
      if (again) {
        var mk2 = again.dataset.againmeal, src = null;
        for (var k2 = db.entries.length - 1; k2 >= 0; k2--) {
          var e2 = db.entries[k2];
          if (e2 && e2.type === 'food' && e2.meal === mk2) { src = e2; break; }
        }
        if (!src) { alert('这个餐次还没有历史记录。'); return; }
        var cp = clone(src);
        cp.id = uid(); cp.date = date; cp.created = Date.now(); cp.time = nowTime();
        db.entries.push(cp); commit();
        return;
      }
      var am = e.target.closest('[data-addmeal]');
      if (am) { openFoodDlg(am.dataset.addmeal); return; }
      var ca = e.target.closest('[data-clearadj]');
      if (ca) { clearAdjust(ca.dataset.clearadj); return; }
      var rvPill = e.target.closest('#tbReview');
      if (rvPill) {
        var btn = $$('[data-tab]').filter(function (x) { return x.dataset.tab === 'plan'; })[0];
        if (btn) btn.click();
        return;
      }
      var row = e.target.closest('tr[data-date]');
      if (row) { date = row.dataset.date; $$('[data-tab]')[0].click(); render(); }
    });

    /* 导出 / 导入 */
    $('#export').onclick = doExport; $('#export2').onclick = doExport;
    $('#import').onclick = function () { $('#file').click(); };
    $('#import2').onclick = function () { $('#file').click(); };
    $('#file').onchange = doImport;
    $('#clearDay').onclick = function () {
      if (!confirm('清空 ' + date + ' 的全部记录？')) return;
      db.entries = db.entries.filter(function (x) { return x.date !== date; }); commit();
    };
    $('#clearAll').onclick = function () {
      if (!confirm('清空全部数据（不可恢复）？建议先导出备份。')) return;
      if (!confirm('再次确认：删除所有记录并恢复默认目标？')) return;
      db = { goals: clone(DEFAULT_GOALS), profile: clone(DEFAULT_PROFILE), entries: [] }; commit();
    };
    $('#printBtn').onclick = copySummary;

    /* 食物库弹窗 */
    $('#fq').oninput = function () { renderFoodResults(); };
    $('#fcat').onchange = function () { renderFoodResults(); };
    $('#fcodeGo').onclick = lookupBarcode;
    $('#fcode').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); lookupBarcode(); } };
    $('#fgrams').oninput = function () { fillFromGrams(); };
    $('#fCancel').onclick = function () { $('#foodDlg').close(); };
    $('#fSave').onclick = saveFoodFromDb;
    $('#mCancel').onclick = function () { $('#manualDlg').close(); };
    $('#mSave').onclick = saveManual;
    $('#eCancel').onclick = function () { $('#entryDlg').close(); };
    $('#entryForm').onsubmit = saveEntry;
  }

  /* ===================== 弹窗逻辑 ===================== */
  var selectedFood = null, foodMeal = 'lunch';
  function openFoodDlg(meal) {
    foodMeal = meal || 'lunch';
    selectedFood = null;
    $('#fq').value = '';
    $('#fcat').value = '*';
    $('#fsel').classList.add('hide');
    $('#fmeal').value = foodMeal;
    $('#ftime').value = nowTime();
    renderFoodResults();
    $('#foodDlg').showModal();
    setTimeout(function () { $('#fq').focus(); }, 30);
  }
  function foodUnitText(f) {
    if (f.unit === 'serving') return f.serving ? ('每份（' + f.serving + '）') : '每份';
    if (f.unit === '100ml') return '每 100 毫升';
    return '每 100 克';
  }
  function foodAmount(f) {
    if (f.unit === 'serving') return 1;
    return 100;
  }
  function renderFoodResults() {
    var q = $('#fq').value, cat = $('#fcat').value;
    var list = q ? searchFood(q, cat, 150) : (cat !== '*' ? searchFood('', cat, 150) : COMMON_LIST);
    var html = list.map(function (f) {
      var on = selectedFood && selectedFood.idx === f.idx ? ' on' : '';
      var label = (f.brand ? f.brand + ' · ' : '') + (f.serving ? f.serving + ' ' : '');
      return '<div class="row2' + on + '" data-idx="' + f.idx + '">' +
        '<span>' + esc(f.name) + foodKindTag(f) + (f.brand && f.name.indexOf(f.brand) < 0 ? '<small style="margin-left:6px">' + esc(f.brand) + '</small>' : '') + '</span>' +
        '<small>' + r0(f.kcal) + ' kcal · ' + (f.kcalOnly ? '（仅热量）' : ('碳 ' + r1(f.c) + ' 蛋 ' + r1(f.p) + ' 脂 ' + r1(f.f))) +
        '（' + foodUnitText(f) + '）' + (f.code ? ' · ' + esc(f.code) : '') + '</small></div>';
    }).join('');
    $('#fres').innerHTML = html || '<div class="empty" style="padding:12px">没有找到匹配的食物，可用条码查询或「+ 手动录入」</div>';
  }
  function selectFood(f) {
    selectedFood = f;
    $('#fsel').classList.remove('hide');
    var extra = [];
    if (f.brand) extra.push(f.brand);
    if (f.cat) extra.push(f.cat);
    if (f.note) extra.push(f.note);
    $('#fselName').innerHTML = esc(f.name) + (extra.length ? ' <small class="hint">· ' + esc(extra.join(' · ')) + '</small>' : '') +
      ' <small class="hint">（' + foodUnitText(f) + '）</small>';
    $('#famountLabel').childNodes[0].nodeValue = (f.unit === 'serving' ? '份数' : (f.unit === '100ml' ? '食用量（毫升）' : '食用量（克）'));
    $('#fgrams').value = foodAmount(f);
    fillFromGrams();
    $$('#fres .row2').forEach(function (x) { x.classList.toggle('on', n(x.dataset.idx) === f.idx); });
  }
  $('#fres').addEventListener('click', function (e) {
    var row = e.target.closest('[data-idx]');
    if (!row) return;
    var f = FOODS[n(row.dataset.idx)];
    if (f) selectFood(f);
  });
  function fillFromGrams() {
    if (!selectedFood) return;
    var amt = n($('#fgrams').value);
    var factor = selectedFood.unit === 'serving' ? amt : amt / 100;
    $('#fKcal').value = r0(selectedFood.kcal * factor);
    $('#fC').value = r1(selectedFood.c * factor);
    $('#fP').value = r1(selectedFood.p * factor);
    $('#fF').value = r1(selectedFood.f * factor);
  }
  /* ---------- 条码查询：先查本地内置，再联网查 Open Food Facts 并缓存 ---------- */
  function offProductToFood(p) {
    var nut = p.nutriments || {};
    function per100(key) {
      var v = Number(nut[key + '_100g']);
      if (!isFinite(v)) v = Number(nut[key]);
      return isFinite(v) ? v : 0;
    }
    var kcal = per100('energy-kcal');
    if (!(kcal > 0)) {
      var kj = per100('energy');
      if (kj > 0) kcal = kj / 4.184;
    }
    if (!(kcal > 0)) return null;
    var name = (p.product_name_zh || p.product_name || '').trim() || ('条码 ' + p.code);
    return {
      code: String(p.code || ''), name: name.slice(0, 40),
      brand: String(p.brands || '').split(',')[0].trim().slice(0, 24),
      kcal: Math.round(kcal * 10) / 10,
      p: Math.round(per100('proteins') * 10) / 10,
      f: Math.round(per100('fat') * 10) / 10,
      c: Math.round(per100('carbohydrates') * 10) / 10,
      fb: Math.round(per100('fiber') * 10) / 10,
      serving: String(p.serving_size || '').slice(0, 14),
      cat: '包装食品（Open Food Facts）', unit: '100g', src: 'off'
    };
  }
  function setCodeHint(html) { var el = $('#fcodeHint'); if (el) el.innerHTML = html; }
  function lookupBarcode() {
    var raw = String($('#fcode').value || '').replace(/\D/g, '');
    if (raw.length < 8) { setCodeHint('<b style="color:#b4552f">请输入完整的商品条码（8–14 位数字）</b>'); return; }
    var local = BY_CODE[raw];
    if (local) {
      selectFood(local);
      setCodeHint('✅ 本地已有「' + esc(local.name) + '」（离线可用）。条码数据来自 Open Food Facts（ODbL 1.0 / DbCL 1.0）。');
      return;
    }
    setCodeHint('正在联网查询 Open Food Facts…');
    var url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(raw) +
      '.json?fields=code,product_name,product_name_zh,brands,nutriments,serving_size,quantity';
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.product) {
          setCodeHint('没有查到条码 <b>' + esc(raw) + '</b>。可换一个条码，或用「+ 手动录入」按包装上的营养表填写。');
          return;
        }
        var item = offProductToFood(d.product);
        if (!item) { setCodeHint('查到了「' + esc(d.product.product_name || raw) + '」，但缺少热量数据，无法直接使用。'); return; }
        item.idx = FOODS.length;
        FOODS.push(item);
        BY_CODE[raw] = item;
        db.customFoods[raw] = item;
        save();
        selectFood(item);
        setCodeHint('✅ 已从 Open Food Facts 查到并<b>缓存到本机</b>（以后离线也能用）：' + esc(item.name) + '。数据来自 Open Food Facts（ODbL 1.0 / DbCL 1.0）。');
      })
      .catch(function () {
        setCodeHint('查询失败（需要联网）。条码查询失败时可以用「+ 手动录入」照着包装营养表填。');
      });
  }
  function saveFoodFromDb() {
    if (!selectedFood) { alert('请先选择一种食物'); return; }
    var amt = n($('#fgrams').value);
    var isServing = selectedFood.unit === 'serving';
    var brand = selectedFood.brand || '';
    db.entries.push({
      id: uid(), type: 'food', date: date, meal: $('#fmeal').value,
      name: selectedFood.name + (brand && selectedFood.name.indexOf(brand) < 0 ? '（' + brand + '）' : ''),
      grams: (!isServing && amt > 0) ? amt : null,
      servings: isServing ? amt : null,
      unit: selectedFood.unit || '100g',
      servingLabel: selectedFood.serving || '',
      kcal: n($('#fKcal').value), c: n($('#fC').value), p: n($('#fP').value), f: n($('#fF').value),
      time: $('#ftime').value || nowTime(), created: Date.now(), src: selectedFood.src || 'db'
    });
    $('#foodDlg').close(); commit();
  }
  var editingFoodId = null;
  function openManual(item, meal) {
    editingFoodId = item ? item.id : null;
    $('#manualTitle').textContent = item ? '编辑食物记录' : '手动录入食物';
    $('#mName').value = item ? (item.name || '') : '';
    $('#mMeal').value = item ? (item.meal || 'lunch') : (meal || 'lunch');
    $('#mGrams').value = item && item.grams ? item.grams : '';
    $('#mTime').value = item ? (item.time || nowTime()) : nowTime();
    $('#mKcal').value = item ? r0(item.kcal) : '';
    $('#mC').value = item ? r1(item.c) : '';
    $('#mP').value = item ? r1(item.p) : '';
    $('#mF').value = item ? r1(item.f) : '';
    $('#manualDlg').showModal();
  }
  function saveManual() {
    var name = $('#mName').value.trim();
    if (!name) { alert('请填写名称'); return; }
    var kcal = $('#mKcal').value === '' ? null : n($('#mKcal').value);
    var c = n($('#mC').value), p = n($('#mP').value), f = n($('#mF').value);
    if (kcal == null || (kcal === 0 && (c || p || f))) kcal = r0(c * 4 + p * 4 + f * 9);
    var entry = {
      id: editingFoodId || uid(), type: 'food', date: date, meal: $('#mMeal').value, name: name,
      grams: n($('#mGrams').value) > 0 ? n($('#mGrams').value) : null,
      kcal: kcal, c: c, p: p, f: f, time: $('#mTime').value || nowTime(), created: Date.now(), src: 'manual'
    };
    if (editingFoodId) {
      var old = db.entries.filter(function (x) { return x.id === editingFoodId; })[0];
      if (old) entry.created = old.created;
      db.entries = db.entries.map(function (x) { return x.id === editingFoodId ? entry : x; });
    } else {
      db.entries.push(entry);
    }
    editingFoodId = null;
    $('#manualDlg').close(); commit();
  }
  var editingEntry = null, entryType = 'water';
  function openEntry(type, item) {
    editingEntry = item || null;
    entryType = type;
    var unit = { water: ['饮水量（毫升）', '饮水'], weight: ['体重（公斤）', '体重'], rest: ['时长（小时）', '休息'] }[type];
    $('#entryTitle').textContent = (item ? '编辑' : '记录') + unit[1];
    var nameField = '';
    if (type === 'rest') {
      nameField = '<label>类型<select name="name">' + ['睡眠', '午休', '其他休息'].map(function (t) {
        return '<option' + (item && item.name === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select></label>';
    }
    $('#entryFields').innerHTML = nameField +
      '<label>' + unit[0] + '<input name="value" type="number" min="0.1" step="0.1" required value="' + (item ? n(item.value) : '') + '"></label>' +
      '<label>时间<input name="time" type="time" required value="' + esc(item && item.time ? item.time : nowTime()) + '"></label>';
    $('#entryDlg').showModal();
  }
  function saveEntry(e) {
    e.preventDefault();
    var f = new FormData(e.currentTarget);
    var type = editingEntry ? editingEntry.type : entryType;
    var entry = {
      id: editingEntry ? editingEntry.id : uid(), type: type, date: date,
      name: String(f.get('name') || ({ water: '饮水', weight: '体重', rest: '睡眠' }[type])),
      value: n(f.get('value')), time: String(f.get('time')), created: editingEntry ? editingEntry.created : Date.now()
    };
    if (editingEntry) db.entries = db.entries.map(function (x) { return x.id === editingEntry.id ? entry : x; });
    else db.entries.push(entry);
    editingEntry = null;
    $('#entryDlg').close(); commit();
  }
  function doExport() {
    var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = '健康日记-' + today() + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function doImport(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { alert('文件不是有效的 JSON。'); return; }
      var looksV2 = data && data.goals && data.goals.kcal != null;
      var looksV1 = data && data.goals && data.goals.cal != null;
      if (!data || !Array.isArray(data.entries) || (!looksV2 && !looksV1)) { alert('文件格式无效：缺少 goals / entries。'); return; }
      if (!confirm('导入会替换当前全部记录与目标，确定继续吗？')) return;
      db = looksV2 ? normalize(data) : normalize(migrateV1(data));
      commit();
    };
    reader.readAsText(file);
    e.target.value = '';
  }
  function copySummary() {
    var t = totals(date), tg = macroTargetGrams();
    var text = '【健康日记】' + date + '\n' +
      '热量 ' + r0(t.kcal) + '/' + r0(db.goals.kcal) + ' 千卡\n' +
      '碳水 ' + r1(t.c) + ' g（目标 ' + tg.c + '） 蛋白质 ' + r1(t.p) + ' g（目标 ' + tg.p + '） 脂肪 ' + r1(t.f) + ' g（目标 ' + tg.f + '）\n' +
      '饮水 ' + r0(t.water) + '/' + r0(db.goals.water) + ' 毫升，休息 ' + r1(t.rest) + '/' + r1(db.goals.rest) + ' 小时';
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('已复制当日摘要到剪贴板：\n\n' + text); }
    catch (err) { alert(text); }
    document.body.removeChild(ta);
  }

  function renderStorage() {
    var el = $('#storageInfo');
    if (!el) return;
    el.textContent = '本次数据来源：' + bootInfo.source +
      '；存储后端：' + storageInfo.backend +
      '；localStorage 镜像：' + (storageInfo.mirrored ? '已写入' : '未写入') +
      '；记录 ' + db.entries.length + ' 条。';
  }

  /* ===================== 初始化 ===================== */
  function initSelects() {
    var cftc = CATS.filter(function (c) { return c.indexOf('包装食品') !== 0 && ['奶茶 / 茶饮', '酒类', '甜品 / 小吃', '便利店常见食品', '外卖 / 快餐', '中式外卖常见菜品（估算）', '超市常见食品', '乳制品 / 蛋白补充', '品牌食品'].indexOf(c) < 0; });
    var packed = CATS.filter(function (c) { return cftc.indexOf(c) < 0; });
    $('#fcat').innerHTML = '<option value="*">全部分类</option>' +
      '<optgroup label="中国食物成分表（每 100 克）">' + cftc.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</optgroup>' +
      (packed.length ? '<optgroup label="包装 · 品牌食品（含条码 / 每份）">' + packed.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</optgroup>' : '');
    $('#fmeal').innerHTML = MEALS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('');
    $('#mMeal').innerHTML = MEALS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('');
    $('#bFormula').innerHTML = FORMULAS.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('');
    $('#bActivity').innerHTML = ACTIVITY.map(function (a) { return '<option value="' + a[0] + '">' + a[1] + '</option>'; }).join('');
    $('#dbInfo').textContent = '食物库 ' + FOODS.length + ' 条 · ' + CATS.length + ' 个分类';
    var offEl = $('#packOffCount'), brEl = $('#packBrandCount');
    if (offEl) offEl.textContent = (PACK.off || []).length;
    if (brEl) brEl.textContent = (PACK.brand || []).length;
    $('#foodDbInfo').textContent = '已内置 ' + FOODS.length + ' 种食物（' + CATS.length + ' 个分类），营养值为每 100 克可食部：热量、碳水化合物、蛋白质、脂肪、膳食纤维。支持按名称搜索与按分类浏览。';
    renderStorage();
  }

  /* 断食倒计时：只更新文字，避免整页重绘打断输入（实现见「断食计时」小节） */

  var bootInfo = { source: 'new' };
  db = normalize(null);
  HDWorkout.create({ today: today, save: save, esc: esc, n: n, uid: uid });
  HDWorkout.attach(db.workout);
  HDWorkout.bind(document);
  HDExtras.bind(document);
  HDMoney.create({ today: today, save: save, entries: function () { return db.entries; } }); HDMoney.bind(document);
  initSelects();
  bind();
  boot().then(function (source) {
    restoreCustomFoods();
    render();
    renderStorage();
    bootInfo.source = source;
    setInterval(tickFasting, 15000);
    try { console.log('[健康日记] 数据来源：' + source + '，存储：' + storageInfo.backend); } catch (e) { }
    window.__hd.ready = true;
  });

  window.__hd = {
    get db() { return db; }, totals: totals, date: function () { return date; },
    search: searchFood, bmr: bmrValue, store: Store, storage: storageInfo, boot: function () { return bootInfo; },
    render: render, save: save, plans: HD_PLANS, workout: HDWorkout, extras: HDExtras, money: HDMoney, foods: FOODS, cats: CATS,
    today: today,
    ready: false
  };
})();
