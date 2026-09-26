(() => {
  'use strict';
  const P = window.PAGE; if (!P || !P.scenes.length) return;
  const $ = id => document.getElementById(id);
  const img = $('scene-image'), vid = $('scene-video'), pp = $('playpause'), svg = $('scene-regions'), markers = $('scene-markers'), chips = $('chips'), pop = $('popover'), popV = $('pop-video'), popL = $('pop-label');
  const cap = $('scene-caption'), blurb = $('scene-blurb');
  let scene = P.scenes[0], pinned = null, current = null, hoverTimer = null;

  function setVideo(el, src) {
    if (!src) { el.removeAttribute('src'); el.load(); return; }
    if (el.dataset.src === src) { el.play().catch(() => {}); return; }
    el.dataset.src = src; el.src = src; el.load(); el.play().catch(() => {});
  }
  function showDetail(o, idx) {
    $('detail-name').textContent = o.name; $('detail-count').textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(scene.objects.length).padStart(2, '0');
    const di = $('detail-input'); if (di) di.textContent = '(' + o.input + ')';
    setVideo($('detail-trip'), o.triplet || o.gen);
    const dp = $('detail-prompt'); if (dp) dp.textContent = '“' + o.prompt + '”';
    const ds = $('detail-stats'); if (ds) ds.textContent = '';
  }
  function place(sobj) {
    const [W, H] = scene.res; const frame = $('scene-frame').getBoundingClientRect(); const fw = frame.width, fh = frame.height;
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
    (sobj.regions || []).forEach(pts => pts.trim().split(/\s+/).forEach(pt => { const [x, y] = pt.split(',').map(Number); if (isFinite(x) && isFinite(y)) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } }));
    if (!(xmax > xmin)) { xmin = xmax = sobj.anchor[0]; ymin = ymax = sobj.anchor[1]; }
    const popW = Math.min(0.26 * fw, 300), gap = 12;
    const leftPx = xmin / W * fw, rightPx = xmax / W * fw, cy = (ymin + ymax) / 2 / H * fh;
    const roomRight = fw - rightPx - gap, roomLeft = leftPx - gap;
    if (roomRight >= popW || roomRight >= roomLeft) { pop.style.left = Math.min(rightPx + gap, fw - popW) + 'px'; pop.style.right = 'auto'; }
    else { pop.style.right = Math.min(fw - leftPx + gap, fw - popW) + 'px'; pop.style.left = 'auto'; }
    pop.style.top = Math.min(Math.max(cy, popW / 2), fh - popW / 2) + 'px';
  }
  function select(sobj, opts = {}) {
    const o = P.objects[sobj.id]; if (!o) return;
    current = sobj.id;
    svg.querySelectorAll('.scene-region').forEach(e => e.classList.toggle('is-active', e.dataset.id === sobj.id));
    markers.querySelectorAll('.scene-marker').forEach(e => e.classList.toggle('is-active', e.dataset.id === sobj.id));
    chips.querySelectorAll('.chip').forEach(e => e.setAttribute('aria-pressed', String(e.dataset.id === sobj.id)));
    cap.textContent = o.name + (pinned ? ' · pinned (Esc)' : '');
    place(sobj); popL.textContent = o.name + (o.relit ? ' · relit' : ''); pop.hidden = false; setVideo(popV, o.relit || o.black);
    showDetail(o, scene.objects.indexOf(sobj));
    if (opts.pin) pinned = sobj.id;
  }
  function unhover() {
    if (pinned) return;
    pop.hidden = true; popV.pause();
    svg.querySelectorAll('.scene-region').forEach(e => e.classList.remove('is-active'));
    markers.querySelectorAll('.scene-marker').forEach(e => e.classList.remove('is-active'));
    cap.textContent = scene.title;
  }
  function buildScene(s) {
    scene = s; pinned = null; current = null; pop.hidden = true; popV.pause();
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.scene === s.id)));
    img.classList.add('is-loading'); img.width = s.res[0]; img.height = s.res[1]; img.alt = s.blurb;
    const pre = new Image(); pre.onload = () => { img.src = s.image; img.classList.remove('is-loading'); }; pre.src = s.image;
    if (vid) {
      if (s.video) { vid.hidden = false; img.hidden = true; vid.poster = s.image; vid.width = s.res[0]; vid.height = s.res[1]; if (vid.dataset.src !== s.video) { vid.dataset.src = s.video; vid.src = s.video; vid.load(); } vid.play().catch(() => {}); if (pp) { pp.hidden = false; pp.innerHTML = '&#10074;&#10074;'; } }
      else { vid.hidden = true; img.hidden = false; vid.pause(); if (pp) pp.hidden = true; }
    }
    svg.setAttribute('viewBox', '0 0 ' + s.res[0] + ' ' + s.res[1]); svg.innerHTML = ''; markers.innerHTML = ''; chips.innerHTML = '';
    cap.textContent = s.title; if (blurb) blurb.textContent = s.blurb;
    const sorted = [...s.objects].sort((a, b) => a.layer - b.layer);
    sorted.forEach(sobj => {
      const o = P.objects[sobj.id]; if (!o) return;
      sobj.regions.forEach(points => {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', points); poly.classList.add('scene-region'); poly.dataset.id = sobj.id;
        poly.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'touch' && !pinned) select(sobj); });
        poly.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch') unhover(); });
        poly.addEventListener('click', ev => { ev.stopPropagation(); if (pinned === sobj.id) { pinned = null; unhover(); } else { pinned = null; select(sobj, {pin: true}); } });
        svg.append(poly);
      });
      const m = document.createElement('span'); m.className = 'scene-marker'; m.dataset.id = sobj.id;
      m.style.left = (sobj.anchor[0] / s.res[0] * 100) + '%'; m.style.top = (sobj.anchor[1] / s.res[1] * 100) + '%'; markers.append(m);
    });
    s.objects.forEach(sobj => {
      const o = P.objects[sobj.id]; if (!o) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.id = sobj.id; b.textContent = o.name; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'touch' && !pinned) select(sobj); });
      b.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch') unhover(); });
      b.addEventListener('click', () => { pinned = null; select(sobj, {pin: true}); }); b.addEventListener('focus', () => select(sobj));
      chips.append(b);
    });
    if (s.objects.length) { const first = s.objects[0]; const o = P.objects[first.id]; if (o) showDetail(o, 0); }
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { const s = P.scenes.find(x => x.id === t.dataset.scene); if (s) buildScene(s); }));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { pinned = null; unhover(); } });
  if (pp && vid) pp.addEventListener('click', ev => { ev.stopPropagation(); if (vid.paused) { vid.play().catch(() => {}); pp.innerHTML = '&#10074;&#10074;'; } else { vid.pause(); pp.innerHTML = '&#9654;'; } });
  $('scene-frame').addEventListener('click', ev => { if (ev.target === img || ev.target === vid) { pinned = null; unhover(); } });
  window.addEventListener('load', () => P.scenes.slice(1).forEach(s => { const i = new Image(); i.src = s.image; }));
  buildScene(P.scenes[0]);
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.load(); } v.play().catch(() => {}); } else { v.pause(); }
  }), {rootMargin: '200px 0px'});
  document.querySelectorAll('video[data-src]').forEach(v => io.observe(v));
})();

