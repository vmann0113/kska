(() => {
  const cfg = window.KSKA_CONFIG;
  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  const HERE = location.origin + location.pathname;

  // ---------------------------------------------------------------------
  // helpers
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach((c) => c != null && node.append(c));
    return node;
  };
  const icon = (name) => el('i', { class: `ph ${name}`, 'aria-hidden': 'true' });
  const today = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };
  const fmtDate = (d) => (d ? d.replaceAll('-', '.') : '');

  let toastTimer;
  const toast = (msg, kind = 'ok') => {
    const t = $('[data-toast]');
    t.textContent = msg;
    t.className = `toast is-on toast--${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 2800);
  };

  const korError = (err) => {
    const m = (err && (err.message || err.error_description || String(err))) || '';
    if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.';
    if (/Email not confirmed/i.test(m)) return '메일함에서 확인 링크를 먼저 눌러주세요.';
    if (/already registered|already exists/i.test(m)) return '이미 계정이 있는 이메일이에요. 로그인해 주세요.';
    if (/rate limit|too many/i.test(m)) return '요청이 너무 많아요. 몇 분 뒤에 다시 시도해 주세요.';
    if (/Password should be/i.test(m)) return '비밀번호는 8자 이상으로 정해주세요.';
    if (/row-level security|permission denied/i.test(m)) return '권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요.';
    if (/duplicate key/i.test(m)) return '이미 등록된 항목이에요.';
    if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요.';
    return `문제가 생겼어요. (${m})`;
  };

  // ---------------------------------------------------------------------
  // views
  const show = (view) => $$('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== view; });

  const authMode = (mode) => {
    $$('[data-form]').forEach((f) => { f.hidden = f.dataset.form !== mode; $('[data-error]', f).textContent = ''; });
    $$('[data-switch]').forEach((b) => { b.hidden = b.dataset.switch === mode || (mode === 'newpass'); });
    const hints = {
      login: '관리자로 등록된 이메일로 로그인하세요.',
      signup: '관리자로 등록된 이메일로 계정을 만들면, 확인 메일이 가요. 메일의 링크를 누른 뒤 로그인하세요.',
      reset: '가입한 이메일로 비밀번호 재설정 링크를 보내드려요.',
      newpass: '새로 쓸 비밀번호를 입력하세요.',
    };
    $('[data-auth-hint]').textContent = hints[mode];
  };
  $$('[data-switch]').forEach((b) => b.addEventListener('click', () => authMode(b.dataset.switch)));

  const busy = (form, on) => {
    const btn = $('button[type="submit"]', form);
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = '잠시만요...'; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  };

  $('[data-form="login"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; busy(f, true);
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    busy(f, false);
    if (error) $('[data-error]', f).textContent = korError(error);
  });

  $('[data-form="signup"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; busy(f, true);
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(), password: f.password.value, options: { emailRedirectTo: HERE },
    });
    busy(f, false);
    if (error) { $('[data-error]', f).textContent = korError(error); return; }
    if (!data.session) {
      authMode('login');
      $('[data-auth-hint]').textContent = '확인 메일을 보냈어요. 메일의 링크를 누른 뒤 이 화면으로 돌아와 로그인하세요.';
    }
  });

  $('[data-form="reset"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; busy(f, true);
    const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: HERE });
    busy(f, false);
    if (error) { $('[data-error]', f).textContent = korError(error); return; }
    authMode('login');
    $('[data-auth-hint]').textContent = '재설정 메일을 보냈어요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.';
  });

  $('[data-form="newpass"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; busy(f, true);
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    busy(f, false);
    if (error) { $('[data-error]', f).textContent = korError(error); return; }
    toast('비밀번호를 바꿨어요.');
    enter();
  });

  $$('[data-logout]').forEach((b) => b.addEventListener('click', async () => {
    await sb.auth.signOut();
    show('auth'); authMode('login');
  }));

  let me = '';
  let recovering = false;
  const enter = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('auth'); authMode('login'); return; }
    me = (session.user.email || '').toLowerCase();
    if (recovering) { show('auth'); authMode('newpass'); return; }
    const { data: ok, error } = await sb.rpc('kska_is_admin');
    if (error || !ok) { $('[data-me]').textContent = me; show('denied'); return; }
    show('app');
    openTab(location.hash.slice(1) || 'events');
  };

  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; show('auth'); authMode('newpass'); return; }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { if (!recovering) enter(); }
    if (event === 'USER_UPDATED') recovering = false;
  });

  // ---------------------------------------------------------------------
  // image upload (resized in the browser)
  const resizeToWebp = async (file, max) => {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.82));
  };
  const uploadImage = async (file, folder, max = 1800) => {
    if (!/^image\//.test(file.type)) throw new Error('사진 파일만 올릴 수 있어요.');
    const blob = await resizeToWebp(file, max);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { error } = await sb.storage.from(cfg.bucket).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
    if (error) throw error;
    return sb.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
  };
  const removeStored = async (url) => {
    const marker = `/storage/v1/object/public/${cfg.bucket}/`;
    if (!url || !url.includes(marker)) return;
    await sb.storage.from(cfg.bucket).remove([decodeURIComponent(url.split(marker)[1])]);
  };

  // ---------------------------------------------------------------------
  // form fields
  const fieldControl = (f, value) => {
    const id = `f-${f.name}`;
    if (f.type === 'checkbox') {
      return el('label', { class: 'check' },
        el('input', { type: 'checkbox', name: f.name, id, checked: value ?? f.default ?? false }),
        el('span', { text: f.label }));
    }
    let input;
    if (f.type === 'textarea') input = el('textarea', { name: f.name, id, rows: f.rows || 4, placeholder: f.placeholder });
    else if (f.type === 'select') input = el('select', { name: f.name, id }, f.options.map((o) => el('option', { value: o, text: o })));
    else if (f.type === 'image') return imageControl(f, value);
    else input = el('input', { type: f.type || 'text', name: f.name, id, placeholder: f.placeholder, required: f.required, inputmode: f.inputmode });
    input.value = value ?? (typeof f.default === 'function' ? f.default() : f.default ?? '');
    return el('div', { class: 'field' },
      el('label', { for: id }, f.label, f.required ? el('em', { text: ' *' }) : null),
      input,
      f.hint ? el('small', { text: f.hint }) : null);
  };

  const imageControl = (f, value) => {
    const hidden = el('input', { type: 'hidden', name: f.name });
    hidden.value = value || '';
    const preview = el('div', { class: 'imgpick__preview' });
    const status = el('small', { class: 'imgpick__status' });
    const render = () => {
      preview.replaceChildren(hidden.value ? el('img', { src: hidden.value, alt: '' }) : el('span', {}, icon('ph-image'), '사진 없음'));
      clearBtn.hidden = !hidden.value;
    };
    const file = el('input', { type: 'file', accept: 'image/*', hidden: true });
    const pickBtn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => file.click() }, icon('ph-upload-simple'), '사진 선택');
    const clearBtn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { hidden.value = ''; render(); } }, '사진 빼기');
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      status.textContent = '올리는 중...'; pickBtn.disabled = true;
      try {
        hidden.value = await uploadImage(file.files[0], f.folder, f.max);
        status.textContent = '';
      } catch (err) { status.textContent = korError(err); }
      pickBtn.disabled = false; file.value = ''; render();
    });
    render();
    return el('div', { class: 'field' },
      el('span', { class: 'field__label' }, f.label, f.required ? el('em', { text: ' *' }) : null),
      el('div', { class: 'imgpick' }, preview, el('div', { class: 'imgpick__actions' }, pickBtn, clearBtn, status)),
      hidden, file,
      f.hint ? el('small', { text: f.hint }) : null);
  };

  const readForm = (form, fields) => {
    const out = {};
    for (const f of fields) {
      const input = form.elements[f.name];
      if (f.type === 'checkbox') out[f.name] = input.checked;
      else if (f.type === 'number') out[f.name] = input.value === '' ? 0 : Number(input.value);
      else {
        const v = input.value.trim();
        out[f.name] = v === '' && !f.required ? (f.type === 'date' ? null : (f.emptyAs ?? null)) : v;
      }
    }
    return out;
  };
  const validate = (data, fields) => {
    for (const f of fields) {
      if (f.required && !data[f.name]) return `${f.label}을(를) 입력해 주세요.`;
      if (f.type === 'url' && data[f.name] && !/^https?:\/\//i.test(data[f.name])) return `${f.label}은 http:// 또는 https:// 로 시작해야 해요.`;
    }
    return '';
  };

  // ---------------------------------------------------------------------
  // edit sheet
  const sheet = $('[data-sheet]');
  const sheetForm = $('[data-sheet-form]');
  let sheetSubmit = null;
  $$('[data-sheet-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
  sheetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sheetSubmit) return;
    const btn = $('[data-sheet-save]');
    btn.disabled = true; btn.textContent = '저장하는 중...';
    $('[data-sheet-error]').textContent = '';
    const err = await sheetSubmit();
    btn.disabled = false; btn.textContent = '저장';
    if (err) $('[data-sheet-error]').textContent = err;
    else sheet.close();
  });
  const openSheet = (title, fields, values, onSave) => {
    $('[data-sheet-title]').textContent = title;
    $('[data-sheet-error]').textContent = '';
    $('[data-sheet-body]').replaceChildren(...fields.map((f) => fieldControl(f, values?.[f.name])));
    sheetSubmit = async () => {
      const data = readForm(sheetForm, fields);
      const v = validate(data, fields);
      if (v) return v;
      return onSave(data);
    };
    sheet.showModal();
  };

  // ---------------------------------------------------------------------
  // collections
  const KINDS = ['스킴페스트', '스킴투어', '체험·강습', '기타'];
  const COLLECTIONS = {
    events: {
      table: 'kska_events', title: '행사', order: ['event_date', { ascending: false }],
      intro: '날짜가 오늘 이후인 행사는 홈페이지에 "다가오는 행사"로 크게 표시되고, 지난 행사는 아래 목록으로 들어가요.',
      fields: [
        { name: 'title', label: '행사 이름', required: true, placeholder: '예: 2026 얼라이브스킴 스킴페스트' },
        { name: 'kind', label: '종류', type: 'select', options: KINDS },
        { name: 'event_date', label: '날짜', type: 'date', required: true },
        { name: 'place', label: '장소', placeholder: '예: 부산 송정해수욕장', hint: '첫 단어(예: 부산)가 "함께 탄 바다" 숫자에 지역으로 들어가요.', emptyAs: '' },
        { name: 'cover_url', label: '대표 사진', type: 'image', folder: 'events' },
        { name: 'summary', label: '한 줄 소개', type: 'textarea', rows: 3, emptyAs: '' },
        { name: 'link_url', label: '신청·안내 링크', type: 'url', placeholder: 'https://', hint: '참가 신청서, 인스타그램 게시물 주소 등' },
        { name: 'link_label', label: '링크 버튼 이름', placeholder: '참가 신청하기' },
        { name: 'published', label: '홈페이지에 보이기', type: 'checkbox', default: true },
      ],
      row: (r) => ({
        img: r.cover_url, title: r.title,
        meta: [fmtDate(r.event_date), r.place, r.kind].filter(Boolean).join('  |  '),
        badge: r.event_date >= today() ? '다가오는 행사' : null,
        hidden: !r.published,
      }),
    },
    notices: {
      table: 'kska_notices', title: '소식', order: ['posted_on', { ascending: false }],
      intro: '홈페이지 "소식"에 최근 8개까지 보여요. 고정한 글은 맨 위에 나와요.',
      fields: [
        { name: 'title', label: '제목', required: true },
        { name: 'posted_on', label: '날짜', type: 'date', default: today },
        { name: 'body', label: '내용', type: 'textarea', rows: 7, hint: '빈 줄을 넣으면 문단이 나뉘어요.', emptyAs: '' },
        { name: 'link_url', label: '링크', type: 'url', placeholder: 'https://' },
        { name: 'link_label', label: '링크 버튼 이름', placeholder: '바로가기' },
        { name: 'pinned', label: '맨 위에 고정 (공지)', type: 'checkbox' },
        { name: 'published', label: '홈페이지에 보이기', type: 'checkbox', default: true },
      ],
      row: (r) => ({ title: r.title, meta: fmtDate(r.posted_on), badge: r.pinned ? '공지' : null, hidden: !r.published }),
    },
    gallery: {
      table: 'kska_gallery', title: '사진', order: ['sort', { ascending: true }], bulk: true,
      intro: '"순서" 숫자가 작을수록 앞에 나와요. 11장 단위로 올리면 모자이크가 가장 예쁘게 채워져요.',
      fields: [
        { name: 'image_url', label: '사진', type: 'image', folder: 'gallery', required: true },
        { name: 'alt', label: '사진 설명', hint: '눈이 불편한 분들의 화면 읽기 프로그램이 읽어주는 문장이에요.', emptyAs: '' },
        { name: 'sort', label: '순서', type: 'number', inputmode: 'numeric', default: 0 },
        { name: 'published', label: '홈페이지에 보이기', type: 'checkbox', default: true },
      ],
      row: (r) => ({ img: r.image_url, title: r.alt || '(설명 없음)', meta: `순서 ${r.sort}`, hidden: !r.published }),
      imageKey: 'image_url',
    },
    sponsors: {
      table: 'kska_sponsors', title: '스폰서', order: ['sort', { ascending: true }],
      intro: '로고를 올리지 않으면 이름이 글자로 표시돼요.',
      fields: [
        { name: 'name', label: '이름', required: true },
        { name: 'url', label: '링크', type: 'url', placeholder: 'https://' },
        { name: 'logo_url', label: '로고', type: 'image', folder: 'sponsors', max: 800, hint: '배경이 투명한 PNG가 가장 좋아요.' },
        { name: 'sort', label: '순서', type: 'number', inputmode: 'numeric', default: 0 },
      ],
      row: (r) => ({ img: r.logo_url, title: r.name, meta: r.url || '' }),
    },
  };

  const panel = $('[data-panel]');

  const renderCollection = async (key) => {
    const c = COLLECTIONS[key];
    const head = el('div', { class: 'panel__head' },
      el('div', {}, el('h1', { text: c.title }), el('p', { class: 'muted', text: c.intro })),
      el('div', { class: 'panel__actions' },
        c.bulk ? el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => bulkUpload() }, icon('ph-images'), '여러 장 올리기') : null,
        el('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(key) }, icon('ph-plus'), `${c.title} 추가`)));
    const list = el('ul', { class: 'list' }, el('li', { class: 'list__empty', text: '불러오는 중...' }));
    panel.replaceChildren(head, list);

    const { data, error } = await sb.from(c.table).select('*').order(...c.order);
    if (error) { list.replaceChildren(el('li', { class: 'list__empty', text: korError(error) })); return; }
    if (!data.length) { list.replaceChildren(el('li', { class: 'list__empty', text: `아직 ${c.title}이(가) 없어요. 오른쪽 위 버튼으로 추가하세요.` })); return; }
    list.replaceChildren(...data.map((r) => {
      const v = c.row(r);
      return el('li', { class: `item${v.hidden ? ' is-hidden' : ''}` },
        'img' in v ? el('div', { class: 'item__thumb' }, v.img ? el('img', { src: v.img, alt: '', loading: 'lazy' }) : icon('ph-image')) : null,
        el('div', { class: 'item__main' },
          el('p', { class: 'item__title' },
            v.badge ? el('span', { class: 'badge', text: v.badge }) : null,
            v.hidden ? el('span', { class: 'badge badge--muted', text: '숨김' }) : null,
            v.title),
          el('p', { class: 'item__meta', text: v.meta })),
        el('div', { class: 'item__actions' },
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => edit(key, r) }, icon('ph-pencil-simple'), '수정'),
          el('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: () => remove(key, r) }, icon('ph-trash'), '삭제')));
    }));
  };

  const edit = (key, row) => {
    const c = COLLECTIONS[key];
    openSheet(row ? `${c.title} 수정` : `${c.title} 추가`, c.fields, row, async (data) => {
      const q = row ? sb.from(c.table).update(data).eq('id', row.id) : sb.from(c.table).insert(data);
      const { error } = await q;
      if (error) return korError(error);
      toast(row ? '수정했어요. 홈페이지에 바로 반영돼요.' : '추가했어요. 홈페이지에 바로 반영돼요.');
      renderCollection(key);
      return '';
    });
  };

  const remove = async (key, row) => {
    const c = COLLECTIONS[key];
    if (!confirm(`이 ${c.title}을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    const { error } = await sb.from(c.table).delete().eq('id', row.id);
    if (error) { toast(korError(error), 'err'); return; }
    for (const f of c.fields) if (f.type === 'image') removeStored(row[f.name]).catch(() => {});
    toast('삭제했어요.');
    renderCollection(key);
  };

  const bulkUpload = () => {
    const input = el('input', { type: 'file', accept: 'image/*', multiple: true });
    input.addEventListener('change', async () => {
      const files = [...input.files];
      if (!files.length) return;
      const { data: last } = await sb.from('kska_gallery').select('sort').order('sort', { ascending: false }).limit(1);
      let sort = (last?.[0]?.sort || 0) + 10;
      let done = 0;
      for (const file of files) {
        toast(`사진 올리는 중... (${done + 1}/${files.length})`);
        try {
          const url = await uploadImage(file, 'gallery');
          const { error } = await sb.from('kska_gallery').insert({ image_url: url, alt: '', sort });
          if (error) throw error;
          sort += 10; done += 1;
        } catch (err) { toast(korError(err), 'err'); }
      }
      toast(`사진 ${done}장을 올렸어요.`);
      renderCollection('gallery');
    });
    input.click();
  };

  // ---------------------------------------------------------------------
  // settings
  const SETTINGS = [
    { name: 'hero_ko', label: '메인 문구', hint: '첫 화면 큰 영어 제목 아래 한 줄' },
    { name: 'hero_lead', label: '메인 소개글', type: 'textarea', rows: 2 },
    { name: 'mission_body', label: '협회 소개글', type: 'textarea', rows: 5 },
    { name: 'instagram', label: '인스타그램 아이디', placeholder: 'kska_official', hint: '@ 없이 아이디만 적어주세요.' },
    { name: 'contact_email', label: '문의 이메일', type: 'email', hint: '비워두면 홈페이지에 표시되지 않아요.' },
    { name: 'contact_phone', label: '문의 전화번호', type: 'tel', hint: '비워두면 홈페이지에 표시되지 않아요.' },
  ];
  const renderSettings = async () => {
    panel.replaceChildren(el('div', { class: 'panel__head' }, el('div', {}, el('h1', { text: '기본 정보' }), el('p', { class: 'muted', text: '홈페이지 곳곳에 들어가는 문구와 연락처예요.' }))));
    const { data, error } = await sb.from('kska_settings').select('key,value');
    if (error) { panel.append(el('p', { class: 'list__empty', text: korError(error) })); return; }
    const values = Object.fromEntries(data.map((r) => [r.key, r.value]));
    const form = el('form', { class: 'form card' }, ...SETTINGS.map((f) => fieldControl(f, values[f.name])),
      el('div', { class: 'form__foot' }, el('button', { class: 'btn btn--primary', type: 'submit' }, '저장')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); busy(form, true);
      const rows = SETTINGS.map((f) => ({
        key: f.name,
        value: f.name === 'instagram' ? form.elements[f.name].value.trim().replace(/^@/, '') : form.elements[f.name].value.trim(),
        updated_at: new Date().toISOString(),
      }));
      const { error: err } = await sb.from('kska_settings').upsert(rows);
      busy(form, false);
      toast(err ? korError(err) : '저장했어요. 홈페이지에 바로 반영돼요.', err ? 'err' : 'ok');
    });
    panel.append(form);
  };

  // ---------------------------------------------------------------------
  // admins
  const renderAdmins = async () => {
    const form = el('form', { class: 'inline-form' },
      el('input', { type: 'email', name: 'email', placeholder: '추가할 관리자 이메일', required: true, 'aria-label': '추가할 관리자 이메일' }),
      el('button', { class: 'btn btn--primary', type: 'submit' }, icon('ph-plus'), '추가'));
    const list = el('ul', { class: 'list' });
    panel.replaceChildren(
      el('div', { class: 'panel__head' }, el('div', {},
        el('h1', { text: '관리자' }),
        el('p', { class: 'muted', text: '여기 등록된 이메일로 계정을 만들면 관리자 화면을 쓸 수 있어요. 추가한 뒤 그분께 이 페이지 주소를 알려주고 "처음이라면 계정 만들기"를 누르라고 안내하세요.' }))),
      form, list);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const { error } = await sb.from('kska_admins').insert({ email });
      if (error) { toast(korError(error), 'err'); return; }
      form.reset(); toast('관리자를 추가했어요.'); load();
    });
    const load = async () => {
      const { data, error } = await sb.from('kska_admins').select('*').order('created_at');
      if (error) { list.replaceChildren(el('li', { class: 'list__empty', text: korError(error) })); return; }
      list.replaceChildren(...data.map((a) => el('li', { class: 'item' },
        el('div', { class: 'item__thumb item__thumb--icon' }, icon('ph-user')),
        el('div', { class: 'item__main' },
          el('p', { class: 'item__title' }, a.email === me ? el('span', { class: 'badge', text: '나' }) : null, a.email),
          el('p', { class: 'item__meta', text: `${fmtDate(a.created_at.slice(0, 10))} 등록` })),
        el('div', { class: 'item__actions' }, a.email === me ? null :
          el('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
            if (!confirm(`${a.email} 을(를) 관리자에서 뺄까요?`)) return;
            const { error: err } = await sb.from('kska_admins').delete().eq('email', a.email);
            toast(err ? korError(err) : '관리자에서 뺐어요.', err ? 'err' : 'ok'); load();
          } }, icon('ph-user-minus'), '빼기')))));
    };
    load();
  };

  // ---------------------------------------------------------------------
  // tabs
  const openTab = (key) => {
    if (!['events', 'notices', 'gallery', 'sponsors', 'settings', 'admins'].includes(key)) key = 'events';
    $$('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
    history.replaceState(null, '', `#${key}`);
    if (key === 'settings') renderSettings();
    else if (key === 'admins') renderAdmins();
    else renderCollection(key);
  };
  $$('[data-tab]').forEach((t) => t.addEventListener('click', () => openTab(t.dataset.tab)));

  enter();
})();
