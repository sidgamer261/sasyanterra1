/* ==========================================================================
   SASYANTERRA v2.0 — Motion, 299-Frame Cinema & Telemetry Engine
   1. Inertial smooth scroll (desktop fine pointers, respects reduced-motion)
   2. Fast 1.75s calibration intro (skippable via Esc or button)
   3. 299-Frame Studio-to-Obsidian Exploded Hardware Cinema (#anatomy)
   4. Autonomous Field Operations SVG Simulation (#operations)
   5. Interactive Sasyanterra OS Phone Preview, Accordion & WhatsApp Forms
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var T = window.ST_T || function (k) { return k; };

  var skipIntro = false, restoreY = 0;
  try {
    skipIntro = sessionStorage.getItem('st-skip-intro') === '1';
    restoreY = +sessionStorage.getItem('st-scroll') || 0;
    sessionStorage.removeItem('st-skip-intro');
    sessionStorage.removeItem('st-scroll');
  } catch (e) {}

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var EXPO = 'cubic-bezier(.16,1,.3,1)';
  var canAnimate = typeof Element !== 'undefined' && !!Element.prototype.animate;

  /* ------------------------------------------------------------------ 1. Smooth Scroll */
  var Smooth = (function () {
    var enabled = !reduce && finePointer;
    var target = window.scrollY, cur = window.scrollY, raf = 0, locked = false;
    function maxScroll() { return Math.max(0, root.scrollHeight - window.innerHeight); }
    function tick() {
      cur += (target - cur) * 0.095;
      if (Math.abs(target - cur) < 0.45) { cur = target; window.scrollTo(0, cur); raf = 0; return; }
      window.scrollTo(0, cur);
      raf = requestAnimationFrame(tick);
    }
    function innerScrollable(el) {
      while (el && el !== body && el !== root) {
        if (el.nodeType === 1 && el.scrollHeight > el.clientHeight + 1) {
          var oy = getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll') return true;
        }
        el = el.parentElement;
      }
      return false;
    }
    window.addEventListener('wheel', function (e) {
      if (!enabled || locked || e.ctrlKey || e.defaultPrevented || body.classList.contains('menu-open')) return;
      if (innerScrollable(e.target)) return;
      e.preventDefault();
      var dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!raf) { cur = window.scrollY; target = cur; }
      target = clamp(target + dy, 0, maxScroll());
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: false });
    window.addEventListener('scroll', function () { if (!raf) cur = target = window.scrollY; }, { passive: true });
    return {
      to: function (y, instant) {
        y = clamp(y, 0, maxScroll());
        if (instant || reduce) { raf && cancelAnimationFrame(raf); raf = 0; cur = target = y; window.scrollTo(0, y); return; }
        if (enabled) { if (!raf) { cur = window.scrollY; raf = requestAnimationFrame(tick); } target = y; }
        else window.scrollTo({ top: y, behavior: 'smooth' });
      },
      lock: function (v) { locked = v; }
    };
  })();
  window.SasyanterraSmooth = Smooth;

  /* Anchor links */
  function targetY(el) {
    if (!el) return 0;
    if (el.id === 'anatomy') { var at = $('#anatomyTrack'); return (at || el).getBoundingClientRect().top + window.scrollY; }
    if (el.hasAttribute('data-scene')) { var tr = $('[data-track]', el); return (tr || el).getBoundingClientRect().top + window.scrollY; }
    return el.getBoundingClientRect().top + window.scrollY;
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var el = id === '#top' ? $('#top') : $(id);
    if (!el) return;
    e.preventDefault();
    var go = function () {
      Smooth.to(id === '#top' ? 0 : targetY(el));
      try { history.replaceState(null, '', id); } catch (err) {}
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    };
    if (body.classList.contains('menu-open')) setTimeout(go, 60); else go();
  });

  /* ------------------------------------------------------------------ 2. Hero & Fast Calibration Intro */
  var hero = $('.hero'), stage = $('#stage'), heroTitle = $('[data-hero-title]');
  if (heroTitle && window.SasyanterraKit) window.SasyanterraKit.splitWords(heroTitle);

  function heroReady() {
    if (body.classList.contains('is-ready')) return;
    body.classList.add('is-ready');
    if (hero) hero.classList.add('is-ready');
    if (heroTitle) heroTitle.classList.add('is-in');
  }

  function runIntro() {
    if (!stage || !canAnimate || reduce || skipIntro) {
      if (stage) stage.style.display = 'none';
      heroReady();
      return;
    }
    window.scrollTo(0, 0);
    Smooth.lock(true);
    root.classList.add('intro-lock');

    var countEl = $('#count'), bootBar = $('#bootBar');
    var dur = 1550, start = performance.now(), done = false, rafId = 0, fadeAnim = null;

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(rafId);
      if (fadeAnim) { try { fadeAnim.cancel(); } catch (e) {} }
      stage.style.display = 'none';
      root.classList.remove('intro-lock');
      Smooth.lock(false);
      heroReady();
      Scenes.refresh();
    }

    (function tick(now) {
      if (done) return;
      var p = clamp((now - start) / dur);
      var eased = easeOut(p);
      if (countEl) countEl.textContent = String(Math.round(eased * 100)).padStart(3, '0');
      if (bootBar) bootBar.style.setProperty('--boot', eased.toFixed(3));
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        heroReady();
        fadeAnim = stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: EXPO, fill: 'forwards' });
        fadeAnim.onfinish = finish;
        setTimeout(finish, 600);
      }
    })(start);

    var skipBtn = $('#skip');
    if (skipBtn) skipBtn.addEventListener('click', finish);
    doc.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && !done) finish();
    });
  }

  /* Hero subtle pointer parallax */
  (function () {
    if (reduce || !finePointer || !hero) return;
    var raf = 0, tx = 0, ty = 0;
    hero.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        hero.style.setProperty('--hx', tx.toFixed(3));
        hero.style.setProperty('--hy', ty.toFixed(3));
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      hero.style.setProperty('--hx', '0');
      hero.style.setProperty('--hy', '0');
    });
  })();

  /* ------------------------------------------------------------------ 3. 299-Frame Architecture Cinema */
  var Anatomy = (function () {
    var sec = $('#anatomy'), track = $('#anatomyTrack'), canvas = $('#anatomyCanvas');
    var range = $('#anatomyRange'), frameStat = $('#frameStat'), loadStat = $('#loadStat'), pctEl = $('#explodePct');
    var chapIdxEl = $('#chapIdx'), chapRangeEl = $('#chapRange'), chapTitleEl = $('#anatomy-heading'), chapDescEl = $('#chapDesc'), chapSpecsEl = $('#chapSpecs');
    var tabs = $$('.atab', sec);
    var TOTAL = 299;
    var frames = new Array(TOTAL + 1);
    var loadedCount = 0;
    var curFrame = 1, targetFrame = 1, dispFrame = 1, animRaf = 0, activeChap = -1;
    var isDarkStage = false;

    /* Sampled pixel RGB curve matching the exact JPEG studio backdrop from Frame 001 to 299 */
    var BG_CURVE = [
      [1, 254, 254, 254],
      [30, 254, 254, 254],
      [32, 219, 220, 215],
      [35, 187, 187, 187],
      [38, 156, 156, 156],
      [41, 112, 112, 112],
      [44, 83, 83, 83],
      [47, 37, 37, 37],
      [50, 20, 20, 20],
      [299, 20, 20, 20]
    ];

    function stageColor(f) {
      if (f <= 30) return 'rgb(254,254,254)';
      if (f >= 50) return 'rgb(20,20,20)';
      for (var i = 0; i < BG_CURVE.length - 1; i++) {
        var a = BG_CURVE[i], b = BG_CURVE[i + 1];
        if (f >= a[0] && f <= b[0]) {
          var t = (f - a[0]) / (b[0] - a[0]);
          var r = Math.round(lerp(a[1], b[1], t));
          var g = Math.round(lerp(a[2], b[2], t));
          var bl = Math.round(lerp(a[3], b[3], t));
          return 'rgb(' + r + ',' + g + ',' + bl + ')';
        }
      }
      return 'rgb(20,20,20)';
    }

    function getChapters() {
      return [
        { start: 1, end: 50, title: T('ch1_t'), desc: T('ch1_d'), specs: [T('ch1_s1'), T('ch1_s2')] },
        { start: 51, end: 95, title: T('ch2_t'), desc: T('ch2_d'), specs: [T('ch2_s1'), T('ch2_s2')] },
        { start: 96, end: 140, title: T('ch3_t'), desc: T('ch3_d'), specs: [T('ch3_s1'), T('ch3_s2')] },
        { start: 141, end: 185, title: T('ch4_t'), desc: T('ch4_d'), specs: [T('ch4_s1'), T('ch4_s2')] },
        { start: 186, end: 235, title: T('ch5_t'), desc: T('ch5_d'), specs: [T('ch5_s1'), T('ch5_s2')] },
        { start: 236, end: 299, title: T('ch6_t'), desc: T('ch6_d'), specs: [T('ch6_s1'), T('ch6_s2')] }
      ];
    }

    function pad3(n) { return String(n).padStart(3, '0'); }
    function frameSrc(n) { return 'assets/frames/ezgif-frame-' + pad3(n) + '.jpg'; }

    function nearestLoaded(idx) {
      if (frames[idx] && frames[idx].complete && frames[idx].naturalWidth) return frames[idx];
      for (var d = 1; d < TOTAL; d++) {
        var lo = idx - d, hi = idx + d;
        if (lo >= 1 && frames[lo] && frames[lo].complete && frames[lo].naturalWidth) return frames[lo];
        if (hi <= TOTAL && frames[hi] && frames[hi].complete && frames[hi].naturalWidth) return frames[hi];
      }
      return null;
    }

    function drawFrame(idx) {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var img = nearestLoaded(idx);
      if (!img) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    function syncUI(fInt) {
      if (!sec) return;
      sec.style.setProperty('--stage-bg', stageColor(fInt));
      isDarkStage = fInt >= 40;
      sec.classList.toggle('is-dark', isDarkStage);

      if (frameStat) frameStat.innerHTML = 'FRAME <b>' + pad3(fInt) + '</b> / 299';
      if (range && doc.activeElement !== range) range.value = String(fInt);
      var pct = Math.round(((fInt - 1) / (TOTAL - 1)) * 100);
      if (pctEl) pctEl.textContent = pct + '%';

      var chaps = getChapters();
      var ci = 0;
      for (var i = 0; i < chaps.length; i++) {
        if (fInt >= chaps[i].start && fInt <= chaps[i].end) { ci = i; break; }
      }
      if (ci !== activeChap) {
        activeChap = ci;
        var c = chaps[ci];
        if (chapIdxEl) chapIdxEl.textContent = T('chap_word') + ' 0' + (ci + 1) + ' / 06';
        if (chapRangeEl) chapRangeEl.textContent = 'FRM ' + pad3(c.start) + '–' + pad3(c.end);
        if (chapTitleEl) chapTitleEl.textContent = c.title;
        if (chapDescEl) chapDescEl.textContent = c.desc;
        if (chapSpecsEl) {
          chapSpecsEl.innerHTML = c.specs.map(function (s) { return '<span>' + s + '</span>'; }).join('');
        }
        tabs.forEach(function (btn, bi) {
          btn.classList.toggle('is-active', bi === ci);
        });
      }
    }

    function tick() {
      dispFrame += (targetFrame - dispFrame) * 0.22;
      if (Math.abs(targetFrame - dispFrame) < 0.08) dispFrame = targetFrame;
      var fInt = clamp(Math.round(dispFrame), 1, TOTAL);
      if (fInt !== curFrame) {
        curFrame = fInt;
        drawFrame(curFrame);
        syncUI(curFrame);
      }
      if (Math.abs(targetFrame - dispFrame) >= 0.08) {
        animRaf = requestAnimationFrame(tick);
      } else {
        animRaf = 0;
      }
    }

    function setProgress(p) {
      targetFrame = 1 + clamp(p, 0, 1) * (TOTAL - 1);
      if (!animRaf) animRaf = requestAnimationFrame(tick);
    }

    function startLoader() {
      if (!canvas || reduce) return;
      var queue = [];
      var seen = {};
      function enqueue(n) {
        if (n >= 1 && n <= TOTAL && !seen[n]) { seen[n] = true; queue.push(n); }
      }
      // Priority 1: Immediate hero/opening & final frames
      [1, 3, 25, 38, 50, 95, 140, 185, 235, 299].forEach(enqueue);
      // Priority 2: Every 5th frame for instant scrubbing across full timeline
      for (var k = 1; k <= TOTAL; k += 5) enqueue(k);
      // Priority 3: All remaining frames for silky 60fps cinema
      for (var m = 1; m <= TOTAL; m++) enqueue(m);

      var inFlight = 0, cursor = 0, CONCURRENCY = 6;
      function pump() {
        while (inFlight < CONCURRENCY && cursor < queue.length) {
          (function (frameNum) {
            inFlight++;
            var img = new Image();
            img.decoding = 'async';
            img.onload = img.onerror = function () {
              inFlight--;
              loadedCount++;
              if (frameNum === curFrame || loadedCount <= 3) drawFrame(curFrame);
              if (loadStat) {
                if (loadedCount >= TOTAL) loadStat.textContent = T('cinema_ready');
                else loadStat.textContent = Math.round((loadedCount / TOTAL) * 100) + '%';
              }
              pump();
            };
            img.src = frameSrc(frameNum);
            frames[frameNum] = img;
          })(queue[cursor++]);
        }
      }
      pump();
    }

    function bindControls() {
      if (!sec || !track) return;
      var chaps = getChapters();
      tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-chap'), 10) || 0;
          var c = chaps[idx];
          if (!c) return;
          var targetF = idx === 0 ? 12 : Math.round((c.start + c.end) * 0.5);
          var p = (targetF - 1) / (TOTAL - 1);
          var rect = track.getBoundingClientRect();
          var span = Math.max(1, track.offsetHeight - window.innerHeight);
          var destY = rect.top + window.scrollY + p * span;
          Smooth.to(destY);
        });
      });

      if (range) {
        range.addEventListener('input', function () {
          var f = clamp(parseInt(range.value, 10) || 1, 1, TOTAL);
          var p = (f - 1) / (TOTAL - 1);
          var rect = track.getBoundingClientRect();
          var span = Math.max(1, track.offsetHeight - window.innerHeight);
          var destY = rect.top + window.scrollY + p * span;
          targetFrame = dispFrame = f;
          curFrame = f;
          drawFrame(f);
          syncUI(f);
          window.scrollTo(0, destY);
        });
      }
    }

    function init() {
      if (!sec || !canvas) return;
      if (reduce) {
        sec.classList.add('is-static');
        return;
      }
      syncUI(1);
      startLoader();
      bindControls();
    }

    return {
      init: init,
      onScroll: function () {
        if (!track || !sec || sec.classList.contains('is-static')) return;
        var r = track.getBoundingClientRect();
        var span = Math.max(1, r.height - window.innerHeight);
        if (r.bottom > -120 && r.top < window.innerHeight + 120) {
          setProgress(clamp(-r.top / span, 0, 1));
        }
      },
      isDarkAtTop: function () {
        if (!sec || sec.classList.contains('is-static')) return false;
        var b = sec.getBoundingClientRect();
        return b.top <= 44 && b.bottom >= 44 && isDarkStage;
      }
    };
  })();

  /* ------------------------------------------------------------------ 4. Scroll Scenes & SVG Field Ops */
  var Scenes = (function () {
    var nav = $('#nav'), progress = $('#progress'), themeMeta = $('#themeMeta');
    var leadWords = [], lead = $('[data-words]');
    if (lead) {
      var text = lead.textContent.replace(/\s+/g, ' ').trim();
      lead.setAttribute('aria-label', text);
      lead.textContent = '';
      text.split(' ').forEach(function (w, i, arr) {
        var s = doc.createElement('span');
        s.className = 'ws';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = w;
        lead.appendChild(s);
        leadWords.push(s);
        if (i < arr.length - 1) lead.appendChild(doc.createTextNode(' '));
      });
    }

    var scene = $('[data-scene]'), track = $('[data-track]');
    var svg = $('#roverSvg');
    var phone = $('#phone');
    var darkSections = $$('.on-dark');
    var navLinks = $$('.nav__links a'), navSecs = navLinks.map(function (a) { return $(a.getAttribute('href')); }), contactSec = $('#contact');
    var steps = $$('[data-step]'), hud = $('#hud'), stepNow = $('#stepNow'), ghost = $('#ghost');
    var NS = 'http://www.w3.org/2000/svg';
    var R = {};
    var sceneVisible = false, pTarget = 0, pDisp = 0, lastCam = 0, ticking = false, lastY = window.scrollY;

    var RX = 330, GROUND = 430;
    var HUD = [T('hud1'), T('hud2'), T('hud3'), T('hud4')];
    var armIK = { a1: -18, a2: 62 };
    var REST = { a1: -148, a2: 164 };

    function solveIK() {
      var bx = 108, by = -168, tx = 390, ty = -84, L1 = 176, L2 = 192;
      var dx = tx - bx, dy = ty - by, dd = Math.min(Math.hypot(dx, dy), L1 + L2 - 1), th = Math.atan2(dy, dx);
      var al = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
      var it = Math.acos(clamp((L1 * L1 + L2 * L2 - dd * dd) / (2 * L1 * L2), -1, 1));
      armIK = { a1: (th - al) * 180 / Math.PI, a2: (Math.PI - it) * 180 / Math.PI };
    }

    function setupScene() {
      if (!svg) return;
      ['world', 'sprouts', 'furrows', 'probeRod', 'rings', 'soilTag', 'beam', 'beamPoly', 'rock', 'rockShape', 'rockTag', 'eye', 'upper', 'fore', 'fingerA', 'fingerB', 'armLaser', 'plantSway', 'roverBody'].forEach(function (id) {
        R[id] = $('#' + id, svg) || doc.getElementById(id);
      });
      R.spins = $$('.spin', svg);
      solveIK();
      if (R.rock) R.rock.setAttribute('transform', 'translate(' + (window.innerWidth < 700 ? 1790 : 1910) + ' 0)');

      var g = R.sprouts, frag = doc.createDocumentFragment();
      for (var x = -120; x < 2500; x += 150) {
        if (Math.abs(x - 1640) < 90 || Math.abs(x - 1910) < 110 || Math.abs(x - 1790) < 100) continue;
        var sc = 0.64 + 0.36 * Math.abs(Math.sin(x * 0.013));
        var u = doc.createElementNS(NS, 'use');
        u.setAttribute('href', '#sprout');
        u.setAttribute('transform', 'translate(' + x + ' 0) scale(' + sc.toFixed(2) + ')');
        u.setAttribute('opacity', '.92');
        frag.appendChild(u);
      }
      g.appendChild(frag);

      R.arcs = [];
      for (var i = 0; i < 3; i++) {
        var p = doc.createElementNS(NS, 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#5ce6ff');
        p.setAttribute('stroke-width', '2.4');
        p.setAttribute('stroke-linecap', 'round');
        R.beam.appendChild(p);
        R.arcs.push(p);
      }
      R.rings = $$('circle', R.rings);
      setViewBox();
    }

    function setViewBox() {
      if (!svg) return;
      if (R.rock) R.rock.setAttribute('transform', 'translate(' + (window.innerWidth < 700 ? 1790 : 1910) + ' 0)');
      svg.setAttribute('viewBox', window.innerWidth < 700 ? '90 135 830 425' : '0 120 1200 440');
    }

    function rockWorldX() { return window.innerWidth < 700 ? 1790 : 1910; }
    function arcPath(cx, cy, r, a0, a1) {
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
    }

    function renderScene(p, now) {
      if (!svg || !R.world) return;
      var nav1 = easeInOut(clamp(p / 0.22));
      var det = easeInOut(clamp((p - 0.5) / 0.22));
      var cam = nav1 * 620 + det * 300;
      var moving = Math.abs(cam - lastCam) > 0.05;
      lastCam = cam;

      R.world.setAttribute('transform', 'translate(' + (-cam).toFixed(2) + ' ' + GROUND + ')');
      R.furrows.setAttribute('patternTransform', 'translate(' + (-(cam % 120)).toFixed(2) + ' 0)');
      var deg = cam / 41 * 180 / Math.PI;
      for (var i = 0; i < R.spins.length; i++) R.spins[i].setAttribute('transform', 'rotate(' + deg.toFixed(1) + ')');
      var bob = moving ? Math.sin(cam / 9) * 1.4 : 0;
      R.roverBody.setAttribute('transform', 'translate(' + RX + ' ' + (GROUND + bob).toFixed(2) + ')');

      // Sub-surface soil probe
      var ext = easeInOut(clamp((p - 0.25) / 0.1)), ret = easeInOut(clamp((p - 0.455) / 0.05));
      var rod = Math.max(0.001, ext * (1 - ret));
      R.probeRod.setAttribute('transform', 'scale(1 ' + rod.toFixed(3) + ')');
      var sensing = ext > 0.92 && ret < 0.3;
      var ringsEl = R.rings[0] && R.rings[0].parentNode;
      if (ringsEl) {
        ringsEl.setAttribute('opacity', sensing ? '1' : '0');
        for (var j = 0; j < R.rings.length; j++) {
          var ph = ((now / 1400) + j / 3) % 1;
          R.rings[j].setAttribute('r', (14 + ph * 68).toFixed(1));
          R.rings[j].setAttribute('opacity', (1 - ph).toFixed(2));
        }
      }
      R.soilTag.setAttribute('opacity', sensing ? '1' : '0');

      // LiDAR obstacle lock
      var rockX = rockWorldX() - cam;
      var beamOn = easeOut(clamp((p - 0.6) / 0.05)) * (1 - 0.8 * clamp((p - 0.88) / 0.06));
      R.beam.setAttribute('opacity', beamOn.toFixed(2));
      var ex = RX + 168, ey = GROUND - 118;
      R.beamPoly.setAttribute('points', ex + ',' + ey + ' ' + (rockX - 50).toFixed(1) + ',' + (GROUND - 66) + ' ' + (rockX - 50).toFixed(1) + ',' + GROUND);
      for (var q = 0; q < R.arcs.length; q++) {
        var ph2 = ((now / 1100) + q / 3) % 1;
        R.arcs[q].setAttribute('d', arcPath(ex, ey, 34 + ph2 * 110, -0.48, 0.48));
        R.arcs[q].setAttribute('opacity', (1 - ph2).toFixed(2));
      }
      R.eye.setAttribute('r', (beamOn > 0.1 ? 6.5 + Math.sin(now / 130) * 2 : 6.5).toFixed(1));
      R.rockShape.setAttribute('stroke', beamOn > 0.5 ? '#5ce6ff' : '#455060');
      R.rockTag.setAttribute('opacity', clamp((beamOn - 0.4) * 2).toFixed(2));

      // Carbon-truss manipulator & crimson targeting laser
      var w = easeInOut(clamp((p - 0.76) / 0.18));
      var a1 = lerp(REST.a1, armIK.a1, w), a2 = lerp(REST.a2, armIK.a2, w);
      R.upper.setAttribute('transform', 'rotate(' + a1.toFixed(2) + ')');
      R.fore.setAttribute('transform', 'translate(176 0) rotate(' + a2.toFixed(2) + ')');
      var openAmt = easeInOut(clamp((p - 0.8) / 0.08));
      var closeAmt = easeInOut(clamp((p - 0.955) / 0.04));
      var g = lerp(5, 26, openAmt);
      g = lerp(g, 6, closeAmt);
      R.fingerA.setAttribute('transform', 'translate(26 -9) rotate(' + (-g).toFixed(1) + ')');
      R.fingerB.setAttribute('transform', 'translate(26 9) rotate(' + g.toFixed(1) + ')');
      if (R.armLaser) {
        var laserAlpha = w > 0.65 ? (0.55 + 0.35 * Math.sin(now / 110)) : 0;
        R.armLaser.setAttribute('opacity', laserAlpha.toFixed(2));
      }
      R.plantSway.setAttribute('transform', 'rotate(' + (-3.5 * closeAmt + Math.sin(now / 900) * 0.6).toFixed(2) + ')');

      var idx = clamp(Math.floor(p * 4), 0, 3);
      for (var s = 0; s < steps.length; s++) {
        steps[s].classList.toggle('is-active', s === idx);
        steps[s].style.setProperty('--fill', clamp(p * 4 - s).toFixed(3));
      }
      if (hud && hud.getAttribute('data-i') !== String(idx)) {
        hud.textContent = HUD[idx];
        hud.setAttribute('data-i', String(idx));
        var sp = steps[idx] && steps[idx].querySelector('span:not(.mono)');
        if (stepNow && sp) stepNow.textContent = sp.textContent;
        if (ghost) ghost.textContent = '0' + (idx + 1);
      }
    }

    function sceneLoop(now) {
      if (!sceneVisible) { ticking = false; return; }
      pDisp += (pTarget - pDisp) * 0.14;
      if (Math.abs(pTarget - pDisp) < 0.0004) pDisp = pTarget;
      renderScene(pDisp, now);
      requestAnimationFrame(sceneLoop);
    }
    function startLoop() { if (!ticking) { ticking = true; requestAnimationFrame(sceneLoop); } }

    var queued = false;
    function onScroll() { if (queued) return; queued = true; requestAnimationFrame(update); }
    function update() {
      queued = false;
      var y = window.scrollY, vh = window.innerHeight;
      var max = Math.max(1, root.scrollHeight - vh);
      if (progress) progress.style.setProperty('--p', (y / max).toFixed(4));

      Anatomy.onScroll();

      if (nav) {
        nav.classList.toggle('is-solid', y > 48);
        var dy = y - lastY;
        if (y > 540 && dy > 7) nav.classList.add('is-hidden');
        else if (dy < -4 || y < 420) nav.classList.remove('is-hidden');

        var dark = Anatomy.isDarkAtTop();
        if (!dark) {
          for (var i = 0; i < darkSections.length; i++) {
            var b = darkSections[i].getBoundingClientRect();
            if (b.top <= 42 && b.bottom >= 42) { dark = true; break; }
          }
        }
        nav.classList.toggle('on-dark', dark);
        if (themeMeta) themeMeta.setAttribute('content', dark ? '#0a0c0f' : '#fefefe');
      }
      lastY = y;

      var curSec = -1;
      for (var ns = 0; ns < navSecs.length; ns++) {
        if (navSecs[ns] && navSecs[ns].getBoundingClientRect().top <= vh * 0.42) curSec = ns;
      }
      if (contactSec && contactSec.getBoundingClientRect().top <= vh * 0.42) curSec = -1;
      for (var nl = 0; nl < navLinks.length; nl++) {
        if (nl === curSec) navLinks[nl].setAttribute('aria-current', 'true');
        else navLinks[nl].removeAttribute('aria-current');
      }

      if (leadWords.length) {
        var lb = lead.getBoundingClientRect();
        var lp = clamp((vh * 0.86 - lb.top) / (lb.height + vh * 0.36));
        var n = leadWords.length;
        for (var k = 0; k < n; k++) {
          leadWords[k].style.setProperty('--o', (0.16 + 0.84 * clamp(lp * (n + 3) - k, 0, 1)).toFixed(3));
        }
      }

      if (track && !(scene && scene.classList.contains('is-static'))) {
        var tb = track.getBoundingClientRect();
        pTarget = clamp(-tb.top / Math.max(1, tb.height - vh));
        var vis = tb.bottom > -50 && tb.top < vh + 50;
        if (vis && !sceneVisible) { sceneVisible = true; startLoop(); }
        else if (!vis) sceneVisible = false;
      }

      if (phone) {
        var pb = phone.getBoundingClientRect();
        var mid = (pb.top + pb.height / 2 - vh / 2) / vh;
        phone.style.setProperty('--tilt', clamp(-mid * 15, -13, 13).toFixed(2) + 'deg');
      }
    }

    function refresh() {
      setViewBox();
      update();
      if (scene && scene.classList.contains('is-static')) renderScene(1, 0);
    }

    function init() {
      Anatomy.init();
      setupScene();
      if (reduce || !canAnimate) {
        if (scene) scene.classList.add('is-static');
        leadWords.forEach(function (w) { w.style.setProperty('--o', '1'); });
        renderScene(1, 0);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', function () { setViewBox(); onScroll(); }, { passive: true });
      update();
      if (!reduce && canAnimate) { pDisp = pTarget; renderScene(pDisp, 0); }
    }

    return { init: init, refresh: refresh };
  })();

  /* ------------------------------------------------------------------ 5. App Tabs, FAQ & WhatsApp Forms */
  function initPhoneTabs() {
    var ptabs = $$('[data-ptab]'), ppanels = $$('[data-ppanel]');
    if (!ptabs.length) return;
    ptabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ptab');
        ptabs.forEach(function (b) { b.classList.toggle('is-on', b === btn); });
        ppanels.forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-ppanel') === id); });
        if (window.SasyanterraKit) window.SasyanterraKit.haptic(8);
      });
    });
  }

  function initFaq() {
    $$('[data-faq] details').forEach(function (d) {
      var sum = $('summary', d), ans = $('.ans', d);
      if (!sum || !ans || reduce || !canAnimate) return;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) {
          var h = ans.offsetHeight;
          var a = ans.animate([{ height: h + 'px' }, { height: '0px' }], { duration: 320, easing: EXPO });
          a.onfinish = function () { d.open = false; };
        } else {
          d.open = true;
          var h2 = ans.offsetHeight;
          ans.animate([{ height: '0px' }, { height: h2 + 'px' }], { duration: 480, easing: EXPO });
        }
      });
    });
  }

  var WA_NUMBER = '919500702412';

  function initForm() {
    var form = $('#enquiry');
    if (!form) return;
    var name = $('#f-name'), role = $('#f-role'), msg = $('#f-msg'), status = $('#status');
    function err(id, input, text) {
      $('#' + id).textContent = text;
      if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    [name, msg].forEach(function (el) {
      el.addEventListener('input', function () { err(el === name ? 'e-name' : 'e-msg', el, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      err('e-name', name, ''); err('e-msg', msg, '');
      if (!name.value.trim()) { err('e-name', name, T('err_name')); bad = bad || name; }
      if (!msg.value.trim()) { err('e-msg', msg, T('err_msg')); bad = bad || msg; }
      if (bad) { status.textContent = ''; bad.focus(); return; }
      var text = T('msg_enq', { name: name.value.trim(), role: role.value, msg: msg.value.trim() });
      var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
      var w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (er) {} }
      status.innerHTML = w ? T('ok_enq') : T('blocked') + ' <a href="' + url + '" target="_blank" rel="noopener">' + T('open_wa') + '</a>.';
    });
  }

  function initJoin() {
    var form = $('#apply');
    if (!form) return;
    var name = $('#j-name'), skill = $('#j-skill'), msg = $('#j-msg'), status = $('#jstatus');
    function err(id, input, text) {
      $('#' + id).textContent = text;
      if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    [name, msg].forEach(function (el) {
      el.addEventListener('input', function () { err(el === name ? 'e-jname' : 'e-jmsg', el, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      err('e-jname', name, ''); err('e-jmsg', msg, '');
      if (!name.value.trim()) { err('e-jname', name, T('err_name')); bad = bad || name; }
      if (!msg.value.trim()) { err('e-jmsg', msg, T('err_jmsg')); bad = bad || msg; }
      if (bad) { status.textContent = ''; bad.focus(); return; }
      var text = T('msg_join', { name: name.value.trim(), skill: skill.value, msg: msg.value.trim() });
      var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
      var w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (er) {} }
      status.innerHTML = w ? T('ok_apply') : T('blocked') + ' <a href="' + url + '" target="_blank" rel="noopener">' + T('open_wa') + '</a>.';
    });
  }

  function start() {
    Scenes.init();
    initPhoneTabs();
    initFaq();
    initForm();
    initJoin();
    var ready = (doc.fonts && doc.fonts.ready)
      ? Promise.race([doc.fonts.ready, new Promise(function (r) { setTimeout(r, 1100); })])
      : Promise.resolve();
    ready.then(function () {
      runIntro();
      Scenes.refresh();
      if (restoreY) setTimeout(function () { window.scrollTo(0, restoreY); }, 120);
    });
    setTimeout(heroReady, 5000);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();

