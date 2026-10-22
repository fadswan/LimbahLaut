/* =========================================================
   Laut Kita — script.js
   Navigasi geser/tekan, latar gelembung, pemutar cerita,
   simulasi menyelam, mesin waktu, game, dan aksi.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Helper ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const fmt = n => Math.round(n).toLocaleString('id-ID');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Menyesuaikan resolusi canvas dengan ukuran tampilan
  function fitCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const S = { ctx, W: 1, H: 1 };
    const apply = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.W = Math.max(1, canvas.clientWidth);
      S.H = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(S.W * dpr);
      canvas.height = Math.round(S.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    if ('ResizeObserver' in window) new ResizeObserver(apply).observe(canvas);
    window.addEventListener('resize', apply);
    apply();
    return S;
  }

  const paintRange = r => r.style.setProperty('--fill', (r.value / r.max * 100) + '%');

  /* ---------- Data bersama ---------- */
  // y = perkiraan waktu terurai (tahun)
  const ITEMS = [
    { i: '🍌', n: 'Kulit pisang',   y: 0.06, lab: '2–5 minggu' },
    { i: '📄', n: 'Kertas',          y: 0.1,  lab: '2–6 minggu' },
    { i: '🚬', n: 'Puntung rokok',   y: 10,   lab: '±10 tahun' },
    { i: '🛍️', n: 'Kantong plastik', y: 20,   lab: '10–20 tahun' },
    { i: '🥫', n: 'Kaleng',          y: 200,  lab: '50–200 tahun' },
    { i: '🥤', n: 'Botol plastik',   y: 450,  lab: '±450 tahun' },
    { i: '🎣', n: 'Tali pancing',    y: 600,  lab: '±600 tahun' },
    { i: '🍾', n: 'Botol kaca',      y: 4000, lab: 'ribuan tahun' }
  ];

  /* =========================================================
     LATAR: gelembung yang bereaksi pada pointer
     ========================================================= */
  const bg = (() => {
    const cv = $('#bg'), S = fitCanvas(cv), ctx = S.ctx;
    const mouse = { x: -999, y: -999 };
    let boost = 0;
    const mk = init => ({
      x: Math.random() * S.W, y: init ? Math.random() * S.H : S.H + 40,
      r: 2 + Math.pow(Math.random(), 2.2) * 20, vy: 14 + Math.random() * 30,
      ph: Math.random() * TAU, sp: .4 + Math.random() * .9, a: .14 + Math.random() * .22, tmp: false
    });
    const bubbles = Array.from({ length: innerWidth < 700 ? 26 : 44 }, () => mk(true));

    window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { mouse.x = -999; mouse.y = -999; });

    function update(dt, t) {
      ctx.clearRect(0, 0, S.W, S.H);
      boost = Math.max(0, boost - dt * 1.6);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= b.vy * (1 + boost * 2.2) * dt;
        b.x += Math.sin(t * b.sp + b.ph) * 12 * dt;
        const dx = b.x - mouse.x, dy = b.y - mouse.y, d2 = dx * dx + dy * dy, R = 120;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / R;
          b.x += dx / d * f * 260 * dt; b.y += dy / d * f * 120 * dt;
        }
        if (b.y < -40 || b.x < -40 || b.x > S.W + 40) {
          if (b.tmp) { bubbles.splice(i, 1); continue; }
          Object.assign(b, mk(false));
        }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${b.a * .28})`; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${b.a + .12})`; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.r * .35, b.y - b.r * .35, Math.max(.8, b.r * .2), 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${b.a + .25})`; ctx.fill();
      }
    }
    function burst(x, y, n = 9) {
      for (let i = 0; i < n; i++) {
        bubbles.push({
          x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 20,
          r: 3 + Math.random() * 10, vy: 50 + Math.random() * 90, ph: Math.random() * TAU,
          sp: .6 + Math.random() * 1.2, a: .3 + Math.random() * .25, tmp: true
        });
      }
    }
    return { update, burst, kick() { boost = 3; } };
  })();

  window.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('button, a, input, [data-nodrag], .dock, .topbar')) return;
    bg.burst(e.clientX, e.clientY);
  });

  /* =========================================================
     NAVIGASI HALAMAN: geser, tekan, papan ketik
     ========================================================= */
  const stage = $('#stage');
  const pages = $$('.page');
  const N = pages.length;
  const keys = pages.map(p => p.dataset.key);
  const dock = $('#dock'), pgNum = $('#pgNum'), pgTitle = $('#pgTitle'), hint = $('#hint');
  const hooks = {};
  const tickers = [];

  let index = 0, target = 0, pos = 0, vel = 0, lastRendered = NaN;
  let down = null, dragTarget = 0, suppress = false, wheelLock = 0;

  const chev = d => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
  dock.innerHTML =
    `<button class="nav-arrow" data-dir="-1" aria-label="Halaman sebelumnya">${chev('M15 5l-7 7 7 7')}</button>` +
    pages.map((p, i) => `<button class="dot" data-i="${i}" aria-label="${p.dataset.title}"><span class="num">${i + 1}</span><span class="lbl">${p.dataset.title}</span></button>`).join('') +
    `<button class="nav-arrow" data-dir="1" aria-label="Halaman berikutnya">${chev('M9 5l7 7-7 7')}</button>`;

  // dari hash URL (#p3)
  const m = location.hash.match(/^#p(\d+)$/);
  if (m) index = target = pos = clamp(+m[1] - 1, 0, N - 1);

  function renderPages() {
    if (pos === lastRendered) return;
    lastRendered = pos;
    for (let i = 0; i < N; i++) {
      const off = i - pos, a = Math.abs(off), el = pages[i];
      if (a > 1.15) {
        if (el._vis !== false) { el.style.visibility = 'hidden'; el._vis = false; }
        continue;
      }
      if (el._vis !== true) { el.style.visibility = 'visible'; el._vis = true; }
      const s = 1 - Math.min(a, 1) * 0.09;
      el.style.transform = `translate3d(${(off * 100).toFixed(3)}%,0,0) scale(${s.toFixed(4)})`;
      el.style.setProperty('--off', off.toFixed(4));
    }
  }

  // Pegas (spring) agar perpindahan terasa halus
  function stepNav(dt) {
    if (down && down.active) {
      pos += (dragTarget - pos) * Math.min(1, dt * 22);
      vel = 0;
    } else if (reduceMotion) {
      pos = target;
    } else {
      const k = 150, c = 2 * Math.sqrt(k) * 0.92;
      let rem = dt;
      while (rem > 0) {
        const h = Math.min(rem, 1 / 120);
        vel += (k * (target - pos) - c * vel) * h;
        pos += vel * h;
        rem -= h;
      }
      if (Math.abs(target - pos) < 0.0004 && Math.abs(vel) < 0.002) { pos = target; vel = 0; }
    }
    renderPages();
  }

  function updateUI() {
    $$('.dot', dock).forEach((b, i) => {
      b.classList.toggle('active', i === index);
      b.setAttribute('aria-current', i === index ? 'page' : 'false');
    });
    $$('[data-dir]').forEach(b => { b.disabled = (+b.dataset.dir < 0 && index === 0) || (+b.dataset.dir > 0 && index === N - 1); });
    pgNum.textContent = `${String(index + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    pgTitle.textContent = pages[index].dataset.title;
    pages.forEach((p, i) => {
      if (i === index) p.removeAttribute('inert'); else p.setAttribute('inert', '');
      p.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    document.body.dataset.theme = pages[index].dataset.theme || '0';
  }

  function ripple(ev) {
    if (reduceMotion) return;
    const has = ev && (ev.clientX || ev.clientY);
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = (has ? ev.clientX : innerWidth / 2) + 'px';
    r.style.top = (has ? ev.clientY : innerHeight - 50) + 'px';
    document.body.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  }

  function goTo(i, ev) {
    i = clamp(i, 0, N - 1);
    if (i === index) return;
    const prev = keys[index];
    index = target = i;
    if (hooks[prev] && hooks[prev].leave) hooks[prev].leave();
    pages[i].scrollTop = 0;
    updateUI();
    ripple(ev);
    bg.kick();
    hint.classList.add('gone');
    try { history.replaceState(null, '', '#p' + (i + 1)); } catch (_) { /* file:// */ }
    if (hooks[keys[i]] && hooks[keys[i]].enter) hooks[keys[i]].enter();
  }

  // Geser dengan mouse atau jari
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-nodrag], input, textarea, select')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, lt: performance.now(), v: 0, active: false, pos0: pos, startIndex: index };
  });
  stage.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        down.active = true; down.pos0 = pos;
        try { stage.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
        stage.classList.add('dragging');
      } else if (Math.abs(dy) > 12) { down = null; return; }
      else return;
    }
    const now = performance.now(), dtm = now - down.lt;
    if (dtm > 0) down.v = .75 * down.v + .25 * ((e.clientX - down.lx) / dtm);
    down.lx = e.clientX; down.lt = now;
    const w = stage.clientWidth || 1;
    let tgt = down.pos0 - (e.clientX - down.x) / w;
    if (tgt < 0) tgt *= .35;
    if (tgt > N - 1) tgt = N - 1 + (tgt - (N - 1)) * .35;
    dragTarget = tgt;
  });
  const endDrag = e => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    stage.classList.remove('dragging');
    if (!d.active) return;
    suppress = true; setTimeout(() => { suppress = false; }, 80);
    const w = stage.clientWidth || 1, dx = e.clientX - d.x;
    if (Math.abs(d.v) > .4 || Math.abs(dx) > w * .16) {
      const dir = Math.abs(d.v) > .4 ? (d.v < 0 ? 1 : -1) : (dx < 0 ? 1 : -1);
      goTo(d.startIndex + dir, e);
    }
    vel = -d.v * 1000 / w * .5;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  // cegah "klik" tidak sengaja setelah menggeser
  stage.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

  // Trackpad (geser horizontal)
  stage.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24) {
      const now = performance.now();
      e.preventDefault();
      if (now < wheelLock) return;
      wheelLock = now + 1000;
      goTo(index + (e.deltaX > 0 ? 1 : -1), null);
    }
  }, { passive: false });

  // Papan ketik
  window.addEventListener('keydown', e => {
    const t = e.target;
    if (t && t.matches && t.matches('input, textarea, select, [role="slider"]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(N - 1);
  });

  // Tombol navigasi
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-go], [data-dir], .dot[data-i]');
    if (!el) return;
    if (el.dataset.go !== undefined) goTo(+el.dataset.go, e);
    else if (el.dataset.dir !== undefined) goTo(index + +el.dataset.dir, e);
    else goTo(+el.dataset.i, e);
  });

  /* ---------- Efek kilau & miring pada kartu ---------- */
  $$('[data-tilt]').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', ((.5 - y) * 9).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x - .5) * 11).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });

  /* =========================================================
     BERANDA: hitung naik angka
     ========================================================= */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
    const show = v => { el.textContent = v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
    if (reduceMotion) { show(end); return; }
    const t0 = performance.now(), dur = 1700;
    const step = now => {
      const k = smooth((now - t0) / dur);
      show(end * k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  hooks.home = { enter() { $$('[data-count]').forEach(countUp); } };

  /* =========================================================
     HALAMAN 1: PERJALANAN SEBOTOL PLASTIK (pemutar interaktif)
     ========================================================= */
  (function story() {
    const cv = $('#story');
    if (!cv) return;
    const S = fitCanvas(cv), ctx = S.ctx;
    const player = $('.player'), screen = $('#screen');
    const bigPlay = $('#bigPlay'), playBtn = $('#playBtn'), scrub = $('#scrub');
    const fill = $('#scrubFill'), thumb = $('#scrubThumb'), timeEl = $('#timeLabel');
    const caption = $('#caption'), capK = $('#capK'), capT = $('#capT'), capD = $('#capD');
    const chapEl = $('#chapters');

    const DURATION = 46;
    const chapters = [
      { t: 'Dibuang sembarangan', d: 'Sebotol plastik dibuang begitu saja di pinggir jalan kota. Hujan turun dan menyapunya ke selokan.', a: 0, b: .17 },
      { t: 'Menyusuri sungai', d: 'Selokan bermuara ke sungai. Botol hanyut bersama sampah lain sepanjang aliran.', a: .17, b: .38 },
      { t: 'Tiba di laut', d: 'Arus membawanya keluar dari muara. Sebagian besar sampah laut memang berasal dari daratan.', a: .38, b: .58 },
      { t: 'Terpecah-pecah', d: 'Sinar matahari, gelombang, dan waktu memecah botol menjadi serpihan mikroplastik yang nyaris mustahil diambil kembali.', a: .58, b: .76 },
      { t: 'Dimakan satwa laut', d: 'Plankton dan ikan kecil mengira serpihan itu makanan. Partikelnya naik lewat rantai makanan.', a: .76, b: .91 },
      { t: 'Kembali ke kita', d: 'Ikan hasil tangkapan sampai di meja makan, membawa jejak plastik yang dulu kita buang.', a: .91, b: 1 }
    ];
    let p = 0, playing = false, scrubbing = false, chIdx = -1;

    /* ---- data tetap (agar tidak berkedip) ---- */
    const rnd = mulberry32(11);
    const farB = Array.from({ length: 14 }, (_, i) => ({ x: (i + .5) / 14, w: .06 + rnd() * .04, h: .2 + rnd() * .28 }));
    const nearB = Array.from({ length: 7 }, (_, i) => ({ x: (i + .5) / 7, w: .11 + rnd() * .04, h: .3 + rnd() * .22, win: Array.from({ length: 12 }, () => [rnd(), rnd(), rnd() > .5]) }));
    const rain = Array.from({ length: 80 }, () => ({ x: rnd(), y: rnd(), l: 10 + rnd() * 14, s: .7 + rnd() * .7 }));
    const floats = Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), s: .6 + rnd() * .7, r: rnd() * TAU, t: Math.floor(rnd() * 3), sp: .5 + rnd() }));
    const snow = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd(), r: 1 + rnd() * 2, sp: .2 + rnd() * .5 }));
    const rays = Array.from({ length: 6 }, (_, i) => ({ x: .08 + i * .16 + rnd() * .05, w: .04 + rnd() * .05, sp: .3 + rnd() * .5 }));
    const frags = Array.from({ length: 26 }, (_, i) => ({ a: rnd() * TAU, d: .12 + rnd() * .34, ph: rnd() * TAU, s: 3 + rnd() * 5, fish: i % 3, ox: (rnd() - .5) * 30, oy: (rnd() - .5) * 18 }));
    const fishCfg = [{ bx: .28, by: .36, sz: 1.0 }, { bx: .62, by: .58, sz: 1.25 }, { bx: .42, by: .78, sz: .85 }];
    const plateDots = Array.from({ length: 22 }, () => ({ a: rnd() * TAU, r: Math.sqrt(rnd()) }));

    const chapterAt = v => { for (let i = 0; i < chapters.length; i++) if (v < chapters[i].b) return i; return chapters.length - 1; };
    const mmss = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    /* ---- UI pemutar ---- */
    chapters.slice(0, -1).forEach(c => {
      const tk = document.createElement('i');
      tk.className = 'tick'; tk.style.left = (c.b * 100) + '%';
      scrub.insertBefore(tk, thumb);
    });
    chapEl.innerHTML = chapters.map((c, i) => `<button class="chap" data-c="${i}">${i + 1}. ${c.t}</button>`).join('');
    const chips = $$('.chap', chapEl);
    chips.forEach((b, i) => b.addEventListener('click', () => { p = chapters[i].a + .004; if (!playing) setPlaying(true); }));

    function setPlaying(v) {
      playing = v;
      player.classList.toggle('is-playing', v);
    }
    function toggle() {
      if (!playing && p >= 1) p = 0;
      setPlaying(!playing);
    }
    playBtn.addEventListener('click', toggle);
    bigPlay.addEventListener('click', toggle);

    // bar waktu
    const seek = e => { const r = scrub.getBoundingClientRect(); p = clamp((e.clientX - r.left) / r.width, 0, 1); };
    scrub.addEventListener('pointerdown', e => { try { scrub.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ } scrubbing = true; scrub.classList.add('drag'); seek(e); });
    scrub.addEventListener('pointermove', e => { if (scrubbing && scrub.hasPointerCapture && scrub.hasPointerCapture(e.pointerId)) seek(e); });
    const scrubEnd = () => { scrubbing = false; scrub.classList.remove('drag'); };
    scrub.addEventListener('pointerup', scrubEnd);
    scrub.addEventListener('pointercancel', scrubEnd);
    scrub.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { p = clamp(p + .02, 0, 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { p = clamp(p - .02, 0, 1); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { toggle(); e.preventDefault(); }
    });

    // seret langsung pada layar = memutar maju/mundur, tekan = putar/jeda
    let sd = null;
    screen.addEventListener('pointerdown', e => {
      if (e.target.closest('.big-play')) return;
      sd = { x: e.clientX, p0: p, moved: false, id: e.pointerId };
    });
    screen.addEventListener('pointermove', e => {
      if (!sd || e.pointerId !== sd.id) return;
      const dx = e.clientX - sd.x;
      if (!sd.moved && Math.abs(dx) > 6) {
        sd.moved = true; scrubbing = true;
        try { screen.setPointerCapture(sd.id); } catch (_) { /* abaikan */ }
        screen.classList.add('grabbing');
      }
      if (sd.moved) p = clamp(sd.p0 + dx / (S.W * 1.1), 0, 1);
    });
    const screenEnd = e => {
      if (!sd || e.pointerId !== sd.id) return;
      const moved = sd.moved; sd = null; scrubbing = false;
      screen.classList.remove('grabbing');
      if (!moved && e.type === 'pointerup') toggle();
    };
    screen.addEventListener('pointerup', screenEnd);
    screen.addEventListener('pointercancel', screenEnd);

    function ui() {
      fill.style.width = (p * 100) + '%';
      thumb.style.left = (p * 100) + '%';
      timeEl.textContent = mmss(p * DURATION) + ' / ' + mmss(DURATION);
      scrub.setAttribute('aria-valuenow', Math.round(p * 100));
      const c = chapterAt(p);
      if (c !== chIdx) {
        chIdx = c;
        capK.textContent = `Bab ${c + 1} dari ${chapters.length}`;
        capT.textContent = chapters[c].t;
        capD.textContent = chapters[c].d;
        caption.classList.remove('swap'); void caption.offsetWidth; caption.classList.add('swap');
        chips.forEach((b, i) => b.classList.toggle('on', i === c));
        const on = chips[c];
        if (on && on.scrollIntoView) { chapEl.scrollTo({ left: on.offsetLeft - 20, behavior: 'smooth' }); }
      }
    }

    /* ---- adegan ---- */
    const sky = (W, H, y, stops) => {
      const g = ctx.createLinearGradient(0, 0, 0, y);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, y);
    };
    function junk(x, y, s, rot, type, a) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
      if (type === 0) { ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath(); ctx.ellipse(0, 0, 9 * s, 7 * s, 0, 0, TAU); ctx.fill(); }
      else if (type === 1) { ctx.fillStyle = 'rgba(251,191,36,.88)'; rrect(ctx, -5 * s, -6 * s, 10 * s, 12 * s, 3 * s); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(176,190,200,.92)'; rrect(ctx, -4 * s, -7 * s, 8 * s, 14 * s, 2 * s); ctx.fill(); }
      ctx.restore();
    }

    function sceneCity(W, H, u, t) {
      sky(W, H, H, [[0, '#1d3f57'], [.55, '#4f8394'], [1, '#c8b690']]);
      let g = ctx.createRadialGradient(W * .78, H * .38, 0, W * .78, H * .38, H * .55);
      g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const ground = H * .78;
      ctx.fillStyle = 'rgba(20,56,74,.55)';
      farB.forEach(b => { const bw = b.w * W * 1.3, bh = b.h * H; rrect(ctx, b.x * W - bw / 2, ground - bh, bw, bh + 10, 8 * u); ctx.fill(); });
      nearB.forEach(b => {
        const bw = b.w * W, bh = b.h * H, bx = b.x * W - bw / 2, by = ground - bh;
        ctx.fillStyle = '#0f2c3c'; rrect(ctx, bx, by, bw, bh + 10, 10 * u); ctx.fill();
        b.win.forEach(w => {
          ctx.fillStyle = w[2] ? 'rgba(255,214,120,.85)' : 'rgba(255,255,255,.08)';
          rrect(ctx, bx + 8 * u + w[0] * (bw - 24 * u), by + 10 * u + w[1] * (bh - 30 * u), 6 * u, 8 * u, 2 * u); ctx.fill();
        });
      });
      ctx.fillStyle = '#14303c'; ctx.fillRect(0, ground, W, H - ground);
      ctx.fillStyle = '#21495a'; ctx.fillRect(0, ground, W, 7 * u);
      ctx.fillStyle = '#08181f'; rrect(ctx, W * .13, H * .865, W * .17, 12 * u, 6 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(W * .14 + i * W * .028, H * .87); ctx.lineTo(W * .14 + i * W * .028, H * .87 + 8 * u); ctx.stroke(); }
      const ra = smooth((p - .06) / .05);
      if (ra > 0) {
        ctx.strokeStyle = `rgba(200,230,255,${.5 * ra})`; ctx.lineWidth = 1.2;
        rain.forEach(d => {
          const x = d.x * W, y = (((d.y + t * .9 * d.s) % 1) * H);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4 * u, y + d.l * u); ctx.stroke();
        });
      }
    }

    function sceneRiver(W, H, u, t) {
      sky(W, H, H * .6, [[0, '#35616f'], [1, '#8fb5ae']]);
      ctx.fillStyle = '#2c6a5a';
      [[.15, .55, .35, .14], [.55, .57, .4, .18], [.92, .55, .3, .13]].forEach(h => { ctx.beginPath(); ctx.ellipse(W * h[0], H * h[1], W * h[2], H * h[3], 0, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#1b4a3a';
      for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(W * (i / 15), H * .54, (11 + (i * 7) % 9) * u, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#2f6b4e'; ctx.fillRect(0, H * .54, W, H * .05);
      const g = ctx.createLinearGradient(0, H * .58, 0, H);
      g.addColorStop(0, '#3f8f95'); g.addColorStop(1, '#1b5260');
      ctx.fillStyle = g; ctx.fillRect(0, H * .58, W, H * .42);
      ctx.lineWidth = 2;
      for (let j = 0; j < 6; j++) {
        ctx.strokeStyle = `rgba(255,255,255,${.1 + j * .03})`; ctx.beginPath();
        for (let x = 0; x <= W; x += 12) { const y = H * (.63 + j * .06) + Math.sin(x * .02 - t * 1.4 + j) * 3 * u; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      floats.slice(0, 8).forEach(f => junk((((f.x + t * .02 * f.sp + p * .4) % 1.1) - .05) * W, (.64 + f.y * .3) * H, f.s * u, f.r + Math.sin(t + f.x * 9) * .3, f.t, .95));
    }

    function sceneSea(W, H, u, t) {
      const hz = H * .46;
      sky(W, H, hz, [[0, '#1a4f6a'], [.6, '#6aa3a8'], [1, '#f2c48d']]);
      let g = ctx.createRadialGradient(W * .76, hz, 0, W * .76, hz, H * .5);
      g.addColorStop(0, 'rgba(255,225,160,.8)'); g.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 10);
      ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.arc(W * .76, hz - 4 * u, 22 * u, 0, TAU); ctx.fill();
      g = ctx.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#2b7f95'); g.addColorStop(1, '#0b3a52');
      ctx.fillStyle = g; ctx.fillRect(0, hz, W, H - hz);
      for (let L = 0; L < 3; L++) {
        ctx.fillStyle = `rgba(10,60,85,${.22 + .12 * L})`; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * (.52 + L * .12) + Math.sin(x * .012 * (1 + L * .3) + t * (1 + L * .4) + L * 2) * (3 + L * 2) * u);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
      floats.forEach(f => { const y = (.5 + f.y * .42) * H; junk((((f.x + t * .012 * f.sp + p * .15) % 1.1) - .05) * W, y, f.s * u * (.6 + .6 * y / H), f.r + Math.sin(t * .8 + f.x * 7) * .3, f.t, .95); });
    }

    function sceneWater(W, H, u, t, v) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, v ? '#17758f' : '#1c82a8'); g.addColorStop(.55, '#0b4466'); g.addColorStop(1, '#041b2e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      rays.forEach(r => {
        const x = (r.x + Math.sin(t * .3 * r.sp + r.x * 9) * .03) * W;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + r.w * W, 0); ctx.lineTo(x + r.w * W * .4 - 40 * u, H); ctx.lineTo(x - r.w * W * .8 - 40 * u, H); ctx.closePath(); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= W; x += 10) { const y = 6 * u + Math.sin(x * .03 + t * 1.5) * 3 * u; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      snow.forEach(s => { ctx.beginPath(); ctx.arc((s.x + Math.sin(t * .3 + s.y * 9) * .01) * W, ((s.y + t * .02 * s.sp) % 1) * H, s.r * u * .8, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#071f31';
      ctx.beginPath(); ctx.ellipse(W * .3, H + 8 * u, W * .5, 38 * u, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * .85, H + 10 * u, W * .4, 30 * u, 0, 0, TAU); ctx.fill();
    }

    function scenePlate(W, H, u, t) {
      sky(W, H, H, [[0, '#16262e'], [1, '#26404a']]);
      const cx = W * .5, cy = H * .5, R = Math.min(W * .3, H * .34);
      let g = ctx.createRadialGradient(cx, cy + R * .15, R * .4, cx, cy + R * .15, R * 1.5);
      g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1f7f7'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dfeced'; ctx.beginPath(); ctx.arc(cx, cy, R * .78, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 2; ctx.stroke();
      // ikan bakar
      ctx.fillStyle = '#c28c4b'; ctx.beginPath(); ctx.moveTo(cx - R * .5, cy); ctx.lineTo(cx - R * .78, cy - R * .2); ctx.lineTo(cx - R * .78, cy + R * .2); ctx.closePath(); ctx.fill();
      g = ctx.createLinearGradient(0, cy - R * .22, 0, cy + R * .22); g.addColorStop(0, '#e1b36d'); g.addColorStop(1, '#bf8845');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R * .58, R * .22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(90,50,10,.28)'; ctx.lineWidth = 2 * u;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * R * .16 - 3 * u, cy - R * .16); ctx.lineTo(cx + i * R * .16 + 3 * u, cy + R * .16); ctx.stroke(); }
      ctx.fillStyle = '#2a1a08'; ctx.beginPath(); ctx.arc(cx + R * .42, cy - R * .06, 3 * u, 0, TAU); ctx.fill();
      // irisan lemon
      const lx = cx + R * .48, ly = cy + R * .42;
      ctx.fillStyle = '#ecdf7c'; ctx.beginPath(); ctx.arc(lx, ly, R * .16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#cdbf3a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(lx - Math.cos(a) * R * .14, ly - Math.sin(a) * R * .14); ctx.lineTo(lx + Math.cos(a) * R * .14, ly + Math.sin(a) * R * .14); ctx.stroke(); }
      // butiran mikroplastik
      const lp = smooth((p - .915) / .07), n = Math.floor(lp * plateDots.length);
      plateDots.slice(0, n).forEach((d, i) => {
        const x = cx + Math.cos(d.a) * d.r * R * .5, y = cy + Math.sin(d.a) * d.r * R * .17;
        const pulse = .6 + .4 * Math.sin(t * 3 + i);
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 9 * u);
        gg.addColorStop(0, `rgba(255,210,90,${.7 * pulse})`); gg.addColorStop(1, 'rgba(255,210,90,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 9 * u, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(x, y, 2.4 * u, 0, TAU); ctx.fill();
      });
      if (lp > .6 && n > 0) {
        const d = plateDots[0], x = cx + Math.cos(d.a) * d.r * R * .5, y = cy + Math.sin(d.a) * d.r * R * .17;
        const tx = cx + R * .62, ty = cy - R * .72;
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx - 4 * u, ty + 10 * u); ctx.stroke();
        ctx.font = `600 ${12 * u}px ${FONT}`; const label = 'mikroplastik', tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; rrect(ctx, tx - tw / 2 - 10 * u, ty - 10 * u, tw + 20 * u, 22 * u, 11 * u); ctx.fill();
        ctx.fillStyle = '#ffe08a'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(label, tx, ty + 1 * u);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }

    const scenes = [sceneCity, sceneRiver, sceneSea, (W, H, u, t) => sceneWater(W, H, u, t, 0), (W, H, u, t) => sceneWater(W, H, u, t, 1), scenePlate];

    /* ---- botol, ikan, serpihan ---- */
    const kf = [
      { p: 0,    x: .50, y: -.14, r: -.6, e: 'in' },
      { p: .075, x: .50, y: .70,  r: .4,  e: 'out' },
      { p: .12,  x: .50, y: .72,  r: .9,  e: 's' },
      { p: .17,  x: .22, y: .80,  r: 1.45, e: 's' },
      { p: .215, x: .16, y: .64,  r: 1.57, e: 's' },
      { p: .38,  x: .56, y: .64,  r: 1.57, e: 'l' },
      { p: .58,  x: .82, y: .55,  r: 1.6, e: 'l' },
      { p: .65,  x: .55, y: .44,  r: 1.2, e: 's' },
      { p: .70,  x: .50, y: .46,  r: .9,  e: 's' }
    ];
    function bottlePose() {
      let i = 0; while (i < kf.length - 2 && p > kf[i + 1].p) i++;
      const a = kf[i], b = kf[i + 1];
      let k = clamp((p - a.p) / (b.p - a.p), 0, 1);
      k = a.e === 'in' ? k * k : a.e === 'out' ? 1 - (1 - k) * (1 - k) : a.e === 'l' ? k : smooth(k);
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: lerp(a.r, b.r, k) };
    }
    function drawBottle(W, H, u, t) {
      const a = 1 - smooth((p - .665) / .05);
      if (a < .01) return;
      const s = (1 - .3 * smooth((p - .66) / .06)) * u;
      const q = bottlePose();
      const fl = smooth((p - .19) / .03) * (1 - smooth((p - .62) / .04));
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(q.x * W, q.y * H + Math.sin(t * 2.1) * 4 * u * fl);
      ctx.rotate(q.r + Math.sin(t * 1.6) * .1 * fl);
      ctx.scale(s, s);
      const g = ctx.createLinearGradient(-13, 0, 13, 0);
      g.addColorStop(0, 'rgba(210,242,255,.9)'); g.addColorStop(1, 'rgba(120,190,225,.7)');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
      rrect(ctx, -13, -20, 26, 50, 9); ctx.fill(); ctx.stroke();
      rrect(ctx, -6, -32, 12, 16, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2563eb'; rrect(ctx, -7.5, -39, 15, 8, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; rrect(ctx, -13, -2, 26, 16, 2); ctx.fill();
      ctx.fillStyle = 'rgba(37,99,235,.55)'; rrect(ctx, -8, 3, 16, 3, 1.5); ctx.fill();
      ctx.restore();
    }
    function fishPos(k, W, H, t) {
      const c = fishCfg[k];
      return { x: (c.bx + .04 * Math.sin(p * 18 + k * 2.1 + t * .4)) * W, y: (c.by + .03 * Math.cos(p * 14 + k + t * .5)) * H, s: c.sz };
    }
    function drawFishes(W, H, u, t) {
      const a = smooth((p - .72) / .05) * (1 - smooth((p - .905) / .03));
      if (a < .01) return;
      fishCfg.forEach((_, k) => {
        const f = fishPos(k, W, H, t), L = 44 * f.s * u, Hh = 17 * f.s * u;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x, f.y);
        ctx.save(); ctx.translate(-L * .8, 0); ctx.rotate(Math.sin(t * 5 + k) * .18);
        ctx.fillStyle = '#7fb5c4'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-L * .45, -Hh * .8); ctx.lineTo(-L * .45, Hh * .8); ctx.closePath(); ctx.fill(); ctx.restore();
        const g = ctx.createLinearGradient(0, -Hh, 0, Hh); g.addColorStop(0, '#a9d4df'); g.addColorStop(1, '#dcf0f2');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, L, Hh, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(60,120,140,.55)'; ctx.beginPath(); ctx.ellipse(-L * .1, Hh * .5, L * .3, Hh * .28, .5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0a2a3a'; ctx.beginPath(); ctx.arc(L * .62, -Hh * .2, 2.4 * f.s * u, 0, TAU); ctx.fill();
        ctx.restore();
      });
    }
    function drawFrags(W, H, u, t) {
      const a = smooth((p - .655) / .02) * (1 - smooth((p - .905) / .03));
      if (a < .01) return;
      const spread = smooth((p - .64) / .1), conv1 = smooth((p - .80) / .06), conv2 = smooth((p - .86) / .04);
      ctx.fillStyle = 'rgba(255,208,90,.96)';
      frags.forEach(f => {
        let x = .5 * W + Math.cos(f.a) * f.d * W * .9 * spread + Math.sin(t * .8 + f.ph) * 6 * u * spread + f.ox * u * (1 - spread);
        let y = .46 * H + Math.sin(f.a) * f.d * H * .75 * spread + Math.cos(t * .7 + f.ph) * 5 * u * spread + f.oy * u * (1 - spread);
        const fp = fishPos(f.fish, W, H, t);
        const mx = fp.x + 44 * fp.s * u * .95, my = fp.y;
        const bx = fp.x + f.ox * .9 * fp.s * u, by = fp.y + f.oy * .5 * fp.s * u;
        x = lerp(lerp(x, mx, conv1), bx, conv2); y = lerp(lerp(y, my, conv1), by, conv2);
        const r = f.s * u * (1 - .4 * spread) * (1 - .3 * conv2);
        ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.rotate(f.ph + t * .6);
        rrect(ctx, -r, -r * .6, r * 2, r * 1.2, r * .4); ctx.fill(); ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    function render(t) {
      const W = S.W, H = S.H, u = Math.max(.62, H / 360);
      ctx.clearRect(0, 0, W, H);
      const ov = .03; let done = false;
      for (let k = 0; k < chapters.length - 1; k++) {
        const B = chapters[k].b;
        if (Math.abs(p - B) < ov) {
          scenes[k](W, H, u, t);
          ctx.save(); ctx.globalAlpha = smooth((p - (B - ov)) / (2 * ov)); scenes[k + 1](W, H, u, t); ctx.restore();
          done = true; break;
        }
      }
      if (!done) scenes[chapterAt(p)](W, H, u, t);
      drawBottle(W, H, u, t);
      drawFishes(W, H, u, t);
      drawFrags(W, H, u, t);
    }

    hooks.story = { leave() { setPlaying(false); } };
    tickers.push({
      page: keys.indexOf('story'),
      fn(dt, t) {
        if (playing && !scrubbing) {
          p += dt / DURATION;
          if (p >= 1) { p = 1; setPlaying(false); }
        }
        render(t); ui();
      }
    });
    ui();
  })();

  /* =========================================================
     HALAMAN 2: MENYELAM
     ========================================================= */
  (function dive() {
    const cv = $('#dive');
    if (!cv) return;
    const S = fitCanvas(cv), ctx = S.ctx;
    const range = $('#depthRange'), autoBtn = $('#autoDive');
    const body = $('#zoneBody'), nameEl = $('#zoneName'), textEl = $('#zoneText'), idxEl = $('#zoneIdx');
    const dEl = $('#rDepth'), pEl = $('#rPress'), lEl = $('#rLight');

    const MAXD = 11000;
    const toDepth = v => MAXD * Math.pow(v / 1000, 1.8);
    let vNow = 0, vTarget = 0, auto = false, curZone = -1;

    const zones = [
      { n: 'Zona Epipelagik', to: 200, t: 'Zona yang masih ditembus cahaya matahari. Sebagian besar plastik terapung ada di sini, dan penyu sering keliru mengira kantong plastik sebagai ubur-ubur.' },
      { n: 'Zona Mesopelagik', to: 1000, t: 'Zona senja dengan cahaya yang menipis. Mikroplastik ditemukan pada plankton dan ikan kecil yang naik-turun setiap hari, membawa partikel plastik ke kedalaman.' },
      { n: 'Zona Batipelagik', to: 4000, t: 'Gelap total, hanya ada cahaya dari makhluk bioluminesen. Serat mikroplastik terdeteksi pada sedimen dan hewan laut dalam.' },
      { n: 'Zona Abisopelagik', to: 6000, t: 'Dataran dasar samudra. Kamera robot pernah merekam kantong plastik, botol, dan jaring yang mengendap di dasar.' },
      { n: 'Zona Hadal', to: 11000, t: 'Palung terdalam di Bumi. Sebuah kantong plastik pernah terekam di Palung Mariana pada sekitar 10.900 m, dan mikroplastik ditemukan pada krustasea kecil di palung-palung ini.' }
    ];
    const zoneOf = d => { for (let i = 0; i < zones.length; i++) if (d < zones[i].to) return i; return zones.length - 1; };

    const dk = [[0, [64, 196, 230]], [200, [18, 112, 160]], [1000, [9, 46, 86]], [4000, [6, 22, 46]], [11000, [3, 8, 18]]];
    function depthColor(d) {
      for (let i = 0; i < dk.length - 1; i++) {
        const [d0, c0] = dk[i], [d1, c1] = dk[i + 1];
        if (d <= d1) { const k = clamp((d - d0) / (d1 - d0), 0, 1); return c0.map((v, j) => Math.round(lerp(v, c1[j], k))); }
      }
      return dk[dk.length - 1][1];
    }
    const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

    const R = mulberry32(5);
    const snow = Array.from({ length: 70 }, () => ({ x: R(), y: R(), r: .8 + R() * 1.8, z: .4 + R() * .8, sp: .3 + R() }));
    const rays = Array.from({ length: 6 }, (_, i) => ({ x: .05 + i * .17 + R() * .05, w: .05 + R() * .06, sp: .3 + R() * .5 }));
    const types = [{ a: 0, b: 5000 }, { a: 0, b: 3500 }, { a: 300, b: 7000 }, { a: 2000, b: 9000 }];
    const debris = Array.from({ length: 16 }, (_, i) => { const ty = i % 4; return { x: .12 + R() * .76, y: R(), k: .5 + R() * 1.0, type: ty, a: types[ty].a, b: types[ty].b, rot: R() * TAU, s: .8 + R() * .6, ph: R() * TAU }; });
    const glow = Array.from({ length: 14 }, () => ({ x: .08 + R() * .84, y: R(), k: .3 + R() * .5, ph: R() * TAU }));
    const vis = (d, a, b) => (a <= 0 ? 1 : smooth((d - a) / 300)) * (1 - smooth((d - b) / 600));

    function drawDebris(type) {
      if (type === 0) {
        ctx.fillStyle = 'rgba(255,255,255,.66)'; ctx.strokeStyle = 'rgba(255,255,255,.66)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -12); ctx.bezierCurveTo(-22, 6, -12, 24, 0, 22); ctx.bezierCurveTo(14, 24, 24, 6, 14, -12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-7, -14, 6, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(7, -14, 6, Math.PI, 0); ctx.stroke();
      } else if (type === 1) {
        ctx.fillStyle = 'rgba(186,230,253,.75)'; rrect(ctx, -7, -16, 14, 32, 5); ctx.fill();
        ctx.fillStyle = '#60a5fa'; rrect(ctx, -3.5, -23, 7, 7, 2); ctx.fill();
      } else if (type === 2) {
        ctx.strokeStyle = 'rgba(190,215,190,.8)'; ctx.lineWidth = 1.2;
        for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 8, -20); ctx.lineTo(-14 + i * 8, 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-20, -20 + i * 8); ctx.lineTo(20, -14 + i * 8); ctx.stroke(); }
      } else {
        ctx.fillStyle = 'rgba(176,190,200,.92)'; rrect(ctx, -7, -12, 14, 24, 3); ctx.fill();
        ctx.fillStyle = 'rgba(220,70,70,.85)'; ctx.fillRect(-7, -3, 14, 6);
      }
    }

    function draw(d, t) {
      const W = S.W, H = S.H, u = Math.max(.7, H / 480), sc = vNow;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(depthColor(d))); g.addColorStop(1, rgb(depthColor(d + 900)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const ra = Math.max(0, 1 - d / 450);
      if (ra > 0) {
        ctx.fillStyle = `rgba(255,255,255,${.1 * ra})`;
        rays.forEach(r => {
          const x = (r.x + Math.sin(t * .3 * r.sp + r.x * 9) * .03) * W;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + r.w * W, 0); ctx.lineTo(x + r.w * W * .4 - 60 * u, H); ctx.lineTo(x - r.w * W * .8 - 60 * u, H); ctx.closePath(); ctx.fill();
        });
      }
      // lereng palung
      const tr = smooth((d - 6000) / 3000);
      if (tr > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.38)';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * .16 * tr, 0); ctx.lineTo(W * .05 * tr, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - W * .16 * tr, 0); ctx.lineTo(W - W * .05 * tr, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
      // dasar laut
      const sb = smooth((d - 5400) / 700);
      if (sb > 0) {
        ctx.fillStyle = `rgba(18,20,30,${.92 * sb})`;
        ctx.beginPath(); ctx.ellipse(W * .3, H + 12 * u - sb * 52 * u, W * .55, 50 * u, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(W * .82, H + 14 * u - sb * 44 * u, W * .45, 42 * u, 0, 0, TAU); ctx.fill();
      }
      // salju laut
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      const span = H + 40;
      snow.forEach(s => {
        const y = ((((s.y * span - sc * .9 * s.z + t * 6 * s.sp) % span) + span) % span) - 20;
        ctx.beginPath(); ctx.arc((s.x + Math.sin(t * .3 + s.y * 9) * .012) * W, y, s.r * u, 0, TAU); ctx.fill();
      });
      // makhluk bioluminesen
      const ga = smooth((d - 500) / 500) * (1 - smooth((d - 9000) / 1500));
      if (ga > .02) {
        glow.forEach(o => {
          const y = ((((o.y * span - sc * .5 * o.k) % span) + span) % span) - 20, x = o.x * W + Math.sin(t * .4 + o.ph) * 10 * u;
          const pu = .5 + .5 * Math.sin(t * 1.6 + o.ph), gg = ctx.createRadialGradient(x, y, 0, x, y, 14 * u);
          gg.addColorStop(0, `rgba(120,255,230,${.8 * ga * pu})`); gg.addColorStop(1, 'rgba(120,255,230,0)');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 14 * u, 0, TAU); ctx.fill();
        });
      }
      // sampah
      const sp2 = H + 120;
      debris.forEach(it => {
        const a = vis(d, it.a, it.b); if (a < .02) return;
        const y = ((((it.y * sp2 - sc * 1.1 * it.k - t * 4 * it.s) % sp2) + sp2) % sp2) - 60;
        const x = (it.x + Math.sin(t * .5 + it.ph) * .03) * W;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(it.rot + Math.sin(t * .6 + it.ph) * .4); ctx.scale(u * it.s, u * it.s);
        drawDebris(it.type); ctx.restore();
      });
      // kantong plastik di Palung Mariana
      const mb = smooth((d - 9600) / 600);
      if (mb > .02) {
        const bx = W * .5, by = H * .72 + Math.sin(t * .8) * 4 * u;
        const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 70 * u); gg.addColorStop(0, `rgba(255,255,255,${.28 * mb})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, by, 70 * u, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalAlpha = mb; ctx.translate(bx, by); ctx.rotate(-.2); ctx.scale(2.6 * u, 2.6 * u); drawDebris(0); ctx.restore();
        ctx.globalAlpha = mb; ctx.font = `600 ${12 * u}px ${FONT}`; const lb = 'Kantong plastik · Palung Mariana', tw = ctx.measureText(lb).width;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; rrect(ctx, bx - tw / 2 - 10 * u, by + 52 * u, tw + 20 * u, 24 * u, 12 * u); ctx.fill();
        ctx.fillStyle = '#e6f6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lb, bx, by + 64 * u);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      }
      // kapal selam
      const sx = W * .5, sy = H * .3 + Math.sin(t * 1.5) * 4 * u;
      if (d > 120) {
        const la = smooth((d - 120) / 400), lg = ctx.createLinearGradient(sx + 38 * u, sy, sx + 130 * u, sy + 90 * u);
        lg.addColorStop(0, `rgba(255,248,200,${.5 * la})`); lg.addColorStop(1, 'rgba(255,248,200,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(sx + 36 * u, sy); ctx.lineTo(sx + 150 * u, sy - 10 * u); ctx.lineTo(sx + 150 * u, sy + 100 * u); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(sx, sy);
      ctx.fillStyle = '#f4c542'; rrect(ctx, -38 * u, -17 * u, 76 * u, 34 * u, 17 * u); ctx.fill();
      ctx.fillStyle = '#d9a526'; rrect(ctx, -12 * u, -26 * u, 24 * u, 12 * u, 6 * u); ctx.fill();
      ctx.fillStyle = '#0f3550'; ctx.beginPath(); ctx.arc(12 * u, -1 * u, 9 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2 * u; ctx.stroke();
      ctx.fillStyle = '#d9a526'; ctx.save(); ctx.translate(-42 * u, 0); ctx.rotate(t * 9); rrect(ctx, -2 * u, -10 * u, 4 * u, 20 * u, 2 * u); ctx.fill(); ctx.restore();
      ctx.restore();
      // meteran kedalaman
      ctx.fillStyle = 'rgba(255,255,255,.2)'; rrect(ctx, 14, 18, 6, H - 36, 3); ctx.fill();
      const my = 18 + (H - 36) * (sc / 1000);
      ctx.fillStyle = '#5eead4'; ctx.beginPath(); ctx.arc(17, my, 7, 0, TAU); ctx.fill();
      ctx.font = `600 ${10 * u}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.fillText('0 m', 28, 26); ctx.fillText('11 km', 28, H - 14);
    }

    function readouts(d) {
      const z = zoneOf(d);
      if (z !== curZone) {
        curZone = z;
        idxEl.textContent = `Zona ${z + 1} dari ${zones.length}`;
        nameEl.textContent = zones[z].n;
        textEl.textContent = zones[z].t;
        body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
      }
      dEl.textContent = fmt(d) + ' m';
      pEl.textContent = fmt(1 + d / 10) + ' atm';
      lEl.textContent = d < 200 ? Math.max(1, Math.round(100 * Math.exp(-d / 45))) + '%' : d < 1000 ? 'sangat redup' : 'gelap total';
    }

    function setBtn() { autoBtn.textContent = auto ? 'Jeda' : (vTarget >= 999 ? 'Naik ke permukaan' : 'Selam otomatis'); }
    autoBtn.addEventListener('click', () => {
      if (!auto && vTarget >= 999) { vTarget = 0; range.value = 0; paintRange(range); setBtn(); return; }
      auto = !auto; setBtn();
    });
    range.addEventListener('input', () => { vTarget = +range.value; auto = false; paintRange(range); setBtn(); });
    paintRange(range);

    tickers.push({
      page: keys.indexOf('dive'),
      fn(dt, t) {
        if (auto) {
          vTarget = Math.min(1000, vTarget + dt * 60); range.value = vTarget; paintRange(range);
          if (vTarget >= 1000) { auto = false; setBtn(); }
        }
        vNow += (vTarget - vNow) * Math.min(1, dt * 5);
        const d = toDepth(vNow);
        draw(d, t); readouts(d);
      }
    });
    readouts(0);
  })();

  /* =========================================================
     HALAMAN 3: JENIS LIMBAH
     ========================================================= */
  (function types() {
    const list = $('#typeList'), det = $('#typeDetail');
    if (!list) return;
    const data = [
      { icon: '🧴', name: 'Plastik dan sampah padat', sum: 'Botol, kantong, sedotan, dan kemasan sekali pakai yang terbawa dari daratan lewat selokan dan sungai.',
        source: 'Sampah rumah tangga dan kota yang tidak terkelola, kemasan sekali pakai, serta tempat pembuangan terbuka.',
        impact: 'Satwa terjerat atau menelan plastik, habitat tertutup, dan sampah menumpuk di pesisir.',
        stat: ['±80%', 'sampah laut berasal dari aktivitas di darat'] },
      { icon: '🔬', name: 'Mikroplastik', sum: 'Serpihan plastik berukuran di bawah 5 milimeter, hasil pecahan plastik yang lebih besar atau dilepas langsung.',
        source: 'Pecahan plastik besar, serat pakaian sintetis, debu ban kendaraan, dan butiran mikro pada beberapa produk perawatan tubuh.',
        impact: 'Dimakan plankton hingga ikan, lalu masuk ke rantai makanan. Pada penelitian tertentu sudah ditemukan di garam laut, air kemasan, bahkan darah manusia.',
        stat: ['< 5 mm', 'ukuran mikroplastik, nyaris mustahil diambil kembali']},
      { icon: '🪢', name: 'Jaring hantu', sum: 'Jaring dan alat tangkap yang hilang atau dibuang di laut, lalu terus menjerat satwa tanpa ada yang mengawasi.',
        source: 'Alat tangkap yang putus, tersangkut karang, atau sengaja dibuang.',
        impact: 'Menjerat penyu, hiu, dan lumba-lumba, serta merusak terumbu karang selama bertahun-tahun.',
        stat: ['±46%', 'massa sampah di Great Pacific Garbage Patch berupa jaring']},
      { icon: '🛢️', name: 'Tumpahan minyak', sum: 'Minyak mentah atau bahan bakar yang tumpah ke laut dan menyebar di permukaan.',
        source: 'Kecelakaan kapal tanker, kebocoran pengeboran lepas pantai, dan pembuangan limbah kapal.',
        impact: 'Melapisi bulu burung laut dan insang ikan, meracuni terumbu serta mangrove, dan bertahan lama di sedimen pesisir.',
        stat: ['±4,9 juta barel', 'minyak tumpah pada insiden Deepwater Horizon (2010)']},
      { icon: '⚗️', name: 'Limbah kimia dan pupuk', sum: 'Zat kimia industri, logam berat, dan limpasan pupuk pertanian yang mengalir ke sungai lalu ke laut.',
        source: 'Pabrik tanpa pengolahan limbah, tambang, dan lahan pertanian dengan pupuk berlebih.',
        impact: 'Kelebihan nutrien memicu ledakan alga dan zona mati yang kekurangan oksigen. Logam berat menumpuk pada biota laut.',
        stat: ['ratusan', 'zona mati (miskin oksigen) tercatat di perairan dunia']},
      { icon: '🏘️', name: 'Limbah domestik', sum: 'Air limbah rumah tangga: deterjen, tinja, dan sisa makanan yang tidak diolah sebelum dibuang.',
        source: 'Saluran buangan langsung ke sungai dan pantai, serta septic tank yang bocor.',
        impact: 'Menyebarkan bakteri penyebab penyakit, menurunkan kadar oksigen air, dan merusak terumbu karang serta padang lamun.',
        stat: ['±44%', 'air limbah rumah tangga dunia belum diolah dengan aman (data PBB, 2020)']}
    ];
    list.innerHTML = data.map((t, i) =>
      `<button class="type-btn glass" role="tab" data-t="${i}" aria-selected="false"><span class="ico">${t.icon}</span><b>${t.name}</b></button>`).join('');
    const btns = $$('.type-btn', list);
    function show(i) {
      const t = data[i];
      btns.forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-selected', i === j); });
      det.innerHTML =
        `<div class="td-body swap">
           <div class="td-head"><span class="td-ico">${t.icon}</span><h3>${t.name}</h3></div>
           <p class="td-sum">${t.sum}</p>
           <div class="td-stat"><b>${t.stat[0]}</b><span>${t.stat[1]}</span></div>
           <dl>
             <div><dt>Dari mana asalnya</dt><dd>${t.source}</dd></div>
             <div><dt>Dampaknya</dt><dd>${t.impact}</dd></div>
           </dl>
         </div>`;
    }
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    show(0);
  })();

  /* =========================================================
     HALAMAN 4: WAKTU TERURAI
     ========================================================= */
  (function decay() {
    const grid = $('#decayGrid');
    if (!grid) return;
    const range = $('#tmRange'), yEl = $('#tmYear'), sum = $('#tmSummary');
    grid.innerHTML = ITEMS.map(it =>
      `<article class="dc glass">
         <div class="dc-top"><span class="ico">${it.i}</span><div><b>${it.n}</b><small>${it.lab}</small></div></div>
         <div class="dc-bar"><i></i></div>
         <span class="dc-state">Masih bertahan</span>
       </article>`).join('');
    const cards = $$('.dc', grid);
    const tOf = v => 0.04 * Math.pow(5000 / 0.04, v / 1000);
    const label = t => {
      if (t < .9) return Math.max(2, Math.round(t * 52)) + ' minggu';
      if (t < 1.5) return '1 tahun';
      if (t < 1000) return Math.round(t) + ' tahun';
      return fmt(Math.round(t / 10) * 10) + ' tahun';
    };
    function render() {
      const v = +range.value, t = tOf(v);
      paintRange(range);
      yEl.textContent = label(t);
      let n = 0;
      ITEMS.forEach((it, i) => {
        const k = clamp(t / it.y, 0, 1), done = t >= it.y;
        if (done) n++;
        const c = cards[i];
        c.classList.toggle('done', done);
        c.querySelector('i').style.width = (k * 100) + '%';
        c.querySelector('.dc-state').textContent = done ? 'Sudah terurai' : 'Masih bertahan';
      });
      sum.textContent = n === 0 ? 'Belum ada yang terurai. Semuanya masih tertinggal di alam.'
        : n === ITEMS.length ? 'Semua benda akhirnya terurai, setelah ribuan tahun.'
        : `${n} dari ${ITEMS.length} benda sudah terurai pada titik waktu ini.`;
    }
    range.addEventListener('input', render);
    render();
  })();

  /* =========================================================
     HALAMAN 5: GAME BERSIHKAN LAUT
     ========================================================= */
  (function game() {
    const sea = $('#sea'), layer = $('#seaItems');
    if (!sea) return;
    const countEl = $('#gCount'), clearEl = $('#gClear'), bar = $('#gBar'), win = $('#gWin');
    const TOTAL = 18; let got = 0;

    function update() {
      const k = got / TOTAL;
      countEl.textContent = `${got} / ${TOTAL}`;
      clearEl.textContent = Math.round(k * 100) + '%';
      bar.style.width = (k * 100) + '%';
      sea.style.setProperty('--clear', k);
      if (got === TOTAL) setTimeout(() => { win.hidden = false; }, 700);
    }
    function collect(b, it) {
      if (b.classList.contains('pop')) return;
      b.classList.add('pop'); got++;
      const r = b.getBoundingClientRect(), s = sea.getBoundingClientRect();
      const x = r.left - s.left + r.width / 2, y = r.top - s.top + r.height / 2;
      const f = document.createElement('div');
      f.className = 'fact'; f.innerHTML = `<b>${it.n}</b> · ${it.lab}`;
      f.style.left = clamp(x - 60, 6, Math.max(6, s.width - 190)) + 'px';
      f.style.top = Math.max(6, y - 40) + 'px';
      sea.appendChild(f); setTimeout(() => f.remove(), 1900);
      for (let i = 0; i < 6; i++) {
        const bu = document.createElement('span');
        bu.className = 'bub'; bu.style.left = (x + (Math.random() - .5) * 34) + 'px'; bu.style.top = (y + (Math.random() - .5) * 20) + 'px';
        bu.style.setProperty('--s', (5 + Math.random() * 9) + 'px'); bu.style.setProperty('--bx', ((Math.random() - .5) * 30) + 'px');
        sea.appendChild(bu); setTimeout(() => bu.remove(), 1000);
      }
      setTimeout(() => b.remove(), 480);
      update();
    }
    function spawn() {
      layer.innerHTML = ''; got = 0; win.hidden = true;
      const rd = Math.random;
      for (let i = 0; i < TOTAL; i++) {
        const it = ITEMS[i % ITEMS.length];
        const b = document.createElement('button');
        b.className = 'trash'; b.type = 'button'; b.textContent = it.i; b.setAttribute('aria-label', 'Angkat ' + it.n);
        b.style.left = (3 + rd() * 80) + '%'; b.style.top = (5 + rd() * 72) + '%';
        b.style.setProperty('--dx', (rd() * 50 - 25) + 'px'); b.style.setProperty('--dy', (rd() * 40 - 20) + 'px');
        b.style.setProperty('--dur', (4 + rd() * 4) + 's'); b.style.setProperty('--delay', (-rd() * 5) + 's');
        b.addEventListener('click', () => collect(b, it));
        layer.appendChild(b);
      }
      update();
    }
    $('#gReset').addEventListener('click', spawn);
    $('#gAgain').addEventListener('click', spawn);
    spawn();
  })();

  /* =========================================================
     HALAMAN 6: AKSI
     ========================================================= */
  (function actions() {
    const grid = $('#actGrid');
    if (!grid) return;
    const acts = [
      { i: '🛍️', t: 'Bawa wadah sendiri', d: 'Tas belanja, botol minum, dan kotak makan mengurangi kemasan sekali pakai.' },
      { i: '♻️', t: 'Pilah sampah dari rumah', d: 'Organik, anorganik, dan residu dipisah agar lebih mudah didaur ulang.' },
      { i: '🚫', t: 'Jangan buang ke selokan', d: 'Selokan dan sungai bermuara ke laut. Sampah kecil seperti puntung rokok pun ikut terbawa.' },
      { i: '👕', t: 'Pilih pakaian dengan bijak', d: 'Pakaian sintetis melepaskan mikroplastik saat dicuci. Pilih bahan alami dan cuci seperlunya.' },
      { i: '🤝', t: 'Ikut bersih-bersih', d: 'Bergabung dalam kerja bakti sungai atau pantai membuat dampak terasa nyata.' },
      { i: '📣', t: 'Ajak orang sekitar', d: 'Bagikan apa yang kamu pelajari. Kebiasaan menyebar lewat contoh.' }
    ];
    grid.innerHTML = acts.map((a, i) =>
      `<button class="act glass" data-a="${i}" aria-pressed="false">
         <span class="chk"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
         <span class="ico">${a.i}</span><b>${a.t}</b><span class="d">${a.d}</span>
       </button>`).join('');
    const ring = $('#ringFg'), nEl = $('#pledgeN'), tEl = $('#pledgeTitle'), dEl = $('#pledgeText');
    const C = 2 * Math.PI * 44;
    ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C;
    function update() {
      const n = $$('.act.on', grid).length;
      ring.style.strokeDashoffset = C * (1 - n / acts.length);
      nEl.textContent = n;
      tEl.textContent = n === 0 ? 'Pilih komitmenmu' : n < acts.length ? `${n} komitmen dipilih` : 'Komitmen lengkap';
      dEl.textContent = n === 0 ? 'Tekan kartu untuk menandai kebiasaan yang akan kamu mulai.'
        : n < acts.length ? 'Perubahan besar dimulai dari kebiasaan kecil yang konsisten.'
        : 'Terima kasih. Mulai hari ini, satu per satu.';
    }
    grid.addEventListener('click', e => {
      const b = e.target.closest('.act'); if (!b) return;
      const on = b.classList.toggle('on');
      b.setAttribute('aria-pressed', on);
      if (on) { const r = b.getBoundingClientRect(); bg.burst(r.left + r.width - 30, r.top + 30, 7); }
      update();
    });
  })();

  /* =========================================================
     MULAI
     ========================================================= */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    stepNav(dt);
    bg.update(dt, t);
    for (const tk of tickers) if (tk.page >= 0 && Math.abs(pos - tk.page) < 1.05) tk.fn(dt, t);
    requestAnimationFrame(frame);
  }
  updateUI();
  renderPages();
  if (hooks[keys[index]] && hooks[keys[index]].enter) hooks[keys[index]].enter();
  requestAnimationFrame(frame);
})();