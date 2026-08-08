(function () {
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
  }

  function initFaq() {
    document.querySelectorAll('.faq-item').forEach((item) => {
      const btn = item.querySelector('.faq-q');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const open = item.classList.contains('open');
        item.parentElement.querySelectorAll('.faq-item.open').forEach((x) => x.classList.remove('open'));
        if (!open) item.classList.add('open');
      });
    });
  }

  const WEBSITE_WA_MESSAGES = {
    carrental: `Hello Onairo Solutions,\n\nI was exploring your Car Rental website demo and I'm interested in getting a similar website for my rent-a-car business.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    it: `Hello Onairo Solutions,\n\nI was exploring your IT Company website demo and I'm interested in getting a similar website for my software / technology business.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    dental: `Hello Onairo Solutions,\n\nI was exploring your Dental Clinic website demo and I'm interested in getting a similar website for my dental practice.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    travel: `Hello Onairo Solutions,\n\nI was exploring your Travel Agency website demo and I'd like a similar website for my travel business.\n\nCould you please share the available packages, features and delivery timeline?\n\nThank you.`,
    lawfirm: `Hello Onairo Solutions,\n\nI was exploring your Law Firm website demo and I'm interested in having a similar professional website built for my law firm.\n\nCould you please share the pricing, included features and estimated delivery time?\n\nThank you.`,
    gym: `Hello Onairo Solutions,\n\nI was exploring your Gym & Fitness website demo and I'm interested in getting a similar website for my gym.\n\nCould you please share pricing, included features and delivery time?\n\nThank you.`,
    restaurant: `Hello Onairo Solutions,\n\nI was exploring your Restaurant website demo and I'd like to get a similar website for my restaurant.\n\nCould you please provide pricing, features and delivery time?\n\nThank you.`,
    clinic: `Hello Onairo Solutions,\n\nI was exploring your Medical Clinic website demo and I'm interested in getting a similar website for my clinic.\n\nCould you please share more details about the package, pricing, included features and estimated delivery time?\n\nThank you.`,
    boutique: `Hello Onairo Solutions,\n\nI was exploring your Clothing Store website demo and I'm interested in getting a similar website for my boutique.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    salon: `Hello Onairo Solutions,\n\nI was exploring your Salon & Beauty website demo and I'm interested in getting a similar website for my business.\n\nCould you please share more details about the package, pricing, included features and estimated delivery time?\n\nThank you.`,
    realestate: `Hello Onairo Solutions,\n\nI was exploring your Real Estate website demo and I'm interested in getting a similar website for my agency.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    carshowroom: `Hello Onairo Solutions,\n\nI was exploring your Car Showroom website demo and I'm interested in getting a similar website for my dealership.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    menssalon: `Hello Onairo Solutions,\n\nI was exploring your Barber Shop website demo and I'm interested in getting a similar website for my barbershop.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
    construction: `Hello Onairo Solutions,\n\nI was exploring your Construction website demo and I'm interested in getting a similar website for my company.\n\nCould you please share more information about pricing, features and estimated delivery time?\n\nThank you.`,
    school: `Hello Onairo Solutions,\n\nI was exploring your School / Academy website demo and I'm interested in getting a similar website for my institution.\n\nCould you please share pricing, included features and estimated delivery time?\n\nThank you.`,
  };

  function initDelegatedActions() {
    if (document.body.dataset.onairoActionsBound === '1') return;
    document.body.dataset.onairoActionsBound = '1';

    document.addEventListener('click', (e) => {
      const demo = e.target.closest('.demo-link');
      if (demo) {
        e.preventDefault();
        const href = demo.getAttribute('href');
        const pageTransition = document.getElementById('pageTransition');
        if (pageTransition) pageTransition.classList.add('active');
        setTimeout(() => { window.location.href = href; }, pageTransition ? 450 : 0);
        return;
      }

      const getBtn = e.target.closest('.btn-get-website');
      if (getBtn) {
        const key = getBtn.dataset.website;
        const message = WEBSITE_WA_MESSAGES[key] || `Hello Onairo Solutions,\n\nI'm interested in getting a website similar to one of your demos.\n\nCould you please share pricing, features and delivery time?\n\nThank you.`;
        window.open(ONAIRO.waUrl(message), '_blank');
      }
    });
  }

  ONAIRO.observeReveals = function (root) {
    const scope = root || document;
    const els = scope.querySelectorAll ? scope.querySelectorAll('.reveal:not(.visible)') : [];
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
  };

  ONAIRO.renderPortfolioCards = function (container, items, limit) {
    if (!container) return;
    const list = typeof limit === 'number' ? items.slice(0, limit) : items;
    container.innerHTML = list.map((item) => {
      const thumb = (!item.thumb) ? '' : (item.thumb.startsWith('http') || item.thumb.startsWith('/')) ? item.thumb : ONAIRO.path(item.thumb);
      const thumbSmall = thumb.startsWith('http')
        ? thumb.replace(/([?&])w=\d+/, '$1w=480')
        : thumb;
      const thumbLarge = thumb.startsWith('http')
        ? thumb.replace(/([?&])w=\d+/, '$1w=800')
        : thumb;
      const waKey = item.waKey || item.id;
      const tags = (item.tags || []).map((t) => `<span>${t}</span>`).join('');
      const seo = (ONAIRO.portfolioSeo && ONAIRO.portfolioSeo[item.id]) || null;
      const seoHref = seo ? ONAIRO.path(`portfolio/${seo.slug}.html`) : '';
      const seoLink = seoHref
        ? `<a href="${seoHref}" class="btn btn-ghost btn-sm seo-page-link">SEO Page</a>`
        : '';
      const actions = item.comingSoon || !item.demo
        ? `<button type="button" class="btn btn-secondary btn-sm" disabled>Coming Soon</button>
           <a class="btn btn-ghost btn-sm" href="${ONAIRO.waUrl(`Hi Onairo Solutions, I'd like to be notified when the ${item.industry} demo launches.`)}">Notify Me</a>`
        : `<a href="${(item.demo && (item.demo.startsWith('/') || item.demo.startsWith('http'))) ? item.demo : ONAIRO.path(item.demo)}" class="btn btn-primary btn-sm demo-link">View Live Demo</a>
           <button type="button" class="btn btn-secondary btn-sm btn-get-website" data-website="${waKey}">Get This Website</button>
           ${seoLink}`;
      return `<article class="port-card reveal" data-category="${item.category}">
        <div class="port-thumb" style="--port-overlay:${item.overlay}">
          <img src="${thumbSmall}" srcset="${thumbSmall} 480w, ${thumbLarge} 800w" sizes="(max-width: 600px) 46vw, (max-width: 980px) 82vw, 33vw" width="800" height="450" alt="${item.industry} website design demo for ${item.name}" loading="lazy" decoding="async">
          <span class="port-badge">${item.badge}</span>
        </div>
        <div class="port-body">
          <div class="port-industry">${item.industry}</div>
          <h3>${seo ? `<a href="${seoHref}" style="color:inherit;text-decoration:none">${item.name}</a>` : item.name}</h3>
          <p>${item.description}</p>
          <div class="tech-tags">${tags}</div>
          <div class="port-actions">${actions}</div>
        </div>
      </article>`;
    }).join('');
  };

  ONAIRO.renderServiceCards = function (container, items, limit) {
    if (!container) return;
    const list = typeof limit === 'number' ? items.slice(0, limit) : items;
    container.innerHTML = list.map((svc) => {
      const href = ONAIRO.path(`services/detail.html?id=${svc.id}`);
      return `<article class="svc-card reveal" id="${svc.id}">
        <div class="svc-icon">${svc.icon}</div>
        <h3>${svc.title}</h3>
        <p>${svc.short}</p>
        <a class="btn btn-ghost btn-sm" href="${href}">Learn More →</a>
      </article>`;
    }).join('');
  };

  ONAIRO.renderProductCards = function (container, items) {
    if (!container) return;
    container.textContent = "";
    (items || []).forEach((prod) => {
      const isLive = prod.status === "live";
      const article = document.createElement("article");
      article.className = "product-card reveal";

      const shot = document.createElement("div");
      shot.className = "product-shot";
      const accent = typeof ONAIRO.safeColor === "function" ? ONAIRO.safeColor(prod.accent, "#2563EB") : "#2563EB";
      shot.style.background = `linear-gradient(135deg,#0e1525, ${accent}99 70%, ${accent})`;
      const mark = document.createElement("div");
      mark.className = "product-logo-mark";
      mark.textContent = String(prod.name || "");
      shot.appendChild(mark);

      const body = document.createElement("div");
      body.className = "product-body";

      const pill = document.createElement("span");
      pill.className = isLive ? "live-pill" : "coming-soon-pill";
      pill.textContent = isLive ? "Available" : "Coming Soon";
      body.appendChild(pill);

      const h3 = document.createElement("h3");
      h3.textContent = String(prod.name || "");
      body.appendChild(h3);

      const p = document.createElement("p");
      p.textContent = String(prod.description || "");
      body.appendChild(p);

      const ul = document.createElement("ul");
      ul.className = "feature-list";
      (prod.features || []).slice(0, 4).forEach((f) => {
        const li = document.createElement("li");
        li.textContent = String(f || "");
        ul.appendChild(li);
      });
      body.appendChild(ul);

      const actions = document.createElement("div");
      actions.className = "product-actions";
      const href =
        typeof ONAIRO.safeUrl === "function"
          ? ONAIRO.safeUrl(prod.href ? ONAIRO.path(prod.href) : "#", "#")
          : prod.href
            ? ONAIRO.path(prod.href)
            : "#";

      if (isLive) {
        const learn = document.createElement("a");
        learn.className = "btn btn-primary btn-sm";
        learn.href = href || "#";
        learn.textContent = "Learn More";
        actions.appendChild(learn);

        const download = document.createElement("a");
        download.className = "btn btn-secondary btn-sm";
        if (prod.downloadUrl) {
          download.href = prod.downloadUrl;
          download.setAttribute("download", "EduTrack-Setup.exe");
        } else {
          download.href = ONAIRO.waUrl(`Hi Onairo Solutions, I'd like to download the ${prod.name} trial.`);
        }
        download.textContent = "Download";
        actions.appendChild(download);

        const pricing = document.createElement("a");
        pricing.className = "btn btn-ghost btn-sm";
        pricing.href = `${href || "#"}#pricing`;
        pricing.textContent = "Pricing";
        actions.appendChild(pricing);
      } else {
        const soon = document.createElement("button");
        soon.className = "btn btn-secondary btn-sm";
        soon.type = "button";
        soon.disabled = true;
        soon.textContent = "Coming Soon";
        actions.appendChild(soon);

        const notify = document.createElement("a");
        notify.className = "btn btn-ghost btn-sm";
        notify.href = ONAIRO.waUrl(`Hi, notify me when ${prod.name} launches.`);
        notify.textContent = "Notify Me";
        actions.appendChild(notify);
      }
      body.appendChild(actions);

      article.appendChild(shot);
      article.appendChild(body);
      container.appendChild(article);
    });
  };

  ONAIRO.initPortfolioFilters = function (bar, grid) {
    if (!bar || !grid || !ONAIRO.portfolioFilters) return;
    bar.innerHTML = ONAIRO.portfolioFilters.map((f, i) =>
      `<button type="button" class="filter-btn${i === 0 ? ' active' : ''}" data-filter="${f.id}">${f.label}</button>`
    ).join('');

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      const items = filter === 'all'
        ? ONAIRO.portfolio
        : ONAIRO.portfolio.filter((p) => p.category === filter);
      ONAIRO.renderPortfolioCards(grid, items);
      ONAIRO.observeReveals(grid);
    });
  };

  const INDUSTRY_DEMOS = {
    gym: {
      brand: 'FORGE.',
      nav: 'Home　Programs　Coaches　Contact',
      navCta: 'Join now',
      kicker: 'TRAIN WITH PURPOSE',
      title: 'Stronger every day.',
      text: 'Coaching, community, and programs built around your goals.',
      cta: 'Start training',
      cards: ['Strength', 'Coaching', 'Community'],
      tablet: 'Train with purpose.',
      phoneKicker: 'MEMBERSHIP',
      phoneTitle: 'Built for progress.',
    },
    clinic: {
      brand: 'MEDCARE',
      nav: 'Home　Doctors　Services　Book',
      navCta: 'Book visit',
      kicker: 'PATIENT-FIRST CARE',
      title: 'Care that feels personal.',
      text: 'Appointments, doctors, and clinic information designed for trust.',
      cta: 'Book appointment',
      cards: ['Doctors', 'Services', 'Appointments'],
      tablet: 'Trusted local care.',
      phoneKicker: 'CLINIC',
      phoneTitle: 'Book in minutes.',
    },
    law: {
      brand: 'ASHFORD',
      nav: 'Home　Practice　Team　Contact',
      navCta: 'Consult',
      kicker: 'LEGAL CLARITY',
      title: 'Counsel you can trust.',
      text: 'A refined presence for law firms that need authority and approachability.',
      cta: 'Request consult',
      cards: ['Practice', 'Partners', 'Results'],
      tablet: 'Modern legal counsel.',
      phoneKicker: 'LAW FIRM',
      phoneTitle: 'Speak with counsel.',
    },
    restaurant: {
      brand: 'OLIVE & CO',
      nav: 'Home　Menu　Reserve　Story',
      navCta: 'Reserve',
      kicker: 'DINING EXPERIENCE',
      title: 'Tables worth remembering.',
      text: 'Menus, reservations, and ambience crafted for hungry visitors.',
      cta: 'View menu',
      cards: ['Menu', 'Reserve', 'Events'],
      tablet: 'Reserve tonight.',
      phoneKicker: 'RESTAURANT',
      phoneTitle: 'Book your table.',
    },
    travel: {
      brand: 'HORIZON',
      nav: 'Home　Tours　Destinations　Contact',
      navCta: 'Plan trip',
      kicker: 'TRAVEL BETTER',
      title: 'Journeys made simple.',
      text: 'Packages, destinations, and enquiry flows for travel agencies.',
      cta: 'Explore tours',
      cards: ['Tours', 'Deals', 'Guides'],
      tablet: 'Find your next trip.',
      phoneKicker: 'TRAVEL',
      phoneTitle: 'Plan with confidence.',
    },
    salon: {
      brand: 'LUMIÈRE',
      nav: 'Home　Services　Stylists　Book',
      navCta: 'Book now',
      kicker: 'BEAUTY & STYLE',
      title: 'Look effortlessly polished.',
      text: 'Service menus and booking paths designed for salon conversions.',
      cta: 'Book a visit',
      cards: ['Hair', 'Beauty', 'Spa'],
      tablet: 'Book your stylist.',
      phoneKicker: 'SALON',
      phoneTitle: 'Glow starts here.',
    },
    school: {
      brand: 'GREENFIELD',
      nav: 'Home　Admissions　Campus　Contact',
      navCta: 'Apply',
      kicker: 'EDUCATION',
      title: 'Learning that inspires.',
      text: 'Admissions-ready school websites with clarity for parents and students.',
      cta: 'View admissions',
      cards: ['Campus', 'Programs', 'Apply'],
      tablet: 'Admissions open.',
      phoneKicker: 'SCHOOL',
      phoneTitle: 'Start the journey.',
    },
    realestate: {
      brand: 'ATRIUM',
      nav: 'Home　Listings　Agents　Contact',
      navCta: 'Enquire',
      kicker: 'PROPERTY',
      title: 'Homes worth finding.',
      text: 'Listings, enquiry paths, and agent profiles for property businesses.',
      cta: 'Browse listings',
      cards: ['Listings', 'Agents', 'Areas'],
      tablet: 'Find your next home.',
      phoneKicker: 'REAL ESTATE',
      phoneTitle: 'Enquire instantly.',
    },
  };

  function animateCount(el) {
    if (!el || el.dataset.counted === '1') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || '';
    const decimals = Number(el.dataset.decimals || 0);
    const divisor = Number(el.dataset.divisor || 1);
    if (reduced || !target) {
      el.textContent = decimals
        ? `${(target / divisor).toFixed(decimals)}${suffix}`
        : `${target.toLocaleString()}${suffix}`;
      el.dataset.counted = '1';
      return;
    }
    const duration = 1100;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = target * eased;
      if (decimals) el.textContent = `${(value / divisor).toFixed(decimals)}${suffix}`;
      else if (suffix === 'M') el.textContent = `${(value / 1000000).toFixed(2)}M`;
      else el.textContent = `${Math.round(value).toLocaleString()}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
      else el.dataset.counted = '1';
    }
    requestAnimationFrame(frame);
  }

  function applyIndustryDemo(key) {
    const demo = INDUSTRY_DEMOS[key] || INDUSTRY_DEMOS.gym;
    const stage = document.querySelector('.launch-stage');
    if (!stage) return;
    stage.dataset.industry = key;
    stage.classList.add('is-switching');
    const map = {
      demoBrand: demo.brand,
      demoNavCta: demo.navCta,
      demoKicker: demo.kicker,
      demoTitle: demo.title,
      demoText: demo.text,
      demoCta: demo.cta,
      demoCard1: demo.cards[0],
      demoCard2: demo.cards[1],
      demoCard3: demo.cards[2],
      tabletBrand: demo.brand,
      tabletTitle: demo.tablet,
      phoneKicker: demo.phoneKicker,
      phoneTitle: demo.phoneTitle,
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
    const nav = document.querySelector('.demo-nav span');
    if (nav) nav.textContent = demo.nav;
    window.setTimeout(() => stage.classList.remove('is-switching'), 450);
  }

  ONAIRO.initPillarWorlds = function () {
    const stages = document.querySelectorAll('.build-stage, .launch-stage, .scale-stage');
    if (stages.length) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          entry.target.querySelectorAll('[data-count]').forEach(animateCount);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.22 });
      stages.forEach((stage) => obs.observe(stage));
    }

    const switcher = document.querySelector('.industry-switcher');
    if (switcher) {
      const buttons = [...switcher.querySelectorAll('[role="tab"][data-demo]')];
      const panel = document.getElementById('industry-demo-panel');
      let idx = Math.max(0, buttons.findIndex((button) => button.classList.contains('active')));
      let paused = false;

      function activateIndustryTab(btn, focusTab) {
        if (!btn) return;
        buttons.forEach((button) => {
          const selected = button === btn;
          button.classList.toggle('active', selected);
          button.setAttribute('aria-selected', String(selected));
          button.tabIndex = selected ? 0 : -1;
        });
        idx = buttons.indexOf(btn);
        if (panel) panel.setAttribute('aria-labelledby', btn.id);
        applyIndustryDemo(btn.dataset.demo);
        // Center the active chip inside its horizontal rail without moving the page.
        // Element.scrollIntoView() also scrolls vertical ancestors and previously
        // pulled visitors back to this pillar during automatic tab rotation.
        const switcherRect = switcher.getBoundingClientRect();
        const buttonRect = btn.getBoundingClientRect();
        const targetLeft =
          switcher.scrollLeft +
          (buttonRect.left - switcherRect.left) -
          (switcherRect.width - buttonRect.width) / 2;
        switcher.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: focusTab ? 'smooth' : 'auto',
        });
        if (focusTab) btn.focus();
      }

      switcher.addEventListener('click', (e) => {
        const btn = e.target.closest('[role="tab"][data-demo]');
        if (!btn) return;
        paused = true;
        activateIndustryTab(btn, false);
      });

      switcher.addEventListener('keydown', (e) => {
        const current = e.target.closest('[role="tab"]');
        if (!current) return;
        const currentIndex = buttons.indexOf(current);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
        else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        else if (e.key === 'Home') nextIndex = 0;
        else if (e.key === 'End') nextIndex = buttons.length - 1;
        else return;
        e.preventDefault();
        paused = true;
        activateIndustryTab(buttons[nextIndex], true);
      });

      switcher.addEventListener('pointerdown', () => { paused = true; });
      switcher.addEventListener('focusin', () => { paused = true; });
      switcher.addEventListener('pointerenter', () => { paused = true; });
      const desktopMotion = window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)');
      if (
        buttons.length &&
        desktopMotion.matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        window.setInterval(() => {
          if (paused || document.hidden) return;
          const stage = document.querySelector('.launch-stage');
          if (!stage) return;
          const rect = stage.getBoundingClientRect();
          const isCurrentlyVisible =
            rect.bottom > window.innerHeight * 0.2 &&
            rect.top < window.innerHeight * 0.8;
          if (!isCurrentlyVisible) return;
          idx = (idx + 1) % buttons.length;
          activateIndustryTab(buttons[idx], false);
        }, 5200);
      }
    }
  };

  function initLpMedia() {
    document.querySelectorAll("img.lp-media-fade").forEach((img) => {
      const mark = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth > 0) {
        mark();
        return;
      }
      img.addEventListener("load", mark, { once: true });
      img.addEventListener(
        "error",
        () => {
          mark();
          img.classList.add("is-broken");
        },
        { once: true }
      );
    });
  }

  function boot() {
    initReveal();
    initFaq();
    initDelegatedActions();
    initLpMedia();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
