/* AM Premify - Menu Bypass (view di dalam index)
   Alur: tempel link -> /api/bypass (proxy server) -> apiii-xrina.my.id/tools/bypassv2
   Jika proxy server tidak ada (server lama / hosting statis), otomatis mencoba langsung ke API. */
(() => {
  'use strict';

  const root = document.getElementById('bp-view');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const API_LOCAL = '/api/bypass';
  const API_UPSTREAM = 'https://apiii-xrina.my.id/tools/bypassv2';
const PROVIDER_PAGE = API_UPSTREAM; // halaman provider (bisa dibuka manual)
  const HKEY = 'am_bypass_hist';
  const CKEY = 'am_bypass_count';
  const HMAX = 10;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const say = (msg, type) => {
    if (typeof toast === 'function') return toast(msg, type || '');
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast show ' + (type || '');
    setTimeout(() => (t.className = 'toast'), 2400);
  };
  const party = () => { try { if (typeof FX !== 'undefined' && FX.confetti) FX.confetti(); } catch {} };

  /* ---------- Terminal ---------- */
  const term = {
    body: $('#bp-term-body'),
    lines: [],
    log(type, msg) {
      const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
      const ln = document.createElement('div'); ln.className = 'ln ' + type;
      const a = document.createElement('span'); a.className = 'ts'; a.textContent = '[' + ts + ']';
      const b = document.createElement('span'); b.className = 'msg'; b.textContent = msg;
      ln.append(a, b); this.body.appendChild(ln);
      this.body.scrollTop = this.body.scrollHeight;
      this.lines.push('[' + ts + '] ' + msg);
    },
    clear() { this.body.textContent = ''; this.lines = []; },
    text() { return this.lines.join('\n'); }
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch { return false; }
    }
  }

  /* ---------- Validasi link ---------- */
  function normalizeUrl(raw) {
    let s = String(raw || '').trim();
    if (!s || s.length > 2000 || /\s/.test(s)) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      if (/^[\w-]+(\.[\w-]+)+([/?#:]|$)/.test(s)) s = 'https://' + s; else return '';
    }
    try {
      const u = new URL(s);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return '';
      return u.href;
    } catch { return ''; }
  }
  const hostOf = (u) => { try { return new URL(u).host; } catch { return String(u).slice(0, 40); } };
  const safeHttp = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };
  const short = (u, n = 64) => (u.length > n ? u.slice(0, n - 1) + '…' : u);

  /* ---------- Baca respons API (bentuk JSON bebas) ---------- */
  const PRI = ['result', 'bypass', 'bypassed', 'url', 'link', 'destination', 'target', 'direct', 'download', 'final', 'data'];
  function walk(v, path, out, d) {
    if (d > 6) return;
    if (typeof v === 'string') {
      const t = v.trim();
      if (/^https?:\/\/\S+$/i.test(t)) out.push({ path, url: t });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, path + '[' + i + ']', out, d + 1));
    } else if (v && typeof v === 'object') {
      Object.keys(v).forEach((k) => walk(v[k], path ? path + '.' + k : k, out, d + 1));
    }
  }
  const rank = (p) => {
    const last = String(p).split('.').pop().replace(/\[\d+\]$/, '').toLowerCase();
    const i = PRI.indexOf(last);
    return i < 0 ? 99 : i;
  };

  function interpret(resp, src) {
    const { ok, status, data, text } = resp;
    if (data == null) {
      const t = String(text || '').trim();
      if (ok && /^https?:\/\/\S+$/i.test(t)) return { ok: true, primary: t, others: [], raw: t };
      const html = /^\s*</.test(t);
      const block = !ok && (status === 403 || status === 429 || status === 503) && html;
      return { ok: false, message: ok ? 'Respons API tidak dikenali.' : (block ? 'API provider menolak permintaan (HTTP ' + status + ', kemungkinan perlindungan anti-bot). Coba buka lewat situs provider.' : 'API membalas HTTP ' + status + '.'), raw: t.slice(0, 1500) };
    }
    const flag = data && typeof data === 'object' ? data : {};
    const failed = !ok || flag.status === false || flag.success === false || flag.ok === false ||
      (typeof flag.status === 'number' && flag.status >= 400) || !!flag.error;
    const found = [];
    walk(data, '', found, 0);
    const seen = new Set();
    const urls = found.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true))).sort((a, b) => rank(a.path) - rank(b.path));
    const fresh = urls.filter((x) => x.url !== src);
    if (!failed && fresh.length) return { ok: true, primary: fresh[0].url, others: fresh.slice(1).map((x) => x.url), raw: data };
    if (!failed) {
      const r = flag.result ?? flag.data ?? flag.message;
      if (typeof r === 'string' && r.trim()) return { ok: true, text: r.trim(), others: [], raw: data };
    }
    const m = flag.message || flag.msg || (typeof flag.error === 'string' ? flag.error : '') ||
      (typeof flag.result === 'string' ? flag.result : '') || (failed ? 'Bypass gagal. Link belum didukung atau sudah kedaluwarsa.' : 'API tidak mengembalikan link hasil.');
    return { ok: false, message: String(m).slice(0, 300), raw: data };
  }

  /* ---------- Panggil API ---------- */
  async function readResp(r) {
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, data, text };
  }
  async function callApi(url) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 50000);
    try {
      let r = null;
      try {
        r = await fetch(API_LOCAL + '?url=' + encodeURIComponent(url), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      } catch (e) { if (e.name === 'AbortError') throw e; r = null; }
      // Proxy server menandai balasannya. Tanpa tanda (server lama / hosting statis) -> langsung ke API.
      if (r && r.headers.get('x-bypass-proxy')) {
        const pr = await readResp(r);
        if (pr.ok || pr.data != null) return pr; // JSON jelas: hasil atau pesan dari API
        term.log('warn', 'Server diblokir API provider (HTTP ' + pr.status + '), mencoba langsung dari browser...');
        try {
          const dr = await readResp(await fetch(API_UPSTREAM + '?url=' + encodeURIComponent(url), { signal: ctrl.signal }));
          if (dr.ok || dr.data != null) return dr;
          return dr.status ? dr : pr;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          term.log('warn', 'Browser juga tidak bisa mengakses API langsung (CORS / diblokir).');
          return pr;
        }
      }
      term.log('warn', 'Proxy server tidak tersedia, mencoba langsung ke API...');
      r = await fetch(API_UPSTREAM + '?url=' + encodeURIComponent(url), { signal: ctrl.signal });
      return await readResp(r);
    } finally { clearTimeout(to); }
  }

  /* ---------- Penghitung ---------- */
  function renderCount() { const n = Number(store.get(CKEY, 0)) || 0; $('#bp-count').textContent = n.toLocaleString('id-ID'); }
  function bumpCount() { store.set(CKEY, (Number(store.get(CKEY, 0)) || 0) + 1); renderCount(); }

  /* ---------- Riwayat ---------- */
  function loadHist() { const h = store.get(HKEY, []); return Array.isArray(h) ? h.filter((x) => x && x.src && x.out).slice(0, HMAX) : []; }
  function addHist(src, out) {
    const h = loadHist().filter((x) => x.src !== src);
    h.unshift({ src, out, t: Date.now() });
    store.set(HKEY, h.slice(0, HMAX));
    renderHist();
  }
  function fmtAgo(t) {
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return s + ' dtk lalu';
    if (s < 3600) return Math.round(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.round(s / 3600) + ' jam lalu';
    return Math.round(s / 86400) + ' hari lalu';
  }
  function iconBtn(tag, icon, title, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    el.title = title; el.setAttribute('aria-label', title);
    if (tag === 'button') el.type = 'button';
    el.innerHTML = '<svg class="ic sm"><use href="#i-' + icon + '"/></svg>';
    return el;
  }
  function renderHist() {
    const ul = $('#bp-hist'); const h = loadHist();
    ul.textContent = '';
    $('#bp-hist-clear').classList.toggle('hidden', !h.length);
    if (!h.length) {
      const li = document.createElement('li'); li.className = 'bp-empty';
      li.textContent = 'Belum ada riwayat. Hasil bypass terakhirmu tersimpan di perangkat ini.';
      ul.appendChild(li); return;
    }
    h.forEach((x, i) => {
      const li = document.createElement('li'); li.className = 'bp-hi'; li.style.animationDelay = (i * 40) + 'ms';
      const tx = document.createElement('div'); tx.className = 'bp-hi-tx';
      const b = document.createElement('b'); b.textContent = short(x.out, 58);
      const sm = document.createElement('small'); sm.textContent = hostOf(x.src) + ' • ' + fmtAgo(x.t);
      tx.append(b, sm);
      const acts = document.createElement('div'); acts.className = 'bp-hi-acts';
      const cp = iconBtn('button', 'copy', 'Salin hasil');
      cp.addEventListener('click', async () => say((await copyText(x.out)) ? 'Link disalin' : 'Gagal menyalin'));
      acts.appendChild(cp);
      if (safeHttp(x.out)) {
        const op = iconBtn('a', 'ext', 'Buka link');
        op.href = x.out; op.target = '_blank'; op.rel = 'noopener noreferrer nofollow';
        acts.appendChild(op);
      }
      const rm = iconBtn('button', 'trash', 'Hapus dari riwayat', 'del');
      rm.addEventListener('click', () => { store.set(HKEY, loadHist().filter((y) => y.src !== x.src)); renderHist(); });
      acts.appendChild(rm);
      li.append(tx, acts); ul.appendChild(li);
    });
  }

  /* ---------- Pipeline progres (Kirim -> Proses -> Selesai) ---------- */
  const nodes = [$('#bp-n1'), $('#bp-n2'), $('#bp-n3')];
  const lines = [$('#bp-l1'), $('#bp-l2')];
  function pipe(state) {
    nodes.forEach((n) => n.classList.remove('on', 'done', 'fail'));
    lines.forEach((l) => l.classList.remove('run', 'fill'));
    if (state === 'idle') return;
    if (state === 'send') { nodes[0].classList.add('on'); lines[0].classList.add('run'); }
    if (state === 'proc') { nodes[0].classList.add('done'); lines[0].classList.add('fill'); nodes[1].classList.add('on'); lines[1].classList.add('run'); }
    if (state === 'done') { nodes.forEach((n) => n.classList.add('done')); lines.forEach((l) => l.classList.add('fill')); }
    if (state === 'fail') { nodes[0].classList.add('done'); lines[0].classList.add('fill'); nodes[1].classList.add('done'); lines[1].classList.add('fill'); nodes[2].classList.add('fail'); }
  }

  /* ---------- Tampilan hasil ---------- */
  const resEl = $('#bp-res');
  function showResult(r, src) {
    resEl.classList.remove('hidden', 'fail');
    resEl.style.animation = 'none'; void resEl.offsetWidth; resEl.style.animation = '';
    const others = $('#bp-others'); others.classList.add('hidden'); $('#bp-others-list').textContent = '';
    const main = $('#bp-url'), open = $('#bp-open'), copy = $('#bp-copy'), share = $('#bp-share');
    const rawTxt = typeof r.raw === 'string' ? r.raw : JSON.stringify(r.raw, null, 2);
    $('#bp-raw').textContent = String(rawTxt || '').slice(0, 6000);
    $('#bp-raw-wrap').classList.toggle('hidden', !rawTxt);
    $('#bp-from').textContent = hostOf(src);
    const to = $('#bp-to');
    const prov = $('#bp-prov');
    prov.href = PROVIDER_PAGE + '?url=' + encodeURIComponent(src);
    prov.classList.toggle('hidden', !!r.ok);

    if (!r.ok) {
      resEl.classList.add('fail');
      $('#bp-stamp-t').textContent = 'GAGAL';
      to.textContent = '???';
      main.className = 'bp-msg'; main.textContent = r.message;
      open.classList.add('hidden'); copy.classList.add('hidden'); share.classList.add('hidden');
      return;
    }
    $('#bp-stamp-t').textContent = 'SUKSES';
    main.className = 'bp-url';
    copy.classList.remove('hidden');
    const val = r.text || r.primary;
    copy.dataset.v = val;
    share.dataset.v = val;
    share.classList.toggle('hidden', !navigator.share);
    if (r.text) { main.textContent = r.text; to.textContent = 'teks'; open.classList.add('hidden'); return; }
    main.textContent = r.primary; to.textContent = hostOf(r.primary);
    if (safeHttp(r.primary)) { open.href = r.primary; open.classList.remove('hidden'); } else open.classList.add('hidden');
    if (r.others && r.others.length) {
      others.classList.remove('hidden');
      const box = $('#bp-others-list');
      r.others.slice(0, 6).forEach((u) => {
        const row = document.createElement('div'); row.className = 'bp-other';
        const code = document.createElement('code'); code.textContent = u; row.appendChild(code);
        const cp = iconBtn('button', 'copy', 'Salin');
        cp.addEventListener('click', async () => say((await copyText(u)) ? 'Link disalin' : 'Gagal menyalin'));
        row.appendChild(cp);
        if (safeHttp(u)) { const a = iconBtn('a', 'ext', 'Buka'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; row.appendChild(a); }
        box.appendChild(row);
      });
    }
  }

  /* ---------- Aksi utama ---------- */
  const input = $('#bp-input'), field = $('#bp-field'), go = $('#bp-go');
  let busy = false, last = 0;

  function syncField() { field.classList.toggle('has-val', !!input.value); field.classList.remove('bp-bad'); }

  async function run() {
    if (busy) return;
    const src = normalizeUrl(input.value);
    if (!src) {
      field.classList.remove('bp-bad'); void field.offsetWidth; field.classList.add('bp-bad');
      term.log('err', 'Link tidak valid. Contoh: https://sfl.gl/q3lfk94');
      say('Masukkan link yang valid (http/https)', 'err');
      input.focus(); return;
    }
    if (Date.now() - last < 1500) return say('Tunggu sebentar...', 'err');
    last = Date.now(); busy = true;
    input.value = src; syncField();
    go.disabled = true; go.classList.add('loading');
    $('#bp-go-t').textContent = 'Memproses...';
    resEl.classList.add('hidden');
    pipe('send');
    term.log('sys', '$ bypass --url ' + hostOf(src));
    term.log('info', 'Menghubungi API bypass...');
    const t2 = setTimeout(() => pipe('proc'), 700);
    try {
      const resp = await callApi(src);
      clearTimeout(t2);
      term.log('info', 'Respons diterima (HTTP ' + resp.status + ').');
      const r = interpret(resp, src);
      showResult(r, src);
      if (r.ok) {
        pipe('done');
        const out = r.primary || r.text;
        term.log('ok', 'Berhasil: ' + short(out, 90));
        if (r.primary) addHist(src, r.primary);
        bumpCount(); party(); say('Bypass berhasil!');
        if (r.primary && !safeHttp(r.primary)) term.log('warn', 'Hasil bukan link http/https, tombol Buka disembunyikan.');
      } else {
        pipe('fail');
        term.log('err', 'Gagal: ' + r.message);
        say('Bypass gagal', 'err');
      }
      setTimeout(() => resEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    } catch (e) {
      clearTimeout(t2);
      const msg = e && e.name === 'AbortError' ? 'Waktu habis (50 detik). Coba lagi nanti.' : 'Tidak bisa menghubungi API: ' + (e && e.message ? e.message : 'kesalahan jaringan');
      term.log('err', msg); pipe('fail');
      showResult({ ok: false, message: msg, raw: '' }, src);
      say('Bypass gagal', 'err');
    } finally {
      busy = false; go.disabled = false; go.classList.remove('loading');
      $('#bp-go-t').textContent = 'Bypass Sekarang';
    }
  }

  /* ---------- Event ---------- */
  go.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  input.addEventListener('input', syncField);
  $('#bp-x').addEventListener('click', () => { input.value = ''; syncField(); pipe('idle'); input.focus(); });
  $('#bp-paste').addEventListener('click', async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return say('Clipboard kosong', 'err');
      input.value = t; syncField(); say('Link ditempel'); term.log('info', 'Link ditempel dari clipboard.');
    } catch { say('Izin clipboard ditolak. Tempel manual (Ctrl+V).', 'err'); input.focus(); }
  });
  root.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.ex; syncField(); input.focus(); }));
  $('#bp-copy').addEventListener('click', async (e) => say((await copyText(e.currentTarget.dataset.v || '')) ? 'Link disalin' : 'Gagal menyalin'));
  $('#bp-share').addEventListener('click', async (e) => {
    const v = e.currentTarget.dataset.v || '';
    try { await navigator.share({ title: 'Hasil Bypass', url: safeHttp(v) ? v : undefined, text: safeHttp(v) ? undefined : v }); } catch {}
  });
  $('#bp-term-copy').addEventListener('click', async () => say((await copyText(term.text())) ? 'Log disalin' : 'Gagal menyalin'));
  $('#bp-term-clear').addEventListener('click', () => { term.clear(); term.log('sys', 'Log dibersihkan.'); });
  $('#bp-term-toggle').addEventListener('click', () => $('#bp-term').classList.toggle('collapsed'));
  $('#bp-hist-clear').addEventListener('click', () => { store.set(HKEY, []); renderHist(); say('Riwayat dihapus'); });

  /* ---------- Awal ---------- */
  const pre = new URLSearchParams(location.search).get('url');
  if (pre) { input.value = pre.slice(0, 2000); syncField(); }
  renderHist(); renderCount(); pipe('idle');
  term.log('sys', 'bypass_terminal siap.');
  term.log('tip', 'Tempel link lalu tekan "Bypass Sekarang".');
})();
