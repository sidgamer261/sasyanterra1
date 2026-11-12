/* ==========================================================================
   SASYANTERRA x RP0X — Interactive Dot Physics, Explosions & Lab Engine
   Zero dependencies, offline/file:// safe (synchronous Path2D SYT sampling),
   IntersectionObserver gated (0 idle CPU offscreen), reduced-motion aware.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var DPR = function () { return Math.min(window.devicePixelRatio || 1, 2); };
  var buzz = function (ms) {
    if (!reduce && navigator.vibrate) { try { navigator.vibrate(ms || 12); } catch (e) {} }
  };

  /* Exact pixel-verified SYT monogram vector paths in viewBox [0, 0, 784, 424] */
  var SYT_VB = [784, 424];
  var SYT_PATHS = {
    s: 'M165 11L129 11A119 119 0 0 0 129 249L205 249A44.5 44.5 0 0 1 205 338L56 338L13 411L205 411A118 118 0 0 0 205 175L129 175A45 45 0 0 1 129 85L215 85Z',
    y: 'M194 11L282 11L393 174L434 112L520 112L428 248L428 356L375 411L356 411L356 248Z',
    t: 'M492 11L770 11L727 85L636 85L636 356L583 411L564 411L564 85L449 85Z'
  };

  var COPPER = '#e5924c', COPPER_HI = '#f6b072', CYAN = '#5ce6ff', GREEN = '#68cf93', INK = '#0b0d10', PAPER = '#f5f5f2';

  function whileVisible(el, fn) {
    if (!el) return function () {};
    var raf = 0, vis = false, t0 = 0;
    function frame(ts) {
      if (!vis) { raf = 0; return; }
      fn(ts, ts - (t0 || ts));
      t0 = ts;
      raf = requestAnimationFrame(frame);
    }
    if (!('IntersectionObserver' in window)) {
      vis = true;
      raf = requestAnimationFrame(frame);
      return function () { vis = false; cancelAnimationFrame(raf); };
    }
    var io = new IntersectionObserver(function (es) {
      vis = es[0].isIntersecting;
      if (vis && !raf) { t0 = 0; raf = requestAnimationFrame(frame); }
    }, { threshold: 0.01 });
    io.observe(el);
    return function () { vis = false; io.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; };
  }

  function smoothTo(y) {
    if (window.SasyanterraSmooth && window.SasyanterraSmooth.to) window.SasyanterraSmooth.to(y);
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* Synchronously rasterizes SYT paths onto an offscreen canvas (100% file:// safe) */
  function sampleSYTPoints(cw, step) {
    var ch = Math.round(cw * SYT_VB[1] / SYT_VB[0]);
    var off = doc.createElement('canvas');
    off.width = cw; off.height = ch;
    var oc = off.getContext('2d');
    var sc = cw / SYT_VB[0];
    oc.save();
    oc.scale(sc, sc);
    if (typeof Path2D === 'function') {
      oc.fillStyle = '#ffffff';
      oc.fill(new Path2D(SYT_PATHS.s));
      oc.fill(new Path2D(SYT_PATHS.t));
      oc.fillStyle = '#ff6600'; // tag center Y glyph for copper highlight
      oc.fill(new Path2D(SYT_PATHS.y));
    }
    oc.restore();
    var d = oc.getImageData(0, 0, cw, ch).data;
    var outerPts = [], yPts = [], allPts = [];
    for (var y = 0; y < ch; y += step) {
      for (var x = 0; x < cw; x += step) {
        var k = (y * cw + x) * 4;
        if (d[k + 3] > 128) {
          var isY = d[k + 2] < 80;
          var item = {
            x: x,
            y: y,
            nx: (x / cw - 0.5),
            ny: (y / cw - ch / cw / 2),
            isY: isY,
            dist: Math.hypot(x - cw * 0.5, y - ch * 0.5)
          };
          allPts.push(item);
          if (isY) yPts.push(item); else outerPts.push(item);
        }
      }
    }
    return { w: cw, h: ch, all: allPts, yPts: yPts, outerPts: outerPts };
  }

  /* ==========================================================================
     1. HERO INTERACTIVE DOT-GRID & SHOCKWAVE RIPPLE
     ========================================================================== */
  function initHeroDots() {
    var cv = $('#heroDotsCanvas'), hero = $('#top');
    if (!cv || !hero || reduce) return;
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1;
    var px = -9999, py = -9999, inside = false, waves = [];

    function size() {
      var r = hero.getBoundingClientRect();
      w = r.width; h = r.height; dpr = DPR();
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(hero);
    else window.addEventListener('resize', size);

    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      inside = true;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { inside = false; });
    hero.addEventListener('pointerdown', function (e) {
      var r = hero.getBoundingClientRect();
      waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0, a: 1 });
    }, { passive: true });

    var sytCard = $('.syt-hero-card', hero);
    if (sytCard) {
      var pulseCard = function () {
        buzz(14);
        var cr = sytCard.getBoundingClientRect(), hr = hero.getBoundingClientRect();
        waves.push({ x: cr.left - hr.left + cr.width / 2, y: cr.top - hr.top + cr.height / 2, r: 0, a: 1.25 });
      };
      sytCard.addEventListener('click', pulseCard);
      sytCard.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulseCard(); }
      });
    }

    whileVisible(hero, function (ts, dt) {
      dt = Math.min(dt || 16, 40) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (var k = waves.length - 1; k >= 0; k--) {
        waves[k].r += dt * 460;
        waves[k].a -= dt * 1.15;
        if (waves[k].a <= 0) waves.splice(k, 1);
      }

      var gap = w < 700 ? 38 : 34;
      var R = 145;
      for (var y = gap * 0.7; y < h; y += gap) {
        for (var x = gap * 0.7; x < w; x += gap) {
          var ox = 0, oy = 0, rad = 1.25, boost = 0;
          if (inside) {
            var dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
            if (d < R) {
              var f = smooth(1 - d / R);
              ox += (dx / (d || 1)) * f * 11;
              oy += (dy / (d || 1)) * f * 11;
              rad += f * 2.4;
              boost = Math.max(boost, f);
            }
          }
          for (var wi = 0; wi < waves.length; wi++) {
            var wv = waves[wi];
            var wd = Math.hypot(x - wv.x, y - wv.y);
            var band = Math.abs(wd - wv.r);
            if (band < 48) {
              var wf = (1 - band / 48) * clamp(wv.a, 0, 1);
              ox += ((x - wv.x) / (wd || 1)) * wf * 14;
              oy += ((y - wv.y) / (wd || 1)) * wf * 14;
              rad += wf * 2.8;
              boost = Math.max(boost, wf);
            }
          }
          if (boost > 0.35) {
            ctx.fillStyle = boost > 0.68 ? COPPER : '#1b7a8c';
            ctx.globalAlpha = 0.25 + boost * 0.65;
          } else {
            ctx.fillStyle = INK;
            ctx.globalAlpha = 0.12 + boost * 0.3;
          }
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, rad, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ==========================================================================
     2. LIVE IST TELEMETRY CLOCKS & ANALOGUE DIAL
     ========================================================================== */
  function initClocks() {
    var istEls = $$('[data-ist-clock]');
    var tickGroup = $('[data-wc-ticks]');
    if (tickGroup) {
      var ns = 'http://www.w3.org/2000/svg';
      for (var i = 0; i < 12; i++) {
        var a = i * 30 * Math.PI / 180, r1 = i % 3 === 0 ? 36 : 41;
        var l = doc.createElementNS(ns, 'line');
        l.setAttribute('x1', (50 + Math.sin(a) * r1).toFixed(2));
        l.setAttribute('y1', (50 - Math.cos(a) * r1).toFixed(2));
        l.setAttribute('x2', (50 + Math.sin(a) * 44).toFixed(2));
        l.setAttribute('y2', (50 - Math.cos(a) * 44).toFixed(2));
        if (i % 3 === 0) l.setAttribute('class', 'is-q');
        tickGroup.appendChild(l);
      }
    }
    var hands = { h: $('[data-wc-hand="h"]'), m: $('[data-wc-hand="m"]'), s: $('[data-wc-hand="s"]') };
    var worldItems = $$('.wcs__item[data-tz]');
    var fmtCache = {};

    function getParts(tz, now) {
      try {
        var fmt = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        }));
        var out = {};
        fmt.formatToParts(now).forEach(function (p) { out[p.type] = p.value; });
        return out;
      } catch (e) {
        var d = new Date(now + 330 * 60000);
        return {
          hour: String(d.getUTCHours()).padStart(2, '0'),
          minute: String(d.getUTCMinutes()).padStart(2, '0'),
          second: String(d.getUTCSeconds()).padStart(2, '0')
        };
      }
    }

    function tick() {
      var now = Date.now();
      var ist = getParts('Asia/Kolkata', now);
      istEls.forEach(function (el) {
        var secs = el.hasAttribute('data-seconds');
        el.textContent = ist.hour + ':' + ist.minute + (secs ? ':' + ist.second : '');
      });
      if (hands.h && hands.m && hands.s) {
        var hh = (+ist.hour) % 12, mm = +ist.minute, ss = +ist.second;
        hands.h.style.transform = 'rotate(' + ((hh + mm / 60) * 30).toFixed(1) + 'deg)';
        hands.m.style.transform = 'rotate(' + ((mm + ss / 60) * 6).toFixed(1) + 'deg)';
        hands.s.style.transform = 'rotate(' + (ss * 6) + 'deg)';
      }
      worldItems.forEach(function (item) {
        var tz = item.getAttribute('data-tz');
        var p = getParts(tz, now);
        var b = $('[data-wc-now]', item);
        if (b) b.textContent = p.hour + ':' + p.minute + ':' + p.second;
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ==========================================================================
     3. 3D ORBITAL SUBSYSTEM RING (#ring / [data-ring])
     ========================================================================== */
  function initRing() {
    var ring = $('[data-ring]');
    if (!ring || reduce) return;
    var cards = $$('[data-ring-card]', ring);
    var n = cards.length;
    if (!n) return;
    var step = 360 / n;
    var noEl = $('[data-ring-no]', ring);
    var dots = $$('[data-ring-dot]', ring);
    var cur = 0, target = 0, raf = 0, active = -1;

    function metrics() {
      var cw = cards[0].offsetWidth || 260;
      return { R: cw * 1.42, Ry: cw * 0.34, cw: cw };
    }
    var M = metrics();

    function paint() {
      var rot = cur * step;
      cards.forEach(function (c, i) {
        var th = (i * step - rot) * Math.PI / 180;
        var cs = Math.cos(th), sn = Math.sin(th);
        var x = sn * M.R * 1.12, z = cs * M.R, y = cs * M.Ry + M.cw * 0.1;
        var ry = -sn * 26;
        var o = 0.24 + 0.76 * (cs + 1) / 2;
        var sc = 1 + 0.1 * Math.max(0, cs);
        c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
        c.style.opacity = o.toFixed(3);
        var front = cs > 0.84;
        c.classList.toggle('is-front', front);
        var a = $('a', c);
        if (a) a.tabIndex = front ? 0 : -1;
      });
      var idx = ((Math.round(cur) % n) + n) % n;
      if (idx !== active) {
        active = idx;
        if (noEl) noEl.textContent = String(idx + 1).padStart(2, '0');
        dots.forEach(function (d, k) { d.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
      }
    }

    function loop() {
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.002) { cur = target; raf = 0; paint(); return; }
      paint();
      raf = requestAnimationFrame(loop);
    }

    function span() { return Math.max(1, ring.offsetHeight - window.innerHeight); }
    function readScroll() {
      var r = ring.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      var p = clamp(-r.top / span(), 0, 1);
      target = p * (n - 1);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function go(i) {
      i = clamp(i, 0, n - 1);
      buzz(10);
      var y = ring.getBoundingClientRect().top + window.scrollY + (i / (n - 1)) * span();
      smoothTo(y);
    }

    var prev = $('[data-ring-prev]', ring), next = $('[data-ring-next]', ring);
    if (prev) prev.addEventListener('click', function () { go(Math.round(target) - 1); });
    if (next) next.addEventListener('click', function () { go(Math.round(target) + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });

    window.addEventListener('resize', function () { M = metrics(); paint(); });
    window.addEventListener('scroll', readScroll, { passive: true });
    M = metrics();
    readScroll();
    paint();
  }

  /* ==========================================================================
     4. THE 3D SCROLL CORRIDOR (#corridor / [data-corridor])
     ========================================================================== */
  function initCorridor() {
    var sec = $('[data-corridor]');
    if (!sec || reduce) return;
    var world = $('[data-corridor-world]', sec);
    var end = $('[data-corridor-end]', sec);
    var cue = $('[data-corridor-cue]', sec);
    var TRAVEL = 3850, q = false;

    function update() {
      q = false;
      var r = sec.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      var span = Math.max(1, sec.offsetHeight - window.innerHeight);
      var p = clamp(-r.top / span, 0, 1);
      var k = clamp(p / 0.8, 0, 1);
      var z = (0.85 * k + 0.15 * easeOut(k)) * TRAVEL;
      if (world) world.style.setProperty('--cz', z.toFixed(1) + 'px');
      var a = clamp((p - 0.62) / 0.2, 0, 1);
      if (end) {
        end.style.opacity = a.toFixed(3);
        end.style.transform = 'translateY(' + ((1 - a) * 18).toFixed(1) + 'px)';
      }
      if (cue) cue.style.opacity = (1 - clamp(p / 0.18, 0, 1)).toFixed(2);
    }

    window.addEventListener('scroll', function () {
      if (!q) { q = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ==========================================================================
     5. DRAGGABLE & INTERACTIVE 3D SYT CUBE ([data-process-cube])
     ========================================================================== */
  function initProcessCube() {
    var wrap = $('[data-process-cube]');
    if (!wrap) return;
    var scene = $('.cube-scene', wrap), cube = $('.cube-el', wrap);
    var steps = $$('.syt-step', wrap);
    if (!scene || !cube || !steps.length) return;

    var faces = [[-14, -26], [-14, -116], [-14, -206], [-14, -296], [-78, -360]];
    var cur = { x: faces[0][0], y: faces[0][1] }, off = { x: 0, y: 0 }, vel = { x: 0, y: 0 };
    var active = 0, dragging = false, last = { x: 0, y: 0 };

    function setActive(i) {
      active = clamp(i, 0, steps.length - 1);
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === active); });
    }
    function apply() {
      cube.style.transform = 'rotateX(' + (cur.x + off.x).toFixed(2) + 'deg) rotateY(' + (cur.y + off.y).toFixed(2) + 'deg)';
    }

    steps.forEach(function (s, i) {
      s.addEventListener('click', function () {
        buzz(10);
        setActive(i);
        if (reduce) { cur.x = faces[i][0]; cur.y = faces[i][1]; apply(); }
      });
    });

    setActive(0);
    apply();
    if (reduce) return;

    whileVisible(wrap, function () {
      var f = faces[active];
      cur.x += (f[0] - cur.x) * 0.09;
      cur.y += (f[1] - cur.y) * 0.09;
      if (!dragging) {
        off.x += vel.x; off.y += vel.y;
        vel.x *= 0.91; vel.y *= 0.91;
        off.x *= 0.94; off.y *= 0.94;
      }
      apply();
    });

    scene.addEventListener('pointerdown', function (e) {
      dragging = true; last.x = e.clientX; last.y = e.clientY; vel.x = vel.y = 0;
      scene.setPointerCapture(e.pointerId);
      scene.classList.add('is-grabbing');
    });
    scene.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      last.x = e.clientX; last.y = e.clientY;
      off.y += dx * 0.55; off.x -= dy * 0.55;
      vel.y = dx * 0.25; vel.x = -dy * 0.25;
    });
    var endDrag = function () { dragging = false; scene.classList.remove('is-grabbing'); };
    scene.addEventListener('pointerup', endDrag);
    scene.addEventListener('pointercancel', endDrag);
    scene.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: [0, -8], ArrowRight: [0, 8], ArrowUp: [-6, 0], ArrowDown: [6, 0] }[e.key];
      if (!k) return;
      e.preventDefault();
      vel.x += k[0]; vel.y += k[1];
    });
  }

  /* ==========================================================================
     6. THE AUTONOMY & TELEMETRY REACTOR (#reactor / [data-reactor])
     ========================================================================== */
  function initReactor() {
    var rootEl = $('[data-reactor]');
    if (!rootEl) return;
    var section = rootEl.closest('section');
    var field = $('[data-rx-field]', rootEl) || rootEl, hud = $('[data-rx-hud]', rootEl);
    var cv = $('[data-rx-cv]', rootEl), ctx = cv.getContext('2d');
    var tally = { inn: 0, drop: 0, ship: 0 }, hudAt = 0;
    var stEls = $$('.rx__st', rootEl), prEls = $$('.rx__pr', rootEl), btns = $$('[data-stage]', rootEl);
    var stories = $$('[data-story]', section);

    var cols = [
      [[0.08, 0.5]],
      [[0.34, 0.2], [0.34, 0.41], [0.34, 0.63], [0.34, 0.84]],
      [[0.60, 0.34], [0.60, 0.68]],
      [[0.84, 0.22], [0.84, 0.5], [0.84, 0.78]]
    ];
    var edges = [
      [[0, 0], [1, 0]], [[0, 0], [1, 1]], [[0, 0], [1, 2]], [[0, 0], [1, 3]],
      [[1, 0], [2, 0]], [[1, 1], [2, 0]], [[1, 1], [2, 1]], [[1, 2], [2, 0]], [[1, 2], [2, 1]], [[1, 3], [2, 1]],
      [[2, 0], [3, 0]], [[2, 0], [3, 1]], [[2, 1], [3, 1]], [[2, 1], [3, 2]]
    ];
    var failRate = { '1,0': 0.52, '1,3': 0.52, '1,1': 0.18 };
    var prodCol = [COPPER_HI, CYAN, GREEN];
    var seg = [PAPER, PAPER, CYAN, COPPER_HI];
    var W = 0, H = 0, vertical = false, dpr = 1, selected = 0;
    var parts = [], sparks = [], flash = [0, 0, 0], spawnAt = 0;

    var PADX = 26, TOP = 30, BAND = 88;
    function pt(u, v) {
      if (!vertical) return [u * W, v * H];
      return [PADX + v * (W - PADX * 2), TOP + ((u - 0.08) / 0.76) * (H - TOP - BAND)];
    }
    function layout() {
      vertical = rootEl.getBoundingClientRect().width < 720;
      rootEl.classList.toggle('rx--v', vertical);
      var r = field.getBoundingClientRect();
      W = r.width || 600; H = r.height || 320; dpr = DPR();
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      stEls.forEach(function (li) {
        if (vertical) { li.style.left = ''; li.style.top = ''; return; }
        var p = pt(+li.dataset.u, +li.dataset.v);
        li.style.left = p[0] + 'px'; li.style.top = p[1] + 'px';
      });
      prEls.forEach(function (li, i) {
        if (vertical) {
          li.style.left = (W * (2 * i + 1) / 6) + 'px';
          li.style.top = (H - 30) + 'px';
          li.style.width = (W / 3 - 10) + 'px';
        } else {
          var p = pt(+li.dataset.u, +li.dataset.v);
          li.style.left = p[0] + 'px'; li.style.top = p[1] + 'px'; li.style.width = '';
        }
      });
    }
    function node(c, i) {
      if (vertical && c === 3) return [W * (2 * i + 1) / 6, pt(cols[3][i][0], 0)[1]];
      return pt(cols[c][i][0], cols[c][i][1]);
    }
    function bez(a, b, t) {
      var dx = vertical ? 0 : (b[0] - a[0]) * 0.5, dy = vertical ? (b[1] - a[1]) * 0.5 : 0;
      var c1 = [a[0] + dx, a[1] + dy], c2 = [b[0] - dx, b[1] - dy], u = 1 - t;
      return [
        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]
      ];
    }
    function spawn() {
      var route = [0], cur = 0;
      for (var c = 1; c < 4; c++) {
        var opts = edges.filter(function (e) { return e[0][0] === c - 1 && e[0][1] === cur; });
        var pick = opts[Math.floor(Math.random() * opts.length)][1][1];
        route.push(pick); cur = pick;
      }
      tally.inn++;
      parts.push({ route: route, s: 0, t: 0, sp: 0.58 + Math.random() * 0.36, dead: false, fade: 1 });
    }
    function burst(p, col, count, spd) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * 6.2832, v = (0.4 + Math.random()) * spd;
        sparks.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col: col });
      }
    }
    function draw(ts, dt) {
      dt = Math.min(dt || 16, 40) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      var cu = [0.08, 0.34, 0.60, 0.84][selected], a0 = pt(cu, 0);
      var glow = ctx.createLinearGradient(vertical ? 0 : a0[0] - 75, vertical ? a0[1] - 50 : 0, vertical ? 0 : a0[0] + 75, vertical ? a0[1] + 50 : 0);
      glow.addColorStop(0, 'rgba(229,146,76,0)');
      glow.addColorStop(0.5, 'rgba(229,146,76,0.18)');
      glow.addColorStop(1, 'rgba(229,146,76,0)');
      ctx.fillStyle = glow;
      if (vertical) ctx.fillRect(0, a0[1] - 50, W, 100); else ctx.fillRect(a0[0] - 75, 0, 150, H);

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      edges.forEach(function (e) {
        var a = node(e[0][0], e[0][1]), b = node(e[1][0], e[1][1]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        var dx = vertical ? 0 : (b[0] - a[0]) * 0.5, dy = vertical ? (b[1] - a[1]) * 0.5 : 0;
        ctx.bezierCurveTo(a[0] + dx, a[1] + dy, b[0] - dx, b[1] - dy, b[0], b[1]);
        ctx.stroke();
      });

      cols.forEach(function (col, c) {
        col.forEach(function (n, i) {
          var p = node(c, i), r = 4.2 + c * 1.5 + (c === 3 ? flash[i] * 6 : 0);
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832);
          ctx.fillStyle = c === 3 ? prodCol[i] : '#1c2330';
          ctx.fill();
          ctx.strokeStyle = c === selected ? COPPER_HI : 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        });
      });
      for (var f = 0; f < 3; f++) flash[f] = Math.max(0, flash[f] - dt * 2.2);

      for (var k = parts.length - 1; k >= 0; k--) {
        var p = parts[k];
        if (p.dead) {
          p.fade -= dt * 2.2;
          if (p.fade <= 0) { parts.splice(k, 1); continue; }
        } else {
          p.t += dt * p.sp * (selected === p.s ? 1.5 : 1);
          if (p.t >= 1) {
            var n1 = node(p.s + 1, p.route[p.s + 1]);
            p.t = 0; p.s++;
            if (p.s === 1 && Math.random() < (failRate['1,' + p.route[1]] || 0)) {
              p.dead = true; p.at = n1; p.s = -1;
              burst(n1, '#ff5c5c', 6, 48);
              tally.drop++;
              continue;
            }
            if (p.s >= 3) {
              burst(n1, prodCol[p.route[3]], 11, 78);
              flash[p.route[3]] = 1;
              tally.ship++;
              parts.splice(k, 1);
              continue;
            }
          }
        }
        if (p.s < 0) {
          ctx.globalAlpha = Math.max(0, p.fade);
          ctx.fillStyle = '#ff5c5c';
          ctx.beginPath(); ctx.arc(p.at[0], p.at[1], 3, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        var A = node(p.s, p.route[p.s]), B = node(p.s + 1, p.route[p.s + 1]);
        for (var tr = 3; tr >= 0; tr--) {
          var q = bez(A, B, clamp(p.t - tr * 0.026, 0, 1));
          var rad = (2.1 + p.s * 1.05) * (1 - tr * 0.18);
          ctx.globalAlpha = (1 - tr * 0.25) * p.fade;
          ctx.fillStyle = seg[p.s + 1] || PAPER;
          ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      for (var s = sparks.length - 1; s >= 0; s--) {
        var sp = sparks[s];
        sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        sp.vx *= 0.93; sp.vy *= 0.93; sp.life -= dt * 1.85;
        if (sp.life <= 0) { sparks.splice(s, 1); continue; }
        ctx.globalAlpha = sp.life;
        ctx.fillStyle = sp.col;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.2, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }

      spawnAt -= dt;
      if (spawnAt <= 0 && parts.length < 58) { spawn(); spawnAt = 0.2 + Math.random() * 0.18; }
      hudAt -= dt;
      if (hudAt <= 0 && hud && !reduce) {
        hudAt = 0.28;
        hud.textContent = 'Packets ' + tally.inn + ' · Noise rejected ' + tally.drop + ' · Commands dispatched ' + tally.ship;
      }
    }

    function select(i, userMade) {
      selected = i;
      btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      stories.forEach(function (st, k) { st.hidden = k !== i; });
      if (userMade) {
        cols[i].forEach(function (n, k) { burst(node(i, k), i === 3 ? prodCol[k] : COPPER_HI, 15, 115); });
        buzz(12);
      }
    }

    btns.forEach(function (b, i) { b.addEventListener('click', function () { select(i, true); if (reduce) draw(0, 16); }); });
    cv.addEventListener('click', function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = 0, bd = 1e9;
      for (var i = 0; i < 4; i++) {
        var n0 = node(i, 0), d = Math.abs(vertical ? n0[1] - y : n0[0] - x);
        if (d < bd) { bd = d; best = i; }
      }
      select(best, true);
      if (reduce) draw(0, 16);
    });

    layout();
    select(0, false);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(rootEl);
    if (reduce) {
      for (var i = 0; i < 16; i++) { spawn(); parts[i].s = i % 3; parts[i].t = Math.random(); }
      draw(0, 16);
    } else {
      whileVisible(rootEl, draw);
    }
  }

  /* ==========================================================================
     7. THE INTERACTIVE ROBOTICS LAB WALL (#lab / [data-wall])
     ========================================================================== */
  function mkFx(stage, cls) {
    var d = doc.createElement('div');
    d.className = 'fx fx--' + cls;
    stage.appendChild(d);
    return d;
  }
  function rel(e, el) {
    var r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width || 1, h: r.height || 1 };
  }

  var FX = {
    /* EXP 01: POP — Rover Hardware Mosaic Explosion & Magnetic Reassembly */
    pop: function (stage, big) {
      var box = mkFx(stage, 'pop');
      var cols = big ? 14 : 10, rows = big ? 9 : 7, cells = [], busy = false, timer = 0;
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var c = doc.createElement('div');
          c.className = 'cell';
          var dx = (i + 0.5) / cols - 0.5, dy = (j + 0.5) / rows - 0.5;
          var bx = cols > 1 ? (i * 100 / (cols - 1)).toFixed(2) : 50;
          var by = rows > 1 ? (j * 100 / (rows - 1)).toFixed(2) : 50;
          c.style.cssText =
            'left:' + (i * 100 / cols) + '%;top:' + (j * 100 / rows) + '%;' +
            'width:' + (100 / cols + 0.2) + '%;height:' + (100 / rows + 0.2) + '%;' +
            'background-image:url("assets/photos/rover-obsidian.jpg");' +
            'background-size:' + (cols * 100) + '% ' + (rows * 100) + '%;' +
            'background-position:' + bx + '% ' + by + '%;';
          c._v = [dx, dy];
          box.appendChild(c);
          cells.push(c);
        }
      }
      function explode() {
        if (busy || !box.animate) return;
        busy = true;
        buzz(14);
        var w = box.clientWidth || 280, h = box.clientHeight || 200;
        cells.forEach(function (c) {
          var tx = c._v[0] * w * (1.25 + Math.random() * 1.25) + (Math.random() - 0.5) * w * 0.32;
          var ty = c._v[1] * h * (1.25 + Math.random() * 1.25) + (Math.random() - 0.5) * h * 0.32;
          var rot = (Math.random() - 0.5) * 340, sc = 0.28 + Math.random() * 1.05;
          var kf = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(' + sc.toFixed(2) + ')';
          c._kf = kf;
          c._a = c.animate([
            { transform: 'none', opacity: 1 },
            { transform: kf, opacity: 0.14 }
          ], { duration: 640 + Math.random() * 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        });
        setTimeout(function () {
          cells.forEach(function (c) {
            c.animate([
              { transform: c._kf || 'none', opacity: 0.14 },
              { transform: 'none', opacity: 1 }
            ], { duration: 820 + Math.random() * 280, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
            if (c._a) { try { c._a.cancel(); } catch (e) {} }
          });
          setTimeout(function () { busy = false; }, 1150);
        }, 920);
      }
      var host = big ? box : stage.parentElement;
      host.addEventListener('pointerenter', explode);
      host.addEventListener('pointerdown', explode);
      var vis = false, io = null;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { vis = es[0].isIntersecting; });
        io.observe(box);
      }
      if (!reduce) timer = setInterval(function () { if (vis) explode(); }, 4400);
      return function () {
        clearInterval(timer);
        if (io) io.disconnect();
        host.removeEventListener('pointerenter', explode);
        host.removeEventListener('pointerdown', explode);
        box.remove();
      };
    },

    /* EXP 02: MAGNET — Interactive Sensor Dot Field + Click Shockwave */
    magnet: function (stage, big) {
      var box = mkFx(stage, 'magnet'), cv = doc.createElement('canvas');
      box.appendChild(cv);
      var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1, gap = big ? 26 : 19;
      var px = -999, py = -999, inside = false, burstR = -1;
      function size() {
        var r = box.getBoundingClientRect();
        w = r.width || 280; h = r.height || 200; dpr = DPR();
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      size();
      var ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
      if (ro) ro.observe(box);
      var host = big ? box : stage.parentElement;
      function mv(e) { var r = rel(e, box); px = r.x; py = r.y; inside = true; }
      function lv() { inside = false; }
      function dn(e) { mv(e); burstR = 1; buzz(10); }
      host.addEventListener('pointermove', mv);
      host.addEventListener('pointerleave', lv);
      host.addEventListener('pointerdown', dn);
      var stop = whileVisible(box, function (ts, dt) {
        dt = Math.min(dt || 16, 40) / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (burstR >= 0) { burstR += dt * 360; if (burstR > Math.max(w, h) * 1.2) burstR = -1; }
        var ax = inside ? px : w / 2 + Math.sin(ts / 900) * w * 0.34;
        var ay = inside ? py : h / 2 + Math.sin(ts / 700 + 1) * h * 0.3;
        var R = Math.max(92, w * 0.28);
        for (var y = gap / 2; y < h; y += gap) {
          for (var x = gap / 2; x < w; x += gap) {
            var dx = ax - x, dy = ay - y, d = Math.hypot(dx, dy);
            var f = smooth(1 - d / R);
            var ox = (dx / (d || 1)) * f * gap * 0.88;
            var oy = (dy / (d || 1)) * f * gap * 0.88;
            if (burstR >= 0) {
              var bd = Math.abs(d - burstR);
              if (bd < 36) {
                var bf = 1 - bd / 36;
                ox -= (dx / (d || 1)) * bf * 14;
                oy -= (dy / (d || 1)) * bf * 14;
                f = Math.max(f, bf);
              }
            }
            ctx.fillStyle = f > 0.62 ? COPPER_HI : f > 0.32 ? CYAN : 'rgba(245,245,242,0.55)';
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, 1.35 + f * 4.2, 0, 6.2832);
            ctx.fill();
          }
        }
      });
      return function () {
        stop();
        if (ro) ro.disconnect();
        host.removeEventListener('pointermove', mv);
        host.removeEventListener('pointerleave', lv);
        host.removeEventListener('pointerdown', dn);
        box.remove();
      };
    },

    /* EXP 03: SCAN — Stealth Hull to Internal Exploded X-Ray Wipe Lens */
    scan: function (stage, big) {
      var box = mkFx(stage, 'scan');
      var under = doc.createElement('div'); under.className = 'scan-under';
      var top = doc.createElement('div'); top.className = 'scan-top';
      var ring = doc.createElement('div'); ring.className = 'scan-ring';
      box.appendChild(under); box.appendChild(top); box.appendChild(ring);
      var mx = 0, my = 0, cx = 0, cy = 0, r = 0, inside = false;
      var host = big ? box : stage.parentElement;
      function mv(e) { var q = rel(e, box); mx = q.x; my = q.y; inside = true; }
      function lv() { inside = false; }
      host.addEventListener('pointermove', mv);
      host.addEventListener('pointerleave', lv);
      host.addEventListener('pointerdown', mv);
      var stop = whileVisible(box, function (ts) {
        var w = box.clientWidth || 280, h = box.clientHeight || 200;
        var R = Math.max(52, w * (big ? 0.2 : 0.27));
        var tx = inside ? mx : w / 2 + Math.sin(ts / 950) * w * 0.28;
        var ty = inside ? my : h / 2 + Math.cos(ts / 1250) * h * 0.24;
        cx = lerp(cx || tx, tx, 0.18);
        cy = lerp(cy || ty, ty, 0.18);
        r = lerp(r, inside ? R : R * 0.65, 0.14);
        top.style.setProperty('--mx', cx.toFixed(1) + 'px');
        top.style.setProperty('--my', cy.toFixed(1) + 'px');
        top.style.setProperty('--r', r.toFixed(1) + 'px');
        ring.style.setProperty('--mx', cx.toFixed(1) + 'px');
        ring.style.setProperty('--my', cy.toFixed(1) + 'px');
        ring.style.setProperty('--r', r.toFixed(1) + 'px');
      });
      return function () {
        stop();
        host.removeEventListener('pointermove', mv);
        host.removeEventListener('pointerleave', lv);
        host.removeEventListener('pointerdown', mv);
        box.remove();
      };
    },

    /* EXP 04: TILT — 3D Brushed-Metal SYT Monolith Card */
    tilt: function (stage, big) {
      var box = mkFx(stage, 'tilt'), card = doc.createElement('div');
      card.className = 'tcard';
      card.innerHTML = '<svg viewBox="0 0 784 424" aria-hidden="true"><use href="#syt-logo"/></svg><i></i>';
      box.appendChild(card);
      var tx = 0, ty = 0, cx = 0, cy = 0, inside = false, host = big ? box : stage.parentElement;
      function mv(e) { var r = rel(e, box); tx = (r.y / r.h - 0.5) * -28; ty = (r.x / r.w - 0.5) * 36; inside = true; }
      function lv() { inside = false; }
      host.addEventListener('pointermove', mv);
      host.addEventListener('pointerleave', lv);
      host.addEventListener('pointerdown', mv);
      var stop = whileVisible(box, function (ts) {
        var gx = inside ? tx : Math.sin(ts / 1400) * 9;
        var gy = inside ? ty : Math.cos(ts / 1800) * 13;
        cx = lerp(cx, gx, 0.13); cy = lerp(cy, gy, 0.13);
        card.style.transform = 'rotateX(' + cx.toFixed(2) + 'deg) rotateY(' + cy.toFixed(2) + 'deg)';
        card.style.setProperty('--gx', (50 + cy * 1.6).toFixed(1) + '%');
        card.style.setProperty('--gy', (30 - cx * 1.8).toFixed(1) + '%');
      });
      return function () {
        stop();
        host.removeEventListener('pointermove', mv);
        host.removeEventListener('pointerleave', lv);
        host.removeEventListener('pointerdown', mv);
        box.remove();
      };
    },

    /* EXP 05: MELT — Kinetic Field Typography */
    melt: function (stage, big) {
      var box = mkFx(stage, 'melt'), p = doc.createElement('p'), letters = [];
      'SASYA + TERRA'.split(' ').forEach(function (w, wi, arr) {
        var wEl = doc.createElement('span');
        wEl.style.display = 'inline-block'; wEl.style.whiteSpace = 'nowrap';
        w.split('').forEach(function (ch) {
          var s = doc.createElement('span');
          s.textContent = ch;
          if (ch === '+') s.style.color = '#b86725';
          wEl.appendChild(s);
          letters.push({ el: s, x: 0, y: 0, r: 0, sy: 1 });
        });
        p.appendChild(wEl);
        if (wi < arr.length - 1) p.appendChild(doc.createTextNode(' '));
      });
      p.style.maxWidth = '92%';
      box.appendChild(p);
      var px = -999, py = -999, inside = false, cache = [], n = 0;
      function measure() {
        cache = letters.map(function (l) {
          return [l.el.offsetLeft + l.el.offsetWidth / 2 + p.offsetLeft, l.el.offsetTop + l.el.offsetHeight / 2 + p.offsetTop];
        });
      }
      var host = big ? box : stage.parentElement;
      function mv(e) { var r = rel(e, box); px = r.x; py = r.y; inside = true; }
      function lv() { inside = false; }
      host.addEventListener('pointermove', mv);
      host.addEventListener('pointerleave', lv);
      host.addEventListener('pointerdown', mv);
      var stop = whileVisible(box, function (ts) {
        if (!cache.length || (n++ % 90) === 0) measure();
        var R = Math.max(72, box.clientWidth * 0.22);
        letters.forEach(function (l, i) {
          var c = cache[i] || [0, 0];
          var ax = inside ? px : (box.clientWidth / 2 + Math.sin(ts / 1100) * box.clientWidth * 0.35);
          var ay = inside ? py : (box.clientHeight / 2 + Math.cos(ts / 1400) * 12);
          var dx = c[0] - ax, dy = c[1] - ay, d = Math.hypot(dx, dy), f = clamp(1 - d / R, 0, 1);
          f = f * f;
          var ty = f * R * 0.48, rot = (dx / R) * f * 24, sy = 1 + f * 0.65, fx = (dx / (d || 1)) * f * 6;
          l.x = lerp(l.x, fx, 0.16); l.y = lerp(l.y, ty, 0.16); l.r = lerp(l.r, rot, 0.16); l.sy = lerp(l.sy, sy, 0.16);
          l.el.style.transform = 'translate(' + l.x.toFixed(1) + 'px,' + l.y.toFixed(1) + 'px) rotate(' + l.r.toFixed(1) + 'deg) scaleY(' + l.sy.toFixed(2) + ')';
        });
      });
      return function () {
        stop();
        host.removeEventListener('pointermove', mv);
        host.removeEventListener('pointerleave', lv);
        host.removeEventListener('pointerdown', mv);
        box.remove();
      };
    },

    /* EXP 06: FURROW — Autonomous Serpentine Row Path */
    furrow: function (stage, big) {
      var box = mkFx(stage, 'furrow'), NS = 'http://www.w3.org/2000/svg';
      var svg = doc.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 300 120');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      var d = '', waves = 5;
      for (var i = 0; i <= 260; i++) {
        var t = i / 260;
        var x = 16 + 268 * t;
        var y = 60 + 34 * Math.sin(6.2832 * waves * t);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      var guide = doc.createElementNS(NS, 'path');
      guide.setAttribute('d', d); guide.setAttribute('fill', 'none');
      guide.setAttribute('stroke', 'rgba(104,207,147,0.22)'); guide.setAttribute('stroke-width', '2');
      guide.setAttribute('stroke-dasharray', '4 4');
      var path = doc.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('fill', 'none');
      path.setAttribute('stroke', GREEN); path.setAttribute('stroke-width', big ? '3.4' : '2.8');
      path.setAttribute('stroke-linecap', 'round');
      var nib = doc.createElementNS(NS, 'circle');
      nib.setAttribute('r', '5.5'); nib.setAttribute('fill', COPPER_HI);
      svg.appendChild(guide); svg.appendChild(path); svg.appendChild(nib);
      box.appendChild(svg);
      var L = path.getTotalLength(), prog = 0, target = 0, inside = false, host = big ? box : stage.parentElement;
      path.style.strokeDasharray = String(L);
      function paint() {
        path.style.strokeDashoffset = String(L * (1 - prog));
        var q = path.getPointAtLength(L * prog);
        nib.setAttribute('cx', q.x.toFixed(1));
        nib.setAttribute('cy', q.y.toFixed(1));
      }
      function mv(e) { var q = rel(e, box); target = clamp(q.x / q.w, 0, 1); inside = true; }
      function lv() { inside = false; }
      host.addEventListener('pointermove', mv);
      host.addEventListener('pointerleave', lv);
      host.addEventListener('pointerdown', mv);
      var stop = whileVisible(box, function (ts) {
        var auto = (ts / 4000) % 1.35;
        if (auto > 1) auto = 1;
        prog = lerp(prog, inside ? target : auto, inside ? 0.2 : 0.14);
        paint();
      });
      return function () {
        stop();
        host.removeEventListener('pointermove', mv);
        host.removeEventListener('pointerleave', lv);
        host.removeEventListener('pointerdown', mv);
        box.remove();
      };
    }
  };

  function initWall() {
    var wall = $('[data-wall]');
    if (!wall) return;
    var tiles = $$('.xp', wall);
    var dlg = $('[data-xpm]', wall), mStage = $('[data-xpm-stage]', wall), killModal = null;
    tiles.forEach(function (t) {
      var k = t.dataset.xp, st = $('[data-xp-stage]', t);
      if (FX[k] && st) FX[k](st, false);
      t.addEventListener('click', function () { openXp(k); });
    });
    function openXp(k) {
      if (!dlg || !FX[k] || !dlg.showModal) return;
      var tile = $('.xp[data-xp="' + k + '"]', wall);
      if (!tile) return;
      var name = $('.xp__foot b', tile).textContent;
      $('[data-xpm-no]', wall).textContent = $('.xp__meta i', tile).textContent + ' // ' + name;
      $('[data-xpm-title]', wall).textContent = name;
      var desc = $('[data-xp-desc="' + k + '"]', wall);
      $('[data-xpm-text]', wall).textContent = desc ? desc.textContent : '';
      if (killModal) killModal();
      dlg.showModal();
      killModal = FX[k](mStage, true);
    }
    function closeXp() { if (dlg && dlg.open) dlg.close(); }
    if (dlg) {
      var closeBtn = $('[data-xpm-close]', wall);
      if (closeBtn) closeBtn.addEventListener('click', closeXp);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) closeXp(); });
      dlg.addEventListener('close', function () { if (killModal) { killModal(); killModal = null; } });
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-open-xp]');
      if (!a) return;
      e.preventDefault();
      var k = a.getAttribute('data-open-xp');
      var wy = wall.getBoundingClientRect().top + window.scrollY - 60;
      smoothTo(wy);
      setTimeout(function () { openXp(k); }, reduce ? 0 : 600);
    });
  }

  /* ==========================================================================
     8. THE RULE BREAKER (KINETIC LETTER EXPLOSION)
     ========================================================================== */
  function initRules() {
    var stage = $('[data-rules]');
    if (!stage) return;
    var textEl = $('[data-rules-text]', stage), live = $('[data-rules-live]', stage);
    var btn = $('[data-rules-next]'), count = $('[data-rules-count]');
    var list = [];
    try { list = JSON.parse(stage.dataset.list); } catch (e) { return; }
    if (!list.length) return;

    var idx = 0, lastMode = '', anims = [];
    var themes = [
      ['#151922', '#f5f5f2'],
      [COPPER, '#0b0d10'],
      [CYAN, '#0b0d10'],
      ['#f4f3ef', '#0b0d10'],
      ['#13221a', '#7be0a5']
    ];
    var aligns = ['left', 'center', 'right'];
    var modes = ['collide', 'scatter', 'drop', 'stretch', 'flip'];

    function build(str) {
      textEl.innerHTML = '';
      var letters = [];
      str.split(' ').forEach(function (w, wi, arr) {
        var wEl = doc.createElement('span'); wEl.className = 'w';
        w.split('').forEach(function (ch) {
          var l = doc.createElement('span'); l.className = 'l'; l.textContent = ch;
          wEl.appendChild(l); letters.push(l);
        });
        textEl.appendChild(wEl);
        if (wi < arr.length - 1) textEl.appendChild(doc.createTextNode(' '));
      });
      return letters;
    }

    function play(letters, mode) {
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      anims = [];
      var vw = Math.max(window.innerWidth, 360), ease = 'cubic-bezier(.16,1,.3,1)';
      var rnd = function (m) { return (Math.random() - 0.5) * m; };
      letters.forEach(function (l, i) {
        if (!l.animate) return;
        var d = Math.min(i * 15, 480), a;
        if (mode === 'collide') {
          var s = i % 2 ? 1 : -1, x = s * vw * 0.65;
          a = l.animate([
            { transform: 'translateX(' + x + 'px) rotate(' + (s * 135) + 'deg)', opacity: 0 },
            { transform: 'translateX(' + (-x * 0.09) + 'px) rotate(' + (-s * 10) + 'deg)', opacity: 1, offset: 0.62 },
            { transform: 'none', opacity: 1 }
          ], { duration: 920, delay: d, easing: ease, fill: 'backwards' });
        } else if (mode === 'scatter') {
          a = l.animate([
            { transform: 'translate(' + rnd(vw * 0.65) + 'px,' + rnd(vw * 0.38) + 'px) rotate(' + rnd(340) + 'deg) scale(0)', opacity: 0 },
            { transform: 'none', opacity: 1 }
          ], { duration: 880, delay: d, easing: ease, fill: 'backwards' });
        } else if (mode === 'drop') {
          a = l.animate([
            { transform: 'translateY(-75vh) rotate(' + rnd(75) + 'deg)', opacity: 0 },
            { transform: 'none', opacity: 1 }
          ], { duration: 880, delay: d, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
        } else if (mode === 'stretch') {
          a = l.animate([
            { transform: 'scaleX(3) scaleY(0.2)', opacity: 0 },
            { transform: 'scaleX(0.45) scaleY(1.25)', opacity: 1, offset: 0.55 },
            { transform: 'none', opacity: 1 }
          ], { duration: 840, delay: d, easing: ease, fill: 'backwards' });
        } else {
          a = l.animate([
            { transform: 'perspective(500px) rotateX(-100deg) translateY(36px)', opacity: 0 },
            { transform: 'none', opacity: 1 }
          ], { duration: 780, delay: d, easing: ease, fill: 'backwards' });
        }
        anims.push(a);
      });
    }

    function show(i, animate) {
      var str = list[i], letters = build(str);
      if (animate) {
        var th = themes[(i + 1) % themes.length];
        stage.style.setProperty('--bg', th[0]);
        stage.style.setProperty('--fg', th[1]);
        stage.style.setProperty('--al', aligns[i % aligns.length]);
        var mode;
        do { mode = modes[Math.floor(Math.random() * modes.length)]; } while (mode === lastMode);
        lastMode = mode;
        if (!reduce) play(letters, mode);
      }
      if (live) live.textContent = str;
      if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
    }

    function next() { idx = (idx + 1) % list.length; show(idx, true); buzz(14); }
    if (btn) btn.addEventListener('click', next);
    stage.addEventListener('click', next);
    show(0, false);
  }

  /* ==========================================================================
     9. FULL-SCREEN 1,100-DOT SYT MUTATION, SPLIT & EXPLOSION (#mutation)
     ========================================================================== */
  function initMutation() {
    var sec = $('[data-mutation]');
    if (!sec) return;
    var cv = $('[data-mu-cv]', sec), ctx = cv.getContext('2d');
    var phaseEl = $('[data-mu-phase]', sec), btn = $('[data-mu-click]', sec);
    var N = 1100, W = 0, H = 0, dpr = 1, R = 200, p = 0, idx = 0;
    var px = 0, py = 0, pin = false, ptrX = 0, ptrY = 0;
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    var names = ['Hexagon', 'Orbital Ring', 'Truss', 'Diamond', 'Crosshair'];
    var tests = [
      function (x, y) { var ax = Math.abs(x), ay = Math.abs(y); return ay < 0.72 && (ax * 0.866 + ay * 0.5) < 0.74; },
      function (x, y) { var d = Math.hypot(x, y); return d > 0.48 && d < 0.82; },
      function (x, y) { return y < 0.7 && Math.abs(x) < (y + 0.78) * 0.62; },
      function (x, y) { return Math.abs(x) + Math.abs(y) < 0.86; },
      function (x, y) { return (Math.abs(x) < 0.23 && Math.abs(y) < 0.82) || (Math.abs(y) < 0.23 && Math.abs(x) < 0.82); }
    ];
    var shapes = tests.map(function (t) {
      var out = [], guard = 0;
      while (out.length < N && guard++ < 220000) {
        var x = rnd() * 2 - 1, y = rnd() * 2 - 1;
        if (t(x, y)) out.push([x, y]);
      }
      while (out.length < N) out.push([0, 0]);
      return out;
    });

    /* Platinum, Copper, Cyan, Field Emerald */
    var COL = [[242, 244, 248], [229, 146, 76], [92, 230, 255], [104, 207, 147]];
    var parts = [];
    for (var i = 0; i < N; i++) {
      var s0 = shapes[0][i];
      parts.push({
        x: 0, y: 0, vx: 0, vy: 0,
        g: i % 4,
        c: Math.floor(((Math.atan2(s0[1], s0[0]) + Math.PI) / 6.2832) * 6) % 6,
        st: rnd(),
        wx: 0, wy: 0, isY: false
      });
    }

    /* Sample exact SYT monogram via Path2D */
    var sampled = sampleSYTPoints(640, 3);
    if (sampled.all.length) {
      parts.forEach(function (q) {
        var pool = q.g === 1 && sampled.yPts.length ? sampled.yPts : (sampled.outerPts.length ? sampled.outerPts : sampled.all);
        var pt = pool[Math.floor(rnd() * pool.length)];
        q.wx = pt.nx;
        q.wy = pt.ny;
        q.isY = pt.isY;
      });
    }

    function size() {
      var r = cv.getBoundingClientRect();
      W = r.width || window.innerWidth; H = r.height || window.innerHeight;
      dpr = DPR();
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      R = Math.min(W, H) * 0.35;
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(cv);

    function readP() {
      if (reduce) { p = 1; return; }
      var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - window.innerHeight);
      p = clamp(-r.top / span, 0, 1);
    }

    function explodeMorph() {
      idx = (idx + 1) % shapes.length;
      buzz(16);
      var cx = W / 2, cy = H * 0.45;
      parts.forEach(function (q) {
        var dx = q.x - cx, dy = q.y - cy, d = Math.hypot(dx, dy) || 1;
        var force = 16 + Math.random() * 26;
        q.vx += (dx / d) * force + (Math.random() - 0.5) * 18;
        q.vy += (dy / d) * force + (Math.random() - 0.5) * 18;
      });
    }

    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      ptrX = e.clientX - r.left; ptrY = e.clientY - r.top;
      px = (ptrX / r.width - 0.5) * 2; py = (ptrY / r.height - 0.5) * 2;
      pin = true;
    }, { passive: true });
    cv.addEventListener('pointerleave', function () { pin = false; px = 0; py = 0; });
    cv.addEventListener('click', explodeMorph);
    if (btn) btn.addEventListener('click', explodeMorph);

    function frame(ts, dt) {
      readP();
      dt = Math.min(dt || 16, 40) / 16;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.45;
      var e = smooth((p - 0.1) / 0.16) - smooth((p - 0.36) / 0.16);
      var s1 = (p - 0.42) / 0.14;
      var wordR = Math.min(W * 0.74, 760);
      var sh0 = shapes[idx], sh1 = shapes[(idx + 1) % shapes.length];
      var shear = px * 0.26, sc = 1 + py * 0.08;

      for (var i = 0; i < N; i++) {
        var q = parts[i], a = sh0[i], b = sh1[i];
        var m1 = smooth(s1 - q.st * 0.5 + 0.25);
        var nx = lerp(a[0], b[0], m1), ny = lerp(a[1], b[1], m1);
        var ang = e * 1.15 * (q.c % 2 ? 1 : -1), ca = Math.cos(ang), sa = Math.sin(ang);
        var rx = nx * ca - ny * sa, ry = nx * sa + ny * ca;
        var dir = (q.c / 6) * 6.2832 + 0.5;
        var ex = Math.cos(dir) * e * 1.08, ey = Math.sin(dir) * e * 1.08;
        var tx = (rx + ex) * R, ty = (ry + ey) * R;
        tx += ty * shear; tx *= sc; ty *= 1 / sc;

        var mw = smooth((p - 0.70) / 0.18 - q.st * 0.28 + 0.1);
        tx = lerp(tx, q.wx * wordR, mw);
        ty = lerp(ty, q.wy * wordR, mw);
        tx += cx; ty += cy;

        q.vx += (tx - q.x) * 0.078 * dt;
        q.vy += (ty - q.y) * 0.078 * dt;
        if (pin && !reduce) {
          var dx = q.x - ptrX, dy = q.y - ptrY, d2 = dx * dx + dy * dy;
          if (d2 < 19600) {
            var d = Math.sqrt(d2) || 1, f = (1 - d / 140) * 3.5;
            q.vx += (dx / d) * f;
            q.vy += (dy / d) * f;
          }
        }
        q.vx *= 0.81; q.vy *= 0.81;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.x === 0 && q.y === 0) { q.x = tx; q.y = ty; }

        var c = COL[q.g];
        var fc = q.isY ? COL[1] : COL[0];
        var rC = lerp(c[0], fc[0], mw) | 0, gC = lerp(c[1], fc[1], mw) | 0, bC = lerp(c[2], fc[2], mw) | 0;
        ctx.fillStyle = 'rgb(' + rC + ',' + gC + ',' + bC + ')';
        var rad = (1.75 + (1 - mw) * 0.85) * (W < 600 ? 0.82 : 1);
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
      }

      if (phaseEl) {
        var ph = p < 0.1 ? '01 Form // ' + names[idx]
          : p < 0.4 ? '02 Sector Split'
          : p < 0.7 ? '03 Mutated // ' + names[(idx + 1) % names.length]
          : '04 SYT // Sasyanterra';
        if (phaseEl.textContent !== ph) phaseEl.textContent = ph;
      }
      sec.style.setProperty('--msg', smooth((p - 0.82) / 0.12).toFixed(3));
    }

    if (reduce) {
      sec.style.setProperty('--msg', '1');
      p = 1;
      for (var k = 0; k < 45; k++) frame(0, 16);
    } else {
      whileVisible(sec, frame);
    }
  }

  /* ==========================================================================
     10. INTERACTIVE FOOTER DOT-MATRIX SYT SIGNATURE ([data-syt-dots])
     ========================================================================== */
  function initFooterDots() {
    var cv = $('[data-syt-dots]');
    if (!cv) return;
    var W = cv.width, H = cv.height, ctx = cv.getContext('2d');
    var sampled = sampleSYTPoints(W - 24, 6);
    if (!sampled.all.length) return;
    var ox = (W - sampled.w) / 2, oy = (H - sampled.h) / 2;
    var maxD = 1;
    var dots = sampled.all.map(function (d) {
      if (d.dist > maxD) maxD = d.dist;
      var hx = ox + d.x, hy = oy + d.y;
      return { hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, dist: d.dist, isY: d.isY };
    });

    var intro = reduce ? 1 : 0, t0 = null, started = reduce;
    var px = -999, py = -999, inside = false;

    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      px = (e.clientX - r.left) * (W / (r.width || W));
      py = (e.clientY - r.top) * (H / (r.height || H));
      inside = true;
    }, { passive: true });
    cv.addEventListener('pointerleave', function () { inside = false; });
    cv.addEventListener('click', function () {
      buzz(14);
      dots.forEach(function (d) {
        var dx = d.x - W / 2, dy = d.y - H / 2, len = Math.hypot(dx, dy) || 1;
        d.vx += (dx / len) * (8 + Math.random() * 14) + (Math.random() - 0.5) * 10;
        d.vy += (dy / len) * (8 + Math.random() * 14) + (Math.random() - 0.5) * 10;
      });
    });

    whileVisible(cv, function (ts) {
      if (!started) { started = true; t0 = ts; }
      if (intro < 1 && t0 !== null) intro = easeOut(clamp((ts - t0) / 1500, 0, 1));

      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var t = clamp(intro * 1.35 - (d.dist / maxD) * 0.35, 0, 1);
        if (t <= 0) continue;

        d.vx += (d.hx - d.x) * 0.12;
        d.vy += (d.hy - d.y) * 0.12;
        var near = 0;
        if (inside && !reduce) {
          var dx = d.x - px, dy = d.y - py, dist = Math.hypot(dx, dy);
          if (dist < 78) {
            near = 1 - dist / 78;
            d.vx += (dx / (dist || 1)) * near * 2.4;
            d.vy += (dy / (dist || 1)) * near * 2.4;
          }
        }
        d.vx *= 0.78; d.vy *= 0.78;
        d.x += d.vx; d.y += d.vy;

        ctx.globalAlpha = t;
        ctx.fillStyle = near > 0.35 ? CYAN : (d.isY ? COPPER_HI : '#e4e8ef');
        ctx.beginPath();
        ctx.arc(d.x, d.y, (1.55 * t + 0.45) + near * 1.4, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ==========================================================================
     11. GUIDED INTERACTIVE BRIEFING OVERLAY ([data-inquiry])
     ========================================================================== */
  function initBriefing() {
    var triggers = $$('[data-inquiry]');
    if (!triggers.length) return;
    var STEPS = [
      { id: 'name', kind: 'text', q: 'What is your name?', ph: 'Your name' },
      { id: 'role', kind: 'choice', q: 'Which best describes you?', options: ['Farmer or grower', 'Agri-business / FPO', 'Engineer or researcher', 'Partner or investor', 'Curious supporter'] },
      { id: 'topic', kind: 'choice', q: 'What would you like to explore?', options: ['Farm pilot / Unit-02 demo', 'Collaborating on Unit-03', 'Hardware & AI capabilities', 'General conversation'] },
      { id: 'note', kind: 'textarea', q: 'Add a quick note for the team.', ph: 'Crops, acreage, collaboration idea, or question…' }
    ];
    var values = {}, idx = 0, el = null, lastFocus = null, timer = 0;

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function build() {
      el = doc.createElement('div');
      el.className = 'briefing';
      el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Sasyanterra Guided Briefing');
      el.innerHTML =
        '<div class="briefing__bar"><i></i></div>' +
        '<div class="briefing__top">' +
          '<span class="brand"><span class="brand__mark brand__mark--syt"><svg viewBox="0 0 784 424" aria-hidden="true"><use href="#syt-logo"/></svg></span><span class="brand__text"><span class="brand__name" style="color:#fff">Sasyanterra</span><span class="brand__sub"><span>SYT</span><span>//</span><span>Briefing</span></span></span></span>' +
          '<button type="button" class="briefing__close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="briefing__body"></div>';
      doc.body.appendChild(el);
      $('.briefing__close', el).addEventListener('click', close);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (idx === 'done') return;
        var s = STEPS[idx];
        if (e.key === 'Enter' && !(e.target.tagName === 'TEXTAREA' && e.shiftKey)) {
          if (e.target.closest('.b-back, .briefing__close')) return;
          e.preventDefault(); next(); return;
        }
        if (s.kind === 'choice') {
          var k = 'abcde'.indexOf(e.key.toLowerCase()), num = parseInt(e.key, 10) - 1;
          var pickIdx = k >= 0 ? k : num;
          if (pickIdx >= 0 && pickIdx < s.options.length) {
            e.preventDefault();
            pick(s, s.options[pickIdx]);
          }
        }
      });
    }
    function open() {
      if (!el) build();
      lastFocus = doc.activeElement;
      if (idx === 'done') idx = 0;
      el.hidden = false;
      root.classList.add('intro-lock');
      if (window.SasyanterraSmooth) window.SasyanterraSmooth.lock(true);
      render('');
    }
    function close() {
      clearTimeout(timer);
      if (!el) return;
      el.hidden = true;
      root.classList.remove('intro-lock');
      if (window.SasyanterraSmooth) window.SasyanterraSmooth.lock(false);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function waUrl() {
      var msg = 'Hi Sasyanterra team,\n' +
        'Name: ' + (values.name || '-') + '\n' +
        'Profile: ' + (values.role || '-') + '\n' +
        'Topic: ' + (values.topic || '-') + '\n\n' +
        (values.note || '');
      return 'https://wa.me/919500702412?text=' + encodeURIComponent(msg);
    }
    function pick(s, val) {
      values[s.id] = val;
      buzz(10);
      $$('.b-choice', el).forEach(function (b) { b.setAttribute('aria-checked', b.dataset.val === val ? 'true' : 'false'); });
      clearTimeout(timer);
      timer = setTimeout(next, reduce ? 0 : 320);
    }
    function next() {
      clearTimeout(timer);
      var s = STEPS[idx];
      var inp = $('.b-input', el);
      if (inp) values[s.id] = inp.value.trim();
      var v = (values[s.id] || '').trim();
      if (s.id === 'name' && v.length < 2) { render('Please enter your name.'); return; }
      if (s.kind === 'choice' && !v) { render('Select one option to continue.'); return; }
      if (s.id === 'note' && v.length < 4) { render('Add a short line so the team has context.'); return; }
      if (idx < STEPS.length - 1) { idx++; render(''); return; }
      var href = waUrl();
      idx = 'done';
      render('');
      window.open(href, '_blank', 'noopener');
    }
    function render(err) {
      var body = $('.briefing__body', el);
      var bar = $('.briefing__bar i', el);
      if (idx === 'done') {
        bar.style.transform = 'scaleX(1)';
        body.innerHTML =
          '<p class="b-kicker mono">READY // WHATSAPP DISPATCH</p>' +
          '<h2 class="b-heading" tabindex="-1">Your briefing is ready on WhatsApp.</h2>' +
          '<p style="color:rgba(245,245,242,0.72);margin:0 0 1.6rem">WhatsApp has opened with your message formatted for the Sasyanterra team (+91 95007 02412). Tap send there whenever you are ready.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.8rem">' +
            '<a class="btn btn--copper press" href="' + esc(waUrl()) + '" target="_blank" rel="noopener">Open WhatsApp again</a>' +
            '<button type="button" class="btn btn--ghost press" data-b-done style="--fg:#f5f5f2;--bd:rgba(255,255,255,0.25)">Close</button>' +
          '</div>';
        $('[data-b-done]', body).addEventListener('click', function () { close(); values = {}; idx = 0; });
        return;
      }
      var s = STEPS[idx], v = values[s.id] || '';
      bar.style.transform = 'scaleX(' + ((idx + 0.2) / STEPS.length).toFixed(3) + ')';
      var html = '<p class="b-kicker mono">STEP 0' + (idx + 1) + ' / 0' + STEPS.length + '</p>' +
        '<h2 class="b-heading" tabindex="-1">' + esc(s.q) + '</h2>';
      if (s.kind === 'text') {
        html += '<input class="b-input" type="text" value="' + esc(v) + '" placeholder="' + esc(s.ph) + '">';
      } else if (s.kind === 'textarea') {
        html += '<textarea class="b-input" rows="3" placeholder="' + esc(s.ph) + '">' + esc(v) + '</textarea>';
      } else {
        html += '<div class="b-choices" role="radiogroup">';
        s.options.forEach(function (o, i) {
          html += '<button type="button" class="b-choice" role="radio" aria-checked="' + (v === o) + '" data-val="' + esc(o) + '">' +
            '<kbd>' + 'ABCDE'[i] + '</kbd><span>' + esc(o) + '</span></button>';
        });
        html += '</div>';
      }
      if (err) html += '<p class="b-err" role="alert">' + esc(err) + '</p>';
      html += '<div class="b-nav">' +
        '<button type="button" class="btn btn--ghost b-back" style="--fg:#f5f5f2;--bd:rgba(255,255,255,0.25);' + (idx === 0 ? 'visibility:hidden' : '') + '">← Back</button>' +
        '<span class="mono" style="opacity:0.55">Press Enter ↵</span>' +
        '<button type="button" class="btn btn--copper b-next">' + (idx === STEPS.length - 1 ? 'Open in WhatsApp →' : 'Continue →') + '</button>' +
      '</div>';
      body.innerHTML = html;

      var inp = $('.b-input', body);
      if (inp) {
        inp.addEventListener('input', function () { values[s.id] = inp.value; });
        inp.focus();
      } else {
        $$('.b-choice', body).forEach(function (b) {
          b.addEventListener('click', function () { pick(s, b.dataset.val); });
        });
      }
      $('.b-back', body).addEventListener('click', function () { if (idx > 0) { idx--; render(''); } });
      $('.b-next', body).addEventListener('click', next);
    }

    triggers.forEach(function (t) {
      t.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
  }

  /* ==========================================================================
     12. DRAGGABLE 404 SYT EMBLEM (.lost-syt)
     ========================================================================== */
  function initLostSyt() {
    var o = $('.lost-syt');
    if (!o) return;
    var angle = 0, dragging = false, startX = 0, base = 0;
    o.addEventListener('pointerdown', function (e) {
      dragging = true; startX = e.clientX; base = angle;
      o.setPointerCapture(e.pointerId);
      o.style.transition = 'none';
    });
    o.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      angle = base + (e.clientX - startX) * 0.85;
      o.style.transform = 'rotate(' + angle.toFixed(1) + 'deg)';
    });
    o.addEventListener('pointerup', function (e) {
      dragging = false; o.style.transition = '';
      if (Math.abs(e.clientX - startX) < 4) { angle += 180; buzz(15); }
      angle = Math.round(angle / 45) * 45;
      o.style.transform = 'rotate(' + angle + 'deg)';
    });
  }

  function init() {
    try { initHeroDots(); } catch (e) { console.error('heroDots', e); }
    try { initClocks(); } catch (e) { console.error('clocks', e); }
    try { initRing(); } catch (e) { console.error('ring', e); }
    try { initCorridor(); } catch (e) { console.error('corridor', e); }
    try { initProcessCube(); } catch (e) { console.error('processCube', e); }
    try { initReactor(); } catch (e) { console.error('reactor', e); }
    try { initWall(); } catch (e) { console.error('wall', e); }
    try { initRules(); } catch (e) { console.error('rules', e); }
    try { initMutation(); } catch (e) { console.error('mutation', e); }
    try { initFooterDots(); } catch (e) { console.error('footerDots', e); }
    try { initBriefing(); } catch (e) { console.error('briefing', e); }
    try { initLostSyt(); } catch (e) { console.error('lostSyt', e); }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
