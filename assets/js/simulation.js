/* ==========================================================================
   FRESCAN — simulation interactive (v2)
   - Le scanner sur la porte du frigo, un frigo qui s'ouvre (étagères en direct)
   - L'application FRESCAN complète, identique à la présentation :
     Accueil · Frigo · Recettes (Chef + mode cuisine) · Courses · Alertes · Impact
   - Dynamic Island pendant le scan, écran verrouillé chaque matin, démo auto
   Tous les textes passent par window.I18N (fr · en · ar).
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const productsEl = $('#simProducts');
  if (!productsEl) return;
  const device = $('#simDevice'), screen = $('#simScreen'), led = $('#simLed'), beam = $('#simBeam'), app = $('#simApp');
  const island = app.parentElement.querySelector('.phone-island');
  const fridge = $('#simFridge'), interior = $('#simInterior');
  const doorBtn = $('#simDoorBtn'), demoBtn = $('#simDemo'), nextBtn = $('#simNextDay'), resetBtn = $('#simReset');
  const dayLabel = $('#simDayLabel'), statTracked = $('#statTracked'), statSaved = $('#statSaved'), statWasted = $('#statWasted');
  const simEl = $('#sim'), modeBtns = [...document.querySelectorAll('.sim-mode')];
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const I18N = window.I18N;
  const t = I18N.t;

  /* ---------- données (les noms viennent des traductions) ---------- */
  const PRODUCTS = [
    { id: 'lait', e: '🥛', life: 6, price: 7.5, kg: 1.03, cat: 'dairy', zone: 'top' },
    { id: 'tomates', e: '🍅', life: 5, price: 9, kg: .6, cat: 'veg', zone: 'drawer' },
    { id: 'oeufs', e: '🥚', life: 14, price: 9, kg: .36, cat: 'dairy', zone: 'top' },
    { id: 'comte', e: '🧀', life: 12, price: 60, kg: .2, cat: 'dairy', zone: 'top' },
    { id: 'salade', e: '🥬', life: 3, price: 5, kg: .3, cat: 'veg', zone: 'drawer' },
    { id: 'poulet', e: '🍗', life: 3, price: 35, kg: .3, cat: 'prot', zone: 'mid' },
    { id: 'fraises', e: '🍓', life: 3, price: 12, kg: .25, cat: 'veg', zone: 'mid' },
    { id: 'carottes', e: '🥕', life: 10, price: 5, kg: 1, cat: 'veg', zone: 'drawer' },
    { id: 'saumon', e: '🐟', life: 2, price: 90, kg: .25, cat: 'prot', zone: 'mid' },
    { id: 'beurre', e: '🧈', life: 30, price: 25, kg: .25, cat: 'dairy', zone: 'top' },
    { id: 'avocat', e: '🥑', life: 4, price: 16, kg: .4, cat: 'veg', zone: 'mid' },
    { id: 'champi', e: '🍄', life: 4, price: 15, kg: .25, cat: 'veg', zone: 'drawer' },
  ];
  /* Recettes : ingrédients du frigo avec quantités (pour `serves` personnes),
     produits de placard supposés disponibles, minuteur (minutes) de chaque étape.
     Les noms et les étapes sont dans les traductions (I18N.recipe). */
  const RECIPES = [
    { id: 'omelette', e: '🍳', meals: ['breakfast', 'lunch', 'dinner'], time: 15, diff: 'easy', kcal: 380, veg: true, serves: 2, g: ['#FFE3AE', '#EF7D3B'],
      ing: [['oeufs', 4, 'pc'], ['comte', 60, 'g'], ['tomates', 2, 'pc'], ['lait', 50, 'ml']], pantry: ['salt', 'oil'], timers: [0, 0, 6, 0] },
    { id: 'quiche', e: '🥧', meals: ['lunch', 'dinner'], time: 45, diff: 'medium', kcal: 520, veg: true, serves: 4, g: ['#FFEFC9', '#D98A2B'],
      ing: [['oeufs', 3, 'pc'], ['lait', 250, 'ml'], ['champi', 250, 'g'], ['comte', 100, 'g'], ['beurre', 75, 'g']], pantry: ['flour', 'salt'], timers: [0, 5, 0, 30] },
    { id: 'salade', e: '🥗', meals: ['lunch', 'dinner'], time: 10, diff: 'easy', kcal: 290, veg: true, serves: 2, g: ['#DDF7CF', '#43A047'],
      ing: [['salade', 1, 'pc'], ['tomates', 3, 'pc'], ['avocat', 1, 'pc']], pantry: ['oil', 'lemon', 'salt'], timers: [0, 0, 0] },
    { id: 'poulet', e: '🍗', meals: ['dinner', 'lunch'], time: 40, diff: 'medium', kcal: 450, veg: false, serves: 2, g: ['#FFDDBA', '#D7612A'],
      ing: [['poulet', 2, 'pc'], ['carottes', 500, 'g'], ['beurre', 30, 'g']], pantry: ['garlic', 'spices', 'salt'], timers: [0, 0, 30, 0] },
    { id: 'saumon', e: '🐟', meals: ['dinner', 'lunch'], time: 25, diff: 'easy', kcal: 410, veg: false, serves: 2, g: ['#FFD9CF', '#E0664F'],
      ing: [['saumon', 2, 'pc'], ['carottes', 200, 'g'], ['champi', 150, 'g']], pantry: ['lemon', 'oil', 'salt'], timers: [0, 0, 18] },
    { id: 'guac', e: '🥑', meals: ['snack', 'lunch'], time: 10, diff: 'easy', kcal: 220, veg: true, serves: 2, g: ['#E3F6CB', '#5C9E31'],
      ing: [['avocat', 2, 'pc'], ['tomates', 1, 'pc']], pantry: ['onion', 'lemon', 'salt', 'bread'], timers: [0, 0, 0] },
    { id: 'smoothie', e: '🥤', meals: ['breakfast', 'snack'], time: 5, diff: 'easy', kcal: 180, veg: true, serves: 2, g: ['#FFD6E2', '#E2456F'],
      ing: [['fraises', 250, 'g'], ['lait', 300, 'ml']], pantry: ['honey'], timers: [0, 0, 0] },
    { id: 'veloute', e: '🥕', meals: ['dinner', 'lunch'], time: 30, diff: 'easy', kcal: 210, veg: true, serves: 4, g: ['#FFE3BD', '#EE8A23'],
      ing: [['carottes', 600, 'g'], ['lait', 200, 'ml'], ['beurre', 20, 'g']], pantry: ['onion', 'stock'], timers: [0, 0, 20, 0] },
    { id: 'poelee', e: '🍄', meals: ['dinner', 'lunch'], time: 20, diff: 'easy', kcal: 390, veg: false, serves: 2, g: ['#EFE1CF', '#9C6B3E'],
      ing: [['poulet', 2, 'pc'], ['champi', 250, 'g'], ['beurre', 20, 'g']], pantry: ['garlic', 'salt'], timers: [0, 5, 8] },
    { id: 'pates', e: '🍝', meals: ['dinner', 'lunch'], time: 20, diff: 'easy', kcal: 610, veg: false, serves: 2, g: ['#FFE9C7', '#E07A3F'],
      ing: [['saumon', 1, 'pc'], ['lait', 200, 'ml'], ['comte', 50, 'g']], pantry: ['pasta', 'garlic', 'salt'], timers: [10, 0, 3, 0] },
    { id: 'risotto', e: '🍚', meals: ['dinner'], time: 35, diff: 'medium', kcal: 520, veg: true, serves: 2, g: ['#F3E7D3', '#B08850'],
      ing: [['champi', 250, 'g'], ['beurre', 30, 'g'], ['comte', 40, 'g']], pantry: ['rice', 'onion', 'stock'], timers: [0, 18, 0, 0] },
    { id: 'crepes', e: '🥞', meals: ['breakfast', 'snack'], time: 30, diff: 'easy', kcal: 340, veg: true, serves: 4, g: ['#FFE1EA', '#E86A92'],
      ing: [['oeufs', 2, 'pc'], ['lait', 500, 'ml'], ['fraises', 250, 'g'], ['beurre', 30, 'g']], pantry: ['flour', 'sugar'], timers: [0, 10, 0, 0] },
    { id: 'toast', e: '🍞', meals: ['breakfast', 'lunch'], time: 10, diff: 'easy', kcal: 360, veg: true, serves: 2, g: ['#E4F5D0', '#7AAE3F'],
      ing: [['avocat', 1, 'pc'], ['oeufs', 2, 'pc'], ['tomates', 1, 'pc']], pantry: ['bread', 'salt'], timers: [0, 0, 4] },
    { id: 'cesar', e: '🥙', meals: ['lunch', 'dinner'], time: 20, diff: 'easy', kcal: 430, veg: false, serves: 2, g: ['#E6F4D8', '#4F9A3A'],
      ing: [['poulet', 2, 'pc'], ['salade', 1, 'pc'], ['comte', 30, 'g'], ['oeufs', 1, 'pc']], pantry: ['bread', 'oil', 'lemon'], timers: [10, 0, 0, 0] },
    { id: 'bowl', e: '🍣', meals: ['lunch', 'dinner'], time: 25, diff: 'easy', kcal: 560, veg: false, serves: 2, g: ['#FFE0D6', '#E46A57'],
      ing: [['saumon', 1, 'pc'], ['avocat', 1, 'pc'], ['carottes', 150, 'g']], pantry: ['rice', 'lemon'], timers: [15, 0, 0] },
    { id: 'cocotte', e: '🥘', meals: ['breakfast', 'dinner'], time: 20, diff: 'easy', kcal: 290, veg: true, serves: 2, g: ['#FFF0CF', '#C9913B'],
      ing: [['oeufs', 2, 'pc'], ['champi', 100, 'g'], ['lait', 60, 'ml'], ['comte', 30, 'g']], pantry: ['salt', 'bread'], timers: [0, 0, 10] },
  ].map((r) => ({ ...r, need: r.ing.map((i) => i[0]) }));

  /* ---------- FRESCAN+ : abonnements ----------
     Valeurs nutritionnelles par portion : p protéines, c glucides, f lipides (g),
     gi index glycémique (low/mid/high), kid recette appréciée des enfants. */
  const NUTRI = {
    omelette: { p: 24, c: 6, f: 28, gi: 'low', kid: true }, quiche: { p: 21, c: 30, f: 35, gi: 'mid', kid: true },
    salade: { p: 5, c: 14, f: 24, gi: 'low', kid: false }, poulet: { p: 38, c: 18, f: 22, gi: 'low', kid: true },
    saumon: { p: 32, c: 10, f: 26, gi: 'low', kid: false }, guac: { p: 3, c: 16, f: 16, gi: 'low', kid: false },
    smoothie: { p: 7, c: 28, f: 5, gi: 'mid', kid: true }, veloute: { p: 6, c: 22, f: 10, gi: 'mid', kid: true },
    poelee: { p: 35, c: 6, f: 24, gi: 'low', kid: true }, pates: { p: 34, c: 68, f: 22, gi: 'mid', kid: true },
    risotto: { p: 16, c: 70, f: 18, gi: 'high', kid: false }, crepes: { p: 11, c: 48, f: 12, gi: 'high', kid: true },
    toast: { p: 15, c: 30, f: 20, gi: 'mid', kid: false }, cesar: { p: 36, c: 18, f: 24, gi: 'low', kid: false },
    bowl: { p: 30, c: 62, f: 20, gi: 'mid', kid: false }, cocotte: { p: 18, c: 12, f: 19, gi: 'low', kid: true },
  };
  const PRODUCT_ALLERGENS = { lait: ['lactose'], comte: ['lactose'], beurre: ['lactose'], oeufs: ['egg'], saumon: ['fish'] };
  const PANTRY_ALLERGENS = { flour: ['gluten'], bread: ['gluten'], pasta: ['gluten'] };
  const ALLERGENS = ['gluten', 'lactose', 'egg', 'fish'];
  RECIPES.forEach((r) => {
    Object.assign(r, NUTRI[r.id]);
    r.allergens = [...new Set([...r.need.flatMap((id) => PRODUCT_ALLERGENS[id] || []), ...r.pantry.flatMap((p) => PANTRY_ALLERGENS[p] || [])])];
  });
  // Prix en dirhams (MAD) : [mensuel, annuel]. « premium » inclut tous les programmes.
  const PLANS = [
    { id: 'premium', e: '👑', price: [79, 669], c: ['#FFC94D', '#0B3A6E'] },
    { id: 'fitness', e: '💪', price: [39, 329], c: ['#FF9A5A', '#E0483C'] },
    { id: 'diabetes', e: '🩺', price: [49, 409], c: ['#4CC3F7', '#0E6F8F'] },
    { id: 'allergy', e: '🛡️', price: [29, 249], c: ['#5BDB8C', '#168A47'] },
    { id: 'family', e: '👨‍👩‍👧', price: [39, 329], c: ['#C98BFA', '#7240D6'] },
  ];
  const planById = Object.fromEntries(PLANS.map((p) => [p.id, p]));
  const GOALS = { protein: 120, carbs: 180 }; // objectifs quotidiens (g)
  const PANTRY_EMOJI = { oil: '🫒', salt: '🧂', flour: '🌾', sugar: '🍬', pasta: '🍝', rice: '🍚', bread: '🥖', garlic: '🧄', onion: '🧅', honey: '🍯', stock: '🍲', spices: '🌶️', lemon: '🍋' };
  // Moment de la journée → type de repas (influence les suggestions)
  const mealOf = (min) => (min < 10.5 * 60 ? 'breakfast' : min < 15 * 60 ? 'lunch' : min < 17.5 * 60 ? 'snack' : 'dinner');
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const name = (id) => I18N.product(id).n;
  const full = (id) => I18N.product(id).full;
  const qty = (id) => I18N.product(id).q;

  const money = (n) => I18N.price(n);
  const kgTxt = (v) => t('sapp.kg', { v: I18N.num(v, v < 10 ? 1 : 0) });
  const dateFor = (day) => { const d = new Date(); d.setDate(d.getDate() + day - 1); return d; };
  const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? Math.min(ms, 200) : ms));
  const ICON = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  function fmtTime(min) {
    const d = new Date();
    d.setHours(Math.floor(min / 60) % 24, min % 60, 0, 0);
    return d.toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- état ---------- */
  let state;
  let lastScreen = ['idle'];
  let renderedView = null;
  let demoRun = 0;
  function initialState() {
    return {
      day: 1, minutes: nowMinutes(), uid: 3,
      inv: [
        { uid: 1, id: 'beurre', added: 1, exp: 25 },
        { uid: 2, id: 'carottes', added: 1, exp: 7 },
      ],
      saved: 0, wasted: 0, savedKg: 0, savedItems: 0, cooked: 0,
      days: { 1: { saved: 0, wasted: 0 } },
      finished: [], extra: {}, checked: new Set(),
      alerts: [], unread: 0,
      view: 'home', query: '', cat: 'all', chefFilter: 'smart', recipe: null, servings: null,
      busy: false, demo: false, lastNew: null, shelfNew: null, prevScore: null, doorOpen: false, queue: [], mode: 'in',
      subs: new Set(), billing: 'month', allergens: new Set(['gluten']), nutri: {},
    };
  }
  // Un programme est actif s'il a été souscrit, ou si l'offre Premium l'est
  const has = (plan) => state.subs.has(plan) || state.subs.has('premium');
  const anyPlus = () => state.subs.size > 0;
  const today = () => (state.nutri[state.day] = state.nutri[state.day] || { p: 0, c: 0, kcal: 0 });
  const clock = () => fmtTime(state.minutes);
  const active = () => state.inv.filter((i) => !i.expired);
  const daysLeft = (it) => it.exp - state.day;
  const dayStat = () => (state.days[state.day] = state.days[state.day] || { saved: 0, wasted: 0 });
  const minDays = (id) => Math.min(...active().filter((i) => i.id === id).map(daysLeft));

  function freshness() {
    const act = active();
    if (!state.inv.length) return 100;
    const sum = act.reduce((s, it) => s + Math.max(0, Math.min(1, daysLeft(it) / Math.min(byId[it.id].life, 7))), 0);
    return Math.round((sum / state.inv.length) * 100);
  }

  /* ---------- produits (courses) ---------- */
  function renderProducts() {
    productsEl.innerHTML = PRODUCTS.map((p) =>
      `<button class="prod" type="button" data-id="${p.id}" aria-label="${t('sim.scanAria', { p: full(p.id) })}">
        <span class="prod-emoji">${p.e}</span><span class="prod-name">${name(p.id)}</span><span class="prod-meta">${qty(p.id)} · ${t('dshort', { n: p.life })}</span>
      </button>`).join('');
    updateCounts();
  }
  function updateCounts() {
    productsEl.querySelectorAll('.prod').forEach((btn) => {
      const c = active().filter((i) => i.id === btn.dataset.id).length;
      let badge = btn.querySelector('.prod-count');
      if (c && !badge) { badge = document.createElement('span'); badge.className = 'prod-count'; btn.appendChild(badge); }
      if (badge) { if (c) badge.textContent = c; else badge.remove(); }
    });
  }

  /* ---------- écran du scanner ---------- */
  function renderScreen(mode, p, days) {
    lastScreen = [mode, p, days];
    const out = state.mode === 'out';
    const chip = `<b class="ss-chip ${out ? 'ss-chip--out' : ''}">${out ? 'OUT' : 'IN'}</b>`;
    const top = (dot, label, withChip) => `<div class="ss-top"><span><i class="ss-dot ${dot}"></i>${label}${withChip ? chip : ''}</span><span class="ss-time">${clock()}</span></div>`;
    if (mode === 'removed') {
      // days = nombre d'unités restantes au frigo
      const n = name(p.id);
      screen.innerHTML = `<div class="ss ss--out">${top('ss-dot--out', t('scr.removedTop'))}
        <div class="ss-main">
          <div class="ss-tile">${p.e}</div>
          <div class="ss-info"><b class="${n.length > 8 ? 'is-long' : ''}">${n}</b><small>${qty(p.id)}</small><em>${t('scr.left')}</em><strong class="c-out">${days ? t('scr.leftN', { n: days }) : t('scr.leftNone')}</strong></div>
          <div class="ss-side"><span class="ss-badge ss-badge--out">− ${t('scr.removed')}</span></div>
        </div>
        <div class="ss-foot">${days ? t('scr.synced') : t('scr.toList')}</div></div>`;
    } else if (mode === 'absent') {
      screen.innerHTML = `<div class="ss ss--out">${top('ss-dot--warn', t('scr.absentTop'))}
        <div class="ss-center"><p class="ss-alert-emo">${p.e}</p>
        <p>${t('scr.absent')}</p><small>${t('scr.absentSub')}</small></div></div>`;
    } else if (mode === 'result') {
      const cls = days <= 1 ? 'c-red' : days <= 2 ? 'c-orange' : '';
      const on = Math.max(1, Math.min(7, days));
      const dlc = dateFor(state.day + days).toLocaleDateString(I18N.locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
      const n = name(p.id);
      screen.innerHTML = `<div class="ss">${top('', t('scr.recognized'))}
        <div class="ss-main">
          <div class="ss-tile">${p.e}</div>
          <div class="ss-info"><b class="${n.length > 8 ? 'is-long' : ''}">${n}</b><small>${qty(p.id)}</small><em>${t('scr.expiresIn')}</em><strong class="${cls}">${t('days', { n: days })}</strong></div>
          <div class="ss-side"><span class="ss-badge">✓ ${t('scr.saved')}</span><small>${t('scr.dlc')} ${dlc}</small><span class="ss-segs ${cls}">${Array.from({ length: 7 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span></div>
        </div>
        <div class="ss-foot">${t('scr.synced')}</div></div>`;
    } else if (mode === 'scan') {
      screen.innerHTML = `<div class="ss ${out ? 'ss--out' : ''}">${top('ss-dot--blue', t('scr.scanning'), true)}
        <div class="ss-center"><div class="ss-frame"><i></i><i></i><i></i><i></i><span class="ss-barcode"></span><span class="ss-laser"></span></div>
        <p>${t('scr.reading')}</p><small>${t('scr.readingSub')}</small></div></div>`;
    } else if (mode === 'alert') {
      screen.innerHTML = `<div class="ss">${top('ss-dot--warn', t('scr.reminder'))}
        <div class="ss-center"><p class="ss-alert-emo">${p.map((x) => x.e).join(' ')}</p>
        <p>${t('scr.toEat', { n: p.length })}</p><small>${t('scr.toEatSub')}</small></div></div>`;
    } else {
      screen.innerHTML = `<div class="ss ${out ? 'ss--out' : ''}">${top('ss-dot--idle', t('scr.ready'), true)}
        <div class="ss-center"><div class="ss-frame"><i></i><i></i><i></i><i></i></div>
        <p>${t(out ? 'scr.approachOut' : 'scr.approach')}</p><small>${t(out ? 'scr.approachOutSub' : 'scr.approachSub')}</small></div></div>`;
    }
  }

  /* ---------- boutons IN / OUT de l'appareil ---------- */
  function renderMode() {
    const out = state.mode === 'out';
    simEl.classList.toggle('is-out', out);
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === state.mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    productsEl.querySelectorAll('.prod').forEach((b) => b.setAttribute('aria-label', t(out ? 'sim.removeAria' : 'sim.scanAria', { p: full(b.dataset.id) })));
  }
  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    // les produits en attente visaient l'autre mode : on les annule
    state.queue = [];
    markQueued();
    renderMode();
    if (!state.busy) renderScreen('idle');
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => { if (!state.demo) setMode(b.dataset.mode); }));

  /* ---------- étagères du frigo ---------- */
  const shelfEls = {
    top: interior.querySelector('[data-zone="top"]'),
    mid: interior.querySelector('[data-zone="mid"]'),
    drawer: interior.querySelector('[data-zone="drawer"]'),
  };
  function renderShelves() {
    const zones = { top: [], mid: [], drawer: [] };
    state.inv.slice().sort((a, b) => a.uid - b.uid).forEach((it) => zones[byId[it.id].zone].push(it));
    for (const z in zones) {
      shelfEls[z].innerHTML = zones[z].map((it) => {
        const dl = daysLeft(it);
        const cls = it.expired ? 'is-expired' : dl <= 1 ? 'is-red' : dl <= 2 ? 'is-orange' : 'is-green';
        const tag = it.expired ? '✕' : dl <= 0 ? '!' : t('dshort', { n: dl });
        return `<button type="button" class="shelf-item ${cls} ${it.uid === state.shelfNew ? 'is-new' : ''}" data-uid="${it.uid}" title="${esc(full(it.id))}" aria-label="${esc(full(it.id))}"><span>${byId[it.id].e}</span><i>${tag}</i></button>`;
      }).join('');
    }
    state.shelfNew = null;
  }
  interior.addEventListener('click', async (e) => {
    const b = e.target.closest('.shelf-item');
    if (!b || state.demo) return;
    b.classList.add('is-eaten');
    await wait(260);
    eatOrTrash(+b.dataset.uid);
  });

  function setDoor(open) {
    state.doorOpen = open;
    fridge.classList.toggle('is-open', open);
    setControls();
    return wait(open ? 900 : 750);
  }

  /* ---------- Dynamic Island ---------- */
  function islandScan() {
    island.innerHTML = `<span class="si-dot"></span><span class="si-text">${t('island.scanning')}</span><span class="si-bars"><i></i><i></i><i></i><i></i></span>`;
    island.classList.add('is-live');
  }
  function islandSaved(p, days) {
    island.innerHTML = `<span class="si-emo">${p.e}</span><span class="si-text">${name(p.id)} · ${t('scr.saved')}</span><span class="si-tag">${t('dshort', { n: days })}</span>`;
    island.classList.add('is-live', 'is-ok');
  }
  function islandRemoved(p) {
    island.innerHTML = `<span class="si-emo">${p.e}</span><span class="si-text">${name(p.id)} · ${t('scr.removed')}</span><span class="si-tag">OUT</span>`;
    island.classList.add('is-live');
  }
  function islandHide() {
    island.classList.remove('is-live', 'is-ok');
    setTimeout(() => { if (!island.classList.contains('is-live')) island.innerHTML = ''; }, 450);
  }

  /* ======================================================================
     Application (téléphone)
     ====================================================================== */
  function buildApp() {
    app.innerHTML = `
      <div class="app-status"><span id="simClock"></span><span class="app-status-ic">${ICON('i-wifi')}<i class="batt"></i></span></div>
      <div class="sim-notif" id="simNotif" role="status" aria-live="polite"></div>
      <div class="sapp-views" id="simViews"></div>
      <nav class="app-tabs sim-tabs" id="simTabs"></nav>
      <div class="sapp-cook" id="simCook" hidden></div>
      <div class="sapp-sheet" id="simSheet" hidden></div>
      <div class="sapp-lock app--lock" id="simLock" hidden></div>`;
    app.addEventListener('click', onAppClick);
    app.addEventListener('input', (e) => {
      if (e.target.id !== 'sappSearch') return;
      state.query = e.target.value;
      $('#sappList').innerHTML = fridgeList();
    });
    // Molette de souris : fait défiler horizontalement les « Autres idées »
    app.addEventListener('wheel', (e) => {
      const row = e.target.closest('.mini-recs');
      if (!row || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = row.scrollWidth - row.clientWidth;
      const pos = Math.abs(row.scrollLeft);
      if (max <= 0 || (e.deltaY > 0 && pos >= max - 1) || (e.deltaY < 0 && pos <= 0)) return;
      e.preventDefault();
      row.scrollLeft += e.deltaY * (I18N.dir === 'rtl' ? -1 : 1);
    }, { passive: false });
    app.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
    });
  }

  const TABS = [['home', 'i-home', 'sapp.tHome'], ['fridge', 'i-fridge', 'sapp.tFridge'], ['chef', 'i-chef', 'sapp.tChef'], ['shop', 'i-list', 'sapp.tShop'], ['plus', 'i-crown', 'sapp.tPlus']];
  const VIEWS = {};

  // animate : entrée complète (changement d'écran) · swap : simple fondu, retour en haut (changement de recette/filtre)
  function renderApp(animate, swap) {
    const v = state.view;
    const views = $('#simViews');
    const enter = animate || renderedView !== v;
    const old = views.firstElementChild;
    const scroll = !enter && !swap && old ? old.scrollTop : 0;
    const cls = enter && !REDUCED ? 'is-enter' : swap && !REDUCED ? 'is-swap' : '';
    views.innerHTML = `<div class="app-body sapp-view sapp-view--${v} ${cls}">${VIEWS[v]()}</div>`;
    if (!enter) views.firstElementChild.scrollTop = scroll;
    renderedView = v;
    const tabOf = { home: 'home', fridge: 'fridge', chef: 'chef', shop: 'shop', alerts: 'home', impact: 'home', plus: 'plus' }[v];
    const tabs = $('#simTabs');
    tabs.setAttribute('aria-label', t('app.tabsLabel'));
    tabs.innerHTML = TABS.map(([id, ic, key]) =>
      `<button type="button" data-nav="${id}" class="${tabOf === id ? 'on' : ''} ${id === 'plus' ? 'tab-plus' + (anyPlus() ? ' is-member' : '') : ''}" aria-pressed="${tabOf === id}">${ICON(ic)}${t(key)}${id === 'home' && state.unread && v !== 'alerts' ? `<b class="tab-badge">${state.unread}</b>` : ''}</button>`).join('');
    $('#simClock').textContent = clock();
    const ring = views.querySelector('.app-score .ring');
    if (ring) {
      const target = +ring.dataset.p;
      ring.style.setProperty('--p', state.prevScore == null ? 0 : state.prevScore);
      requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', target)));
      state.prevScore = target;
    }
    state.lastNew = null;
  }
  function go(view, extra) {
    state.view = view;
    if (view === 'alerts') state.unread = 0;
    if (extra) Object.assign(state, extra);
    renderApp(true);
  }

  /* ---------- Accueil ---------- */
  VIEWS.home = () => {
    const act = active(), n = act.length;
    const score = freshness();
    const level = !state.inv.length ? 'empty' : score >= 75 ? 'good' : score >= 45 ? 'watch' : 'bad';
    const soon = act.filter((i) => daysLeft(i) <= 3).sort((a, b) => a.exp - b.exp);
    const urgent = act.filter((i) => daysLeft(i) <= 2).length;
    const best = suggestions()[0];
    const cards = soon.slice(0, 3).map((it) => {
      const dl = daysLeft(it);
      const label = dl <= 0 ? t('sapp.today') : dl === 1 ? t('sapp.tomorrow') : t('days', { n: dl });
      return `<button type="button" class="app-card ${dl <= 1 ? 'app-card--red' : 'app-card--orange'}" data-nav="fridge"><span>${byId[it.id].e}</span><b>${name(it.id)}</b><i>${label}</i></button>`;
    }).join('');
    return `
      <div class="app-hello">
        <div><small>${t('sapp.hello')}</small><h4>${t('sapp.yourFridge')}</h4></div>
        <button type="button" class="sapp-bell" data-nav="alerts" aria-label="${t('app.alerts')}">${ICON('i-bell')}${state.unread ? `<b>${state.unread}</b>` : ''}</button>
      </div>
      <div class="app-score is-${level}">
        <div class="ring" data-p="${score}"><span>${score}<small>%</small></span></div>
        <div><strong>${t('sapp.health.' + level)}</strong><small>${t('sapp.tracked', { n })}<br>${t('sapp.urgentN', { n: urgent })}</small></div>
      </div>
      <div class="app-sec-title"><span>${t('sapp.soon')}</span><a data-nav="fridge" role="button" tabindex="0">${t('sapp.seeAll')}</a></div>
      ${cards ? `<div class="app-cards">${cards}</div>` : `<div class="sapp-allgood">${t('sapp.nothingUrgent')}</div>`}
      <div class="app-sec-title"><span>${t('sapp.thisMonth')}</span><a data-nav="impact" role="button" tabindex="0">${t('sapp.seeImpact')}</a></div>
      <button type="button" class="app-kpis" data-nav="impact">
        <div><strong>${money(state.saved)}</strong><small>${t('sapp.saved')}</small></div>
        <div><strong>${kgTxt(state.savedKg)}</strong><small>${t('sapp.rescued')}</small></div>
      </button>
      ${homePrograms()}
      ${best
        ? `<button type="button" class="app-suggest" data-nav="chef" data-pick="${best.idx}"><span>${best.e}</span><div><b>${t('meal.idea.' + mealOf(state.minutes), { r: I18N.recipe(best.id).n })}</b><small>${best.urgent.length ? t('why.saves', { list: listFmt(best.urgent.slice(0, 2).map((x) => name(x.id))) }) : t('sapp.uses', { n: best.got.length })} · ${timeLabel(best)}</small></div>${ICON('i-arrow', 'ic ic-dir')}</button>`
        : `<div class="app-suggest is-empty"><span>👩‍🍳</span><div><b>${t('sapp.noIdeaT')}</b><small>${t('sapp.noIdea')}</small></div></div>`}
      ${anyPlus() ? '' : plusTeaser('home')}`;
  };
  // Cartes des programmes actifs sur l'accueil (objectifs du jour, profil allergies)
  function homePrograms() {
    const d = today();
    const goal = (ic, label, v, max, cls) => `<div class="goal goal--${cls}">
      <div class="goal-top"><span>${ic} ${label}</span><b>${I18N.num(v)} / ${I18N.num(max)} ${t('unit.g')}</b></div>
      <span class="goal-bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span></div>`;
    const out = [];
    if (has('fitness')) out.push(goal('💪', t('home.proteinT'), d.p, GOALS.protein, 'protein'));
    if (has('diabetes')) out.push(goal('🩸', t('home.carbsT'), d.c, GOALS.carbs, 'carbs'));
    if (has('allergy')) out.push(`<div class="goal goal--allergy"><div class="goal-top"><span>🛡️ ${t('home.allergyT')}</span><b>${state.allergens.size ? listFmt([...state.allergens].map((a) => t('allergen.' + a))) : '—'}</b></div></div>`);
    if (has('family')) out.push(`<div class="goal goal--family"><div class="goal-top"><span>👨‍👩‍👧 ${t('home.familyT')}</span><b>${t('sapp.serves', { n: 4 })}</b></div></div>`);
    return out.length ? `<div class="app-sec-title"><span>👑 FRESCAN+</span><a data-nav="plus" role="button" tabindex="0">${t('home.manage')}</a></div><div class="goals">${out.join('')}</div>` : '';
  }

  /* ---------- Frigo (inventaire) ---------- */
  function tagFor(it) {
    const dl = daysLeft(it);
    if (it.expired) return ['tag-grey', t('app.tagExpired'), '#B9C3CF'];
    if (dl <= 0) return ['tag-red', t('app.tagToday'), 'var(--danger)'];
    if (dl === 1) return ['tag-red', t('dshort', { n: 1 }), 'var(--danger)'];
    if (dl === 2) return ['tag-orange', t('dshort', { n: 2 }), 'var(--warn)'];
    return ['tag-green', t('dshort', { n: dl }), 'var(--fresh)'];
  }
  function fridgeList() {
    if (!state.inv.length) return `<div class="sim-empty"><span>🧊</span>${t('app.emptyFridge')}</div>`;
    const q = norm(state.query.trim());
    const items = state.inv.slice().sort((a, b) => a.exp - b.exp).filter((it) =>
      (state.cat === 'all' || byId[it.id].cat === state.cat) && (!q || norm(full(it.id)).includes(q) || norm(name(it.id)).includes(q)));
    if (!items.length) return `<div class="sim-empty"><span>🔍</span>${t('sapp.noMatch')}</div>`;
    return `<ul class="app-list">${items.map((it) => {
      const p = byId[it.id];
      const [cls, label, color] = tagFor(it);
      const pct = it.expired ? 0 : Math.max(5, Math.min(100, (daysLeft(it) / p.life) * 100));
      const ago = state.day - it.added;
      return `<li class="${it.uid === state.lastNew ? 'is-new' : ''} ${it.expired ? 'is-expired' : ''}">
        <span class="app-emo">${p.e}</span>
        <div><b>${full(it.id)}</b><small>${qty(it.id)} · ${ago === 0 ? t('app.addedToday') : t('app.addedAgo', { n: ago })}</small><span class="life"><i style="width:${pct}%;background:${color}"></i></span></div>
        <i class="tag ${cls}">${label}</i>
        ${it.expired
          ? `<button class="sim-act sim-act--trash" data-act="${it.uid}" aria-label="${t('app.ariaTrash', { p: name(it.id) })}">${ICON('i-close')}</button>`
          : `<button class="sim-act" data-act="${it.uid}" aria-label="${t('app.ariaEat', { p: name(it.id) })}">${ICON('i-check')}</button>`}
      </li>`;
    }).join('')}</ul>`;
  }
  VIEWS.fridge = () => `
    <div class="app-title-row"><h4>${t('app.myFridge')}</h4><span class="app-count">${t('app.count', { n: active().length })}</span></div>
    <label class="app-search">${ICON('i-search')}<input type="search" id="sappSearch" value="${esc(state.query)}" placeholder="${esc(t('sapp.search'))}" aria-label="${esc(t('sapp.search'))}" autocomplete="off"></label>
    <div class="app-chips">${['all', 'dairy', 'veg', 'prot'].map((c) => `<button type="button" class="${state.cat === c ? 'on' : ''}" data-cat="${c}">${t('sapp.c.' + c)}</button>`).join('')}</div>
    <div id="sappList">${fridgeList()}</div>`;

  /* ---------- Recettes (Chef intelligent) ---------- */
  /* Chef intelligent : chaque recette reçoit un score.
     - couverture : part des ingrédients déjà dans le frigo
     - urgence    : produits qui expirent bientôt (aujourd'hui > demain > 2 j > 3 j)
     - valeur     : euros de nourriture sauvés
     - manquants  : pénalité par ingrédient à acheter
     - moment     : bonus si la recette correspond au repas (matin, midi, goûter, soir) */
  const URGENCY = (d) => (d <= 0 ? 5 : d === 1 ? 4 : d === 2 ? 3 : d === 3 ? 1.5 : 0);
  const timeLabel = (r) => t('sapp.min', { n: r.time });
  function recipeInfo(r, idx) {
    const have = new Set(active().map((i) => i.id));
    const got = r.need.filter((id) => have.has(id));
    const miss = r.need.filter((id) => !have.has(id));
    const coverage = got.length / r.need.length;
    const urgent = got.map((id) => ({ id, d: minDays(id) })).filter((x) => x.d <= 3).sort((a, b) => a.d - b.d);
    const urgency = got.reduce((s, id) => s + URGENCY(minDays(id)), 0);
    const value = got.reduce((s, id) => s + byId[id].price, 0);
    const mealFit = r.meals.includes(mealOf(state.minutes));
    // Programmes FRESCAN+ : ils réordonnent les suggestions selon le profil
    let plus = 0;
    if (has('fitness')) plus += r.p >= 25 ? 3 : r.p >= 18 ? 1.5 : 0;
    if (has('diabetes')) plus += r.gi === 'low' ? 3 : r.gi === 'high' ? -4 : 0;
    if (has('family') && r.kid) plus += 2.5;
    const blockedBy = has('allergy') ? r.allergens.filter((a) => state.allergens.has(a)) : [];
    const score = coverage * 10 + urgency * 2.2 + Math.min(value, 120) * .025 - miss.length * 2.5 + (mealFit ? 1.5 : 0) + (r.time <= 20 ? .5 : 0) + plus;
    return { ...r, idx, got, miss, coverage, urgent, urgency, value, mealFit, score, pct: Math.round(coverage * 100), blocked: blockedBy.length > 0, blockedBy };
  }
  // Recettes masquées par le programme Allergies
  const visible = () => RECIPES.map(recipeInfo).filter((r) => !r.blocked);
  const byScore = (a, b) => b.score - a.score;
  // Suggestions anti-gaspi : au moins la moitié des ingrédients déjà au frigo,
  // et d'abord les recettes adaptées au repas en cours (pas de pâtes au petit-déjeuner).
  const suggestions = () => visible().filter((r) => r.got.length && r.coverage >= .5)
    .sort((a, b) => (b.mealFit - a.mealFit) || byScore(a, b));
  // Produits qui expirent aujourd'hui ou demain et que la recette affichée n'utilise pas :
  // le Chef propose la meilleure recette pour les sauver (plus tard dans la journée).
  function rescuePlan(sel) {
    const urgent = [...new Set(active().filter((i) => daysLeft(i) <= 1).map((i) => i.id))]
      .filter((id) => !sel.need.includes(id))
      .sort((a, b) => minDays(a) - minDays(b));
    const all = visible().filter((r) => r.idx !== sel.idx && r.coverage >= .5);
    const plan = [];
    for (const id of urgent) {
      const r = all.filter((x) => x.need.includes(id)).sort(byScore)[0];
      if (!r) continue;
      const same = plan.find((p) => p.r.idx === r.idx);
      if (same) same.ids.push(id); // une même recette sauve plusieurs produits
      else if (plan.length < 2) plan.push({ id, ids: [id], d: minDays(id), r });
    }
    return plan;
  }
  const byMeal = (a, b) => (b.mealFit - a.mealFit) || byScore(a, b);
  // Filtres disponibles : ceux des programmes actifs s'ajoutent
  function chefFilters() {
    const f = ['smart', 'quick', 'veg'];
    if (has('fitness')) f.push('protein');
    if (has('diabetes')) f.push('lowgi');
    if (has('family')) f.push('kids');
    return [...f, 'all'];
  }
  function chefList() {
    if (!chefFilters().includes(state.chefFilter)) state.chefFilter = 'smart';
    const all = visible();
    switch (state.chefFilter) {
      case 'quick': return all.filter((r) => r.time <= 20 && r.got.length).sort(byMeal);
      case 'veg': return all.filter((r) => r.veg && r.got.length).sort(byMeal);
      case 'protein': return all.filter((r) => r.p >= 25 && r.got.length).sort(byMeal);
      case 'lowgi': return all.filter((r) => r.gi === 'low' && r.got.length).sort(byMeal);
      case 'kids': return all.filter((r) => r.kid && r.got.length).sort(byMeal);
      case 'all': return all.sort(byScore);
      default: return suggestions();
    }
  }
  // « Poulet et Salade », « Chicken and Lettuce », « دجاج وخس »
  function listFmt(arr) {
    try { return new Intl.ListFormat(I18N.locale(), { style: 'long', type: 'conjunction' }).format(arr); } catch (_) { return arr.join(', '); }
  }
  function whenShort(d) { return d <= 0 ? t('when.today') : d === 1 ? t('when.tomorrow') : t('dshort', { n: d }); }
  // Pourquoi cette recette ? (raisons concrètes, triées par importance)
  function reasons(r) {
    const out = [];
    if (r.urgent.length) out.push(['⚡', t('why.saves', { list: listFmt(r.urgent.slice(0, 3).map((x) => `${name(x.id)} (${whenShort(x.d)})`)) }), 'urgent']);
    if (has('fitness') && r.p >= 18) out.push(['💪', t('why.protein', { n: r.p }), 'plus']);
    if (has('diabetes')) {
      if (r.gi === 'low') out.push(['🩸', t('why.lowgi', { n: r.c }), 'plus']);
      else if (r.gi === 'high') out.push(['⚠️', t('why.highgi', { n: r.c }), 'warn']);
    }
    if (has('family') && r.kid) out.push(['👶', t('why.kids'), 'plus']);
    if (has('allergy') && state.allergens.size) out.push(['🛡️', r.allergens.length ? t('why.safeFor', { list: listFmt([...state.allergens].map((a) => t('allergen.' + a))) }) : t('why.noAllergen'), 'plus']);
    if (!r.miss.length) out.push(['✅', t('why.all'), '']);
    else out.push(['🛒', t('why.missing', { list: listFmt(r.miss.map(name)) }), 'buy']);
    if (r.value >= 10) out.push(['💶', t('why.value', { v: money(r.value) }), '']);
    if (r.mealFit) out.push(['🕗', t('why.meal.' + mealOf(state.minutes)), '']);
    else if (r.time <= 20) out.push(['⏱', t('why.quick', { n: r.time }), '']);
    return out.slice(0, anyPlus() ? 5 : 4);
  }
  // Quantités adaptées au nombre de personnes
  const FRACTIONS = { .5: '½', .25: '¼', .75: '¾' };
  function fmtQty(q, unit, scale) {
    let v = q * scale;
    if (unit === 'pc') {
      v = Math.max(.5, Math.round(v * 2) / 2);
      const whole = Math.floor(v), frac = v - whole;
      return `×${whole ? I18N.num(whole) : ''}${FRACTIONS[frac] || ''}`;
    }
    v = Math.max(5, Math.round(v / (v >= 100 ? 10 : 5)) * (v >= 100 ? 10 : 5));
    return `${I18N.num(v)} ${t('unit.' + unit)}`;
  }
  // Programme Famille : portions pour 4 personnes par défaut
  function servings(r) { return state.servings || (has('family') ? Math.max(r.serves, 4) : r.serves); }

  VIEWS.chef = () => {
    const meal = mealOf(state.minutes);
    const list = chefList();
    const filters = chefFilters().map((f) =>
      `<button type="button" class="${state.chefFilter === f ? 'on' : ''} ${['protein', 'lowgi', 'kids'].includes(f) ? 'is-plus' : ''}" data-filter="${f}">${t('chef.f.' + f)}</button>`).join('');
    const hidden = has('allergy') ? RECIPES.map(recipeInfo).filter((r) => r.blocked) : [];
    const head = `
      <div class="app-title-row"><h4>${t('chef.title.' + meal)}</h4>${anyPlus() ? '<span class="plus-pill">👑 FRESCAN+</span>' : ''}</div>
      <div class="app-chips chef-filters">${filters}</div>
      ${hidden.length ? `<p class="allergy-note">🛡️ ${t('allergy.hidden', { n: hidden.length, list: listFmt([...state.allergens].map((a) => t('allergen.' + a))) })}</p>` : ''}`;
    if (!list.length) {
      const msg = state.chefFilter === 'smart' || !active().length ? t('app.emptyRecipes') : t('chef.noMatch');
      return head + `<div class="sim-empty"><span>👩‍🍳</span>${msg}</div>`;
    }
    const sel = list.find((r) => r.idx === state.recipe) || list[0];
    if (state.recipe !== sel.idx) state.servings = null;
    state.recipe = sel.idx;
    const rec = I18N.recipe(sel.id);
    const ready = !sel.miss.length;
    const n = servings(sel), scale = n / sel.serves;
    const ringC = sel.pct === 100 ? 'var(--fresh-bright)' : sel.pct >= 50 ? '#FFC24A' : '#FF8A8A';

    const fridgeRows = sel.ing.filter(([id]) => sel.got.includes(id)).map(([id, q, u]) => {
      const d = minDays(id);
      const cls = d <= 1 ? 'tag-red' : d <= 2 ? 'tag-orange' : 'tag-green';
      return `<li><span class="ing-emo">${byId[id].e}</span><span class="ing-name">${name(id)}</span><span class="ing-qty">${fmtQty(q, u, scale)}</span><i class="tag ${cls}">${whenShort(d)}</i></li>`;
    }).join('');
    const buyRows = sel.ing.filter(([id]) => sel.miss.includes(id)).map(([id, q, u]) =>
      `<li class="is-buy"><span class="ing-emo">${byId[id].e}</span><span class="ing-name">${name(id)}</span><span class="ing-qty">${fmtQty(q, u, scale)}</span><i class="tag tag-blue">${t('sapp.toBuy')}</i></li>`).join('');
    const pantry = sel.pantry.map((p) => `<span>${PANTRY_EMOJI[p]} ${I18N.pantry(p)}</span>`).join('');
    const why = reasons(sel).map(([ic, txt, cls]) => `<li class="${cls}"><span>${ic}</span>${txt}</li>`).join('');
    const plan = rescuePlan(sel).map((p) =>
      `<button type="button" class="chef-alert ${p.d <= 0 ? 'is-red' : ''}" data-pick="${p.r.idx}">
        <span>${byId[p.id].e}</span>
        <div><b>${t(p.d <= 0 ? 'chef.alertToday' : 'chef.alertTomorrow', { p: listFmt(p.ids.map(name)) })}</b><small>${t('chef.alertIdea', { r: I18N.recipe(p.r.id).n, t: timeLabel(p.r) })}</small></div>
        ${ICON('i-arrow', 'ic ic-dir')}</button>`).join('');
    const others = list.filter((r) => r.idx !== sel.idx).slice(0, 6).map((r) =>
      `<button type="button" class="mini-rec" data-pick="${r.idx}" style="--g1:${r.g[0]};--g2:${r.g[1]}">
        <span class="mini-emo">${r.e}</span>${r.urgent.length ? '<i class="mini-flag">⚡</i>' : ''}
        <b>${I18N.recipe(r.id).n}</b><small>${r.pct} % · ${timeLabel(r)}</small></button>`).join('');

    return head + `
      ${plan ? `<div class="chef-alerts">${plan}</div>` : ''}
      <div class="recipe-hero" style="--g1:${sel.g[0]};--g2:${sel.g[1]}">
        <span class="recipe-badge ${ready ? '' : 'is-miss'}">${t('chef.match', { n: sel.pct })}</span>
        ${sel.urgent.length ? `<span class="recipe-flag">${t('chef.rescues', { n: sel.urgent.length })}</span>` : ''}
        <span class="recipe-emoji">${sel.e}</span>
        <span class="recipe-ring" style="--p:${sel.pct};--rc:${ringC}"><b>${sel.pct}%</b></span>
      </div>
      <h5 class="recipe-title">${rec.n}</h5>
      <div class="recipe-meta">
        <span>⏱ ${timeLabel(sel)}</span><span>👌 ${t('sapp.' + sel.diff)}</span><span>🔥 ${t('chef.kcal', { n: sel.kcal })}</span>
      </div>
      ${recipeTags(sel)}
      ${nutritionBlock(sel)}
      <div class="serv">
        <span>👥 ${t('sapp.serves', { n })}</span>
        <div class="serv-ctl"><button type="button" data-serv="-1" aria-label="${t('chef.less')}" ${n <= 1 ? 'disabled' : ''}>−</button><b>${n}</b><button type="button" data-serv="1" aria-label="${t('chef.more')}" ${n >= 8 ? 'disabled' : ''}>+</button></div>
      </div>
      <div class="recipe-why"><b>${t('chef.why')}</b><ul>${why}</ul></div>
      ${fridgeRows ? `<div class="app-sec-title">${t('chef.inFridge')}</div><ul class="ing-list">${fridgeRows}</ul>` : ''}
      ${buyRows ? `<div class="app-sec-title">${t('chef.toBuy')}</div><ul class="ing-list">${buyRows}</ul>` : ''}
      <div class="app-sec-title">${t('chef.pantry')}</div>
      <div class="pantry">${pantry}</div>
      ${ready
        ? `<button type="button" class="app-btn" data-cook>${ICON('i-chef')}${t('sapp.cookStep')}</button>`
        : `<button type="button" class="app-btn app-btn--ghost" data-addmissing>${ICON('i-list')}${t('sapp.addMissing')}</button>`}
      ${others ? `<div class="app-sec-title">${t('sapp.otherIdeas')}</div><div class="mini-recs">${others}</div>` : ''}
      ${anyPlus() ? '' : plusTeaser('chef')}`;
  };

  // Badges de la recette (régime, enfants, protéines, IG)
  function recipeTags(r) {
    const tags = [];
    if (r.veg) tags.push(['veg', t('chef.veg')]);
    if (has('family') && r.kid) tags.push(['kids', t('badge.kids')]);
    if (has('fitness') && r.p >= 25) tags.push(['protein', t('badge.protein')]);
    if (has('diabetes')) tags.push([`gi-${r.gi}`, `🩸 ${t('gi.' + r.gi)}`]);
    return tags.length ? `<div class="recipe-tags">${tags.map(([c, l]) => `<span class="rtag rtag--${c}">${l}</span>`).join('')}</div>` : '';
  }
  // Valeurs nutritionnelles : réservées aux programmes Fitness et Diabète
  function nutritionBlock(r) {
    if (!has('fitness') && !has('diabetes')) {
      return `<button type="button" class="nutri-locked" data-nav="plus">
        <span class="nutri-blur" aria-hidden="true"><i>${r.p} g</i><i>${r.c} g</i><i>${r.f} g</i></span>
        <span class="nutri-lock">🔒 ${t('nutri.locked')}</span></button>`;
    }
    const cell = (k, v, max, hl) => `<div class="nutri-cell ${hl ? 'is-hl' : ''}"><b>${v}</b><small>${t('nutri.' + k)}</small><span class="nutri-bar"><i style="width:${Math.min(100, (parseFloat(v) / max) * 100)}%"></i></span></div>`;
    return `<div class="nutri">
      <div class="nutri-head">${t('nutri.title')}</div>
      <div class="nutri-grid">
        ${cell('kcal', r.kcal, 800, false)}
        ${cell('p', `${r.p} g`, 50, has('fitness'))}
        ${cell('c', `${r.c} g`, 80, has('diabetes'))}
        ${cell('f', `${r.f} g`, 45, false)}
      </div>
      ${has('diabetes') && r.gi === 'high' ? `<p class="gi-warn">⚠️ ${t('gi.warn')}</p>` : ''}
    </div>`;
  }
  // Encart de découverte FRESCAN+ (affiché tant qu'aucun abonnement n'est actif)
  function plusTeaser(where) {
    return `<button type="button" class="plus-teaser" data-nav="plus">
      <span class="plus-teaser-ic">👑</span>
      <div><b>${t(`teaser.${where}T`)}</b><small>${t(`teaser.${where}S`)}</small></div>
      <span class="plus-teaser-cta">${t('teaser.cta')}</span></button>`;
  }

  /* ---------- FRESCAN+ (abonnements) ---------- */
  const planName = (id) => t(`plan.${id}.n`);
  function priceLine(p) {
    const yearly = state.billing === 'year';
    const v = p.price[yearly ? 1 : 0];
    return {
      main: money(v),
      per: t(yearly ? 'plus.perYear' : 'plus.perMonth'),
      equiv: yearly ? t('plus.equiv', { v: money(v / 12) }) : '',
    };
  }
  VIEWS.plus = () => {
    const activeNames = PLANS.filter((p) => state.subs.has(p.id)).map((p) => planName(p.id));
    const cards = PLANS.map((p) => {
      const own = state.subs.has(p.id);
      const included = !own && p.id !== 'premium' && state.subs.has('premium');
      const pr = priceLine(p);
      const allergyCfg = p.id === 'allergy' && has('allergy')
        ? `<div class="plan-allergens"><small>${t('allergy.mine')}</small><div>${ALLERGENS.map((a) =>
          `<button type="button" class="${state.allergens.has(a) ? 'on' : ''}" data-allergen="${a}" aria-pressed="${state.allergens.has(a)}">${t('allergen.' + a)}</button>`).join('')}</div></div>`
        : '';
      const action = own
        ? `<div class="plan-actions"><span class="plan-on">${t('plus.activeBtn')}</span><button type="button" class="plan-cancel" data-unsub="${p.id}">${t('plus.cancel')}</button></div>`
        : included
          ? `<div class="plan-actions"><span class="plan-on">${t('plus.included')}</span></div>`
          : `<button type="button" class="plan-cta" data-sub="${p.id}">${t('plus.trial')}</button>`;
      return `<article class="plan-card ${p.id === 'premium' ? 'is-best' : ''} ${own || included ? 'is-active' : ''}" style="--c1:${p.c[0]};--c2:${p.c[1]}">
        ${p.id === 'premium' ? `<span class="plan-best">${t('plus.best')}</span>` : ''}
        <div class="plan-head">
          <span class="plan-ic">${p.e}</span>
          <div class="plan-name"><b>${planName(p.id)}</b><small>${t(`plan.${p.id}.tag`)}</small></div>
          <div class="plan-price"><b>${pr.main}</b><small>${pr.per}</small></div>
        </div>
        ${pr.equiv ? `<p class="plan-equiv">${pr.equiv}</p>` : ''}
        <ul class="plan-feats">${[1, 2, 3].map((k) => `<li>✓ ${t(`plan.${p.id}.f${k}`)}</li>`).join('')}</ul>
        ${allergyCfg}${action}
      </article>`;
    }).join('');
    return `
      <div class="plus-hero">
        <span class="plus-crown">👑</span>
        <h4>FRESCAN+</h4>
        <p>${activeNames.length ? t('plus.active', { list: listFmt(activeNames) }) : t('plus.sub')}</p>
      </div>
      <div class="app-seg plus-billing">
        <button type="button" class="${state.billing === 'month' ? 'on' : ''}" data-billing="month">${t('plus.month')}</button>
        <button type="button" class="${state.billing === 'year' ? 'on' : ''}" data-billing="year">${t('plus.year')}</button>
      </div>
      <div class="plans">${cards}</div>
      <p class="plus-legal">${t('plus.legal')}</p>`;
  };

  // Fenêtre de souscription (simulation : aucun paiement réel)
  function openSheet(id) {
    const p = planById[id];
    const el = $('#simSheet');
    const pr = priceLine(p);
    const first = dateFor(state.day + 14).toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'long' });
    el.innerHTML = `
      <div class="sheet-backdrop" data-sheetclose></div>
      <div class="sheet-panel" style="--c1:${p.c[0]};--c2:${p.c[1]}" role="dialog" aria-label="${esc(planName(id))}">
        <span class="sheet-grab"></span>
        <div class="sheet-plan"><span class="plan-ic">${p.e}</span><div><b>FRESCAN+ ${planName(id)}</b><small>${t(`plan.${id}.tag`)}</small></div></div>
        <div class="sheet-rows">
          <div><span>${t('sheet.today')}</span><b class="free">${money(0)}</b></div>
          <div><span>${t('sheet.after')}</span><b>${pr.main}${pr.per}</b></div>
          <div><span>${t('sheet.firstLabel')}</span><b>${first}</b></div>
        </div>
        <p class="sheet-note">${t('sheet.note')}</p>
        <div class="sheet-pay">💳 ${t('sheet.pay')}</div>
        <button type="button" class="app-btn sheet-confirm" data-sheetconfirm="${id}">${t('sheet.confirm')}</button>
        <button type="button" class="sheet-cancel" data-sheetclose>${t('sheet.later')}</button>
      </div>`;
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
  }
  function closeSheet() {
    const el = $('#simSheet');
    el.classList.remove('is-visible');
    setTimeout(() => { if (!el.classList.contains('is-visible')) { el.hidden = true; el.innerHTML = ''; } }, 400);
  }
  async function confirmSheet(id) {
    const el = $('#simSheet');
    const btn = el.querySelector('[data-sheetconfirm]');
    btn.disabled = true;
    btn.innerHTML = `<span class="sheet-spin"></span>${t('sheet.processing')}`;
    await wait(1100);
    state.subs.add(id);
    if (id === 'premium') PLANS.forEach((p) => { if (p.id !== 'premium') state.subs.delete(p.id); });
    const confetti = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2, d = 70 + Math.random() * 60;
      return `<i style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.random() * 540 - 270}deg;--d:${Math.random() * .2}s">${['✨', '👑', '💚', '🎉'][i % 4]}</i>`;
    }).join('');
    el.querySelector('.sheet-panel').innerHTML = `
      <div class="confetti" aria-hidden="true">${confetti}</div>
      <div class="sheet-done">
        <span class="sheet-check">✓</span>
        <b>${t('sheet.done', { p: planName(id) })}</b>
        <small>${t('sheet.doneSub')}</small>
        <button type="button" class="app-btn" data-sheetgo>${ICON('i-chef')}${t('sheet.try')}</button>
      </div>`;
    renderApp();
  }

  /* ---------- Courses (liste automatique) ---------- */
  function shopData() {
    const activeIds = new Set(active().map((i) => i.id));
    const seen = new Set(), finished = [];
    for (const f of state.finished) {
      if (seen.has(f.pid) || activeIds.has(f.pid)) continue;
      seen.add(f.pid);
      finished.push(f);
    }
    const low = state.inv.filter((i) => i.expired || daysLeft(i) <= 1).sort((a, b) => a.exp - b.exp);
    const extra = Object.keys(state.extra).filter((pid) => !activeIds.has(pid) && !seen.has(pid)).map((pid) => ({ pid, rid: state.extra[pid] }));
    const already = active().filter((i) => daysLeft(i) >= 3).sort((a, b) => b.exp - a.exp).slice(0, 3);
    return { finished, low, extra, already };
  }
  const checkLi = (key, pid, title, sub) => {
    const done = state.checked.has(key);
    return `<li class="${done ? 'done' : ''}" data-check="${key}" role="button" tabindex="0" aria-pressed="${done}"><i>${done ? '✓' : ''}</i><div><b>${title}</b><small>${sub}</small></div><span class="cl-emo">${byId[pid].e}</span></li>`;
  };
  VIEWS.shop = () => {
    const d = shopData();
    const sections = [];
    if (d.finished.length) sections.push(`<div class="app-sec-title">${t('sapp.finished')}</div><ul class="check-list">${d.finished.map((f) =>
      checkLi('f-' + f.pid, f.pid, full(f.pid), f.kind === 'wasted' ? t('sapp.wastedOn', { n: f.day }) : t('sapp.eatenOn', { n: f.day }))).join('')}</ul>`);
    if (d.low.length) sections.push(`<div class="app-sec-title">${t('sapp.low')}</div><ul class="check-list">${d.low.map((it) =>
      checkLi('l-' + it.uid, it.id, full(it.id), it.expired ? t('sapp.lowExpired') : daysLeft(it) <= 0 ? t('sapp.lowToday') : t('sapp.lowTomorrow'))).join('')}</ul>`);
    if (d.extra.length) sections.push(`<div class="app-sec-title">${t('sapp.forRecipes')}</div><ul class="check-list">${d.extra.map((x) =>
      checkLi('x-' + x.pid, x.pid, full(x.pid), `${RECIPES.find((r) => r.id === x.rid).e} ${I18N.recipe(x.rid).n}`)).join('')}</ul>`);
    const body = sections.length ? sections.join('') : `<div class="sim-empty"><span>🛒</span>${t('sapp.emptyList')}</div>`;
    const already = d.already.length ? `<div class="app-sec-title">${t('sapp.already')}</div><ul class="check-list check-list--muted">${d.already.map((it) =>
      `<li><i>${byId[it.id].e}</i><div><b>${full(it.id)}</b><small>${qty(it.id)} · ${t('sapp.stillDays', { n: daysLeft(it) })}</small></div></li>`).join('')}</ul>` : '';
    return `
      <div class="app-title-row"><h4>${t('sapp.shopTitle')}</h4><span class="app-count app-count--blue">${t('sapp.auto')}</span></div>
      <p class="app-note">${ICON('i-sparkle')}<span>${t('sapp.generated')}</span></p>
      ${body}${already}
      <button type="button" class="app-btn app-btn--ghost" data-share>${ICON('i-share')}${t('sapp.share')}</button>`;
  };

  /* ---------- Alertes ---------- */
  // Idée de recette pour un produit qui expire : la mieux notée parmi celles qui l'utilisent
  function idea(id) {
    const r = visible().filter((x) => x.need.includes(id)).sort(byScore)[0];
    if (!r) return t('alert.quick');
    return t('alert.idea', { r: I18N.recipe(r.id).n, t: timeLabel(r) });
  }
  function alertText(a) {
    switch (a.kind) {
      case 'expired': return [t('alert.expired', { p: name(a.pid) }), t('alert.lost', { v: money(a.value) })];
      case 'today': return [t('alert.today', { p: name(a.pid) }), idea(a.pid)];
      case 'tomorrow': return [t('alert.tomorrow', { p: name(a.pid) }), idea(a.pid)];
      case 'cooked': return [t('alert.cooked', { r: I18N.recipe(a.rid).n }), t('alert.cookedText', { n: a.n, v: money(a.value) })];
      default: return ['', ''];
    }
  }
  function notifHTML(a, when) {
    const [title, text] = alertText(a);
    return `<div class="notif notif--${a.type}"><div class="notif-head"><span class="notif-app">${ICON('i-logo')}</span>FRESCAN<em>${when}</em></div><b>${a.icon} ${title}</b><p>${text}</p></div>`;
  }
  const backBar = () => `<div class="sapp-back"><button type="button" data-nav="home">${ICON('i-arrow', 'ic-back')}${t('sapp.back')}</button></div>`;
  VIEWS.alerts = () => `${backBar()}
    <div class="app-title-row"><h4>${t('app.alerts')}</h4><span class="app-count">${I18N.num(state.alerts.length)}</span></div>
    ${state.alerts.length
      ? `<div class="sapp-notifs">${state.alerts.map((a) => notifHTML(a, t('app.dayN', { n: a.day }))).join('')}</div>`
      : `<div class="sim-empty"><span>🔔</span>${t('app.emptyAlerts')}</div>`}`;

  /* ---------- Impact ---------- */
  VIEWS.impact = () => {
    const days = Object.keys(state.days).map(Number).sort((a, b) => a - b).slice(-6);
    const max = Math.max(1, ...days.map((d) => state.days[d].saved));
    const total = state.saved + state.wasted;
    const rate = total ? Math.round((state.wasted / total) * 100) : 0;
    return `${backBar()}
      <div class="app-title-row"><h4>${t('sapp.impact')}</h4><span class="app-count">${t('app.dayN', { n: state.day })}</span></div>
      <div class="impact-hero">
        <small>${t('sapp.impactSaved')}</small>
        <strong>${money(state.saved)}</strong>
        <span>${t('sapp.impactItems', { n: state.savedItems })}</span>
      </div>
      <div class="app-sec-title">${t('sapp.perDay')}</div>
      <div class="bars" style="--cols:${days.length}">${days.map((d) =>
        `<div class="${d === state.day ? 'on' : ''}" style="--h:${Math.max(5, (state.days[d].saved / max) * 100)}%"><i></i><small>${t('sapp.dayShort', { n: d })}</small></div>`).join('')}</div>
      <div class="impact-tiles">
        <div><strong>${kgTxt(state.savedKg)}</strong><small>${t('sapp.kgSaved')}</small></div>
        <div><strong>${kgTxt(state.savedKg * 2.5)}</strong><small>${t('sapp.co2')}</small></div>
        <div><strong>${I18N.num(rate)} %</strong><small>${t('sapp.wasteRate')}</small></div>
        <div><strong>${I18N.num(state.cooked)}</strong><small>${t('sapp.recipesCooked', { n: state.cooked })}</small></div>
      </div>`;
  };

  /* ---------- actions dans l'appli ---------- */
  function consume(it) {
    const p = byId[it.id];
    state.inv = state.inv.filter((i) => i !== it);
    state.saved += p.price;
    state.savedKg += p.kg;
    state.savedItems += 1;
    dayStat().saved += p.price;
    state.finished.unshift({ pid: it.id, day: state.day, kind: 'eaten' });
  }
  function eatOrTrash(uid) {
    const it = state.inv.find((i) => i.uid === uid);
    if (!it) return;
    if (it.expired) {
      state.inv = state.inv.filter((i) => i !== it);
      state.finished.unshift({ pid: it.id, day: state.day, kind: 'wasted' });
      renderAll();
    } else {
      consume(it);
      renderAll('saved');
    }
  }

  function onAppClick(e) {
    if (state.demo) return;
    const el = e.target.closest('[data-nav],[data-act],[data-cat],[data-filter],[data-serv],[data-pick],[data-cook],[data-addmissing],[data-check],[data-share],[data-sub],[data-unsub],[data-billing],[data-allergen],[data-sheetclose],[data-sheetconfirm],[data-sheetgo]');
    if (!el) return;
    const d = el.dataset;
    // FRESCAN+
    if (d.sub) { openSheet(d.sub); return; }
    if ('sheetclose' in d) { closeSheet(); return; }
    if (d.sheetconfirm) { confirmSheet(d.sheetconfirm); return; }
    if ('sheetgo' in d) { closeSheet(); go('chef', { chefFilter: 'smart', recipe: null, servings: null }); return; }
    if (d.unsub) { state.subs.delete(d.unsub); renderApp(); notify('👋', t('plus.cancelled', { p: planName(d.unsub) }), t('plus.cancelledSub')); return; }
    if (d.billing) { state.billing = d.billing; renderApp(); return; }
    if (d.allergen) {
      if (state.allergens.has(d.allergen)) state.allergens.delete(d.allergen); else state.allergens.add(d.allergen);
      renderApp();
      return;
    }
    if (d.nav) { go(d.nav, d.pick != null ? { recipe: +d.pick, chefFilter: 'smart', servings: null } : null); return; }
    if (d.act) { eatOrTrash(+d.act); return; }
    if (d.cat) { state.cat = d.cat; renderApp(); return; }
    if (d.filter) { state.chefFilter = d.filter; state.recipe = null; state.servings = null; renderApp(false, true); return; }
    if (d.serv) {
      const r = RECIPES[state.recipe];
      state.servings = Math.min(8, Math.max(1, servings(r) + +d.serv));
      renderApp();
      return;
    }
    if (d.pick != null) {
      // Une recette hors du filtre actuel (ex. proposée par une alerte) : on repasse sur « Toutes »
      if (!chefList().some((r) => r.idx === +d.pick)) state.chefFilter = 'all';
      state.recipe = +d.pick;
      state.servings = null;
      renderApp(false, true);
      return;
    }
    if ('cook' in d) { if (!state.busy) cook(state.recipe); return; }
    if ('addmissing' in d) {
      const r = recipeInfo(RECIPES[state.recipe], state.recipe);
      r.miss.forEach((pid) => { state.extra[pid] = r.id; });
      notify('🛒', t('sapp.addedList'), t('sapp.addedListSub', { n: r.miss.length }));
      renderApp();
      return;
    }
    if (d.check) {
      if (state.checked.has(d.check)) state.checked.delete(d.check); else state.checked.add(d.check);
      renderApp();
      return;
    }
    if ('share' in d) notify('👨‍👩‍👧', t('sapp.shared'), t('sapp.sharedSub'));
  }

  function notify(icon, title, text) {
    const el = $('#simNotif');
    el.innerHTML = `<span class="notif-app">${ICON('i-logo')}</span><div><b>${icon} ${title}</b><small>${text}</small></div>`;
    el.classList.add('is-visible');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  /* ---------- mode cuisine ---------- */
  function cook(idx, auto) {
    return new Promise((resolve) => {
      const r = RECIPES[idx];
      const rec = I18N.recipe(r.id);
      const el = $('#simCook');
      const total = rec.steps.length;
      const n = servings(r), scale = n / r.serves;
      state.busy = true;
      setControls();
      const ings = r.ing.map(([id, q, u]) => `<span>${byId[id].e} ${fmtQty(q, u, scale)}</span>`).join('');
      el.innerHTML = `
        <div class="cook-head"><span class="cook-label">${t('cook.step', { n: 1, total })}</span><span class="cook-progress"><i></i></span></div>
        <div class="recipe-hero cook-hero" style="--g1:${r.g[0]};--g2:${r.g[1]}"><span class="recipe-emoji">${r.e}</span><span class="recipe-badge">👥 ${t('sapp.serves', { n })}</span></div>
        <h5 class="recipe-title">${rec.n}</h5>
        <div class="cook-ings">${ings}</div>
        <ol class="cook-steps">${rec.steps.map((txt, i) => `<li><span class="n">${i + 1}</span><div><b>${txt}</b>${r.timers[i] ? `<small class="cook-timer" data-min="${r.timers[i]}">⏱ ${t('sapp.min', { n: r.timers[i] })}</small>` : ''}</div></li>`).join('')}</ol>`;
      el.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
      const lis = el.querySelectorAll('.cook-steps li');
      const bar = el.querySelector('.cook-progress i');
      (async () => {
        await wait(450);
        for (let s = 0; s < total; s++) {
          lis.forEach((li, k) => { li.classList.toggle('is-on', k === s); li.classList.toggle('is-done', k < s); });
          lis[s].scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
          el.querySelector('.cook-label').textContent = t('cook.step', { n: s + 1, total });
          bar.style.width = `${((s + 1) / total) * 100}%`;
          const timer = lis[s].querySelector('.cook-timer');
          await wait(900);
          if (timer) {
            // minuteur accéléré : le temps de cuisson défile en 1,5 s
            const mins = +timer.dataset.min;
            timer.classList.add('is-running');
            for (let k = 12; k >= 0; k--) {
              const left = Math.round((mins * 60 * k) / 12);
              timer.textContent = `⏱ ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
              await wait(125);
            }
            timer.classList.remove('is-running');
            timer.textContent = `✓ ${t('cook.timerDone')}`;
          }
          await wait(500);
        }
        lis.forEach((li) => { li.classList.remove('is-on'); li.classList.add('is-done'); });
        await wait(350);
        // les ingrédients sont consommés : autant de produits sauvés
        let value = 0, n = 0;
        r.need.forEach((id) => {
          const it = active().filter((i) => i.id === id).sort((a, b) => a.exp - b.exp)[0];
          if (it) { value += byId[id].price; n += 1; consume(it); }
        });
        state.cooked += 1;
        state.minutes += r.time;
        // une portion mangée : comptée dans les objectifs du jour (Fitness, Diabète)
        const day = today();
        day.p += r.p; day.c += r.c; day.kcal += r.kcal;
        state.alerts.unshift({ type: 'good', icon: r.e, kind: 'cooked', rid: r.id, n, value, day: state.day });
        const confetti = Array.from({ length: 22 }, (_, i) => {
          const a = (i / 22) * Math.PI * 2, dist = 80 + Math.random() * 70;
          return `<i style="--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist - 30}px;--r:${Math.random() * 540 - 270}deg;--d:${Math.random() * .25}s">${['🎉', '✨', '💚', '🥳', '🍽️'][i % 5]}</i>`;
        }).join('');
        el.innerHTML = `
          <div class="confetti" aria-hidden="true">${confetti}</div>
          <div class="cook-done">
            <span class="cook-done-emo">${r.e}</span>
            <h5>${t('alert.bon')}</h5>
            <p>${t('cook.doneSub', { n, v: money(value) })}</p>
            ${has('fitness') || has('diabetes') ? `<p class="cook-nutri">${[has('fitness') ? `💪 +${r.p} ${t('unit.g')} ${t('nutri.p').toLowerCase()}` : '', has('diabetes') ? `🩸 +${r.c} ${t('unit.g')} ${t('nutri.c').toLowerCase()}` : ''].filter(Boolean).join(' · ')}</p>` : ''}
            <button type="button" class="app-btn" data-cookclose>${ICON('i-home')}${t('cook.back')}</button>
          </div>`;
        renderAll('saved');
        const close = () => {
          clearTimeout(timer);
          el.classList.remove('is-visible');
          setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 450);
          state.busy = false;
          go('home');
          setControls();
          resolve();
        };
        const timer = auto ? setTimeout(close, 2600) : null;
        el.querySelector('[data-cookclose]').addEventListener('click', close);
      })();
    });
  }

  /* ---------- écran verrouillé (chaque matin) ---------- */
  function showLock(alerts) {
    return new Promise((resolve) => {
      const el = $('#simLock');
      const d = dateFor(state.day).toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
      const list = alerts.slice(0, 3).map((a) => notifHTML(a, t('lock.now'))).join('');
      el.innerHTML = `
        <div class="app-status app-status--light"><span>5G</span><span class="app-status-ic">${ICON('i-wifi')}<i class="batt"></i></span></div>
        <div class="lock-clock"><small>${d}</small><strong>${clock()}</strong></div>
        <div class="lock-notifs">${list || `<div class="notif notif--good"><div class="notif-head"><span class="notif-app">${ICON('i-logo')}</span>FRESCAN<em>${t('lock.now')}</em></div><b>${t('lock.allGood')}</b><p>${t('lock.allGoodSub')}</p></div>`}
          ${alerts.length > 3 ? `<div class="lock-more">${t('lock.more', { n: alerts.length - 3 })}</div>` : ''}</div>
        <div class="lock-hint">${t('lock.tap')}</div>
        <div class="lock-bottom"><span></span></div>`;
      el.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.classList.add('is-leaving');
        setTimeout(() => { el.hidden = true; el.classList.remove('is-visible', 'is-leaving'); resolve(); }, 560);
      };
      const timer = setTimeout(close, REDUCED ? 1500 : 4200);
      el.onclick = close;
    });
  }

  /* ---------- statistiques ---------- */
  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  function updateStats(changed) {
    statTracked.textContent = I18N.num(active().length);
    statSaved.textContent = money(state.saved);
    statWasted.textContent = money(state.wasted);
    if (changed === 'saved') flash(statSaved);
    if (changed === 'wasted') flash(statWasted);
    const d = dateFor(state.day).toLocaleDateString(I18N.locale(), { weekday: 'short', day: 'numeric', month: 'short' });
    dayLabel.textContent = t('sim.day', { n: state.day, date: d });
  }
  function renderAll(changed) {
    renderApp();
    renderShelves();
    updateCounts();
    updateStats(changed);
  }
  function setControls() {
    demoBtn.querySelector('span').textContent = t(state.demo ? 'sim.demoStop' : 'sim.demo');
    demoBtn.classList.toggle('is-running', state.demo);
    doorBtn.querySelector('span').textContent = t(state.doorOpen ? 'sim.close' : 'sim.open');
    doorBtn.setAttribute('aria-pressed', String(state.doorOpen));
    nextBtn.disabled = state.demo || state.busy;
    resetBtn.disabled = state.demo || state.busy;
    doorBtn.disabled = state.demo || state.busy;
    productsEl.classList.toggle('is-locked', state.demo);
  }

  /* ---------- animation du scan ---------- */
  // Le « fantôme » du produit est positionné en coordonnées de page : il suit le défilement.
  function ghostT(pt, dy = 0, sc = 1) { return `translate(${pt.x}px, ${pt.y + dy}px) translate(-50%, -50%) scale(${sc})`; }
  function pageRect(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
  }
  function centerOf(el) { const r = pageRect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function makeGhost(p, pt) {
    const g = document.createElement('div');
    g.className = 'prod-ghost';
    g.textContent = p.e;
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
    g._pt = pt;
    g.style.transform = ghostT(pt);
    return g;
  }
  function moveGhost(g, to, dur, sc = 1, opacity = 1) {
    const from = g._pt;
    g._pt = to;
    const a = g.animate(
      [{ transform: ghostT(from), opacity: 1 }, { transform: ghostT(to, 0, sc), opacity }],
      { duration: REDUCED ? 1 : dur, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }
    );
    return a.finished.catch(() => {});
  }
  function dropBack(g, btn) { moveGhost(g, centerOf(btn), 320, .5, 0).then(() => g.remove()); }
  function aimBeam(target) {
    const r = pageRect(device);
    const cx = r.left + r.width / 2, cy = r.top + r.height * .073;
    const dx = target.x - cx, dy = target.y - cy;
    beam.style.setProperty('--len', `${Math.hypot(dx, dy)}px`);
    beam.style.setProperty('--ang', `${Math.atan2(dy, dx)}rad`);
  }

  // File d'attente : les produits cliqués pendant un scan sont scannés à la suite
  let pumping = false;
  function markQueued() {
    productsEl.querySelectorAll('.prod').forEach((b) => {
      const n = state.queue.filter((x) => x === b.dataset.id).length;
      b.classList.toggle('is-queued', n > 0);
    });
  }
  function requestScan(id, from) {
    if (state.demo) { if (from && from.ghost) dropBack(from.ghost, from.btn); return; }
    if (!state.busy && !pumping && !state.queue.length) { pump(id, from); return; }
    if (from && from.ghost) dropBack(from.ghost, from.btn);
    if (state.queue.length < 8) state.queue.push(id);
    markQueued();
    if (!pumping) pump();
  }
  async function pump(first, from) {
    if (pumping) return;
    pumping = true;
    const st = state;
    try {
      if (first) await scan(first, from, true);
      while (state === st && st.queue.length && !st.demo) {
        if (st.busy) await wait(250);
        else { const id = st.queue.shift(); markQueued(); await scan(id, null, true); }
      }
    } finally { pumping = false; }
  }

  async function scan(id, from, auto) {
    if (state.busy || (state.demo && !auto)) {
      device.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 280 });
      if (from && from.ghost) dropBack(from.ghost, from.btn);
      return;
    }
    const st = state;
    st.busy = true;
    setControls();
    if (st.doorOpen) await setDoor(false);
    const p = byId[id];
    const btn = productsEl.querySelector(`[data-id="${id}"]`);
    const removing = st.mode === 'out';
    const inFridge = st.inv.some((i) => i.id === id);
    // Mode OUT : le produit sort du frigo pour être présenté au scanner
    const fridgeBox = pageRect(fridge);
    const origin = removing && inFridge ? { x: fridgeBox.left + fridgeBox.width / 2, y: fridgeBox.top + fridgeBox.height * .72 } : centerOf(btn);
    const ghost = from && from.ghost ? from.ghost : makeGhost(p, origin);
    let r = pageRect(device);
    // Le produit est présenté au-dessus de l'appareil, côté début de lecture (gauche, ou droite en arabe)
    const rtl = I18N.dir === 'rtl';
    const target = { x: r.left + r.width * (rtl ? .88 : .12), y: r.top - r.height * .22 };

    await moveGhost(ghost, target, 560);
    aimBeam(target);
    device.classList.add('is-scanning');
    led.className = 'sim-led scan';
    renderScreen('scan');
    islandScan();
    if (!REDUCED) ghost.animate([{ transform: ghostT(target) }, { transform: ghostT(target, -7) }, { transform: ghostT(target) }], { duration: 520, iterations: 2 });
    await wait(1150);
    if (state !== st) { ghost.remove(); return; }

    device.classList.remove('is-scanning');

    if (removing) {
      // l'unité la plus proche de sa date limite part en premier (produits périmés inclus)
      const unit = st.inv.filter((i) => i.id === id).sort((a, b) => a.exp - b.exp)[0];
      if (unit) {
        st.minutes += 2;
        st.view = 'fridge';
        st.query = '';
        st.cat = 'all';
        eatOrTrash(unit.uid);
        const left = active().filter((i) => i.id === id).length;
        renderScreen('removed', p, left);
        islandRemoved(p);
        if (!left) setTimeout(() => notify('🛒', t('out.finishedT', { p: name(id) }), t('out.finishedSub')), 300);
        led.className = 'sim-led out';
        device.classList.add('is-out-done');
        moveGhost(ghost, centerOf(btn), 480, .5, 0).then(() => ghost.remove());
      } else {
        // rien à retirer : l'appareil le signale et le produit repart
        renderScreen('absent', p);
        islandHide();
        led.className = 'sim-led warn';
        device.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 280 });
        dropBack(ghost, btn);
      }
      await wait(st.queue.length ? 1300 : 2000);
      if (state !== st) return;
      islandHide();
      device.classList.remove('is-out-done');
      led.className = 'sim-led';
      renderScreen('idle');
      st.busy = false;
      setControls();
      return;
    }

    const item = { uid: st.uid++, id, added: st.day, exp: st.day + p.life };
    st.inv.push(item);
    st.lastNew = item.uid;
    st.shelfNew = item.uid;
    st.minutes += 2;
    st.view = 'fridge'; // l'appli affiche aussitôt le produit ajouté
    st.query = '';
    st.cat = 'all';
    renderScreen('result', p, p.life);
    islandSaved(p, p.life);
    // Programme Allergies : alerte dès le scan d'un produit à risque
    const risk = has('allergy') ? (PRODUCT_ALLERGENS[id] || []).filter((a) => state.allergens.has(a)) : [];
    if (risk.length) setTimeout(() => notify('⚠️', t('allergy.scanT', { p: name(id) }), t('allergy.scanSub', { a: listFmt(risk.map((a) => t('allergen.' + a))) })), 300);
    led.className = 'sim-led on';
    device.classList.add('is-done');
    r = pageRect(device);
    moveGhost(ghost, { x: r.left + r.width / 2, y: r.top + r.height * .62 }, 420, .25, 0).then(() => ghost.remove());
    renderAll();

    await wait(st.queue.length ? 1300 : 2000);
    if (state !== st) return;
    islandHide();
    device.classList.remove('is-done');
    led.className = 'sim-led';
    renderScreen('idle');
    st.busy = false;
    setControls();
  }

  /* ---------- glisser-déposer + clic ---------- */
  productsEl.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.prod');
    if (!btn || e.button > 0 || state.demo) return;
    const id = btn.dataset.id;
    const start = { x: e.clientX, y: e.clientY };
    let ghost = null;
    try { btn.setPointerCapture(e.pointerId); } catch (_) { /* pointeur déjà relâché */ }
    const over = (x, y) => {
      const r = device.getBoundingClientRect(), m = 40;
      return x > r.left - m && x < r.right + m && y > r.top - m * 2 && y < r.bottom + m;
    };
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        ghost = makeGhost(byId[id], { x: ev.pageX, y: ev.pageY });
      }
      if (ghost) {
        ghost._pt = { x: ev.pageX, y: ev.pageY };
        ghost.style.transform = ghostT(ghost._pt);
        device.classList.toggle('is-target', over(ev.clientX, ev.clientY));
      }
    };
    const end = (ev) => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerup', end);
      btn.removeEventListener('pointercancel', end);
      device.classList.remove('is-target');
      if (!ghost) { if (ev.type === 'pointerup') requestScan(id); return; }
      if (ev.type === 'pointerup' && over(ev.clientX, ev.clientY)) requestScan(id, { ghost, btn });
      else dropBack(ghost, btn);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  });
  // Clavier (Entrée / Espace) : l'événement click a detail === 0
  productsEl.addEventListener('click', (e) => {
    if (e.detail !== 0 || state.demo) return;
    const btn = e.target.closest('.prod');
    if (btn) requestScan(btn.dataset.id);
  });

  /* ---------- le temps passe ---------- */
  async function nextDay() {
    if (state.busy) return;
    const st = state;
    st.busy = true;
    setControls();
    if (st.doorOpen) await setDoor(false);
    st.day += 1;
    st.minutes = 8 * 60;
    st.days[st.day] = { saved: 0, wasted: 0 };
    const today = [], tomorrow = [], gone = [];
    for (const it of st.inv) {
      if (it.expired) continue;
      const dl = daysLeft(it), p = byId[it.id];
      if (dl < 0) {
        it.expired = true;
        st.wasted += p.price;
        dayStat().wasted += p.price;
        gone.push({ type: 'bad', icon: '🗑️', kind: 'expired', pid: it.id, value: p.price, day: st.day });
      } else if (dl === 0) {
        today.push({ type: 'warn', icon: '⏰', kind: 'today', pid: it.id, day: st.day });
      } else if (dl === 1) {
        tomorrow.push({ type: 'warn', icon: '🔔', kind: 'tomorrow', pid: it.id, day: st.day });
      }
    }
    const fresh = [...today, ...tomorrow, ...gone];
    st.alerts.unshift(...fresh);
    st.unread += fresh.length;
    st.view = 'home';
    renderAll(gone.length ? 'wasted' : null);
    flash(dayLabel);
    const urgent = [...today, ...tomorrow].map((a) => byId[a.pid]);
    if (urgent.length) {
      renderScreen('alert', urgent.slice(0, 4));
      led.className = 'sim-led warn';
    } else {
      renderScreen('idle');
    }
    await showLock(fresh);
    if (state !== st) return;
    st.minutes += 1;
    $('#simClock').textContent = clock();
    if (urgent.length) {
      await wait(500);
      led.className = 'sim-led';
      renderScreen('idle');
    }
    st.busy = false;
    setControls();
  }

  nextBtn.addEventListener('click', () => { if (!state.demo) nextDay(); });
  resetBtn.addEventListener('click', () => { if (!state.busy && !state.demo) resetSim(); });
  doorBtn.addEventListener('click', () => { if (!state.busy && !state.demo) setDoor(!state.doorOpen); });

  function resetSim() {
    const cookEl = $('#simCook'), lockEl = $('#simLock'), sheetEl = $('#simSheet');
    sheetEl.hidden = true; sheetEl.classList.remove('is-visible'); sheetEl.innerHTML = '';
    cookEl.hidden = true; cookEl.classList.remove('is-visible'); cookEl.innerHTML = '';
    lockEl.hidden = true; lockEl.classList.remove('is-visible', 'is-leaving');
    fridge.classList.remove('is-open');
    islandHide();
    state = initialState();
    led.className = 'sim-led';
    device.classList.remove('is-scanning', 'is-done', 'is-out-done');
    renderMode();
    renderScreen('idle');
    renderAll();
    setControls();
  }

  /* ---------- démo automatique ---------- */
  async function runDemo() {
    if (state.busy) return;
    const token = ++demoRun;
    resetSim();
    state.demo = true;
    setControls();
    if (window.innerWidth > 1140) $('#sim').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    const alive = () => demoRun === token;
    const step = async (fn, pause = 650) => {
      if (!alive()) throw new Error('stop');
      await fn();
      if (!alive()) throw new Error('stop');
      await wait(pause);
    };
    try {
      await wait(700);
      for (const id of ['lait', 'oeufs', 'comte', 'fraises', 'saumon', 'tomates']) await step(() => scan(id, null, true), 250);
      await step(() => go('home'), 900);
      await step(() => setDoor(true), 2400);
      await step(() => setDoor(false), 300);
      // bouton OUT : le saumon sort du frigo et quitte l'inventaire
      await step(() => setMode('out'), 900);
      await step(() => scan('saumon', null, true), 250);
      await step(() => setMode('in'), 600);
      await step(() => nextDay(), 500);
      await step(() => nextDay(), 700);
      await step(() => go('chef', { chefFilter: 'smart', servings: null, recipe: RECIPES.findIndex((r) => r.id === 'omelette') }), 2600);
      await step(() => cook(state.recipe, true), 700);
      await step(() => go('shop'), 2800);
      await step(() => go('impact'), 3200);
      await step(() => go('plus'), 3000);
      await step(() => go('home'), 200);
    } catch (_) { /* démo interrompue */ }
    if (alive()) { state.demo = false; setControls(); }
  }
  demoBtn.addEventListener('click', () => {
    if (state.demo) { demoRun++; state.demo = false; setControls(); }
    else runDemo();
  });

  /* ---------- changement de langue ---------- */
  document.addEventListener('frescan:lang', () => {
    renderProducts();
    renderMode();
    renderScreen(...lastScreen);
    const notif = $('#simNotif');
    if (notif) notif.classList.remove('is-visible');
    renderAll();
    setControls();
  });

  /* ---------- démarrage ---------- */
  state = initialState();
  renderProducts();
  renderMode();
  renderScreen('idle');
  buildApp();
  renderAll();
  setControls();
})();
