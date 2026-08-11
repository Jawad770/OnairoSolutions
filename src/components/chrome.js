(function () {
  const WA_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.449C18.24 1.245 15.24 0 12 0 5.373 0 0 5.373 0 12c0 2.117.554 4.185 1.606 6.001L0 24l6.155-1.587A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12 0-3.24-1.245-6.24-3.48-8.551zM12 22c-1.822 0-3.609-.489-5.17-1.412l-.37-.22-3.656.942.975-3.556-.24-.378A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2c2.654 0 5.15 1.034 7.025 2.914A9.88 9.88 0 0122 12c0 5.523-4.477 10-10 10zm5.476-7.44c-.3-.15-1.77-.873-2.044-.972-.274-.099-.473-.148-.672.149-.2.297-.772.972-.946 1.17-.174.198-.348.223-.648.074-.3-.149-1.266-.467-2.41-1.486-.89-.794-1.49-1.774-1.664-2.073-.174-.298-.018-.46.13-.608.134-.133.3-.348.45-.522.15-.174.199-.298.299-.497.1-.198.05-.372-.025-.521-.075-.15-.672-1.62-.92-2.217-.242-.582-.487-.503-.672-.513l-.573-.01c-.198 0-.522.074-.795.372-.274.297-1.043 1.02-1.043 2.487 0 1.466 1.069 2.885 1.219 3.083.15.198 2.105 3.21 5.1 4.502.714.308 1.271.492 1.706.63.716.227 1.368.195 1.884.118.574-.085 1.77-.723 2.02-1.421.248-.699.248-1.297.173-1.422-.074-.124-.273-.199-.572-.348z"/></svg>`;
  const MAIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`;
  const PHONE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>`;
  const CHEVRON = `<svg class="nav-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  const CLOSE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

  function logoSvg() {
    return `<div class="hex-logo" aria-hidden="true">
      <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="22,2 39,11.5 39,32.5 22,42 5,32.5 5,11.5" fill="rgba(37,99,235,0.12)" stroke="rgba(59,130,246,0.55)" stroke-width="1.2"/>
        <polygon class="hex-ring" points="22,4 37,12.5 37,31.5 22,40 7,31.5 7,12.5" fill="none" stroke="rgba(59,130,246,0.3)" stroke-width="0.8" stroke-dasharray="4 3"/>
        <polygon points="22,8 34,14.5 34,29.5 22,36 10,29.5 10,14.5" fill="rgba(37,99,235,0.08)" stroke="rgba(59,130,246,0.25)" stroke-width="0.7"/>
        <text x="22" y="22" text-anchor="middle" dominant-baseline="central" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="22" fill="url(#oGradNav)">O</text>
        <defs><linearGradient id="oGradNav" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#93C5FD"/><stop offset="100%" stop-color="#2563EB"/></linearGradient></defs>
        <circle cx="22" cy="2.5" r="1.5" fill="rgba(59,130,246,0.7)"/>
        <circle cx="38.5" cy="11.75" r="1.5" fill="rgba(59,130,246,0.5)"/>
        <circle cx="38.5" cy="32.25" r="1.5" fill="rgba(59,130,246,0.5)"/>
        <circle cx="22" cy="41.5" r="1.5" fill="rgba(59,130,246,0.7)"/>
        <circle cx="5.5" cy="32.25" r="1.5" fill="rgba(59,130,246,0.5)"/>
        <circle cx="5.5" cy="11.75" r="1.5" fill="rgba(59,130,246,0.5)"/>
      </svg>
    </div>`;
  }

  function isActive(active, ids) {
    return ids.indexOf(active) !== -1;
  }

  function linkItem(href, label, active, id) {
    const cls = active === id ? 'active' : '';
    return `<li><a href="${href}" class="${cls}" data-nav-id="${id}">${label}</a></li>`;
  }

  function navHtml(active) {
    const p = ONAIRO.path;
    const email = ONAIRO.config.email;
    const phone = '+92 327 234 0505';
    const phoneHref = 'tel:+923272340505';

    const desktopItems = [
      { id: 'home', label: 'Home', href: p('index.html') },
      { id: 'portfolio', label: 'Portfolio', href: p('portfolio/index.html') },
      { id: 'products', label: 'Products', href: p('products/index.html') },
      { id: 'services', label: 'Services', href: p('services/index.html') },
      { id: 'industries', label: 'Industries', href: p('industries/index.html') },
      { id: 'about', label: 'About', href: p('pages/about.html') },
      { id: 'blog', label: 'Blog', href: p('pages/blog.html') },
      { id: 'contact', label: 'Contact', href: p('pages/contact.html') },
      { id: 'quote', label: 'Request Quote', href: p('pages/request-quote.html'), cta: true },
    ];

    const exploreOpen = isActive(active, ['home', 'about', 'pricing', 'blog', 'contact', 'quote']);
    const servicesOpen = isActive(active, ['services']);
    const industriesOpen = isActive(active, ['industries']);
    const workOpen = isActive(active, ['portfolio', 'products']);

    return `<nav class="site-nav" id="siteNav" aria-label="Primary">
      <a href="${p('index.html')}" class="logo-wrap">
        ${logoSvg()}
        <div class="logo-text">ONAIRO<span>Solutions</span></div>
      </a>
      <button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="navDrawer">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links nav-links-desktop" id="navLinksDesktop">
        ${desktopItems.map((item) => {
          const cls = [
            item.cta ? 'nav-cta' : '',
            active === item.id ? 'active' : '',
          ].filter(Boolean).join(' ');
          return `<li><a href="${item.href}" class="${cls}">${item.label}</a></li>`;
        }).join('')}
      </ul>
    </nav>
      <div class="nav-drawer-backdrop" id="navBackdrop" hidden></div>
      <div class="nav-drawer" id="navDrawer" role="dialog" aria-modal="true" aria-label="Site navigation" hidden>
        <div class="nav-drawer-panel">
          <div class="nav-drawer-head">
            <div class="nav-drawer-brand">ONAIRO <span>Solutions</span></div>
            <button type="button" class="nav-drawer-close" id="navDrawerClose" aria-label="Close navigation">${CLOSE_ICON}</button>
          </div>
          <div class="nav-drawer-scroll" id="navDrawerScroll">
            <div class="nav-group ${exploreOpen ? 'open' : ''}">
              <button type="button" class="nav-group-toggle" aria-expanded="${exploreOpen}" aria-controls="navGroupExplore">
                Explore ${CHEVRON}
              </button>
              <ul class="nav-group-list" id="navGroupExplore">
                ${linkItem(p('index.html'), 'Home', active, 'home')}
                ${linkItem(p('pages/about.html'), 'About', active, 'about')}
                ${linkItem(p('pages/blog.html'), 'Blog', active, 'blog')}
                ${linkItem(p('pages/contact.html'), 'Contact', active, 'contact')}
              </ul>
            </div>
            <div class="nav-group ${servicesOpen ? 'open' : ''}">
              <button type="button" class="nav-group-toggle" aria-expanded="${servicesOpen}" aria-controls="navGroupServices">
                Services ${CHEVRON}
              </button>
              <ul class="nav-group-list" id="navGroupServices">
                ${linkItem(p('services/index.html'), 'All Services', active, 'services')}
                ${linkItem(p('services/website-development.html'), 'Website Development', active, 'services')}
                ${linkItem(p('services/software-development.html'), 'Custom Software', active, 'services')}
                ${linkItem(p('services/seo-services.html'), 'SEO Services', active, 'services')}
                ${linkItem(p('services/ai-solutions.html'), 'AI Solutions', active, 'services')}
              </ul>
            </div>
            <div class="nav-group ${industriesOpen ? 'open' : ''}">
              <button type="button" class="nav-group-toggle" aria-expanded="${industriesOpen}" aria-controls="navGroupIndustries">
                Industries ${CHEVRON}
              </button>
              <ul class="nav-group-list" id="navGroupIndustries">
                ${linkItem(p('industries/index.html'), 'All Industries', active, 'industries')}
                ${linkItem(p('industries/dental-clinic-website-design.html'), 'Dental Clinics', active, 'industries')}
                ${linkItem(p('industries/law-firm-website-design.html'), 'Law Firms', active, 'industries')}
                ${linkItem(p('industries/school-website-design.html'), 'Schools', active, 'industries')}
                ${linkItem(p('industries/restaurant-website-design.html'), 'Restaurants', active, 'industries')}
              </ul>
            </div>
            <div class="nav-group ${workOpen ? 'open' : ''}">
              <button type="button" class="nav-group-toggle" aria-expanded="${workOpen}" aria-controls="navGroupWork">
                Work & Products ${CHEVRON}
              </button>
              <ul class="nav-group-list" id="navGroupWork">
                ${linkItem(p('portfolio/index.html'), 'Portfolio', active, 'portfolio')}
                ${linkItem(p('products/index.html'), 'Products', active, 'products')}
                ${linkItem(p('products/edutrack.html'), 'EduTrack', active, 'products')}
              </ul>
            </div>
          </div>
          <div class="nav-drawer-foot">
            <a class="nav-cta" href="${p('pages/request-quote.html')}">Request Quote</a>
            <div class="nav-contact-row">
              <a href="${ONAIRO.waUrl()}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_ICON}<span>WhatsApp</span></a>
              <a href="mailto:${email}" aria-label="Email">${MAIL_ICON}<span>Email</span></a>
              <a href="${phoneHref}" aria-label="Call ${phone}">${PHONE_ICON}<span>Call</span></a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function footerHtml() {
    const p = ONAIRO.path;
    const y = ONAIRO.config.year;
    return `<footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="${p('index.html')}" class="logo-wrap">
              ${logoSvg()}
              <div class="logo-text">ONAIRO<span>Solutions</span></div>
            </a>
            <p>A technology company building premium services, industry websites, and commercial software products for businesses worldwide.</p>
            <div class="footer-social" aria-label="Social media">
              <a href="https://www.linkedin.com/" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Instagram">ig</a>
              <a href="https://www.facebook.com/" target="_blank" rel="noopener" aria-label="Facebook">fb</a>
              <a href="https://x.com/" target="_blank" rel="noopener" aria-label="X">x</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Quick Links</h4>
            <a href="${p('index.html')}">Home</a>
            <a href="${p('pages/about.html')}">About</a>
            <a href="${p('pages/blog.html')}">Blog</a>
            <a href="${p('pages/contact.html')}">Contact</a>
            <a href="${p('pages/careers.html')}">Careers</a>
            <a href="${p('pages/request-quote.html')}">Request Quote</a>
          </div>
          <div class="footer-col">
            <h4>Services</h4>
            <a href="${p('services/index.html')}">All Services</a>
            <a href="${p('services/website-development.html')}">Website Development</a>
            <a href="${p('services/software-development.html')}">Custom Software</a>
            <a href="${p('services/seo-services.html')}">SEO Services</a>
            <a href="${p('services/ai-solutions.html')}">AI Solutions</a>
          </div>
          <div class="footer-col">
            <h4>Industries & Products</h4>
            <a href="${p('industries/index.html')}">All Industries</a>
            <a href="${p('industries/dental-clinic-website-design.html')}">Dental Clinic Website</a>
            <a href="${p('industries/law-firm-website-design.html')}">Law Firm Website</a>
            <a href="${p('industries/school-website-design.html')}">School Website</a>
            <a href="${p('products/edutrack.html')}">EduTrack School Software</a>
          </div>
          <div class="footer-col">
            <h4>Newsletter</h4>
            <p style="color:var(--slate);font-size:0.88rem;margin-bottom:0.5rem;">Product updates and digital insights.</p>
            <form class="newsletter-form" id="newsletterForm" data-onairo-form="newsletter">
              <input type="email" name="email" placeholder="Your email" required aria-label="Email for newsletter" autocomplete="email"/>
              <button type="submit">Join</button>
            </form>
            <p id="newsletterMsg" style="color:var(--emerald);font-size:0.8rem;margin-top:0.6rem;display:none;">Thanks — you're on the list.</p>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${y} Onairo Solutions. All rights reserved.</p>
          <p><a href="mailto:${ONAIRO.config.email}">${ONAIRO.config.email}</a></p>
        </div>
      </div>
    </footer>`;
  }

  function waFloatHtml() {
    return `<a href="${ONAIRO.waUrl()}" class="wa-float" id="waFloat" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${WA_ICON}</a>`;
  }

  function ensureSanitize() {
    if (document.querySelector('script[data-sanitize]')) return;
    const s = document.createElement('script');
    s.src = ONAIRO.path('shared/js/sanitize.js');
    s.dataset.sanitize = '1';
    document.head.appendChild(s);
  }

  function ensureAiWidget() {
    if (document.querySelector('script[data-ai-widget]')) return;
    const s = document.createElement('script');
    s.src = ONAIRO.path('shared/js/ai-widget.js');
    s.defer = true;
    s.dataset.aiWidget = '1';
    document.body.appendChild(s);
  }

  function ensureFloatingDrag() {
    if (document.querySelector('script[data-floating-drag]')) return;
    const s = document.createElement('script');
    s.src = ONAIRO.path('shared/js/floating-drag.js');
    s.defer = true;
    s.dataset.floatingDrag = '1';
    document.body.appendChild(s);
  }

  function ensureCampaignClient() {
    if (document.querySelector('script[data-campaign-client]')) return;
    const s = document.createElement('script');
    s.src = ONAIRO.path('shared/js/campaign-client.js');
    s.defer = true;
    s.dataset.campaignClient = '1';
    document.body.appendChild(s);
  }

  function ensureSandboxBanner() {
    if (document.getElementById('onairo-sandbox-banner')) return;
    fetch('/api/catalog/items?channel=website', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.sandbox) return;
        const bar = document.createElement('div');
        bar.id = 'onairo-sandbox-banner';
        bar.setAttribute('data-nosnippet', '1');
        bar.style.cssText = 'position:sticky;top:0;z-index:10000;background:#f59e0b;color:#111;padding:8px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between;font:600 13px/1.3 system-ui,sans-serif';
        bar.innerHTML = '<span>SANDBOX PREVIEW — changes are not live on the public site</span><a href="/portal/catalog/sandbox" style="color:#111;text-decoration:underline">Exit to Sandbox</a>';
        document.body.insertBefore(bar, document.body.firstChild);
      })
      .catch(() => {});
  }

  function initMobileDrawer() {
    const nav = document.getElementById('siteNav');
    const toggle = document.getElementById('navToggle');
    const drawer = document.getElementById('navDrawer');
    const backdrop = document.getElementById('navBackdrop');
    const closeBtn = document.getElementById('navDrawerClose');
    if (!nav || !toggle || !drawer || !backdrop) return;

    let lastFocus = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;

    function focusable() {
      return Array.prototype.slice.call(
        drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    }

    function setOpen(open) {
      drawer.hidden = !open;
      backdrop.hidden = !open;
      drawer.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      nav.classList.toggle('drawer-open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');

      if (open) {
        lastFocus = document.activeElement;
        const items = focusable();
        (closeBtn || items[0] || drawer).focus();
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    function close() {
      setOpen(false);
    }

    function open() {
      setOpen(true);
    }

    toggle.addEventListener('click', () => {
      if (drawer.classList.contains('open')) close();
      else open();
    });
    closeBtn && closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });

    drawer.querySelectorAll('.nav-group-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.nav-group');
        if (!group) return;
        const willOpen = !group.classList.contains('open');
        group.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });

    document.addEventListener('keydown', (e) => {
      if (!drawer.classList.contains('open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    drawer.addEventListener('touchstart', (e) => {
      if (!e.touches[0]) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
    }, { passive: true });

    drawer.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
        touchDeltaX = dx;
        drawer.style.transform = `translateX(${Math.min(dx, drawer.offsetWidth)}px)`;
      }
    }, { passive: true });

    drawer.addEventListener('touchend', () => {
      drawer.style.transform = '';
      if (touchDeltaX > 80) close();
      touchDeltaX = 0;
    });
  }

  function initScrollAwareNav() {
    const nav = document.getElementById('siteNav');
    if (!nav) return;
    let lastY = window.scrollY || 0;
    let ticking = false;

    function update() {
      const y = window.scrollY || 0;
      nav.classList.toggle('scrolled', y > 12);
      const drawerOpen = nav.classList.contains('drawer-open');
      if (!drawerOpen) {
        if (y > 120 && y > lastY + 4) nav.classList.add('nav-hidden');
        else if (y < lastY - 4 || y < 40) nav.classList.remove('nav-hidden');
      } else {
        nav.classList.remove('nav-hidden');
      }
      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function mount() {
    const active = document.body.dataset.nav || document.body.dataset.page || 'home';
    const navMount = document.getElementById('site-nav');
    const footerMount = document.getElementById('site-footer');
    const chromeEnd = document.getElementById('site-chrome-end');

    if (navMount) navMount.outerHTML = navHtml(active);
    if (footerMount) footerMount.outerHTML = footerHtml();
    if (chromeEnd) chromeEnd.outerHTML = waFloatHtml() + '<div class="page-transition" id="pageTransition" aria-hidden="true"></div>';

    ensureSanitize();
    ensureAiWidget();
    ensureFloatingDrag();
    ensureCampaignClient();
    ensureSandboxBanner();
    initMobileDrawer();
    initScrollAwareNav();

    const form = document.getElementById('newsletterForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('newsletterMsg');
        const emailInput = form.querySelector('input[name="email"], input[type="email"]');
        const email = (emailInput && emailInput.value || '').trim();
        try {
          const res = await fetch('/api/newsletter/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, source: 'footer' }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Could not subscribe');
          if (msg) {
            msg.textContent = 'Thanks — you are subscribed.';
            msg.style.display = 'block';
          }
          form.reset();
        } catch (err) {
          if (msg) {
            msg.textContent = err.message || 'Could not subscribe right now.';
            msg.style.display = 'block';
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
