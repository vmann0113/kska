// 관리자 모드에서 저장한 내용을 불러와 페이지에 반영합니다.
// 불러오기에 실패하면 HTML에 들어 있는 기본 내용이 그대로 보입니다.
(() => {
  const cfg = window.KSKA_CONFIG;
  if (!cfg) return;

  const get = (path) =>
    fetch(`${cfg.url}/rest/v1/${path}`, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
  };
  const icon = (name) => el('i', { class: `ph ${name}`, 'aria-hidden': 'true' });
  const safeUrl = (u) => (u && /^(https?:\/\/|mailto:|tel:)/i.test(u.trim()) ? u.trim() : null);
  const fmtDate = (d) => d.replaceAll('-', '.');
  const todayStr = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };
  const dday = (d) => {
    const ms = new Date(`${d}T00:00:00`) - new Date(`${todayStr()}T00:00:00`);
    const n = Math.round(ms / 86400000);
    return n === 0 ? 'D-DAY' : `D-${n}`;
  };
  const isFest = (kind) => kind.includes('페스트');

  // 기본 정보 -----------------------------------------------------------
  const applySettings = (rows) => {
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    document.querySelectorAll('[data-setting]').forEach((node) => {
      const v = s[node.dataset.setting];
      if (v) node.textContent = v;
    });
    const ig = (s.instagram || '').replace(/^@/, '').trim();
    if (ig) {
      document.querySelectorAll('[data-ig]').forEach((a) => {
        a.href = `https://www.instagram.com/${encodeURIComponent(ig)}/`;
        a.querySelectorAll('span').forEach((sp) => { if (sp.textContent.startsWith('@')) sp.textContent = `@${ig}`; });
        a.childNodes.forEach((n) => {
          if (n.nodeType === 3 && n.textContent.includes('@')) n.textContent = n.textContent.replace(/@[\w.]+/, `@${ig}`);
        });
      });
    }
    const contact = document.querySelector('[data-contact]');
    if (contact) {
      contact.replaceChildren();
      if (s.contact_email) contact.append(el('a', { href: `mailto:${s.contact_email}` }, icon('ph-envelope-simple'), s.contact_email));
      if (s.contact_phone) contact.append(el('a', { href: `tel:${s.contact_phone.replace(/[^\d+]/g, '')}` }, icon('ph-phone'), s.contact_phone));
      contact.hidden = !contact.childElementCount;
    }
  };

  // 행사 ----------------------------------------------------------------
  const eventCard = (e) =>
    el('li', { class: 'event' },
      el('figure', { class: 'event__img' },
        e.cover_url ? el('img', { src: e.cover_url, alt: e.title, loading: 'lazy', width: 1200, height: 900 }) : null),
      el('div', { class: 'event__meta' },
        el('span', { class: `tag${isFest(e.kind) ? ' tag--fest' : ''}`, text: e.kind }),
        el('time', { datetime: e.event_date, text: fmtDate(e.event_date) })),
      el('h3', { class: 'event__title', text: e.title }),
      e.place ? el('p', { class: 'event__place' }, icon('ph-map-pin'), e.place) : null,
      e.summary ? el('p', { class: 'event__summary', text: e.summary }) : null,
      safeUrl(e.link_url)
        ? el('a', { class: 'event__link', href: safeUrl(e.link_url), target: '_blank', rel: 'noopener' }, e.link_label || '자세히 보기', el('i', { class: 'ph-bold ph-arrow-up-right', 'aria-hidden': 'true' }))
        : null);

  const upcomingCard = (e) =>
    el('article', { class: 'up' },
      el('figure', { class: 'up__img' },
        e.cover_url ? el('img', { src: e.cover_url, alt: e.title, loading: 'lazy', width: 1200, height: 900 }) : el('div', { class: 'up__ph' }, icon('ph-waves'))),
      el('div', { class: 'up__body' },
        el('div', { class: 'up__meta' },
          el('span', { class: 'up__dday', text: dday(e.event_date) }),
          el('span', { class: 'up__label', text: `다가오는 ${e.kind}` })),
        el('h3', { class: 'up__title', text: e.title }),
        el('p', { class: 'up__when' }, icon('ph-calendar-blank'), fmtDate(e.event_date)),
        e.place ? el('p', { class: 'up__when' }, icon('ph-map-pin'), e.place) : null,
        e.summary ? el('p', { class: 'up__summary', text: e.summary }) : null,
        safeUrl(e.link_url)
          ? el('a', { class: 'btn btn--accent', href: safeUrl(e.link_url), target: '_blank', rel: 'noopener' }, e.link_label || '자세히 보기', el('i', { class: 'ph-bold ph-arrow-up-right', 'aria-hidden': 'true' }))
          : null));

  const applyEvents = (rows) => {
    const today = todayStr();
    const upcoming = rows.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const past = rows.filter((e) => e.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date));

    const up = document.querySelector('[data-upcoming]');
    if (up) {
      up.replaceChildren(...upcoming.map(upcomingCard));
      up.hidden = !upcoming.length;
    }
    const rail = document.querySelector('[data-rail]');
    if (rail) {
      rail.replaceChildren(...past.map(eventCard));
      rail.hidden = !past.length;
      rail.dispatchEvent(new Event('scroll'));
    }

    // 숫자 띠
    const setFact = (k, v) => document.querySelectorAll(`[data-fact="${k}"]`).forEach((n) => { n.textContent = v; });
    if (past.length) {
      setFact('first-year', String(Math.min(...past.map((e) => +e.event_date.slice(0, 4)))));
      setFact('fest-count', String(past.filter((e) => isFest(e.kind)).length));
      setFact('tour-count', String(past.filter((e) => !isFest(e.kind)).length));
      const regions = [...new Set([...past].reverse().map((e) => (e.place || '').trim().split(/\s+/)[0]).filter(Boolean))];
      setFact('place-count', String(regions.length));
      setFact('places', regions.join('·'));
    }
  };

  // 소식 ----------------------------------------------------------------
  const applyNews = (rows) => {
    const section = document.querySelector('[data-news]');
    const list = document.querySelector('[data-news-list]');
    if (!section || !list) return;
    list.replaceChildren(...rows.map((n, i) =>
      el('li', { class: `news__item${n.pinned ? ' is-pinned' : ''}` },
        el('details', { open: i === 0 ? true : null },
          el('summary', {},
            el('time', { datetime: n.posted_on, text: fmtDate(n.posted_on) }),
            el('span', { class: 'news__title' }, n.pinned ? el('span', { class: 'news__pin', text: '공지' }) : null, n.title),
            el('i', { class: 'ph-bold ph-plus news__toggle', 'aria-hidden': 'true' })),
          el('div', { class: 'news__body' },
            ...n.body.split(/\n{2,}/).map((p) => el('p', { text: p })),
            safeUrl(n.link_url)
              ? el('a', { class: 'news__link', href: safeUrl(n.link_url), target: '_blank', rel: 'noopener' }, n.link_label || '바로가기', el('i', { class: 'ph-bold ph-arrow-up-right', 'aria-hidden': 'true' }))
              : null)))));
    const has = rows.length > 0;
    section.hidden = !has;
    document.querySelectorAll('[data-news-link]').forEach((a) => { a.hidden = !has; });
  };

  // 갤러리 --------------------------------------------------------------
  const PATTERN = ['tile--wide', 'tile--tall', '', '', '', 'tile--tall', 'tile--wide', '', '', '', 'tile--wide'];
  const applyGallery = (rows) => {
    const grid = document.querySelector('[data-gallery]');
    if (!grid || !rows.length) return;
    grid.classList.toggle('mosaic--dense', rows.length % PATTERN.length !== 0);
    grid.replaceChildren(...rows.map((g, i) =>
      el('button', { class: `tile ${PATTERN[i % PATTERN.length]}`.trim(), type: 'button', 'data-full': g.image_url },
        el('img', { src: g.image_url, alt: g.alt || '스킴보드 사진', loading: 'lazy' }))));
  };

  // 스폰서 --------------------------------------------------------------
  const applySponsors = (rows) => {
    const box = document.querySelector('[data-sponsors]');
    const section = box?.closest('.sponsor');
    if (!box) return;
    box.replaceChildren(...rows.map((sp) => {
      const inner = sp.logo_url ? el('img', { src: sp.logo_url, alt: sp.name, loading: 'lazy' }) : sp.name;
      return safeUrl(sp.url)
        ? el('a', { class: 'sponsor__mark', href: safeUrl(sp.url), target: '_blank', rel: 'noopener', 'aria-label': sp.name }, inner)
        : el('span', { class: 'sponsor__mark' }, inner);
    }));
    if (section) section.hidden = !rows.length;
  };

  Promise.allSettled([
    get('kska_settings?select=key,value').then(applySettings),
    get('kska_events?select=*&published=eq.true&order=event_date.desc').then(applyEvents),
    get('kska_notices?select=*&published=eq.true&order=pinned.desc,posted_on.desc&limit=8').then(applyNews),
    get('kska_gallery?select=*&published=eq.true&order=sort.asc,created_at.asc').then(applyGallery),
    get('kska_sponsors?select=*&order=sort.asc,created_at.asc').then(applySponsors),
  ]).then((results) => {
    results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('KSKA data load failed', r.reason));
  });
})();
