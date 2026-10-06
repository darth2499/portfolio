(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let data = { site: {}, destinations: [] };
  let slideTimer = null;
  let unmount = null; // cleanup for the country gallery (animation loop + listeners)

  /* ---------- Download deterrents ---------- */
  // Honest note: nothing stops a screenshot. These stop casual right-click / drag / long-press saves.
  const guarded = (el) => el.closest && el.closest('.gal, .dest-card, .slideshow, .lightbox');
  document.addEventListener('contextmenu', (e) => { if (guarded(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });

  /* ---------- Lazy fade-in ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { load(en.target); io.unobserve(en.target); }
  }, { rootMargin: '600px 0px' }) : null;
  function load(img) {
    img.onload = () => img.classList.add('loaded');
    img.src = img.dataset.src;
  }
  function lazy(root) {
    root.querySelectorAll('img.lazy').forEach((img) => (io ? io.observe(img) : load(img)));
  }

  /* ---------- Sidebar ---------- */
  function buildNav() {
    const { site, destinations } = data;
    $('#destList').innerHTML = destinations
      .map((d) => `<li><a href="#/destinations/${d.slug}" data-slug="${d.slug}">${esc(d.name)}</a></li>`).join('');
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${site.name || ''}`;
    // Stagger order for the phone menu's reveal animation
    document.querySelectorAll('#nav .folder-toggle, #nav .sub-inner li, #nav > ul > li:not(.folder), #nav .copyright')
      .forEach((el, i) => { el.classList.add('anim'); el.style.setProperty('--d', i); });
    if (site.instagram) {
      const handle = site.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      $('#igLink').href = `https://instagram.com/${handle}`;
      $('#igItem').hidden = false;
    }
  }
  function setFolder(open) {
    $('#destFolder').classList.toggle('open', open);
    $('#destToggle').setAttribute('aria-expanded', open);
  }
  const isPhone = () => matchMedia('(max-width: 760px)').matches;
  function setMenu(open) {
    $('#sidebar').classList.toggle('menu-open', open);
    document.body.classList.toggle('no-scroll', open);
    $('#menuBtn').setAttribute('aria-expanded', open);
    $('#menuBtn').setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  $('#destToggle').addEventListener('click', () => {
    if (isPhone()) { setMenu(false); location.hash = '#/destinations'; return; }
    // Opens the list (it stays open until the page is reloaded) and goes to the Destinations page
    setFolder(true);
    location.hash = '#/destinations';
  });
  $('#menuBtn').addEventListener('click', () => setMenu(!$('#sidebar').classList.contains('menu-open')));
  $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (!isPhone()) setMenu(false); });

  function markActive(route, slug) {
    document.querySelectorAll('.nav a').forEach((a) => a.classList.remove('active'));
    $('#destToggle').classList.toggle('active', route === 'destinations');
    if (slug) $(`.sub a[data-slug="${slug}"]`)?.classList.add('active');
    else if (route) $(`.nav a[data-route="${route}"]`)?.classList.add('active');
    if (route === 'destinations') setFolder(true);
  }

  /* ---------- Views ---------- */
  function render(html, title) {
    clearInterval(slideTimer);
    if (unmount) { unmount(); unmount = null; }
    main.innerHTML = `<div class="view">${html}</div>`;
    document.title = title ? `${title} — ${data.site.name}` : `${data.site.name} — Photography`;
    lazy(main);
    window.scrollTo(0, 0);
  }

  function viewHome() {
    const all = data.destinations.flatMap((d) => d.photos.filter((p) => p.w >= p.h).map((p) => ({ ...p, place: d.name, slug: d.slug })));
    const pool = all.length ? all : data.destinations.flatMap((d) => d.photos.map((p) => ({ ...p, place: d.name, slug: d.slug })));
    if (!pool.length) {
      return render(`<p class="empty">No photos yet — add a folder like <code>photos/Iceland/</code> and push.</p>`);
    }
    const n = Math.min(data.site.home?.slideshowCount || 8, pool.length);
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, n);
    render(`<a class="slideshow" id="slides" href="#/destinations/${picks[0].slug}">
      ${picks.map((p, i) => `<div class="slide${i === 0 ? ' on' : ''}" data-slug="${p.slug}" data-place="${esc(p.place)}">
        <img ${i < 2 ? `src="${p.f}"` : `data-src="${p.f}"`} alt="${esc(p.place)}" draggable="false"></div>`).join('')}
      <div class="shield"></div><div class="slide-cap" id="slideCap">${esc(picks[0].place)}</div>
      <div class="slide-wm">© ${esc(data.site.name)}</div></a>`);
    const slides = [...main.querySelectorAll('.slide')];
    let i = 0;
    slideTimer = setInterval(() => {
      slides[i].classList.remove('on');
      i = (i + 1) % slides.length;
      const s = slides[i], next = slides[(i + 1) % slides.length].querySelector('img');
      if (next.dataset.src && !next.src) next.src = next.dataset.src;
      s.classList.add('on');
      $('#slides').href = `#/destinations/${s.dataset.slug}`;
      $('#slideCap').textContent = s.dataset.place;
    }, (data.site.home?.slideSeconds || 5) * 1000);
  }

  function viewDestinations() {
    render(`<div class="page-head"><h1 class="page-title">Destinations</h1></div>
      <div class="dest-grid">${data.destinations.map((d) => `
        <a class="dest-card" href="#/destinations/${d.slug}">
          <div class="frame"><img class="lazy" data-src="${d.cover.t}" alt="${esc(d.name)}" draggable="false"></div>
          <div class="label">${esc(d.name)} <span>${d.photos.length}</span></div>
        </a>`).join('')}</div>`, 'Destinations');
    scatterIn([...main.querySelectorAll('.dest-card')]);
  }

  // Prints drop in from above, land scattered on the "table", then slide into the grid
  function scatterIn(cards) {
    if (!cards.length || !Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const grid = cards[0].parentElement.getBoundingClientRect();
    const vh = innerHeight;
    const cx = grid.left + grid.width / 2;
    const cy = (Math.max(grid.top, 0) + Math.min(grid.bottom, vh)) / 2; // centre of the visible table
    const rects = cards.map((c) => c.getBoundingClientRect());
    cards.forEach((card, i) => {
      const r = rects[i];
      const mx = r.left + r.width / 2, my = r.top + r.height / 2;
      const sx = (cx - mx) * rnd(0.45, 0.8) + rnd(-70, 70);   // scattered resting spot
      const sy = (cy - my) * rnd(0.45, 0.8) + rnd(-40, 40);
      const startY = -r.bottom - rnd(80, 260);                // fully above the screen
      const rot0 = rnd(-40, 40), rot1 = rnd(-16, 16);
      card.classList.add('flying');
      const anim = card.animate([
        { transform: `translate(${sx + rnd(-140, 140)}px, ${startY}px) rotate(${rot0}deg) scale(1.15)`, offset: 0, easing: 'cubic-bezier(.35,0,.65,1)' },
        { transform: `translate(${sx}px, ${sy}px) rotate(${rot1}deg) scale(1)`, offset: 0.42, easing: 'linear' },
        { transform: `translate(${sx}px, ${sy}px) rotate(${rot1}deg) scale(1)`, offset: 0.55, easing: 'cubic-bezier(.55,0,.15,1)' },
        { transform: 'none', offset: 1 },
      ], { duration: 1800, delay: Math.min(i * 90, 900), fill: 'backwards' });
      anim.finished.then(() => card.classList.remove('flying')).catch(() => {});
    });
  }

  function viewDestination(slug) {
    const d = data.destinations.find((x) => x.slug === slug);
    if (!d) return viewDestinations();
    render(`<div class="gal">
        <div class="gal-head"><h1 class="page-title country">${esc(d.name)}</h1>
          <span class="page-meta" id="galCount">1 / ${d.photos.length}</span></div>
        <div class="gal-stage" id="galStage">
          <div class="gal-photo" id="galPhoto">${'<div class="gal-pic"><img class="lo" alt="" draggable="false"><img class="hi" alt="" draggable="false"></div>'.repeat(2)}</div>
          <div class="shield"></div>
        </div>
        <div class="gal-strip" id="galStrip">
          <div class="gal-track" id="galTrack">${d.photos.map((p, i) => `
            <button class="gal-thumb" data-i="${i}" aria-label="Photo ${i + 1}" style="background-image:url(${p.q})"><img src="${p.s}" alt="" draggable="false" decoding="async"></button>`).join('')}
          </div>
          <div class="gal-frame"></div>
        </div>
      </div>`, d.name);
    unmount = mountGallery(d.photos);
  }

  /* ---------- Country gallery: big photo + momentum-scrolling thumbnail strip ----------
     Vertical strip on the right (desktop), horizontal strip along the bottom (phone).
     Scrolling glides and slowly eases to a stop, then settles on the nearest photo. */
  function mountGallery(photos) {
    const n = photos.length;
    const stage = $('#galStage'), strip = $('#galStrip'), track = $('#galTrack');
    const thumbs = [...track.children];
    let horiz = false, step = 70;
    let pos = 0, target = 0, cur = -1, raf = 0, snapTimer = 0;
    let drag = null, moved = false, downThumb = null;

    const clamp = (v) => Math.max(0, Math.min((n - 1) * step, v));
    const snap = () => { target = clamp(Math.round(target / step) * step); kick(); };

    function layout() {
      horiz = isPhone();
      step = horiz ? 48 : 56;
      thumbs.forEach((t, i) => {
        t.style.transform = horiz ? `translate(calc(-50% + ${i * step}px), -50%)` : `translate(-50%, calc(-50% + ${i * step}px))`;
      });
      pos = target = clamp(Math.max(cur, 0) * step);
      paint();
    }
    function paint() {
      track.style.transform = horiz ? `translate3d(${-pos}px,0,0)` : `translate3d(0,${-pos}px,0)`;
      const i = Math.round(pos / step);
      if (i !== cur) setCurrent(i);
    }
    let last = 0;
    function loop(now) {
      // Frame-rate independent easing (same feel on 60Hz and 120Hz screens)
      const dt = last ? Math.min(64, now - last) : 16.7; last = now;
      if (!drag) pos += (target - pos) * (1 - Math.pow(1 - 0.1, dt / 16.7));
      if (Math.abs(target - pos) < 0.2 && !drag) pos = target;
      paint();
      if (pos !== target || drag) raf = requestAnimationFrame(loop);
      else { raf = 0; last = 0; }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    /* Big photo — progressive and seamless:
       - land on a photo: show the sharpest version already in memory, straight away
       - once you stop: the sharper version fades in slowly ON TOP of the softer one
         (the softer one stays underneath, so there's never a dip or a jump)
       - meanwhile the neighbours are quietly preloaded, so the next photo is usually
         already sharp by the time you get to it */
    const pics = [...$('#galPhoto').children];
    let showing = null, token = 0, settleTimer = 0, lastSwitch = 0;
    const done = new Set(), pending = new Map();
    function load(src) {                       // download + decode once, remember it
      if (done.has(src)) return Promise.resolve(true);
      if (!pending.has(src)) {
        const im = new Image(); im.decoding = 'async'; im.src = src;
        pending.set(src, im.decode().then(() => { done.add(src); return true; }, () => { pending.delete(src); return false; }));
      }
      return pending.get(src);
    }
    thumbs.forEach((t, k) => {                 // strip thumbnails count as "in memory" once loaded
      const im = t.firstElementChild, mark = () => done.add(photos[k].s);
      if (im.complete && im.naturalWidth) mark(); else im.addEventListener('load', mark, { once: true });
    });
    const best = (p) => [p.f, p.t, p.s].find((src) => done.has(src));
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

    async function sharpen(pic, src, my) {     // fade a sharper version in over the current one
      const lo = pic.children[0], hi = pic.children[1];
      if (hi.classList.contains('in')) {       // move what's showing down a layer first
        lo.src = hi.src; try { await lo.decode(); } catch (e) {}
        if (my !== token) return;
        hi.classList.add('instant'); hi.classList.remove('in');
      }
      hi.src = src; try { await hi.decode(); } catch (e) { return; }
      if (my !== token) return;
      await nextFrame();
      hi.classList.remove('instant'); hi.classList.add('in');
    }

    function setCurrent(i) {
      const prev = cur;
      cur = Math.max(0, Math.min(n - 1, i));
      $('#galCount').textContent = `${cur + 1} / ${n}`;
      thumbs[prev]?.classList.remove('on'); thumbs[cur].classList.add('on');
      const p = photos[cur], my = ++token;
      const pic = pics[0] === showing ? pics[1] : pics[0], old = showing;
      const lo = pic.children[0], hi = pic.children[1];
      pic.style.backgroundImage = `url(${p.q})`;
      hi.classList.add('instant'); hi.classList.remove('in'); hi.removeAttribute('src');
      const have = best(p);
      if (have) lo.src = have; else lo.removeAttribute('src');
      const show = () => {
        if (my !== token) return;
        // Scrolling fast: swap instantly (no overlapping portrait/landscape ghosts).
        // Settled: quick crossfade — the old photo always fades out as the new one fades in.
        const now = performance.now(), fast = now - lastSwitch < 320;
        lastSwitch = now;
        pics.forEach((o) => {
          if (o === pic) return;
          o.style.transition = fast ? 'none' : '';
          o.style.zIndex = 1; o.classList.remove('show');
        });
        pic.style.transition = fast ? 'none' : '';
        pic.style.zIndex = 2; pic.classList.add('show'); showing = pic;
      };
      if (have) lo.decode().then(show, show); else show();

      clearTimeout(settleTimer);
      settleTimer = setTimeout(async () => {   // only fetch big files once scrolling settles
        if (my !== token) return;
        if (have !== p.f) {
          if (have !== p.t && !done.has(p.f)) {
            const okT = await load(p.t);           // medium size first (fast even on slow connections)
            if (my !== token) return;
            if (okT && !done.has(p.f) && done.has(p.t)) await sharpen(pic, p.t, my);
          }
          if (await load(p.f) && my === token) await sharpen(pic, p.f, my);
        }
        // Preload neighbours one at a time (never clogs the connection)
        for (const o of [1, -1, 2, -2, 3]) {
          const q = photos[cur + o];
          if (my !== token) return;
          if (q) { await load(q.t); if (Math.abs(o) <= 2 && my === token) await load(q.f); }
        }
      }, 90);
    }

    // Mouse wheel / trackpad: anywhere on the page
    function onWheel(e) {
      if (!lb.hidden) return;
      e.preventDefault();
      let dlt = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) dlt *= 16;
      target = clamp(target + dlt * 0.8);
      kick();
      clearTimeout(snapTimer); snapTimer = setTimeout(snap, 160);
    }
    // Drag / swipe on the strip or the big photo, with flick momentum
    function onDown(e) {
      if (e.button > 0) return;
      drag = { x: e.clientX, y: e.clientY, start: target, last: horiz ? e.clientX : e.clientY, t: performance.now(), v: 0, fromStrip: strip.contains(e.target) };
      moved = false;
      downThumb = e.target.closest('.gal-thumb');
      e.currentTarget.setPointerCapture?.(e.pointerId);
      kick();
    }
    function onMove(e) {
      if (!drag) return;
      const p = horiz ? e.clientX : e.clientY;
      const total = horiz ? drag.x - e.clientX : drag.y - e.clientY;
      if (Math.abs(total) > 6) moved = true;
      if (!moved) return;
      // On the strip the thumbnails follow your finger; on the big photo a swipe moves faster
      const k = drag.fromStrip ? 1 : step / 90;
      const now = performance.now(), dt = Math.max(1, now - drag.t);
      drag.v = 0.8 * ((drag.last - p) * k / dt) + 0.2 * drag.v;
      drag.last = p; drag.t = now;
      target = pos = clamp(drag.start + total * k);
    }
    function onUp() {
      if (!drag) return;
      if (moved) { target = clamp(target + drag.v * 260); snap(); }  // fling, then settle
      drag = null; kick();
    }
    function onKey(e) {
      if (!lb.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { target = clamp(target + step); snap(); e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { target = clamp(target - step); snap(); e.preventDefault(); }
    }

    strip.addEventListener('click', () => {
      const t = downThumb; // (pointer capture retargets the click, so use where the press started)
      if (!t || moved) return;
      target = clamp(+t.dataset.i * step); kick();
    });
    stage.addEventListener('click', () => { if (!moved) openLightbox(photos, cur); });
    [strip, stage].forEach((el) => {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    layout();

    return () => {
      cancelAnimationFrame(raf); clearTimeout(snapTimer);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', layout);
    };
  }

  function viewAbout() {
    const paras = (data.site.about || '').split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('');
    render(`<div class="page-head"><h1 class="page-title">About</h1></div><div class="prose">${paras}</div>`, 'About');
  }
  function viewContact() {
    const e = data.site.email;
    render(`<div class="page-head"><h1 class="page-title">Contact</h1></div><div class="prose">
      <p>For prints, licensing or commissions, get in touch.</p>
      ${e ? `<p><a href="mailto:${esc(e)}">${esc(e)}</a></p>` : ''}</div>`, 'Contact');
  }

  /* ---------- Router (hash routes work on GitHub Pages with no config) ---------- */
  function route() {
    closeLightbox(true);
    const [, section, slug] = (location.hash.replace(/^#\/?/, '#/') || '#/').split('/');
    // The home page is a single screen: no scrolling
    document.body.classList.toggle('is-home', !['destinations', 'about', 'contact'].includes(section));
    document.body.classList.toggle('is-gallery', section === 'destinations' && !!slug);
    if (section === 'destinations' && slug) { markActive('destinations', slug); viewDestination(slug); }
    else if (section === 'destinations') { markActive('destinations'); viewDestinations(); }
    else if (section === 'about') { markActive('about'); viewAbout(); }
    else if (section === 'contact') { markActive('contact'); viewContact(); }
    else { markActive(null); viewHome(); }
  }

  /* ---------- Lightbox (swipeable 3-slide carousel) ---------- */
  const lb = $('#lightbox'), track = $('#lbTrack'), viewport = $('#lbViewport');
  let lbList = [], lbIdx = 0, busy = false;
  const CENTER = -100 / 3; // track is 3 slides wide; the middle one is on screen
  const at = (o) => lbList[(lbIdx + o + lbList.length) % lbList.length];
  const setX = (px, animate) => {
    track.classList.toggle('animating', !!animate);
    track.style.transform = `translate3d(calc(${CENTER}% + ${px}px),0,0)`;
  };
  function setSrc(img, p) {
    if (img.dataset.url === p.f) return;
    img.dataset.url = p.f;
    img.classList.remove('loaded');
    img.onload = () => img.classList.add('loaded');
    img.src = p.f;
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
  }
  function fill() {
    const [a, b, c] = track.children;
    setSrc(a.firstElementChild, at(-1));
    setSrc(b.firstElementChild, at(0));
    setSrc(c.firstElementChild, at(1));
    $('#lbCount').textContent = `${lbIdx + 1} / ${lbList.length}`;
    new Image().src = at(2).f; new Image().src = at(-2).f; // warm the cache
  }
  // Slide one photo left (dir = 1) or right (dir = -1)
  function go(dir) {
    if (busy || lbList.length < 2) return;
    busy = true;
    setX(-dir * viewport.clientWidth, true);
    const done = () => {
      track.removeEventListener('transitionend', done);
      clearTimeout(fallback);
      lbIdx = (lbIdx + dir + lbList.length) % lbList.length;
      // Recycle the slide that left the screen instead of reloading images (no flicker)
      if (dir > 0) track.appendChild(track.firstElementChild);
      else track.insertBefore(track.lastElementChild, track.firstElementChild);
      setX(0, false);
      fill();
      busy = false;
    };
    const fallback = setTimeout(done, 600);
    track.addEventListener('transitionend', done);
  }
  function openLightbox(list, i) {
    lbList = list; lbIdx = i; busy = false;
    lb.hidden = false; document.body.style.overflow = 'hidden';
    setX(0, false); fill();
    requestAnimationFrame(() => lb.classList.add('show'));
  }
  function closeLightbox(instant) {
    if (lb.hidden) return;
    lb.classList.remove('show'); document.body.style.overflow = '';
    if (instant) lb.hidden = true;
    else setTimeout(() => { lb.hidden = true; }, 300);
  }
  $('#lbClose').onclick = () => closeLightbox();
  $('#lbPrev').onclick = () => go(-1);
  $('#lbNext').onclick = () => go(1);
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });

  // Finger-tracking swipe: the photo follows your finger, then glides to the next one
  let sx = 0, sy = 0, st = 0, dx = 0, dragging = false, locked = null, moved = false;
  viewport.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length > 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = performance.now();
    dx = 0; dragging = true; locked = null; moved = false;
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (locked === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (locked !== 'x') return;
    e.preventDefault();
    moved = true;
    dx = lbList.length < 2 ? mx * 0.3 : mx; // rubber-band if there's only one photo
    setX(dx, false);
  }, { passive: false });
  viewport.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    if (locked !== 'x') return;
    const w = viewport.clientWidth, v = dx / (performance.now() - st); // px per ms
    if (lbList.length > 1 && (Math.abs(dx) > w * 0.2 || Math.abs(v) > 0.4)) go(dx < 0 ? 1 : -1);
    else setX(0, true);
  });
  // Tap / click on the photo = next (ignored right after a swipe)
  viewport.addEventListener('click', () => { if (!moved) go(1); moved = false; });

  /* ---------- Boot ---------- */
  fetch('data.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
    data = d; buildNav(); route();
    window.addEventListener('hashchange', route);
  }).catch(() => { main.innerHTML = '<p class="empty">Could not load photos. Run <code>npm run build</code>.</p>'; });
})();
