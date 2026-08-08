/**
 * EduTrack interactive product chapters (5 chapters, 12 screens).
 */
(function (global) {
  'use strict';

  var ASSET = '../shared/assets/products/edutrack/';
  var WA = 'https://wa.me/923137863988';

  var CHAPTERS = [
    {
      id: 'management',
      label: 'School Management',
      features: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          slug: 'dashboard',
          kicker: 'Dashboard',
          title: 'Your whole campus at a glance',
          desc: 'Students, teachers, present/absent counts, weekly attendance, and monthly fee health — personalized for each principal account.',
          bullets: [
            'Live headcount and attendance widgets',
            'Fee pending, paid, and overdue totals',
            'Quick actions: enrol, attendance, payroll, broadcast',
            'Customizable layout with widget library',
          ],
        },
        {
          id: 'students',
          label: 'Students',
          slug: 'students',
          kicker: 'Students',
          title: 'Every student record, searchable and export-ready',
          desc: 'Manage 1,000+ students with class/section filters, guardian phones, family links, import/export, and clear Active status.',
          bullets: [
            'Search by name, roll, phone, or CNIC',
            'Import CSV/Excel and export reports',
            'List or block views for busy offices',
            'Fast enrol with Add Student',
          ],
        },
        {
          id: 'attendance',
          label: 'Attendance',
          slug: 'attendance',
          kicker: 'Attendance',
          title: 'Mark today\u2019s register in minutes, not periods',
          desc: 'Keyboard-driven attendance with Present, Absent, Late, and Informed — built for teachers who need speed without losing accuracy.',
          bullets: [
            'Class & section filters for today\u2019s register',
            'Shortcut keys for rapid marking',
            'Student and staff attendance modules',
            'Ready status when the day is live',
          ],
        },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      features: [
        {
          id: 'fee-dashboard',
          label: 'Fee Dashboard',
          slug: 'fee-dashboard',
          kicker: 'Fee Dashboard',
          title: 'Know exactly what\u2019s pending, paid, and overdue',
          desc: 'Colour-coded status cards, collection progress, and PKR totals so the accounts desk never guesses where money stands.',
          bullets: [
            'Pending, partial, paid, and overdue buckets',
            'Collected today / this month metrics',
            'Collection progress bar with billed vs collected',
            'Quick links to collect, generate, and outstanding',
          ],
        },
        {
          id: 'fee-collect',
          label: 'Fee Collection',
          slug: 'fee-collect',
          kicker: 'Fee Collection',
          title: 'Collect fees without hunting through sheets',
          desc: 'Search by name, roll number, or guardian phone — then collect against the monthly structures set at enrolment.',
          bullets: [
            'Collect, vouchers, generate, defaults, outstanding tabs',
            'Fast student lookup for the fee counter',
            'Monthly fee workflow designed for school cashiers',
            'Fewer calculation mistakes at peak hours',
          ],
        },
        {
          id: 'salary-slips',
          label: 'Salary Slips',
          slug: 'salary-slips',
          kicker: 'Salary Slips',
          title: 'Generate payroll documents that stay official forever',
          desc: 'Issue monthly salary slips with live preview, archive, bulk print, PDF/PNG export, and templates your school can brand.',
          bullets: [
            'Teacher search with employee IDs',
            'Preview, print & archive, download PDF',
            'Template designer for payroll layouts',
            'Issued slips keep original layout',
          ],
        },
      ],
    },
    {
      id: 'identity',
      label: 'School Identity',
      features: [
        {
          id: 'id-cards',
          label: 'ID Cards',
          slug: 'id-cards',
          kicker: 'ID Cards',
          title: 'Preview, print, and export student & teacher IDs',
          desc: 'Filter by class and section, select subjects, choose Front / Back / Both, and open the Template Designer for school-branded layouts.',
          bullets: [
            'Students & teachers card workflows',
            'Live preview before print',
            'Template library & settings',
            'CR80-ready professional prints',
          ],
        },
        {
          id: 'templates',
          label: 'Templates',
          slug: 'templates',
          kicker: 'Templates',
          title: 'Professional print templates for IDs and payroll',
          desc: 'Edit, duplicate, import, and export printable layouts — Student ID, Teacher ID, Salary Slip, and custom designs with CR80 and A4 support.',
          bullets: [
            'Template library with defaults',
            'Element counts and update history',
            'Advanced create/import/export on Professional',
            'Archive without losing issued documents',
          ],
        },
      ],
    },
    {
      id: 'smart-attendance',
      label: 'Smart Attendance',
      features: [
        {
          id: 'qr-scanner',
          label: 'QR Scanner',
          slug: 'qr-scanner',
          kicker: 'QR Scanner',
          title: 'Scan student IDs — mark Present instantly',
          desc: 'Use a camera or USB/2D barcode scanner. Attendance updates through the API with live connection status on your school LAN.',
          bullets: [
            'Camera or USB scanner input',
            'Torch, mute, and session controls',
            'Scan result + recent scans panel',
            'Desktop browser / LAN-friendly',
          ],
        },
        {
          id: 'kiosk',
          label: 'Kiosk Mode',
          slug: 'kiosk',
          kicker: 'Kiosk Mode',
          title: 'Fullscreen attendance for lobby TVs and tablets',
          desc: 'Launch a temporary kiosk session, scan from a second device, and watch updates land instantly over WebSocket — perfect for morning gates.',
          bullets: [
            'One-click Launch Kiosk',
            'Camera or USB input modes',
            'Pair with QR Scanner on another device',
            'Kiosk settings for display hardware',
          ],
        },
      ],
    },
    {
      id: 'comms',
      label: 'Communication & Analytics',
      features: [
        {
          id: 'broadcast',
          label: 'Broadcast',
          slug: 'broadcast',
          kicker: 'Broadcast',
          title: 'WhatsApp messaging that schools can control',
          desc: 'Compose broadcasts to the entire school or targeted audiences, preview before send, and keep queue, logs, and templates in one dashboard.',
          bullets: [
            'Audience and send-mode controls',
            'Preview before parents receive messages',
            'Queue, logs, and reusable templates',
            'Ends chaotic personal chat forwarding',
          ],
        },
        {
          id: 'reports',
          label: 'Reports',
          slug: 'reports',
          kicker: 'Reports',
          title: 'Analytics and exports leadership can trust',
          desc: 'Students, attendance, fees, payroll, teachers, academic, and activity reports — with PDF/Excel exports and filtered dashboards.',
          bullets: [
            'Campus summary cards in one place',
            'Open filtered reports with charts',
            'Export for boards and audits',
            'Fee outstanding vs collected visibility',
          ],
        },
      ],
    },
  ];

  function imgUrls(slug) {
    return {
      src640: ASSET + slug + '-640.png',
      src1024: ASSET + slug + '.png',
    };
  }

  function demoWaMessage(feature) {
    return (
      'Hi Onairo Solutions, I\u2019d like a live demo of EduTrack \u2014 interested in ' +
      feature.kicker +
      '.'
    );
  }

  function refreshWaLinks() {
    if (!window.ONAIRO || typeof ONAIRO.waUrl !== 'function') return;
    document.querySelectorAll('.et-wa[data-wa]').forEach(function (el) {
      el.setAttribute('href', ONAIRO.waUrl(el.getAttribute('data-wa')));
    });
  }

  function initEduTrackChapters() {
    var root = document.getElementById('etChapters');
    if (!root) return;

    var chapterNav = document.getElementById('etChapterNav');
    var pillNav = document.getElementById('etFeaturePills');
    var imgEl = document.getElementById('etChapterImg');
    var lbBtn = document.getElementById('etChapterLb');
    var preview = document.getElementById('etChapterPreview');
    var kicker = document.getElementById('etChapterKicker');
    var title = document.getElementById('etChapterTitle');
    var desc = document.getElementById('etChapterDesc');
    var bullets = document.getElementById('etChapterBullets');
    var detail = document.getElementById('etChapterDetail');
    var btnDemo = document.getElementById('etChapterDemo');

    if (!chapterNav || !pillNav || !imgEl || !lbBtn) return;

    var chapterIndex = 0;
    var featureIndex = 0;
    var animMs = 300;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function currentChapter() {
      return CHAPTERS[chapterIndex];
    }

    function currentFeature() {
      return currentChapter().features[featureIndex];
    }

    function renderChapterTabs() {
      chapterNav.innerHTML = '';
      CHAPTERS.forEach(function (ch, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'et-chapters__chapter' + (i === chapterIndex ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', i === chapterIndex ? 'true' : 'false');
        btn.id = 'et-ch-' + ch.id;
        btn.setAttribute('aria-controls', 'etChapterPanel');
        btn.textContent = ch.label;
        btn.addEventListener('click', function () {
          if (chapterIndex === i) return;
          chapterIndex = i;
          featureIndex = 0;
          renderChapterTabs();
          renderPills();
          applyFeature(true);
        });
        chapterNav.appendChild(btn);
      });
    }

    function renderPills() {
      pillNav.innerHTML = '';
      var ch = currentChapter();
      ch.features.forEach(function (feat, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'et-chapters__pill' + (i === featureIndex ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', i === featureIndex ? 'true' : 'false');
        btn.id = 'et-feature-' + feat.id;
        btn.setAttribute('aria-controls', 'etChapterPanel');
        btn.textContent = feat.label;
        btn.addEventListener('click', function () {
          if (featureIndex === i) return;
          featureIndex = i;
          renderPills();
          syncChapterTabActive();
          applyFeature(true);
        });
        pillNav.appendChild(btn);
      });
    }

    function syncChapterTabActive() {
      var tabs = chapterNav.querySelectorAll('.et-chapters__chapter');
      tabs.forEach(function (tab, i) {
        tab.classList.toggle('is-active', i === chapterIndex);
        tab.setAttribute('aria-selected', i === chapterIndex ? 'true' : 'false');
      });
    }

    function applyFeature(animate) {
      var feat = currentFeature();
      var urls = imgUrls(feat.slug);
      var alt = 'EduTrack ' + feat.kicker;

      function updateCopy() {
        kicker.textContent = feat.kicker;
        title.textContent = feat.title;
        desc.textContent = feat.desc;
        bullets.innerHTML = '';
        feat.bullets.forEach(function (text) {
          var li = document.createElement('li');
          li.textContent = text;
          bullets.appendChild(li);
        });
        btnDemo.href = WA;
        btnDemo.setAttribute('data-wa', demoWaMessage(feat));
        refreshWaLinks();
        lbBtn.setAttribute('data-src', urls.src1024);
        lbBtn.setAttribute('data-alt', alt);
        lbBtn.setAttribute(
          'aria-label',
          'View full-size screenshot: ' + feat.title
        );
      }

      function swapImage() {
        imgEl.src = urls.src640;
        imgEl.srcset =
          urls.src640 + ' 640w, ' + urls.src1024 + ' 1024w';
        imgEl.sizes = '(max-width: 719px) 90vw, min(1024px, 70vw)';
        imgEl.alt = alt;
        imgEl.width = 1024;
        imgEl.height = 640;
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';
      }

      if (!animate || reduceMotion) {
        swapImage();
        updateCopy();
        detail.classList.remove('is-animating');
        preview.classList.remove('is-animating');
        return;
      }

      preview.classList.add('is-animating');
      detail.classList.add('is-animating');

      window.setTimeout(function () {
        swapImage();
        updateCopy();
        preview.classList.remove('is-animating');
        detail.classList.add('is-entering');
        window.setTimeout(function () {
          detail.classList.remove('is-animating', 'is-entering');
        }, animMs);
      }, animMs * 0.45);
    }

    renderChapterTabs();
    renderPills();
    applyFeature(false);
    refreshWaLinks();

    /* keyboard: left/right for features within chapter */
    root.addEventListener('keydown', function (e) {
      if (e.target.closest('.et-lightbox')) return;
      var feats = currentChapter().features;
      if (e.key === 'ArrowRight') {
        featureIndex = (featureIndex + 1) % feats.length;
        renderPills();
        applyFeature(true);
      }
      if (e.key === 'ArrowLeft') {
        featureIndex = (featureIndex - 1 + feats.length) % feats.length;
        renderPills();
        applyFeature(true);
      }
    });
  }

  global.ET_CHAPTERS = CHAPTERS;
  global.initEduTrackChapters = initEduTrackChapters;
})(typeof window !== 'undefined' ? window : globalThis);
