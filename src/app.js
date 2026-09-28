(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let data = { site: {}, destinations: [] };
  let slideTimer = null;

  /* ---------- Download deterrents ---------- */
  // Honest note: nothing stops a screenshot. These stop casual right-click / drag / long-press saves.
  const guarded = (el) => el.closest && el.closest('.tile, .dest-card, .slideshow, .lightbox');
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
    const open = !$('#destFolder').classList.contains('open');
    setFolder(open);
    if (open && !location.hash.startsWith('#/destinations')) location.hash = '#/destinations';
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
    ro?.disconnect();
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
  }

  function viewDestination(slug) {
    const idx = data.destinations.findIndex((d) => d.slug === slug);
    if (idx < 0) return viewDestinations();
    const d = data.destinations[idx];
    const prev = data.destinations[idx - 1], next = data.destinations[idx + 1];
    render(`<div class="page-head"><h1 class="page-title country">${esc(d.name)}</h1>
        <span class="page-meta">${d.photos.length} photographs</span></div>
      <div class="grid">${d.photos.map((p, i) => `<a class="tile" href="#" data-i="${i}" data-ar="${(p.w / p.h).toFixed(4)}">
          <img class="lazy" data-src="${p.t}" alt="${esc(d.name)} ${i + 1}" draggable="false"></a>`).join('')}</div>
      <nav class="pager">
        ${prev ? `<a href="#/destinations/${prev.slug}">← ${esc(prev.name)}</a>` : '<span></span>'}
        ${next ? `<a href="#/destinations/${next.slug}">${esc(next.name)} →</a>` : '<span></span>'}
      </nav>`, d.name);
    justify();
    lastW = 0; ro?.observe(main.querySelector('.grid'));
    main.querySelector('.grid').addEventListener('click', (e) => {
      const t = e.target.closest('.tile');
      if (!t) return;
      e.preventDefault();
      openLightbox(d.photos, +t.dataset.i);
    });
  }

  // Justified rows: every row fills the width, photos keep their shape and your file order.
  function justify() {
    const grid = main.querySelector('.grid');
    if (!grid) return;
    const css = getComputedStyle(document.documentElement);
    const target = parseFloat(css.getPropertyValue('--row')) || 340;
    const gap = parseFloat(css.getPropertyValue('--gap')) || 12;
    const W = grid.clientWidth;
    const tiles = [...grid.children];
    let row = [], sum = 0;
    const place = (items, h) => items.forEach((t) => { t.style.width = `${Math.floor(+t.dataset.ar * h)}px`; t.style.height = `${Math.round(h)}px`; });
    for (const t of tiles) {
      row.push(t); sum += +t.dataset.ar;
      const h = (W - gap * (row.length - 1)) / sum;
      if (h <= target) { place(row, h); row = []; sum = 0; }
    }
    if (row.length) place(row, Math.min(target, (W - gap * (row.length - 1)) / sum));
  }
  // Re-flow whenever the grid's width changes (window resize, scrollbar appearing, etc.)
  let lastW = 0;
  const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => {
    const w = Math.round(es[0].contentRect.width);
    if (w !== lastW) { lastW = w; justify(); }
  }) : null;

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
