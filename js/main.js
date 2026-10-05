(() => {
  document.documentElement.classList.add('js');

  // Nav turns solid once the hero leaves the viewport
  const nav = document.querySelector('[data-nav]');
  const hero = document.querySelector('[data-hero]');
  if (nav && hero) {
    new IntersectionObserver(([entry]) => {
      nav.classList.toggle('is-solid', !entry.isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);
  }

  // Mobile menu
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    nav.classList.toggle('is-open', open);
    toggle.querySelector('i').className = open ? 'ph ph-x' : 'ph ph-list';
  };
  toggle?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  // Reveal on scroll
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // Events rail buttons
  const rail = document.querySelector('[data-rail]');
  const prev = document.querySelector('[data-rail-prev]');
  const next = document.querySelector('[data-rail-next]');
  if (rail && prev && next) {
    const step = () => (rail.querySelector('.event')?.getBoundingClientRect().width || 400) + 24;
    const update = () => {
      prev.disabled = rail.scrollLeft <= 4;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    };
    prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Gallery lightbox
  const tiles = [...document.querySelectorAll('[data-gallery] .tile')];
  const box = document.querySelector('[data-lightbox]');
  const boxImg = box?.querySelector('[data-lightbox-img]');
  let current = 0;
  const show = (i) => {
    current = (i + tiles.length) % tiles.length;
    const tile = tiles[current];
    boxImg.src = tile.dataset.full;
    boxImg.alt = tile.querySelector('img').alt;
  };
  if (box && boxImg && typeof box.showModal === 'function') {
    tiles.forEach((tile, i) => tile.addEventListener('click', () => { show(i); box.showModal(); }));
    box.querySelector('[data-lightbox-close]').addEventListener('click', () => box.close());
    box.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(current - 1));
    box.querySelector('[data-lightbox-next]').addEventListener('click', () => show(current + 1));
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
