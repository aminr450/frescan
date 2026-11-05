/* ==========================================================================
   FRESCAN — interactions de la page
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const I18N = window.I18N;
  const t = I18N.t;
  const money = (n) => I18N.price(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* stockage indisponible */ } },
  };

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('is-visible'), 2800);
  }

  /* ---------- Header : ombre + barre de progression ---------- */
  const header = $('#header'), progress = $('#scrollProgress');
  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const nav = $('#nav'), menuBtn = $('#menuBtn');
  function closeMenu() { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#header')) closeMenu(); });

  /* ---------- Lien actif selon la section ---------- */
  const links = $$('.nav a[href^="#"]:not(.nav-mobile-cta)');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['accueil', 'concept', 'simulation', 'studio', 'appli', 'economies', 'mission', 'boutique', 'faq']
      .forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Apparitions au scroll + compteurs ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0, dur = REDUCED ? 1 : 1600;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = I18N.num(end * e, dec);
      if (k < 1) requestAnimationFrame(step);
      else el.dataset.counted = '1';
    };
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const rio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        $$('[data-count]', en.target).forEach(countUp);
        rio.unobserve(en.target);
      });
    }, { threshold: .14, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach((el) => rio.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
    $$('[data-count]').forEach(countUp);
  }

  /* ---------- FAQ : une seule question ouverte ---------- */
  $$('.faq details').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) $$('.faq details').forEach((o) => { if (o !== d) o.open = false; });
  }));

  /* ---------- Vitrine de l'application ---------- */
  const showcase = $('.showcase');
  const features = $$('.feature');
  const phones = $$('.phone--show');
  let cur = 0;
  function showScreen(i) {
    const n = phones.length;
    cur = (i + n) % n;
    features.forEach((f, k) => {
      f.classList.toggle('is-active', k === cur);
      f.setAttribute('aria-pressed', String(k === cur));
      const bar = $('.feature-bar i', f);
      bar.style.animation = 'none';
      void bar.offsetWidth;
      bar.style.animation = '';
    });
    phones.forEach((p, k) => {
      const d = (k - cur + n) % n;
      p.classList.toggle('is-active', d === 0);
      p.classList.toggle('is-next', d === 1);
      p.classList.toggle('is-prev', d === n - 1);
      p.setAttribute('aria-hidden', String(d !== 0));
    });
  }
  if (showcase && phones.length) {
    features.forEach((f, k) => f.addEventListener('click', () => showScreen(k)));
    phones.forEach((p, k) => p.addEventListener('click', () => { if (!p.classList.contains('is-active')) showScreen(k); }));
    if (!REDUCED) {
      $('#featureList').addEventListener('animationend', (e) => {
        if (e.animationName === 'progress' && e.target.closest('.feature.is-active')) showScreen(cur + 1);
      });
    } else {
      showcase.classList.add('is-paused');
    }
    showcase.addEventListener('mouseenter', () => showcase.classList.add('is-paused'));
    showcase.addEventListener('mouseleave', () => { if (!REDUCED) showcase.classList.remove('is-paused'); });
    if ('IntersectionObserver' in window && !REDUCED) {
      new IntersectionObserver(([en]) => showcase.classList.toggle('is-paused', !en.isIntersecting), { threshold: .2 }).observe(showcase);
    }
    showScreen(0);

    // Les téléphones s'inclinent légèrement en suivant la souris
    const tilt = $('#phonesTilt'), stage = $('#phonesStage');
    if (tilt && stage && !REDUCED && window.matchMedia('(hover: hover)').matches) {
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        tilt.style.setProperty('--try', `${(x * 14).toFixed(2)}deg`);
        tilt.style.setProperty('--trx', `${(-y * 10).toFixed(2)}deg`);
      });
      stage.addEventListener('pointerleave', () => {
        tilt.style.setProperty('--try', '0deg');
        tilt.style.setProperty('--trx', '0deg');
      });
    }
  }

  /* ---------- Calculateur d'économies ---------- */
  const LAUNCH_PRICE = 899; // prix de lancement FRESCAN Solo (MAD)
  const people = $('#calcPeople');
  let calc = () => {};
  if (people) {
    let kg = 30;
    const tweenNum = (el, to) => {
      const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
      const t0 = performance.now(), dur = REDUCED ? 1 : 500;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = I18N.num(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const renderAmount = () => {
      const current = ($('#calcEuros') || {}).textContent || '0';
      $('#calcAmount').innerHTML = `${t('calc.amount', { n: `<span id="calcEuros">${current}</span>` })}<em>${t('calc.perYear')}</em>`;
    };
    calc = (relabel) => {
      if (relabel) renderAmount();
      const n = +people.value;
      $('#calcPeopleOut').textContent = n;
      people.style.setProperty('--fill', `${((n - 1) / 5) * 100}%`);
      const savedKg = n * kg * .4;
      const dirhams = savedKg * 35; // valeur moyenne ≈ 35 MAD/kg
      tweenNum($('#calcEuros'), Math.round(dirhams / 10) * 10);
      tweenNum($('#calcKg'), Math.round(savedKg));
      tweenNum($('#calcMonths'), Math.max(1, Math.ceil(LAUNCH_PRICE / (dirhams / 12))));
    };
    people.addEventListener('input', () => calc());
    $$('#calcWaste button').forEach((b) => b.addEventListener('click', () => {
      $$('#calcWaste button').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', String(x === b)); });
      kg = +b.dataset.kg;
      calc();
    }));
    calc(true);
  }

  /* ---------- Finitions (synchronisées : studio 3D ↔ boutique) ---------- */
  const FINISH_COLORS = { glacier: '#EEF1F5', graphite: '#2B3038', nuit: '#163A66' };
  let finish = 'glacier';
  function setFinish(f, silent) {
    finish = f;
    $$('.swatch').forEach((s) => {
      const on = s.dataset.finish === f;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-checked', String(on));
    });
    ['#finishName', '#shopFinishName'].forEach((id) => { const el = $(id); if (el) el.textContent = t(`finish.${f}`); });
    if (!silent) document.dispatchEvent(new CustomEvent('frescan:finish', { detail: f }));
  }
  $$('.swatch').forEach((s) => s.addEventListener('click', () => setFinish(s.dataset.finish)));

  /* ---------- Boutique ---------- */
  const PACKS = {
    solo: { units: 1, price: LAUNCH_PRICE },
    duo: { units: 2, price: 1599 },
    famille: { units: 3, price: 2299 },
  };
  const RRP = 1099; // prix public conseillé (MAD)
  let pack = 'solo', qty = 1;

  function updatePrice() {
    const p = PACKS[pack], old = p.units * RRP;
    $('#priceNow').textContent = I18N.price(p.price);
    $('#priceOld').textContent = I18N.price(old);
    $('#priceSave').textContent = t('save', { n: Math.round((1 - p.price / old) * 100) });
  }
  $$('.pack').forEach((b) => b.addEventListener('click', () => {
    pack = b.dataset.pack;
    $$('.pack').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', String(x === b)); });
    updatePrice();
  }));
  const qtyVal = $('#qtyVal');
  $('#qtyMinus').addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
  $('#qtyPlus').addEventListener('click', () => { qty = Math.min(9, qty + 1); qtyVal.textContent = qty; });

  /* ---------- Panier ---------- */
  let cart = store.get('frescan-cart', []);
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter((it) => PACKS[it.pack] && FINISH_COLORS[it.finish] && it.qty > 0);

  const drawer = $('#cartDrawer'), backdrop = $('#drawerBackdrop');
  const countEl = $('#cartCount');
  const total = () => cart.reduce((sum, it) => sum + PACKS[it.pack].price * it.qty, 0);

  function saveCart() { store.set('frescan-cart', cart); }
  function renderCart(bump) {
    const n = cart.reduce((sum, it) => sum + it.qty, 0);
    countEl.hidden = n === 0;
    countEl.textContent = n;
    if (bump) { countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }

    const list = $('#cartItems');
    if (!cart.length) {
      list.innerHTML = `<div class="cart-empty"><svg><use href="#i-logo"/></svg><strong>${t('cart.emptyTitle')}</strong>${t('cart.emptyText')}<br><a class="btn btn-primary" href="#boutique" data-close-cart>${t('cart.emptyBtn')}</a></div>`;
    } else {
      list.innerHTML = cart.map((it) => {
        const p = PACKS[it.pack];
        return `<div class="cart-item">
          <div class="cart-thumb" style="--sw:${FINISH_COLORS[it.finish]}"><img src="assets/img/vue-face.webp" alt=""><span class="cart-dot"></span></div>
          <div class="cart-info"><strong>${t(`pack.name.${it.pack}`)}</strong><small>${t(`finish.${it.finish}`)} · ${t('cart.scanners', { n: p.units })}</small>
            <div class="cart-qty"><button data-dec="${it.key}" aria-label="${t('cart.dec')}"><svg class="ic"><use href="#i-minus"/></svg></button><span>${it.qty}</span><button data-inc="${it.key}" aria-label="${t('cart.inc')}"><svg class="ic"><use href="#i-plus"/></svg></button></div>
          </div>
          <div class="cart-right"><b>${money(p.price * it.qty)}</b><button class="cart-remove" data-del="${it.key}">${t('cart.remove')}</button></div>
        </div>`;
      }).join('');
    }
    $('#cartSubtotal').textContent = money(total());
    $('#cartTotal').textContent = money(total());
    $('#checkoutBtn').disabled = cart.length === 0;
  }

  function addToCart() {
    const key = `${pack}-${finish}`;
    const found = cart.find((it) => it.key === key);
    if (found) found.qty = Math.min(20, found.qty + qty);
    else cart.push({ key, pack, finish, qty });
    saveCart();
    renderCart(true);
  }

  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#cartClose').focus(), 50);
  }
  function closeCart() {
    backdrop.classList.remove('is-visible');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { backdrop.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $('#cartOpen').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);
  $('#addToCart').addEventListener('click', () => {
    addToCart();
    toast(t('toast.added', { pack: t(`pack.name.${pack}`), finish: t(`finish.${finish}`) }));
    openCart();
  });
  $('#buyNow').addEventListener('click', () => { addToCart(); openCheckout(); });
  $('#cartItems').addEventListener('click', (e) => {
    const el = e.target.closest('[data-inc],[data-dec],[data-del],[data-close-cart]');
    if (!el) return;
    if (el.hasAttribute('data-close-cart')) { closeCart(); return; }
    const key = el.dataset.inc || el.dataset.dec || el.dataset.del;
    const it = cart.find((x) => x.key === key);
    if (!it) return;
    if (el.dataset.inc) it.qty = Math.min(20, it.qty + 1);
    if (el.dataset.dec) it.qty -= 1;
    if (el.dataset.del || it.qty <= 0) cart = cart.filter((x) => x !== it);
    saveCart();
    renderCart();
  });

  /* ---------- Modale de commande ---------- */
  const modal = $('#checkoutModal');
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  function openCheckout() {
    if (drawer.classList.contains('is-open')) closeCart();
    $('#modalTotal').textContent = money(total());
    $('#modalMsg').textContent = '';
    modal.hidden = false;
    setTimeout(() => $('#checkoutForm input').focus(), 60);
  }
  function closeCheckout() { modal.hidden = true; }
  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#modalClose').addEventListener('click', closeCheckout);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCheckout(); });
  $('#checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#checkoutForm input'), msg = $('#modalMsg');
    if (!validEmail(input.value.trim())) {
      msg.textContent = t('form.invalid');
      msg.classList.add('is-error');
      input.focus();
      return;
    }
    msg.classList.remove('is-error');
    msg.textContent = t('modal.ok');
    input.value = '';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeCheckout();
    else if (drawer.classList.contains('is-open')) closeCart();
    else closeMenu();
  });

  /* ---------- Newsletter ---------- */
  $('#newsletter').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#newsletter input'), msg = $('#newsletterMsg');
    if (!validEmail(input.value.trim())) {
      msg.textContent = t('nl.invalid');
      msg.classList.add('is-error');
      return;
    }
    msg.classList.remove('is-error');
    msg.textContent = t('nl.ok');
    input.value = '';
  });

  /* ---------- Boîte produit en 3D (CSS) ---------- */
  const boxScene = $('#boxScene'), box = $('#box');
  if (boxScene && box) {
    let ry = -30, rx = -12, vx = 0, dragging = false, last = null, visible = false;
    boxScene.addEventListener('pointerdown', (e) => {
      dragging = true; last = { x: e.clientX, y: e.clientY };
      try { boxScene.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    boxScene.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      ry += dx * .5;
      rx = Math.max(-35, Math.min(20, rx - dy * .3));
      vx = dx * .5;
    });
    const stop = () => { dragging = false; };
    boxScene.addEventListener('pointerup', stop);
    boxScene.addEventListener('pointercancel', stop);
    const spin = () => {
      if (visible) {
        if (!dragging) { ry += (REDUCED ? 0 : .14) + vx; vx *= .94; }
        box.style.setProperty('--ry', `${ry}deg`);
        box.style.setProperty('--rx', `${rx}deg`);
      }
      requestAnimationFrame(spin);
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(boxScene);
    else visible = true;
    requestAnimationFrame(spin);
  }

  /* ---------- Changement de langue ---------- */
  document.addEventListener('frescan:lang', () => {
    updatePrice();
    renderCart();
    setFinish(finish, true);
    calc(true);
    $$('[data-count][data-counted]').forEach((el) => {
      el.textContent = I18N.num(parseFloat(el.dataset.count), +el.dataset.decimals || 0);
    });
    if (!modal.hidden) $('#modalTotal').textContent = money(total());
    $('#modalMsg').textContent = '';
    $('#newsletterMsg').textContent = '';
  });

  setFinish('glacier', true);
  updatePrice();
  renderCart();
})();
