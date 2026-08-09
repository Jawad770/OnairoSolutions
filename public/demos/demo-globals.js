/**
 * Regional locale for Onairo demo sites.
 * HTML is authored in PKR / Pakistan — visitors see local currency & locations
 * based on timezone, browser language, and IP (same approach as the main site).
 */
(function (window) {
  'use strict';

  const DEFAULT_CURRENCY = 'USD';

  const CURRENCIES = {
    PKR: { locale: 'en-PK', region: 'pk', prefix: 'Rs.' },
    SAR: { locale: 'ar-SA', region: 'sa', prefix: 'SAR' },
    AED: { locale: 'ar-AE', region: 'ae', prefix: 'AED' },
    USD: { locale: 'en-US', region: 'us', prefix: 'USD' },
    GBP: { locale: 'en-GB', region: 'gb', prefix: 'GBP' },
    EUR: { locale: 'de-DE', region: 'eu', prefix: 'EUR' },
  };

  /** PKR per 1 unit of foreign currency (demo approximations). */
  const PKR_RATE = {
    PKR: 1,
    SAR: 75,
    AED: 76,
    USD: 280,
    GBP: 355,
    EUR: 300,
  };

  const COUNTRY_CURRENCY = {
    PK: 'PKR',
    US: 'USD',
    GB: 'GBP',
    SA: 'SAR',
    AE: 'AED',
    BH: 'SAR',
    KW: 'SAR',
    OM: 'SAR',
    QA: 'SAR',
    EG: 'AED',
    JO: 'AED',
    LB: 'AED',
    IQ: 'AED',
    SY: 'AED',
    YE: 'AED',
    PS: 'AED',
    LY: 'AED',
    TN: 'AED',
    MA: 'AED',
    DZ: 'AED',
    SD: 'AED',
    AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
    FI: 'EUR', FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR',
    LU: 'EUR', LV: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR',
    SK: 'EUR', HR: 'EUR', AD: 'EUR', MC: 'EUR', SM: 'EUR', VA: 'EUR',
  };

  const TIMEZONE_CURRENCY = {
    'Asia/Karachi': 'PKR',
    'Asia/Dubai': 'AED',
    'Asia/Riyadh': 'SAR',
    'Asia/Qatar': 'SAR',
    'Asia/Kuwait': 'SAR',
    'Asia/Bahrain': 'SAR',
    'Asia/Muscat': 'SAR',
    'Asia/Aden': 'SAR',
    'Asia/Baghdad': 'AED',
    'Asia/Beirut': 'AED',
    'Asia/Damascus': 'AED',
    'Asia/Amman': 'AED',
    'Asia/Gaza': 'AED',
    'Asia/Hebron': 'AED',
    'Asia/Jerusalem': 'AED',
    'Africa/Cairo': 'AED',
    'Africa/Tripoli': 'AED',
    'Africa/Khartoum': 'AED',
    'Europe/London': 'GBP',
    'Europe/Dublin': 'EUR',
    'America/New_York': 'USD',
    'America/Chicago': 'USD',
    'America/Denver': 'USD',
    'America/Los_Angeles': 'USD',
  };

  const pakCities = {
    restaurant: 'Lahore',
    clinic: 'Islamabad',
    boutique: 'Karachi',
    salon: 'Lahore',
    realestate: 'Karachi',
    carshowroom: 'Lahore',
    menssalon: 'Islamabad',
    building: 'Rawalpindi',
    school: 'Islamabad',
    gym: 'Lahore',
    lawfirm: 'Islamabad',
    travel: 'Lahore',
    dental: 'Lahore',
    it: 'Lahore',
    carrental: 'Lahore',
    'carshowroom-admin': 'Lahore',
  };

  const saCities = {
    restaurant: 'Riyadh',
    clinic: 'Jeddah',
    boutique: 'Jeddah',
    salon: 'Riyadh',
    realestate: 'Riyadh',
    carshowroom: 'Jeddah',
    menssalon: 'Dammam',
    building: 'Riyadh',
    school: 'Riyadh',
    gym: 'Riyadh',
    lawfirm: 'Riyadh',
    travel: 'Riyadh',
    dental: 'Riyadh',
    it: 'Riyadh',
    carrental: 'Riyadh',
    'carshowroom-admin': 'Jeddah',
  };

  const aeCities = {
    restaurant: 'Dubai',
    clinic: 'Dubai',
    boutique: 'Dubai',
    salon: 'Abu Dhabi',
    realestate: 'Dubai',
    carshowroom: 'Dubai',
    menssalon: 'Sharjah',
    building: 'Dubai',
    school: 'Abu Dhabi',
    gym: 'Dubai',
    lawfirm: 'Dubai',
    travel: 'Dubai',
    dental: 'Dubai',
    it: 'Dubai',
    carrental: 'Dubai',
    'carshowroom-admin': 'Dubai',
  };

  let activeCurrency = 'PKR';
  let textSnapshot = null;
  const localeChangeCallbacks = [];

  function getDemoKey() {
    const file = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    return file;
  }

  function getCityForCurrency(currency) {
    const key = getDemoKey();
    if (currency === 'SAR') return saCities[key] || 'Riyadh';
    if (currency === 'AED') return aeCities[key] || 'Dubai';
    return pakCities[key] || 'Lahore';
  }

  function getCity() {
    return getCityForCurrency(activeCurrency);
  }

  function currencyFromLocale() {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const lang of langs) {
      const l = (lang || '').toLowerCase();
      if (l.endsWith('-pk') || l === 'ur') return 'PKR';
      if (l.endsWith('-sa')) return 'SAR';
      if (l.endsWith('-ae')) return 'AED';
      if (l.endsWith('-gb')) return 'GBP';
      if (l.endsWith('-us')) return 'USD';
      if (/^ar-(bh|kw|om|qa|ye)/.test(l)) return 'SAR';
      if (/^ar-(eg|jo|lb|iq|sy|ps|ly|tn|ma|dz|sd)/.test(l)) return 'AED';
      if (/^(de|fr|it|es|nl|pt|fi|el|sk|sl|et|lv|lt|mt|cy|ie|at|be|lu|hr|ad)-/.test(l)) return 'EUR';
    }
    return null;
  }

  function currencyFromTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_CURRENCY[tz]) return TIMEZONE_CURRENCY[tz];
    if (tz.startsWith('Europe/') && !tz.includes('London')) {
      const euroZones = ['Berlin', 'Paris', 'Rome', 'Madrid', 'Amsterdam', 'Brussels', 'Vienna', 'Warsaw', 'Prague', 'Athens', 'Helsinki', 'Stockholm', 'Oslo', 'Copenhagen', 'Zurich', 'Lisbon', 'Bucharest', 'Budapest', 'Dublin'];
      if (euroZones.some((c) => tz.endsWith(c))) return 'EUR';
    }
    return null;
  }

  function currencyFromCountry(countryCode) {
    if (!countryCode) return null;
    return COUNTRY_CURRENCY[countryCode.toUpperCase()] || null;
  }

  function detectCurrency(countryCode) {
    return currencyFromCountry(countryCode)
      || currencyFromTimezone()
      || currencyFromLocale()
      || DEFAULT_CURRENCY;
  }

  function getCurrencyOverride() {
    const param = new URLSearchParams(location.search).get('currency');
    const code = param ? param.toUpperCase() : null;
    return code && CURRENCIES[code] ? code : null;
  }

  async function fetchCountryCode() {
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('geo timeout')), ms)),
      ]);

    const apis = [
      async () => {
        const res = await withTimeout(fetch('https://ipwho.is/'), 2500);
        const data = await res.json();
        return data.success ? data.country_code : null;
      },
      async () => {
        const res = await withTimeout(fetch('https://ipapi.co/json/'), 2500);
        const data = await res.json();
        return data.country_code || data.country || null;
      },
    ];
    for (const api of apis) {
      try {
        const code = await api();
        if (code) return code.toUpperCase();
      } catch (_) {}
    }
    return null;
  }

  /**
   * Restore visibility after bfcache Back/Forward and when window.load is delayed
   * by third-party images/maps (CSS fade / .reveal must not stay stuck at opacity 0).
   */
  function ensurePageVisible(forceReveals) {
    try {
      if (document.body) {
        document.body.style.opacity = '1';
        document.body.classList.add('loaded');
      }
      const loader = document.getElementById('loader');
      if (loader) {
        loader.classList.add('hide');
        loader.setAttribute('aria-hidden', 'true');
      }
      const reveals = document.querySelectorAll('.reveal');
      if (!reveals.length) return;
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      reveals.forEach((el) => {
        if (forceReveals || el.classList.contains('visible')) {
          el.classList.add('visible');
          return;
        }
        const rect = el.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < vh + 80) el.classList.add('visible');
      });
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    let visibilityScheduled = false;
    function scheduleEnsureVisible() {
      if (visibilityScheduled) return;
      visibilityScheduled = true;
      // Do not wait only on window.load — Unsplash/CSS backgrounds + maps can hang it.
      const run = () => ensurePageVisible(false);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(run, 80), { once: true });
      } else {
        setTimeout(run, 80);
      }
      window.addEventListener('load', () => setTimeout(run, 50), { once: true });
      // Hard fallback so the branded loader cannot cover the demo indefinitely.
      setTimeout(() => ensurePageVisible(true), 1800);
    }
    scheduleEnsureVisible();
    window.addEventListener('pageshow', (event) => {
      ensurePageVisible(!!event.persisted);
    });
    window.addEventListener('pagehide', () => ensurePageVisible(false));
  }

  function pkrToForeign(pkr, currency) {
    const rate = PKR_RATE[currency] || PKR_RATE.USD;
    return Math.max(1, Math.round(pkr / rate));
  }

  function formatIntl(amount, currency) {
    const locale = CURRENCIES[currency]?.locale || 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** Format a PKR amount for display — mirrors Rs./PKR style with SAR, AED, etc. */
  function formatFromPkr(pkr, currency) {
    if (currency === 'PKR') {
      if (pkr >= 10000000) return `Rs. ${(pkr / 10000000).toFixed(2).replace(/\.?0+$/, '')} Crore`;
      if (pkr >= 100000) return `Rs. ${Math.round(pkr / 100000)} Lac`;
      return `Rs. ${pkr.toLocaleString('en-PK')}`;
    }

    const prefix = CURRENCIES[currency]?.prefix || currency;
    const amount = pkrToForeign(pkr, currency);

    if (currency === 'SAR' || currency === 'AED') {
      if (pkr >= 10000000) {
        const major = (amount / 1000000).toFixed(2).replace(/\.?0+$/, '');
        return `${prefix} ${major}M`;
      }
      if (pkr >= 100000) return `${prefix} ${Math.round(amount / 1000)}K`;
      return `${prefix} ${amount.toLocaleString('en-SA')}`;
    }

    if (amount >= 1000000) return formatIntl(amount, currency);
    return formatIntl(amount, currency);
  }

  function captureSnapshot() {
    if (textSnapshot) return;
    textSnapshot = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      textSnapshot.push({ node: walker.currentNode, value: walker.currentNode.nodeValue });
    }
  }

  function restoreSnapshot() {
    if (!textSnapshot) return;
    textSnapshot.forEach(({ node, value }) => {
      if (node.isConnected) node.nodeValue = value;
    });
  }

  function buildLocationReplacements(currency) {
    const city = getCityForCurrency(currency);
    const replacements = [];

    if (currency === 'SAR') {
      replacements.push(
        [/\bLahore\b/g, city],
        [/\bKarachi\b/g, city],
        [/\bIslamabad\b/g, city],
        [/\bRawalpindi\b/g, city],
        [/Pakistan/g, 'Saudi Arabia'],
        [/All prices in PKR/g, 'All prices in SAR'],
        [/\+92\s/g, '+966 '],
        [/042-/g, '011-'],
        [/051-/g, '012-'],
        [/MM Alam Road, Gulberg III/g, 'King Fahd Road, Al Olaya'],
        [/MM Alam Road/g, 'King Fahd Road'],
        [/Gulberg III/g, 'Al Olaya'],
        [/Gulberg & DHA/g, 'Al Olaya & Al Malqa'],
        [/DHA Phase 6/g, 'Al Tahlia'],
        [/F-7 Markaz/g, 'Al Hamra'],
        [/F-7\/4/g, 'Al Rakah'],
        [/F-7/g, 'Al Hamra'],
        [/Johar Town/g, 'Al Nakheel'],
        [/Bahria Town Phase 8, Rawalpindi/g, 'Al Nakheel District, Riyadh'],
        [/Bahria Town Karachi/g, 'Al Narjis, Riyadh'],
        [/DHA · Bahria · Gulshan/g, 'Al Narjis · Al Malqa · King Fahd'],
        [/Clifton Block 9/g, 'Al Olaya District'],
        [/Gulshan, PECHS, Korangi/g, 'Al Olaya, Al Malqa, King Abdullah Financial District'],
        [/Meezan Bank, HBL, and UBL/g, 'Al Rajhi Bank, SNB, and Riyad Bank'],
        [/Education Boulevard, Sector B/g, 'King Abdullah Road, Al Malqa'],
        [/Khayaban-e-Iqbal/g, 'King Saud Street'],
        [/Lahori/g, city === 'Jeddah' ? 'Jeddawi' : 'Riyadhi'],
      );
    } else if (currency === 'AED') {
      replacements.push(
        [/\bLahore\b/g, city],
        [/\bKarachi\b/g, city],
        [/\bIslamabad\b/g, city],
        [/\bRawalpindi\b/g, city],
        [/Pakistan/g, 'UAE'],
        [/All prices in PKR/g, 'All prices in AED'],
        [/\+92\s/g, '+971 '],
        [/042-/g, '04-'],
        [/051-/g, '02-'],
        [/MM Alam Road, Gulberg III/g, 'Sheikh Zayed Road, Dubai Marina'],
        [/MM Alam Road/g, 'Sheikh Zayed Road'],
        [/Gulberg III/g, 'Dubai Marina'],
        [/Gulberg & DHA/g, 'Marina & JBR'],
        [/DHA Phase 6/g, 'Jumeirah'],
        [/F-7 Markaz/g, 'Al Wasl'],
        [/F-7\/4/g, 'Al Wasl'],
        [/F-7/g, 'Al Wasl'],
        [/Johar Town/g, 'Al Barsha'],
        [/Bahria Town Phase 8, Rawalpindi/g, 'Dubai Hills Estate'],
        [/Bahria Town Karachi/g, 'Arabian Ranches, Dubai'],
        [/DHA · Bahria · Gulshan/g, 'Marina · JBR · Downtown'],
        [/Clifton Block 9/g, 'Palm Jumeirah'],
        [/Education Boulevard, Sector B/g, 'Academic City, Dubai'],
        [/Khayaban-e-Iqbal/g, 'Al Rigga Street'],
        [/Lahori/g, 'Dubai'],
        [/Meezan Bank, HBL, and UBL/g, 'Emirates NBD, ADCB, and FAB'],
      );
    }

    return replacements;
  }

  function buildCurrencyReplacements(currency) {
    if (currency === 'PKR') return [];

    return [
      [/(\d+(?:\.\d+)?)\s*Crore/g, (_, n) => formatFromPkr(parseFloat(n) * 10000000, currency)],
      [/(\d+(?:,\d+)?)\s*Lac/g, (_, n) => formatFromPkr(parseFloat(n.replace(/,/g, '')) * 100000, currency)],
      [/Rs\.\s*(\d+)L\b/g, (_, n) => formatFromPkr(parseFloat(n) * 100000, currency)],
      [/(\d+)L\b/g, (_, n) => formatFromPkr(parseFloat(n) * 100000, currency)],
      [/Rs\.\s*([\d,]+)/g, (_, n) => formatFromPkr(parseInt(n.replace(/,/g, ''), 10), currency)],
      [/\bPKR\b/g, currency],
    ];
  }

  function buildReplacements(currency) {
    if (currency === 'PKR') return [];
    return [...buildLocationReplacements(currency), ...buildCurrencyReplacements(currency)];
  }

  function applyReplacements(text, replacements) {
    let out = text;
    for (const [pattern, replacement] of replacements) {
      out = typeof replacement === 'function'
        ? out.replace(pattern, replacement)
        : out.replace(pattern, replacement);
    }
    return out;
  }

  function walkAndLocalize(root, replacements) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const next = applyReplacements(node.nodeValue, replacements);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function applyLocale(currency) {
    if (!document.body) return;
    captureSnapshot();
    restoreSnapshot();

    activeCurrency = currency;
    const replacements = buildReplacements(currency);
    if (replacements.length) walkAndLocalize(document.body, replacements);

    document.documentElement.setAttribute('data-demo-locale', CURRENCIES[currency]?.region || currency.toLowerCase());
    document.documentElement.setAttribute('data-demo-currency', currency);
    localeChangeCallbacks.forEach((fn) => {
      try { fn(currency); } catch (_) {}
    });
  }

  function formatStoredPrice(price) {
    const lac = parseFloat(String(price).replace(/[^\d.]/g, ''));
    if (Number.isNaN(lac)) return String(price);
    if (activeCurrency === 'PKR') return `Rs. ${lac} Lac`;
    return formatFromPkr(lac * 100000, activeCurrency);
  }

  function onLocaleChange(fn) {
    localeChangeCallbacks.push(fn);
    return () => {
      const i = localeChangeCallbacks.indexOf(fn);
      if (i >= 0) localeChangeCallbacks.splice(i, 1);
    };
  }

  async function init() {
    if (!document.body) return activeCurrency;

    const override = getCurrencyOverride();
    let currency = override || detectCurrency(null);
    applyLocale(currency);

    if (!override) {
      try {
        const country = await fetchCountryCode();
        const ipCurrency = detectCurrency(country);
        if (ipCurrency !== currency) applyLocale(ipCurrency);
      } catch (_) {}
    }

    return activeCurrency;
  }

  window.DemoGlobals = {
    CURRENCIES,
    getCurrency: () => activeCurrency,
    getCity,
    getDemoKey,
    formatFromPkr,
    formatStoredPrice,
    onLocaleChange,
    detectCurrency,
    init,
    ensurePageVisible,
    get locale() {
      return {
        country: activeCurrency === 'SAR' ? 'Saudi Arabia' : activeCurrency === 'AED' ? 'UAE' : 'Pakistan',
        currencyCode: activeCurrency,
        symbol: CURRENCIES[activeCurrency]?.prefix || activeCurrency,
      };
    },
    formatPrice: (amount) => formatFromPkr(amount, activeCurrency),
    formatLacPrice: (lac) => formatFromPkr(lac * 100000, activeCurrency),
    pkrToSar: (pkr) => pkrToForeign(pkr, 'SAR'),
  };
})(window);
