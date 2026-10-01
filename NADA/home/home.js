(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // Node coordinates on the road (match the path in index.html)
  var NODES = [[1000, 400], [1450, 1150], [650, 1900], [1350, 2650], [1000, 3400]];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  
let currentUser = null;

function loadCurrentUser() {
  const savedUser = localStorage.getItem("currentUser");

  if (!savedUser) {
    currentUser = null;
    return;
  }

  try {
    currentUser = JSON.parse(savedUser);
  } catch (error) {
    console.error("Invalid currentUser:", error);
    localStorage.removeItem("currentUser");
    currentUser = null;
  }
}

function renderNavbar() {
  const navAuth = document.getElementById("navAuth");
  const navUser = document.getElementById("navUser");
  const userName = document.getElementById("userName");

  if (!navAuth || !navUser) return;

  const loggedIn = currentUser && currentUser.role === "employee";

  navAuth.classList.toggle("hidden", !!loggedIn);
  navUser.classList.toggle("hidden", !loggedIn);

  if (loggedIn && userName) {
    userName.textContent = currentUser.name || "Employee";
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("userRole");
  localStorage.removeItem("bridgeway_current_role");
  window.location.href = "../../GAITH/login.html";
}

loadCurrentUser();
renderNavbar();

  var path = $('#roadPath'), world = $('#world'), trav = $('#traveler'), spacer = $('#spacer');
  var panels = $$('.stop-panel'), N = panels.length, I = N - 1;
  var names = panels.map(function (p) { return p.dataset.name; });
  var cLine = $('#cLine'), pipA = $('#pipA'), pipB = $('#pipB'), hint = $('#hint'), live = $('#announcer');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var trail, total, dist = [], nodeEls = [], sideEls = [], navLinks = $$('.nav-menu-link[data-jump]'), cur = -1;
  var dwelling = false, statsPanel = $('#stop-3'), countRaf;
  var saRoot = $('#softwareAssembly'), saTag = $('#saTag'), saItems = [], saLast = -1, saVis = 1, saPhase = $('#saPhase'), saStep = $('#saStep'), saSegs = [];
  if (!path || !world || !trav) return;

  function build() {
    var d = path.getAttribute('d');
    ['road-edge', 'road-bed', 'road-dash', 'road-trail'].forEach(function (c) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('class', c);
      path.parentNode.insertBefore(p, $('#nodes'));
      if (c === 'road-trail') trail = p;
    });
    total = path.getTotalLength();
    trail.style.strokeDasharray = total + ' ' + total;

    // Find each node's distance along the road (no hardcoded lengths)
    dist = NODES.map(function (n) {
      var best = 0, bd = Infinity;
      for (var l = 0; l <= total; l += 2) {
        var p = path.getPointAtLength(l), e = Math.pow(p.x - n[0], 2) + Math.pow(p.y - n[1], 2);
        if (e < bd) { bd = e; best = l; }
      }
      return best;
    });
    dist[0] = 0; dist[I] = total;

    NODES.forEach(function (n, i) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'road-node');
      g.setAttribute('transform', 'translate(' + n[0] + ',' + n[1] + ')');
      g.innerHTML = '<circle class="node-ring" r="22"/><circle class="node-core" r="10"/><text class="node-label" y="42">' + names[i].toUpperCase() + '</text>';
      g.addEventListener('click', function () { goTo(i); });
      $('#nodes').appendChild(g); nodeEls.push(g);
    });

    $('#sideNav').innerHTML = names.map(function (n, i) {
      return '<a href="#stop-' + i + '" class="side-step" data-jump="' + i + '"><i></i><span>0' + (i + 1) + ' ' + n + '</span></a>';
    }).join('');
    sideEls = $$('.side-step');
  }

  function update(p) {
    p = Math.max(0, Math.min(1, p));
    var x = p * I, k = Math.min(I - 1, Math.floor(x));
    var len = dist[k] + (x - k) * (dist[k + 1] - dist[k]);

    var pt = path.getPointAtLength(len);
    var a = path.getPointAtLength(Math.min(len + 4, total)), b = path.getPointAtLength(Math.max(len - 4, 0));
    var deg = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;

    // Camera: keep traveler at the focal point; ease up on the final stretch so the road leads into the footer
    var mobile = window.innerWidth <= 768, H = window.innerHeight;
    var fy = H * (mobile ? 0.72 : 0.65), last = (N - 2) / I;
    if (p > last) {
      var t = (p - last) / (1 - last);
      fy += (H * (mobile ? 0.16 : 0.19) - fy) * t * t * (3 - 2 * t);
    }
    world.style.transform = 'translate3d(' + (window.innerWidth / 2 - pt.x).toFixed(1) + 'px,' + (fy - pt.y).toFixed(1) + 'px,0)';
    trav.style.transform = 'translate3d(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px,0) rotate(' + (deg - 90).toFixed(1) + 'deg)';
    trail.style.strokeDashoffset = Math.max(0, total - len).toFixed(1);

    // Blueprint is only for the top of the page: fades and slides away as soon as you leave Home
    saVis = Math.max(0, Math.min(1, 1 - p / 0.0875));
    if (reduce && saRoot) paintAssembly(1);

    var near = Math.round(x), dwell = Math.abs(p - near / I) <= 0.62 / (I * 2);
    if (near !== cur) { cur = near; onStop(near); }
    dwelling = dwell;
    panels.forEach(function (el, i) {
      var on = i === near && dwell, was = el.classList.contains('is-active');
      el.classList.toggle('is-active', on);
      if (el === statsPanel && on !== was) countStats(on);
      if (on) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    });
    nodeEls.forEach(function (el, i) {
      el.classList.toggle('completed', i < near);
      el.classList.toggle('active', i === near);
    });
    connect(near, dwell);
  }

  function onStop(i) {
    sideEls.forEach(function (el, j) { if (j === i) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
    // Top nav: Home/About/Services/Contact; Stats has no link so none is highlighted
    navLinks.forEach(function (l) { l.classList.toggle('active', +l.dataset.jump === i); });
    hint.textContent = i < I ? 'Next: ' + names[i + 1] : 'You have arrived';
    live.textContent = 'Stop ' + (i + 1) + ' of ' + N + ': ' + names[i];
    if (i === 0) layoutAssembly(); // side nav width changes with the active label, so re-measure on Home
  }

  function connect(i, dwell) {
    var show = dwell && window.innerWidth > 820;
    [cLine, pipA, pipB].forEach(function (el) { el.style.opacity = show ? '1' : '0'; });
    if (!show) return;
    var c = panels[i].getBoundingClientRect(), r = nodeEls[i].getBoundingClientRect();
    var nx = r.left + r.width / 2, ny = r.top + r.height / 2, cx, cy, tx, ty, d;
    if (panels[i].classList.contains('pos-center')) {
      cx = c.left + c.width / 2; cy = c.top; tx = nx; ty = ny + 26;
      d = 'M' + tx + ' ' + ty + 'L' + cx + ' ' + cy;
    } else {
      var left = panels[i].classList.contains('pos-left');
      cx = left ? c.right : c.left; cy = c.top + c.height / 2;
      tx = left ? nx - 22 : nx + 22; ty = ny;
      var mx = (cx + tx) / 2;
      d = 'M' + cx + ' ' + cy + 'C' + mx + ' ' + cy + ',' + mx + ' ' + ty + ',' + tx + ' ' + ty;
    }
    cLine.setAttribute('d', d);
    pipA.setAttribute('cx', cx); pipA.setAttribute('cy', cy);
    pipB.setAttribute('cx', tx); pipB.setAttribute('cy', ty);
  }

  // Numbers section: count up from 0 each time the stop is reached
  function setStat(e, v) { e.textContent = Math.round(v) + (e.dataset.suffix || ''); }
  function countStats(on) {
    cancelAnimationFrame(countRaf);
    var els = $$('[data-count]');
    if (!on || reduce) { els.forEach(function (e) { setStat(e, on ? +e.dataset.count : 0); }); return; }
    var t0 = performance.now(), D = 1800;
    (function tick(now) {
      var t = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - t, 3);
      els.forEach(function (e) { setStat(e, +e.dataset.count * k); });
      if (t < 1) countRaf = requestAnimationFrame(tick);
    })(t0);
  }

  // Services: click a row to expand its details in place (one open at a time)
  function initServices() {
    var panel = $('#stop-2'), items = $$('.svc-item');
    items.forEach(function (item) {
      var btn = item.querySelector('.svc-toggle'), body = item.querySelector('.svc-body');
      function reveal() {
        var p = panel.getBoundingClientRect(), r = item.getBoundingClientRect();
        if (r.bottom > p.bottom - 12) panel.scrollBy({ top: r.bottom - p.bottom + 24, behavior: reduce ? 'auto' : 'smooth' });
      }
      btn.addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        items.forEach(function (o) {
          var me = o === item && open;
          o.classList.toggle('is-open', me);
          o.querySelector('.svc-toggle').setAttribute('aria-expanded', me ? 'true' : 'false');
        });
        if (open && reduce) reveal();
      });
      body.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'grid-template-rows' && item.classList.contains('is-open')) reveal();
      });
    });
    // keep the dotted connector attached while the card grows/shrinks
    if (window.ResizeObserver) new ResizeObserver(function () { connect(cur, dwelling); }).observe(panel);
  }

  // Software assembly: a small blueprint that builds itself from the journey's own progress (no extra ScrollTrigger)
  function initAssembly() {
    if (!saRoot) return;
    saSegs = $$('.sa-seg b');
    saItems = $$('#softwareAssembly [data-win]').map(function (el) {
      var w = el.getAttribute('data-win').split(','), it = { el: el, a: +w[0], b: +w[1], kind: el.getAttribute('data-kind') };
      if (it.kind === 'pulse') { it.path = document.getElementById(el.getAttribute('data-path')); it.len = it.path.getTotalLength(); }
      return it;
    });
  }

  var SA_PHASES = ['Sketching the structure', 'Adding components', 'Connecting data', 'Wiring the logic', 'Launching'];
  var SA_CUTS = [0, 0.26, 0.5, 0.7, 0.84, 1];

  function assemble(p) {
    if (!saItems.length || Math.abs(p - saLast) < 0.002) return;
    saLast = p;
    saItems.forEach(function (it) {
      var t = reduce ? (p >= it.a ? 1 : 0) : Math.max(0, Math.min(1, (p - it.a) / (it.b - it.a)));
      var e = t * t * (3 - 2 * t), el = it.el;
      if (it.kind === 'draw') {
        el.setAttribute('stroke-dashoffset', (1 - e).toFixed(3)); el.setAttribute('opacity', t > 0 ? 1 : 0);
      } else if (it.kind === 'fade') {
        el.setAttribute('opacity', e.toFixed(3)); el.setAttribute('transform', 'translate(0 ' + ((1 - e) * 5).toFixed(2) + ')');
      } else if (it.kind === 'dim') {
        el.setAttribute('opacity', (1 - 0.6 * e).toFixed(3));
      } else if (it.kind === 'pop') {
        el.setAttribute('opacity', e.toFixed(3));
        el.setAttribute('transform', 'translate(120 90) scale(' + (0.95 + 0.05 * e).toFixed(3) + ') translate(-120 -90)');
      } else if (it.kind === 'pulse') {
        var pt = it.path.getPointAtLength(e * it.len);
        el.setAttribute('cx', pt.x.toFixed(1)); el.setAttribute('cy', pt.y.toFixed(1));
        el.setAttribute('opacity', reduce ? 0 : Math.sin(Math.PI * t).toFixed(3));
      }
    });
    var idx = 0, live = p > 0.96, label;
    while (idx < 4 && p >= SA_CUTS[idx + 1]) idx++;
    saSegs.forEach(function (b, i) {
      var f = Math.max(0, Math.min(1, (p - SA_CUTS[i]) / (SA_CUTS[i + 1] - SA_CUTS[i])));
      b.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      var s = b.parentNode.parentNode;
      s.classList.toggle('is-done', i < idx || live);
      s.classList.toggle('is-now', i === idx && !live);
    });
    label = live ? 'Live' : SA_PHASES[idx];
    if (saPhase && saPhase.textContent !== label) saPhase.textContent = label;
    if (saStep) saStep.textContent = 'Step ' + (idx + 1) + ' of 5';
    saRoot.classList.toggle('is-live', live);
    if (saTag) saTag.classList.toggle('is-on', live);
  }

  // Place the blueprint to the right of the hero card and the Home node, clear of the side nav
  function layoutAssembly() {
    if (!saRoot) return;
    var W = window.innerWidth, H = window.innerHeight, hero = panels[0];
    // Side nav slides its label open on a short transition, so reserve its expanded width instead of measuring it
    var sn = $('#sideNav'), snW = sn && sn.offsetWidth ? 108 + Math.min(32, Math.max(14, W * 0.02)) : 24;
    var left = Math.max(hero.offsetLeft + hero.offsetWidth + 16, W / 2 + 70), right = W - snW - 16;
    saRoot.classList.toggle('is-off', right - left < 300);
    saRoot.style.left = left + 'px'; saRoot.style.right = Math.max(0, W - right) + 'px';
    saRoot.style.top = '92px'; saRoot.style.bottom = '70px';
  }

  function paintAssembly(o) {
    saRoot.style.opacity = (o * saVis).toFixed(3);
    saRoot.style.transform = 'translate3d(' + ((1 - saVis) * 40).toFixed(1) + 'px,0,0)';
  }

  // Background "video": timed loop (build -> hold -> fade out -> restart), independent of scroll.
  // It restarts from the beginning every time you come back to the top.
  var SA_BUILD = 11000, SA_HOLD = 3500, SA_FADE = 1200, SA_CYCLE = SA_BUILD + SA_HOLD + SA_FADE + 600;
  function playAssembly() {
    if (!saRoot) return;
    if (reduce) { assemble(1); paintAssembly(1); return; } // static finished frame
    var t0 = performance.now(), hidden = false;
    (function frame(now) {
      requestAnimationFrame(frame);
      if (saVis <= 0) { if (!hidden) { paintAssembly(0); hidden = true; } return; }
      if (hidden) { t0 = now; hidden = false; }
      var t = (now - t0) % SA_CYCLE, p = Math.min(1, t / SA_BUILD), o = 1;
      if (t < 700) o = t / 700;
      else if (t > SA_BUILD + SA_HOLD) o = Math.max(0, 1 - (t - SA_BUILD - SA_HOLD) / SA_FADE);
      assemble(p);
      paintAssembly(o);
    })(t0);
  }

  function goTo(i) {
    var max = spacer.offsetHeight - window.innerHeight;
    window.scrollTo({ top: Math.max(0, Math.min(I, i)) / I * max, behavior: reduce ? 'auto' : 'smooth' });
  }


  // Theme: light = original B, dark = project A's background (choice is remembered)
  function initTheme() {
    var root = document.documentElement, btn = $('#themeToggle'), lab = $('#themeLabel');
    if (!btn) return;
    function paint() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      if (lab) lab.textContent = dark ? 'Light' : 'Dark';
    }
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      if (!reduce) { root.classList.add('theme-anim'); setTimeout(function () { root.classList.remove('theme-anim'); }, 450); }
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('journey-theme', dark ? 'dark' : 'light'); } catch (e) {}
      paint();
    });
    paint();
  }

  function init() {
    initTheme();
    build();
    initServices();
    initAssembly();
    layoutAssembly();
    playAssembly();
    $$('[data-jump]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); goTo(+el.dataset.jump); });
    });
    window.addEventListener('keydown', function (e) {
      var t = document.activeElement && document.activeElement.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (e.key === ' ' && (t === 'BUTTON' || t === 'A')) return; // let Space activate focused buttons/links
      var next = { ArrowDown: cur + 1, PageDown: cur + 1, ' ': cur + 1, ArrowUp: cur - 1, PageUp: cur - 1, Home: 0, End: I }[e.key];
      if (next === undefined || next < 0 || next > I) return;
      e.preventDefault(); goTo(next);
    });

    var y = $('#yr'); if (y) y.textContent = new Date().getFullYear();

    var st;
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      st = ScrollTrigger.create({
        trigger: spacer, start: 'top top', end: 'bottom bottom',
        scrub: reduce ? true : 0.8,
        snap: { snapTo: 1 / I, duration: { min: 0.2, max: 0.45 }, ease: 'power1.inOut' },
        onUpdate: function (s) { update(s.progress); }
      });
    } else {
      window.addEventListener('scroll', function () {
        var max = spacer.offsetHeight - window.innerHeight;
        update(max > 0 ? window.scrollY / max : 0);
      }, { passive: true });
    }
    window.addEventListener('resize', function () { layoutAssembly(); if (st) st.refresh(); update(st ? st.progress : 0); });
    window.addEventListener('load', layoutAssembly);
    update(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
