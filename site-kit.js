/* ==========================================================================
   SASYANTERRA v2.0 — UI Primitives & Micro-Interactions
   Haptics, masked word splits, IntersectionObserver reveals, marquee & menu.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = function () {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---- Tactile Haptics ---- */
  var hapticSwitch = null;
  function ensureSwitch() {
    if (hapticSwitch) return hapticSwitch;
    var label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    hapticSwitch = label;
    return label;
  }
  function haptic(ms) {
    if (reduceMotion()) return false;
    var dur = typeof ms === 'number' && ms > 0 ? ms : 10;
    try {
      if (navigator.vibrate) return navigator.vibrate(dur);
      ensureSwitch().click();
      return true;
    } catch (e) { return false; }
  }
  function initHaptics() {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-haptic], .press') : null;
      if (!t) return;
      var n = parseInt(t.getAttribute('data-haptic'), 10);
      haptic(isNaN(n) ? 10 : n);
    }, { passive: true });
    document.addEventListener('touchstart', function () {}, { passive: true });
  }

  /* ---- Masked Word Reveals (preserves <em> styling inside headings!) ---- */
  function splitWords(el) {
    if (el.getAttribute('data-split-done')) return;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    var idx = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var outer = document.createElement('span');
            outer.className = 'w';
            outer.setAttribute('aria-hidden', 'true');
            var inner = document.createElement('span');
            inner.className = 'w-i';
            inner.style.setProperty('--i', String(idx++));
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          n.setAttribute('aria-hidden', 'true');
          walk(n);
        }
      });
    })(el);
    el.setAttribute('data-split-done', '1');
  }

  function whenInView(els, cb, opts) {
    if (!('IntersectionObserver' in window)) { els.forEach(cb); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { cb(en.target); io.unobserve(en.target); }
      });
    }, opts || { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function initReveal() {
    $$('[data-split]').forEach(splitWords);
    var els = $$('[data-reveal], [data-split]');
    els.forEach(function (el) {
      var i = el.getAttribute('data-reveal-i');
      if (i) el.style.setProperty('--i', i);
    });
    if (reduceMotion()) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    whenInView(els, function (el) { el.classList.add('is-in'); });
  }

  /* ---- Counters ---- */
  function formatNumber(n, locale) {
    try { return new Intl.NumberFormat(locale || undefined).format(n); } catch (e) { return String(n); }
  }
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-count-suffix') || '';
    var locale = el.getAttribute('lang') || root.lang || undefined;
    var done = function () { el.textContent = formatNumber(target, locale) + suffix; };
    if (reduceMotion()) { done(); return; }
    var dur = parseInt(el.getAttribute('data-count-duration'), 10) || 1300;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = formatNumber(Math.round(target * eased), locale) + suffix;
      if (p < 1) requestAnimationFrame(tick); else done();
    }
    requestAnimationFrame(tick);
  }
  function initCounters() {
    whenInView($$('[data-count-to]'), runCounter, { threshold: 0.5 });
  }

  /* ---- Marquee ---- */
  function initMarquee() {
    $$('[data-marquee]').forEach(function (el) {
      if (el.getAttribute('data-marquee-ready')) return;
      var items = Array.prototype.slice.call(el.children);
      var track = document.createElement('div');
      track.className = 'marquee__track';
      var a = document.createElement('div');
      a.style.cssText = 'display:flex;gap:inherit;flex:none;align-items:center';
      items.forEach(function (n) { a.appendChild(n); });
      var b = a.cloneNode(true);
      b.setAttribute('aria-hidden', 'true');
      track.appendChild(a);
      track.appendChild(b);
      el.appendChild(track);
      var speed = parseFloat(el.getAttribute('data-speed')) || 34;
      el.style.setProperty('--marquee-duration', speed + 's');
      el.setAttribute('data-marquee-ready', '1');
    });
  }

  /* ---- Magnetic Buttons ---- */
  function initMagnetic() {
    if (reduceMotion() || typeof window.matchMedia !== 'function' ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.22;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      function loop() {
        cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
        el.style.transform = 'translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)';
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
        else { el.style.transform = ''; raf = null; }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        kick();
      });
      el.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    });
  }

  /* ---- Full-Screen Menu Dialog ---- */
  function initMenu() {
    var menu = document.querySelector('[data-menu]');
    var toggles = $$('[data-menu-toggle]');
    if (!menu || !toggles.length) return;
    var lastFocus = null;
    var page = $$('main, header, footer').filter(function (n) { return !menu.contains(n); });
    function focusables() {
      return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', menu);
    }
    function open() {
      lastFocus = document.activeElement;
      menu.classList.add('is-open');
      menu.removeAttribute('hidden');
      document.body.classList.add('menu-open');
      page.forEach(function (n) { n.setAttribute('inert', ''); });
      toggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      var f = focusables();
      if (f.length) f[0].focus();
    }
    function close() {
      menu.classList.remove('is-open');
      menu.setAttribute('hidden', '');
      document.body.classList.remove('menu-open');
      page.forEach(function (n) { n.removeAttribute('inert'); });
      toggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function isOpen() { return menu.classList.contains('is-open'); }
    toggles.forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
      t.addEventListener('click', function () { isOpen() ? close() : open(); });
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    menu.setAttribute('hidden', '');
  }

  function initYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function init() {
    root.classList.add('js');
    initYear();
    initHaptics();
    initReveal();
    initCounters();
    initMarquee();
    initMagnetic();
    initMenu();
  }

  window.SasyanterraKit = { init: init, haptic: haptic, splitWords: splitWords };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

