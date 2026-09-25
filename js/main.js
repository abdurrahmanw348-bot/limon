(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ==========================================================
     TEXT SPLITTING
     ========================================================== */
  // Wrap every word (and optionally every char) in masked spans, keeping inline elements like <br>.
  function splitText(el, mode) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            if (mode === 'chars') {
              [...part].forEach((ch) => {
                const c = document.createElement('span');
                c.className = 'c';
                c.style.setProperty('--i', i++);
                c.textContent = ch;
                w.appendChild(c);
              });
            } else {
              const inner = document.createElement('span');
              inner.className = 'w__i';
              inner.style.setProperty('--i', i++);
              inner.textContent = part;
              w.appendChild(inner);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add('split');
    if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
  }
  $$('[data-split]').forEach((el) => splitText(el, el.dataset.split));

  // Rolling text on buttons + nav links: duplicate label so it can roll up on hover.
  $$('.btn').forEach((btn) => {
    if (btn.children.length) return;
    const t = btn.textContent.trim();
    btn.innerHTML = `<span class="btn__text"><span>${t}</span><span aria-hidden="true">${t}</span></span>`;
  });
  $$('.nav__group--left .nav__link').forEach((a) => {
    const t = a.textContent.trim();
    a.innerHTML = `<span>${t}</span><span aria-hidden="true">${t}</span>`;
  });
  $$('.nav__logo, .footer__logo').forEach((logo) => {
    logo.setAttribute('aria-label', logo.textContent.trim());
    logo.innerHTML = [...logo.textContent.trim()].map((c) => `<span aria-hidden="true">${c}</span>`).join('');
  });

  // Scroll-scrubbed statement: split into words that light up with scroll.
  $$('.statement').forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'sw';
            s.textContent = part;
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.classList.contains('statement__pill')) {
          walk(child);
        } else if (child.nodeType === 1) {
          child.classList.add('sw');
        }
      });
    };
    walk(el);
  });

  /* ==========================================================
     PAGE TRANSITIONS
     ========================================================== */
  const curtain = $('.curtain');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !curtain || reduced) return;
    const href = a.getAttribute('href');
    if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!/\.html(\?|#|$)/.test(href) || /^https?:/.test(href)) return;
    const url = new URL(href, location.href);
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    e.preventDefault();
    curtain.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 750);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && curtain) curtain.classList.remove('is-leaving');
  });

  /* ==========================================================
     NAV — mobile drawer, hide on scroll, progress
     ========================================================== */
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const drawer = $('#drawer');
  const progress = $('.nav__progress');

  const setDrawer = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setDrawer(!nav.classList.contains('is-open')));
  window.addEventListener('resize', () => { if (window.innerWidth > 960) setDrawer(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

  /* ==========================================================
     REVEAL ON SCROLL
     ========================================================== */
  const revealTargets = $$('.reveal, .split, .img-reveal, .feature__inner, .tl-item, .insta__grid, .footer__logo, .eyebrow')
    .filter((el) => !el.closest('.quote'));
  $$('.reveal').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((s) => s.classList.contains('reveal'));
    el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 6) * 90}ms`;
  });
  // A fully clipped element has no visible area, so clip-path reveals are watched through their parent.
  const watchMap = new Map();
  revealTargets.forEach((el) => {
    const watched = el.classList.contains('img-reveal') ? el.parentElement : el;
    if (!watchMap.has(watched)) watchMap.set(watched, []);
    watchMap.get(watched).push(el);
  });
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      watchMap.get(e.target).forEach((el) => el.classList.add('is-in'));
      revealer.unobserve(e.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  // Wait for the curtain to lift before revealing what's above the fold.
  setTimeout(() => watchMap.forEach((_, el) => revealer.observe(el)), reduced ? 0 : 650);

  /* ==========================================================
     MARQUEES (scroll-reactive)
     ========================================================== */
  const marquees = $$('[data-marquee]').map((el) => {
    const track = $('.marquee__track', el);
    const group = $('.marquee__group', track);
    const copies = Math.max(2, Math.ceil((window.innerWidth * 2) / Math.max(group.offsetWidth, 1)));
    for (let i = 1; i < copies; i++) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
    return { el, track, group, x: 0, speed: parseFloat(el.dataset.speed || '0.6'), dir: parseFloat(el.dataset.marquee || '-1') };
  });

  /* ==========================================================
     HERO SLIDESHOW
     ========================================================== */
  const slides = $$('.hero__slide');
  if (slides.length) {
    const num = $('.hero__num');
    const bar = $('.hero__bar i');
    let si = 0;
    const runBar = () => { bar.classList.remove('is-running'); void bar.offsetWidth; bar.classList.add('is-running'); };
    const go = (n) => {
      slides[si].classList.remove('is-active');
      si = (n + slides.length) % slides.length;
      slides[si].classList.add('is-active');
      num.textContent = String(si + 1).padStart(2, '0');
      runBar();
    };
    runBar();
    if (!reduced) setInterval(() => go(si + 1), 6000);
  }

  /* ==========================================================
     SCROLL LOOP — parallax, scrub, timeline, marquees, badge
     ========================================================== */
  const parallaxEls = $$('[data-parallax]');
  const statements = $$('.statement').map((el) => ({ el, words: $$('.sw', el) }));
  const timelines = $$('.timeline').map((el) => ({ el, fill: $('.timeline__fill', el) }));
  const badges = $$('.badge__ring');
  const toTop = $('#toTop');
  let lastY = window.scrollY;
  let velocity = 0;
  let scrollDir = 1;
  let badgeRot = 0;

  function onFrame() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const delta = y - lastY;
    lastY = y;
    velocity = lerp(velocity, delta, 0.15);
    if (Math.abs(delta) > 0.5) scrollDir = delta > 0 ? 1 : -1;

    // Nav: hide going down, show going up
    const docH = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${docH > 0 ? y / docH : 0})`;
    nav.classList.toggle('is-scrolled', y > 10);
    if (!nav.classList.contains('is-open')) {
      if (delta > 4 && y > 300) nav.classList.add('is-hidden');
      else if (delta < -4 || y < 300) nav.classList.remove('is-hidden');
    }
    document.body.classList.toggle('nav-visible', !nav.classList.contains('is-hidden'));
    if (toTop) toTop.classList.toggle('is-visible', y > 600);

    if (!reduced) {
      // Parallax
      parallaxEls.forEach((el) => {
        const box = (el.parentElement || el).getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) return;
        const speed = parseFloat(el.dataset.parallax);
        const offset = (box.top + box.height / 2 - vh / 2) * -speed;
        const scale = el.dataset.scale ? ` scale(${el.dataset.scale})` : '';
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)${scale}`;
      });

      // Marquees: base speed, boosted and flipped by scroll
      marquees.forEach((m) => {
        const w = m.group.offsetWidth;
        if (!w) return;
        m.x += (m.speed + Math.abs(velocity) * 0.25) * m.dir * scrollDir;
        if (m.x <= -w) m.x += w;
        if (m.x > 0) m.x -= w;
        m.track.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0)`;
      });

      // Rotating badges
      badgeRot += 0.25 + Math.abs(velocity) * 0.35;
      badges.forEach((b) => { b.style.transform = `rotate(${badgeRot.toFixed(2)}deg)`; });
    }

    // Statement word scrub
    statements.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      const p = reduced ? 1 : clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    });

    // Timeline line draws with scroll
    timelines.forEach(({ el, fill }) => {
      const r = el.getBoundingClientRect();
      fill.style.transform = `scaleY(${clamp((vh * 0.6 - r.top) / r.height)})`;
    });

    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  if (toTop) toTop.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ==========================================================
     CURSOR, MAGNETIC BUTTONS, HOVER PREVIEW
     ========================================================== */
  if (finePointer && !reduced) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.innerHTML = '<span class="cursor__label"></span>';
    document.body.appendChild(cursor);
    const label = $('.cursor__label', cursor);
    const mouse = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      cursor.classList.add('is-visible');
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('mouseover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, input, select, textarea, label');
      cursor.classList.toggle('has-label', !!labelled);
      cursor.classList.toggle('is-link', !!link && !labelled);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });

    // Hover preview for drink rows
    const rows = $$('[data-preview]');
    let preview, previewImgs = [];
    const pv = { x: 0, y: 0, rot: 0 };
    if (rows.length) {
      preview = document.createElement('div');
      preview.className = 'hover-preview';
      rows.forEach((row) => {
        const img = new Image();
        img.src = row.dataset.preview;
        img.alt = '';
        preview.appendChild(img);
        previewImgs.push(img);
        row.addEventListener('mouseenter', () => {
          preview.classList.add('is-visible');
          previewImgs.forEach((im) => im.classList.toggle('is-active', im === img));
        });
        row.addEventListener('mouseleave', () => preview.classList.remove('is-visible'));
      });
      document.body.appendChild(preview);
    }

    const tick = () => {
      pos.x = lerp(pos.x, mouse.x, 0.2);
      pos.y = lerp(pos.y, mouse.y, 0.2);
      cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      if (preview) {
        const px = pv.x;
        pv.x = lerp(pv.x, mouse.x, 0.1);
        pv.y = lerp(pv.y, mouse.y, 0.1);
        pv.rot = lerp(pv.rot, clamp((pv.x - px) * 0.6, -12, 12), 0.1);
        preview.style.transform = `translate3d(${pv.x}px, ${pv.y}px, 0) rotate(${pv.rot}deg)`;
      }
      requestAnimationFrame(tick);
    };
    tick();

    // Magnetic pull
    $$('.btn, .to-top, .socials a, .magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ==========================================================
     COMPONENTS
     ========================================================== */
  // Menu filter with exit / enter animation
  const filters = $$('.filter');
  const cards = $$('#menuGrid .food-card');
  if (filters.length && cards.length) {
    filters.forEach((btn) => {
      const f = btn.dataset.filter;
      const count = f === 'all' ? cards.length : cards.filter((c) => c.dataset.category === f).length;
      btn.insertAdjacentHTML('beforeend', `<sup>${count}</sup>`);
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        filters.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        const visible = cards.filter((c) => !c.classList.contains('is-hidden'));
        visible.forEach((c) => c.classList.add('is-leaving'));
        setTimeout(() => {
          const shown = [];
          cards.forEach((c) => {
            c.classList.remove('is-leaving');
            const show = f === 'all' || c.dataset.category === f;
            c.classList.toggle('is-hidden', !show);
            if (show) { c.classList.add('is-entering', 'is-in'); shown.push(c); }
          });
          shown.forEach((c, i) => {
            c.style.transitionDelay = `${i * 70}ms`;
            requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove('is-entering')));
          });
          setTimeout(() => shown.forEach((c) => { c.style.transitionDelay = ''; }), 1200);
        }, reduced ? 0 : 320);
        const grid = $('#menuGrid');
        const top = grid.getBoundingClientRect().top + window.scrollY - 200;
        if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  // FAQ accordion
  $$('.faq__item').forEach((item) => {
    const q = $('.faq__q', item);
    q.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      $$('.faq__item.is-open').forEach((o) => {
        o.classList.remove('is-open');
        $('.faq__q', o).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });

  // Quote slider (words rise in, fall out)
  const quotes = $$('.quote');
  if (quotes.length) {
    const dots = $$('.dot');
    let qi = 0, timer;
    const show = (i) => {
      quotes[qi].classList.remove('is-active');
      $('blockquote', quotes[qi]).classList.remove('is-in');
      dots[qi].classList.remove('is-active');
      qi = (i + quotes.length) % quotes.length;
      quotes[qi].classList.add('is-active');
      dots[qi].classList.add('is-active');
      setTimeout(() => $('blockquote', quotes[qi]).classList.add('is-in'), 350);
    };
    const autoplay = () => { clearInterval(timer); timer = setInterval(() => show(qi + 1), 7000); };
    dots.forEach((d, n) => d.addEventListener('click', () => {
      if (n === qi) return;
      d.querySelector('i').style.animation = 'none'; void d.offsetWidth; d.querySelector('i').style.animation = '';
      show(n); autoplay();
    }));
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      $('blockquote', quotes[0]).classList.add('is-in');
      autoplay();
      obs.disconnect();
    }, { threshold: 0.4 }).observe($('.quotes'));
  }

  // Stat counters
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now();
      const tick = (t) => {
        const p = reduced ? 1 : Math.min((t - t0) / 1800, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))).toLocaleString('en-US') + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counter.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('.stat__num').forEach((el) => counter.observe(el));

  // Opening hours: highlight today + live open/closed status
  // [open, close] in hours; null = closed. Index = Date#getDay() (0 = Sunday)
  const HOURS = [[12, 22], null, [17, 23], [17, 23], [17, 23], [17, 24], [17, 24]];
  const now = new Date();
  const today = HOURS[now.getDay()];
  const hourNow = now.getHours() + now.getMinutes() / 60;
  $$('.hours li[data-days]').forEach((li) => {
    if (li.dataset.days.split(',').map(Number).includes(now.getDay())) li.classList.add('is-today');
  });
  $$('.status').forEach((st) => {
    const open = today && hourNow >= today[0] && hourNow < today[1];
    st.classList.toggle('is-open', !!open);
    const text = $('.status__text', st);
    if (open) text.textContent = `Open now — kitchen until ${String(today[1] % 24).padStart(2, '0')}:00`;
    else if (today && hourNow < today[0]) text.textContent = `Closed — opens today at ${today[0]}:00`;
    else text.textContent = 'Closed now — see you tomorrow';
  });

  const flash = (el, text) => {
    el.textContent = text;
    el.classList.remove('is-new'); void el.offsetWidth; el.classList.add('is-new');
  };

  // Reservation form
  const form = $('#reserveForm');
  if (form) {
    const msg = $('#formMsg');
    const dateInput = $('#dateInput');
    const t = new Date();
    t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
    dateInput.min = t.toISOString().slice(0, 10);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let firstBad = null;
      $$('[required]', form).forEach((input) => {
        const ok = input.checkValidity() && input.value.trim() !== '';
        const field = input.closest('.field');
        field.classList.remove('is-invalid'); void field.offsetWidth;
        field.classList.toggle('is-invalid', !ok);
        if (!ok && !firstBad) firstBad = input;
      });
      if (firstBad) { flash(msg, 'Please fill in the highlighted fields.'); firstBad.focus(); return; }
      const data = new FormData(form);
      const d = new Date(data.get('date') + 'T00:00');
      if (d.getDay() === 1) {
        dateInput.closest('.field').classList.add('is-invalid');
        flash(msg, 'We’re closed on Mondays — please pick another day.');
        dateInput.focus();
        return;
      }
      const pretty = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      flash(msg, `Thank you, ${data.get('name').split(' ')[0]}. Table for ${data.get('guests')} on ${pretty} at ${data.get('time')} — we'll confirm by email shortly.`);
      form.reset();
    });
    form.addEventListener('input', (e) => {
      const field = e.target.closest('.field');
      if (field) field.classList.remove('is-invalid');
    });
  }

  // Newsletter
  const nl = $('#newsletter');
  if (nl) {
    const nlMsg = $('#nlMsg');
    nl.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#nlEmail');
      if (!input.checkValidity() || !input.value.trim()) { flash(nlMsg, 'Please enter a valid email address.'); input.focus(); return; }
      flash(nlMsg, 'You’re on the list. See you at the bar.');
      nl.reset();
    });
  }

  $$('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
