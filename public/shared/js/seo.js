/**
 * Injects SEO meta tags, Open Graph, Twitter Cards, and JSON-LD schemas.
 * Requires: config.js, seo-data.js
 * Optional body attrs: data-page, data-seo-path, data-seo-title, data-seo-description
 */
(function () {
  if (!window.ONAIRO) return;

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function upsertJsonLd(id, data) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function pageKey() {
    return document.body?.dataset?.page || 'home';
  }

  function resolvePage() {
    const key = pageKey();
    const pages = ONAIRO.seoPages || {};
    const base = pages[key] || pages.home || {};
    const overrideTitle = document.body?.dataset?.seoTitle;
    const overrideDesc = document.body?.dataset?.seoDescription;
    const overridePath = document.body?.dataset?.seoPath;
    return {
      ...base,
      title: overrideTitle || base.title || document.title,
      description: overrideDesc || base.description || '',
      path: overridePath || base.path || '/',
    };
  }

  function abs(path) {
    return ONAIRO.absoluteUrl(String(path || '/').replace(/^\//, ''));
  }

  function organizationSchema() {
    const c = ONAIRO.config;
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: c.brand,
      url: c.siteUrl,
      logo: abs(c.logoPath.replace(/^\//, '')),
      email: c.email,
      sameAs: [
        'https://www.linkedin.com/',
        'https://www.instagram.com/',
        'https://www.facebook.com/',
        'https://x.com/',
      ],
      contactPoint: [{
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: c.email,
        telephone: '+' + c.waNumber,
        areaServed: ['PK', 'Worldwide'],
        availableLanguage: ['English', 'Urdu'],
      }],
    };
  }

  function websiteSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: ONAIRO.config.brand,
      url: ONAIRO.config.siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: abs('portfolio/index.html') + '?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    };
  }

  function localBusinessSchema() {
    const c = ONAIRO.config;
    return {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: c.brand,
      description: 'Website development, custom software, and school management software for businesses in Pakistan and worldwide.',
      url: c.siteUrl,
      logo: abs(c.logoPath.replace(/^\//, '')),
      image: abs(c.logoPath.replace(/^\//, '')),
      email: c.email,
      telephone: '+' + c.waNumber,
      areaServed: {
        '@type': 'Place',
        name: c.serviceArea,
      },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '10:00',
        closes: '19:00',
      }],
      priceRange: '$$',
    };
  }

  function breadcrumbSchema(crumbs) {
    if (!crumbs || !crumbs.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(function (c, i) {
        return {
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: abs(String(c.path || '/').replace(/^\//, '')),
        };
      }),
    };
  }

  function faqSchema(faqs) {
    if (!faqs || !faqs.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(function (f) {
        return {
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        };
      }),
    };
  }

  function serviceSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Website & Software Development',
      provider: { '@type': 'Organization', name: ONAIRO.config.brand },
      areaServed: 'Pakistan',
      serviceType: [
        'Website Development',
        'Website Design',
        'Custom Software Development',
        'Business Automation',
        'AI Integration',
      ],
      url: abs('services/index.html'),
    };
  }

  function edutrackSchemas() {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'EduTrack',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Windows',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'PKR',
          availability: 'https://schema.org/InStock',
        },
        description: 'Offline-first school management software for attendance, fees, payroll, ID cards, QR check-in, and parent communication.',
        url: abs('products/edutrack.html'),
        brand: { '@type': 'Brand', name: ONAIRO.config.brand },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'EduTrack School Management Software',
        description: 'Windows school ERP for Pakistani schools — fees, attendance, payroll, ID cards, and reports.',
        brand: { '@type': 'Brand', name: 'EduTrack' },
        category: 'School Management Software',
        url: abs('products/edutrack.html'),
      },
    ];
  }

  function injectAnalytics() {
    const id = ONAIRO.config.gaMeasurementId;
    if (!id) return;
    if (document.getElementById('ga4-lib')) return;
    const lib = document.createElement('script');
    lib.async = true;
    lib.id = 'ga4-lib';
    lib.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(lib);
    const inline = document.createElement('script');
    inline.id = 'ga4-config';
    inline.textContent =
      "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','" +
      id.replace(/'/g, '') +
      "');";
    document.head.appendChild(inline);
  }

  function enhanceImages() {
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
      if (!img.hasAttribute('fetchpriority')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  }

  function renderFaqSection(faqs) {
    if (!faqs || !faqs.length) return;
    if (document.getElementById('seoFaq')) return;
    if (document.querySelector('.faq-item') || document.getElementById('faq')) return;
    const section = document.createElement('section');
    section.className = 'section seo-faq';
    section.id = 'seoFaq';
    section.setAttribute('aria-label', 'Frequently asked questions');
    section.innerHTML =
      '<div class="container">' +
      '<div class="section-head center">' +
      '<p class="section-tag">FAQ</p>' +
      '<h2 class="section-title">Frequently asked questions</h2>' +
      '</div>' +
      '<div class="seo-faq-list">' +
      faqs
        .map(function (f, i) {
          return (
            '<details class="seo-faq-item"' +
            (i === 0 ? ' open' : '') +
            '><summary>' +
            f.q +
            '</summary><p>' +
            f.a +
            '</p></details>'
          );
        })
        .join('') +
      '</div></div>';
    const footer = document.getElementById('site-footer');
    if (footer) footer.parentNode.insertBefore(section, footer);
    else document.body.appendChild(section);
  }

  function apply() {
    const page = resolvePage();
    const url = abs(String(page.path || '/').replace(/^\//, ''));
    const title = page.title;
    const description = page.description;
    const image = abs('favicon.svg');

    if (title) document.title = title;
    upsertMeta('name', 'description', description);
    if (page.keywords) upsertMeta('name', 'keywords', page.keywords);
    upsertMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    upsertMeta('name', 'author', ONAIRO.config.brand);
    upsertMeta('name', 'theme-color', '#0A0F1E');
    if (ONAIRO.config.gscVerification && ONAIRO.config.gscVerification.indexOf('REPLACE_') !== 0) {
      upsertMeta('name', 'google-site-verification', ONAIRO.config.gscVerification);
    }

    upsertLink('canonical', url);

    upsertMeta('property', 'og:type', page.type === 'product' ? 'product' : 'website');
    upsertMeta('property', 'og:site_name', ONAIRO.config.brand);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:locale', ONAIRO.config.locale || 'en_PK');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);

    upsertJsonLd('ld-organization', organizationSchema());
    upsertJsonLd('ld-website', websiteSchema());
    upsertJsonLd('ld-localbusiness', localBusinessSchema());

    const crumbs = breadcrumbSchema(page.breadcrumbs);
    if (crumbs && pageKey() !== 'landing') upsertJsonLd('ld-breadcrumb', crumbs);

    const faq = faqSchema(page.faqs);
    if (faq && pageKey() !== 'landing') upsertJsonLd('ld-faq', faq);

    if (pageKey() === 'services') upsertJsonLd('ld-service', serviceSchema());
    if (pageKey() === 'edutrack') {
      const schemas = edutrackSchemas();
      upsertJsonLd('ld-software', schemas[0]);
      upsertJsonLd('ld-product', schemas[1]);
    }

    if (page.faqs && page.faqs.length && pageKey() !== 'landing') renderFaqSection(page.faqs);
    injectAnalytics();
    enhanceImages();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
