import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Icon, Modal } from './ui.jsx';
import Search, { useSearchShortcut } from './Search.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { queueFiles, onOpenCamera, canLiveCamera } from '../lib/scanQueue.js';
import CameraScan from './CameraScan.jsx';
import { remember } from '../lib/inbox.js';
import { go } from '../router.js';
import { useStore } from '../store.jsx';
import { APP_NAME, DEMO, LIVE_CONFIGURED } from '../config.js';
import { LogoMark } from './Logo.jsx';
import { api } from '../api/index.js';
import { irsRate, followsIrs } from '../lib/mileage.js';

// Install as an app: Android/Chrome can do it with one tap; on iPhone it's Safari's Share → Add to Home Screen.
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
function install() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
  window.dispatchEvent(new Event('wrap-install-help'));
}

const NAV = [
  { id: '', label: 'Overview', icon: 'overview' },
  { id: 'invoices', label: 'Invoices', icon: 'invoice' },
  { id: 'quotes', label: 'Quotes', icon: 'quote' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt' },
  { id: 'clients', label: 'Clients', icon: 'clients' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'taxes', label: 'Taxes', icon: 'file' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Layout({ route, children }) {
  const [searching, setSearching] = useState(false);
  useSearchShortcut(setSearching);
  const [installHelp, setInstallHelp] = useState(false);
  useEffect(() => { const on = () => setInstallHelp(true); window.addEventListener('wrap-install-help', on); return () => window.removeEventListener('wrap-install-help', on); }, []);
  const store = useStore();
  const { db, user } = store;
  // Mileage follows the IRS rate: when a new year's rate applies, update it (unless you set your own).
  const rate = db.profile.mileage_rate;
  useEffect(() => {
    if (rate != null && followsIrs(rate) && Math.abs(Number(rate) - irsRate()) > 0.0005) store.updateProfile({ mileage_rate: irsRate() }).catch(() => {});
  }, [rate]); // eslint-disable-line react-hooks/exhaustive-deps
  const section = route.parts[0] || '';
  const review = db.receipts.filter((r) => r.status === 'review' && !r.ai?.manual).length; // (a new expense being typed in doesn't count)
  const current = section === 'invoices' && route.query.kind === 'quote' ? 'quotes' : section;
  const sideRef = useRef(null);
  const sidePill = useRef(null);
  useSlidePill(sideRef, sidePill, 'a.nav.on', current);
  return (
    <div className="shell">
      {installHelp && (
        <Modal title="Install Wrap on your iPhone" onClose={() => setInstallHelp(false)} footer={<Button variant="primary" onClick={() => setInstallHelp(false)}>Got it</Button>}>
          <ol className="install-steps">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the <b>Share</b> button <Icon name="upload" size={16} /> at the bottom.</li>
            <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          </ol>
          <p className="small muted">Wrap then opens full screen from its own icon, like any other app, and stays signed in.</p>
        </Modal>
      )}
      <nav ref={sideRef} className="side" aria-label="Main">
        <span ref={sidePill} className="nav-pill" aria-hidden="true" />
        <a className="brand" href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <LogoMark />
          <span className="brand-text col" style={{ gap: 0 }}>
            <strong style={{ fontSize: 15 }}>{APP_NAME}</strong>
            <span className="small muted" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{db.profile.business_name || user.email}</span>
          </span>
        </a>
        <button className="btn primary new-btn" style={{ margin: '0 0 12px', flex: 'none' }} onClick={() => go('/invoices/new')} aria-label="New invoice">
          <Icon name="plus" size={16} /><span>New invoice</span>
        </button>
        <button type="button" className="nav" onClick={() => setSearching(true)}><Icon name="search" /><span>Search</span></button>
        {NAV.map((n) => (
          <a key={n.id} href={`/${n.id}`} className={`nav ${current === n.id ? 'on' : ''}`} aria-current={current === n.id ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span className={n.id === '' ? '' : ''}>{n.label}</span>
            {n.id === 'expenses' && review > 0 && <span className="pill review badge" title="Receipts to review">{review}</span>}
          </a>
        ))}
        <div className="side-foot col" style={{ gap: 6 }}>
          {DEMO && <span className="pill partial" style={{ alignSelf: 'flex-start' }}>Demo mode</span>}
          <span>{DEMO ? 'Data stays in this browser' : `Signed in as ${user.email}`}</span>
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <button className="btn link small" onClick={() => api.auth.signOut()}>{DEMO && LIVE_CONFIGURED ? 'Exit demo' : 'Sign out'}</button>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
      {searching && <Search onClose={() => setSearching(false)} />}
      <MobileNav current={current} review={review} onSearch={() => setSearching(true)} />
    </div>
  );
}

/** A highlight that slides to the current page's item in a nav (sidebar, phone tab bar). */
function useSlidePill(nav, pill, selector, key) {
  const first = useRef(true);
  const last = useRef('');
  const place = (animate, resized) => {
    const p = pill.current;
    const on = nav.current?.querySelector(selector);
    if (!p) return;
    if (!on || !on.offsetWidth) { p.style.opacity = '0'; last.current = ''; return; }
    const box = `${on.offsetLeft},${on.offsetTop},${on.offsetWidth},${on.offsetHeight}`;
    if (resized && box === last.current) return; // nothing moved
    last.current = box;
    const wasHidden = p.style.opacity !== '1';
    if (!animate || wasHidden) p.style.transition = 'none';
    p.style.opacity = '1';
    p.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    p.style.width = `${on.offsetWidth}px`;
    p.style.height = `${on.offsetHeight}px`;
    if (!animate || wasHidden) { void p.offsetWidth; p.style.transition = ''; }
  };
  useLayoutEffect(() => { place(!first.current); first.current = false; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = nav.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => place(true, true)) // follows along (never cuts a slide short);
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function MobileNav({ current, review, onSearch }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const cam = useRef(null);
  const lib = useRef(null);
  const [camOpen, setCamOpen] = useState(false);
  const barRef = useRef(null);
  const barPill = useRef(null);
  useSlidePill(barRef, barPill, 'a.on', current);
  // The in-app camera shows the crop while you aim; the phone's own camera if this browser can't (or you chose it).
  const nativeCam = () => { try { return sessionStorage.getItem('wrap_cam_native') === '1'; } catch { return false; } };
  const startScan = () => { setOpen(false); if (canLiveCamera() && !nativeCam()) setCamOpen(true); else cam.current?.click(); };
  useEffect(() => onOpenCamera(startScan), []); // eslint-disable-line react-hooks/exhaustive-deps
  const item = (id, label, icon) => (
    <a href={`/${id}`} className={current === id ? 'on' : ''} aria-current={current === id ? 'page' : undefined} onClick={() => setOpen(false)}>
      <Icon name={icon} size={22} />{label}
    </a>
  );
  return (
    <>
      {open && <div className="scrim" style={{ background: 'rgba(0,0,0,.2)', zIndex: 39 }} onClick={() => setOpen(false)} />}
      {open && (
        <div className="sheet" role="menu">
          <button onClick={() => { setOpen(false); onSearch(); }}><Icon name="search" />Search</button>
          <ThemeToggle label="Dark mode" />
          {!installed() && <button onClick={() => { setOpen(false); install(); }}><Icon name="download" />Install the app</button>}
          <a href="/invoices/new" onClick={() => setOpen(false)}><Icon name="plus" />New invoice</a>
          <a href="/invoices/new?kind=quote" onClick={() => setOpen(false)}><Icon name="quote" />New quote</a>
          <a href="/quotes" onClick={() => setOpen(false)}><Icon name="quote" />Quotes</a>
          <a href="/calendar" onClick={() => setOpen(false)}><Icon name="calendar" />Calendar</a>
          <a href="/clients" onClick={() => setOpen(false)}><Icon name="clients" />Clients</a>
          <a href="/reports" onClick={() => setOpen(false)}><Icon name="reports" />Reports</a>
          <a href="/taxes" onClick={() => setOpen(false)}><Icon name="file" />Taxes</a>
          <a href="/settings" onClick={() => setOpen(false)}><Icon name="settings" />Settings</a>
          <button onClick={() => api.auth.signOut()}><Icon name="logout" />{DEMO && LIVE_CONFIGURED ? 'Exit demo' : 'Sign out'}</button>
        </div>
      )}
      <nav ref={barRef} className="mobile-nav" aria-label="Main">
        <span ref={barPill} className="bar-pill" aria-hidden="true" />
        {item('', 'Home', 'overview')}
        {item('invoices', 'Invoices', 'invoice')}
        <button type="button" className="scan" aria-label="Scan a receipt" onClick={startScan}>
          <span className="bubble"><Icon name="camera" size={24} /></span>
        </button>
        <a href="/expenses" className={current === 'expenses' ? 'on' : ''} onClick={() => setOpen(false)} style={{ position: 'relative' }}>
          <Icon name="receipt" size={22} />Expenses
          {review > 0 && <span className="pill review" style={{ position: 'absolute', top: 2, right: 10, padding: '0 6px', fontSize: 10 }}>{review}</span>}
        </a>
        <button type="button" className={open ? 'on' : ''} aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="more" size={22} />More</button>
        <input ref={cam} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) { queueFiles(f); go('/expenses'); } }} />
        <input ref={lib} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) { setCamOpen(false); queueFiles(f); go('/expenses'); } }} />
      </nav>
      {camOpen && (
        <CameraScan
          onDone={(files) => {
            setCamOpen(false);
            // Kept on the phone right away: leaving the app now can't lose them (they're saved the next time it's open).
            remember(files, s.db?.profile?.id).catch(() => {}).finally(() => { queueFiles(files); go('/expenses'); });
          }}
          onClose={() => setCamOpen(false)}
          onNative={() => { try { sessionStorage.setItem('wrap_cam_native', '1'); } catch { /* */ } setCamOpen(false); cam.current?.click(); }}
          onLibrary={() => lib.current?.click()}
        />
      )}
    </>
  );
}