(function () {
  const lb = document.createElement('div'); lb.id = 'lightbox'; lb.hidden = true;
  lb.innerHTML = "<div class='lb-inner'><video controls autoplay loop muted playsinline></video><img alt='' hidden><button class='lb-close' aria-label='Close'>×</button><p class='lb-hint'>Full-resolution file. Click outside or press Esc to close.</p></div>";
  document.body.appendChild(lb);
  const v = lb.querySelector('video'), im = lb.querySelector('img');
  function close() { lb.hidden = true; v.pause(); v.removeAttribute('src'); v.load(); im.hidden = true; im.removeAttribute('src'); }
  function openVideo(src, poster) { im.hidden = true; v.hidden = false; v.poster = poster || ''; v.src = src; lb.hidden = false; v.play().catch(() => {}); }
  function openImage(src) { v.hidden = true; v.pause(); v.removeAttribute('src'); im.src = src; im.hidden = false; lb.hidden = false; }
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-close')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) close(); });
  document.querySelectorAll('.card video, .pair video, .detail-media video, .scene-video').forEach(el => {
    el.style.cursor = 'zoom-in'; el.title = 'Click to view at full resolution';
    el.addEventListener('click', e => { e.preventDefault(); const s = el.currentSrc || el.src || el.dataset.src; if (s) openVideo(s, el.poster); });
  });
  document.querySelectorAll('.card img, .pair img, .detail-media img').forEach(el => {
    el.style.cursor = 'zoom-in'; el.title = 'Click to view at full resolution';
    el.addEventListener('click', () => openImage(el.currentSrc || el.src));
  });
})();
