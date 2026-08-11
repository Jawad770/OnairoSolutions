/**
 * Onairo SEO page registry — titles, descriptions, FAQ, breadcrumbs.
 * Used by seo.js to inject meta tags + JSON-LD.
 */
window.ONAIRO = window.ONAIRO || {};

ONAIRO.seoPages = {
  home: {
    title: 'Onairo Solutions | Website Development & Software Company',
    description: 'Premium website development, custom software, and EduTrack school management software worldwide. Build, showcase, and ship digital products.',
    path: '/',
    pathHtml: 'index.html',
    type: 'website',
    keywords: 'website development, software development, website design, EduTrack, custom software',
    breadcrumbs: [{ name: 'Home', path: '/' }],
    faqs: [
      { q: 'What does Onairo Solutions do?', a: 'Onairo Solutions is a technology company offering website development, custom software, business automation, AI integration, and commercial products like EduTrack.' },
      { q: 'Do you build websites for businesses worldwide?', a: 'Yes. We design and develop SEO-ready business websites for clinics, law firms, gyms, travel agencies, real estate, IT companies, and more — serving clients worldwide.' },
      { q: 'What is EduTrack?', a: 'EduTrack is our offline-first Windows school management software for attendance, fees, payroll, ID cards, reports, and parent communication.' },
      { q: 'How do I request a quote?', a: 'Use Request Quote or Contact Us. Enquiries are saved securely and our team responds with next steps, usually within one business day.' },
    ],
  },
  services: {
    title: 'Professional Website & Software Development Services | Onairo Solutions',
    description: 'Website development, custom software, AI integration, automation, and consulting from Onairo Solutions — built for businesses worldwide.',
    path: '/services/',
    pathHtml: 'services/index.html',
    type: 'website',
    keywords: 'website development services, custom software development, business automation, AI integration',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Services', path: '/services/' },
    ],
    faqs: [
      { q: 'Which services do you offer?', a: 'Website development, custom software, business automation, AI integration, cloud & hosting support, API development, UI/UX, consulting, and product engineering.' },
      { q: 'Can you redesign an existing website?', a: 'Yes. We modernize outdated sites with premium design, better conversion paths, mobile performance, and SEO foundations.' },
      { q: 'Do you build custom software for schools or businesses?', a: 'Yes. We build tailored systems and also offer EduTrack for schools that need ready-made school management software.' },
      { q: 'How long does a typical website project take?', a: 'Most business websites take 1–4 weeks depending on scope. Custom software timelines are scoped after discovery.' },
    ],
  },
  portfolio: {
    title: 'Website Design Portfolio | Onairo Solutions',
    description: 'Explore industry website showcases: dental clinics, law firms, gyms, travel agencies, real estate, restaurants, IT companies, and more by Onairo Solutions.',
    path: '/portfolio/',
    pathHtml: 'portfolio/index.html',
    type: 'website',
    keywords: 'website design portfolio, dental clinic website, law firm website, gym website, travel agency website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Portfolio', path: '/portfolio/' },
    ],
    faqs: [
      { q: 'Are portfolio showcases live examples?', a: 'Yes. Each showcase shows a complete industry website experience you can explore before requesting a custom build.' },
      { q: 'Can you customize a showcase for my brand?', a: 'Absolutely. Showcases are starting points — we adapt layout, branding, content, and features to your business.' },
      { q: 'Which industries do you cover?', a: 'Healthcare, legal, fitness, travel, hospitality, retail, education, construction, automotive, real estate, and professional services.' },
    ],
  },
  products: {
    title: 'Software Products | EduTrack & More | Onairo Solutions',
    description: 'Explore Onairo software products including EduTrack school management software and upcoming Track suite tools for growing businesses.',
    path: '/products/',
    pathHtml: 'products/index.html',
    type: 'website',
    keywords: 'software products, EduTrack, school management software, Track suite',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Products', path: '/products/' },
    ],
    faqs: [
      { q: 'What products does Onairo offer?', a: 'EduTrack is our flagship school management product. More Track suite products are coming for business operations.' },
      { q: 'Is EduTrack available for trial?', a: 'Yes. Schools can request a trial and live demo through the EduTrack product page.' },
    ],
  },
  edutrack: {
    title: 'EduTrack School Management Software | Offline School ERP',
    description: 'EduTrack is offline-first Windows school management software for attendance, fees, payroll, ID cards, QR check-in, and parent broadcasts worldwide.',
    path: '/products/edutrack.html',
    pathHtml: 'products/edutrack.html',
    type: 'product',
    keywords: 'school management software, offline school ERP, fee management software, QR attendance, school payroll software, ID card software',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Products', path: '/products/' },
      { name: 'EduTrack', path: '/products/edutrack.html' },
    ],
    faqs: [
      { q: 'Is EduTrack offline school management software?', a: 'Yes. EduTrack is Windows desktop software designed to run on your school PC with offline-first workflows and LAN support.' },
      { q: 'Does EduTrack handle fees and payroll?', a: 'Yes. It includes fee dashboards, collection workflows, salary slips, and related school office documents.' },
      { q: 'Can we use QR attendance?', a: 'Yes. EduTrack supports QR scanning and kiosk mode for fast morning check-in.' },
      { q: 'Is EduTrack suitable for schools worldwide?', a: 'Yes. It supports school office workflows including fees, class/section structures, WhatsApp broadcasts, and print-ready IDs.' },
    ],
  },
  about: {
    title: 'About Onairo Solutions | Global Technology Company',
    description: 'Learn about Onairo Solutions — a technology company building websites, custom software, and products like EduTrack for businesses worldwide.',
    path: '/pages/about.html',
    pathHtml: 'pages/about.html',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/pages/about.html' },
    ],
    faqs: [
      { q: 'Where does Onairo Solutions work?', a: 'Onairo Solutions serves clients worldwide through remote delivery, WhatsApp support, and professional project workflows.' },
    ],
  },
  pricing: {
    title: 'Website & Software Plans | Onairo Solutions',
    description: 'Explore Onairo website packages and EduTrack plans — features and fit by scope. Request a quote for a personalised proposal.',
    path: '/pages/pricing.html',
    pathHtml: 'pages/pricing.html',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Plans', path: '/pages/pricing.html' },
    ],
    faqs: [
      { q: 'Do you publish prices online?', a: 'No. We publish plan names and inclusions. Exact commercial terms are shared after a short discovery via Request Quote or WhatsApp.' },
      { q: 'What website plans do you offer?', a: 'Starter, Business, and Premium — differing by page count, design depth, and features. We recommend the best fit after understanding your goals.' },
    ],
  },
  blog: {
    title: 'Blog | Website Design, Software & EduTrack Insights | Onairo Solutions',
    description: 'SEO-friendly insights on website design, software development, school management, AI, SEO, and business growth from Onairo Solutions.',
    path: '/pages/blog.html',
    pathHtml: 'pages/blog.html',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/pages/blog.html' },
    ],
  },
  contact: {
    title: 'Contact Onairo Solutions | Website & Software Enquiries',
    description: 'Contact Onairo Solutions for website development, custom software, or EduTrack demos. Email, WhatsApp, or submit a secure enquiry.',
    path: '/pages/contact.html',
    pathHtml: 'pages/contact.html',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/pages/contact.html' },
    ],
    faqs: [
      { q: 'What is the fastest way to reach you?', a: 'WhatsApp is usually fastest for demos and plan discussions. You can also email hello@onairosolutions.com or use the contact form.' },
      { q: 'Do you respond across time zones?', a: 'We serve worldwide clients and typically reply within one business day — often sooner on WhatsApp.' },
    ],
  },
  quote: {
    title: 'Request a Quote | Website & Software Projects | Onairo Solutions',
    description: 'Request a quote for website development, EduTrack, or custom software. Share scope, budget, and files for a clear next step.',
    path: '/pages/request-quote.html',
    pathHtml: 'pages/request-quote.html',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Request Quote', path: '/pages/request-quote.html' },
    ],
  },
  industries: {
    title: 'Industry Website Design Onairo Solutions',
    description: 'Explore industry website landing pages for clinics, law firms, gyms, travel agencies, schools, real estate, and more.',
    path: '/industries/',
    pathHtml: 'industries/index.html',
    type: 'website',
    keywords: 'industry website design, dental clinic website, law firm website, school website design',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Industries', path: '/industries/' },
    ],
    faqs: [
      { q: 'Do you build industry-specific websites?', a: 'Yes. Each industry landing page targets a specific business type with tailored features, demos, and conversion paths.' },
      { q: 'Can I see a live showcase first?', a: 'Yes. Matching portfolio showcases are linked from every industry page so you can explore before requesting a custom build.' },
    ],
  },
  /* Individual service/industry landings set data-seo-* overrides; no hub FAQ injection */
  landing: {
    title: 'Onairo Solutions',
    description: 'Premium website and software solutions by Onairo Solutions.',
    path: '/',
    type: 'website',
    breadcrumbs: [{ name: 'Home', path: '/' }],
  },
};

ONAIRO.portfolioSeo = {
  gym: {
    slug: 'gym-website-design',
    title: 'Gym Website Design Fitness Website Showcase | Onairo Solutions',
    description: 'Premium gym and fitness website design with memberships, class schedules, trainers, and WhatsApp leads — by Onairo Solutions.',
    h1: 'Gym & Fitness Website Design',
    industryLabel: 'Gym Website',
  },
  lawfirm: {
    slug: 'law-firm-website-design',
    title: 'Law Firm Website Design Legal Website Showcase | Onairo Solutions',
    description: 'Professional law firm website design with practice areas, attorney profiles, case results, and consultation booking.',
    h1: 'Law Firm Website Design',
    industryLabel: 'Law Firm Website',
  },
  dental: {
    slug: 'dental-clinic-website-design',
    title: 'Dental Clinic Website Design Onairo Solutions',
    description: 'Luxury dental clinic website design with treatments, smile gallery, dentist profiles, and WhatsApp appointments.',
    h1: 'Dental Clinic Website Design',
    industryLabel: 'Dental Clinic Website',
  },
  carrental: {
    slug: 'rent-a-car-website-design',
    title: 'Rent A Car Website Design Car Rental Website | Onairo Solutions',
    description: 'Luxury rent-a-car website design with fleet filters, booking widgets, pricing, and WhatsApp reservations.',
    h1: 'Rent A Car Website Design',
    industryLabel: 'Car Rental Website',
  },
  school: {
    slug: 'school-website-design',
    title: 'School Website Design Education Website Showcase | Onairo Solutions',
    description: 'School website design with programs, faculty, admissions, events gallery, and WhatsApp enquiries.',
    h1: 'School Website Design',
    industryLabel: 'School Website',
  },
  crestwood: {
    slug: 'school-website-design',
    title: 'Crestwood Academy School Website | Onairo Solutions',
    description: 'Premium multi-page Crestwood Academy school website showcase with admissions, academics, faculty, news, and gallery.',
    h1: 'Crestwood Academy School Website',
    industryLabel: 'School Website',
  },
  it: {
    slug: 'it-company-website-design',
    title: 'IT Company Website Design Software Firm Website | Onairo Solutions',
    description: 'Modern IT company and SaaS website design with services, case studies, tech stack, and consultation forms.',
    h1: 'IT Company Website Design',
    industryLabel: 'IT Company Website',
  },
  carshowroom: {
    slug: 'car-showroom-website-design',
    title: 'Car Showroom Website Design | Dealership Website | Onairo Solutions',
    description: 'Premium car showroom website design with inventory grid, filters, and test-drive booking.',
    h1: 'Car Showroom Website Design',
    industryLabel: 'Car Showroom Website',
  },
  travel: {
    slug: 'travel-agency-website-design',
    title: 'Travel Agency Website Design Tour Website | Onairo Solutions',
    description: 'Cinematic travel agency website design with destinations, packages, offers, and WhatsApp trip planning.',
    h1: 'Travel Agency Website Design',
    industryLabel: 'Travel Agency Website',
  },
  boutique: {
    slug: 'clothing-store-website-design',
    title: 'Clothing Store Website Design | Boutique Website | Onairo Solutions',
    description: 'Fashion boutique website design with product gallery, collections, and WhatsApp ordering.',
    h1: 'Clothing Store Website Design',
    industryLabel: 'Boutique Website',
  },
  restaurant: {
    slug: 'restaurant-website-design',
    title: 'Restaurant Website Design Menu & Booking Site | Onairo Solutions',
    description: 'Restaurant website design with menus, gallery, location map, and WhatsApp table booking.',
    h1: 'Restaurant Website Design',
    industryLabel: 'Restaurant Website',
  },
  building: {
    slug: 'construction-company-website-design',
    title: 'Construction Company Website Design | Project Showcase | Onairo Solutions',
    description: 'Construction and real-estate project website design with progress, units, amenities, and developer portfolio.',
    h1: 'Construction Company Website Design',
    industryLabel: 'Construction Website',
  },
  salon: {
    slug: 'salon-website-design',
    title: 'Salon Website Design Beauty Salon Website | Onairo Solutions',
    description: 'Beauty salon website design with services, pricing, before/after gallery, and WhatsApp booking.',
    h1: 'Salon Website Design',
    industryLabel: 'Salon Website',
  },
  realestate: {
    slug: 'real-estate-website-design',
    title: 'Real Estate Website Design Property Listing Site | Onairo Solutions',
    description: 'Real estate agency website design with property listings, agents, and WhatsApp enquiries.',
    h1: 'Real Estate Website Design',
    industryLabel: 'Real Estate Website',
  },
  clinic: {
    slug: 'medical-clinic-website-design',
    title: 'Medical Clinic Website Design Doctor Website | Onairo Solutions',
    description: 'Medical clinic website design with doctor profiles, services, and WhatsApp appointment booking.',
    h1: 'Medical Clinic Website Design',
    industryLabel: 'Medical Clinic Website',
  },
  menssalon: {
    slug: 'barber-shop-website-design',
    title: 'Barber Shop Website Design | Mens Salon Website | Onairo Solutions',
    description: 'Modern barbershop website design with pricing, gallery, barber profiles, and WhatsApp booking.',
    h1: 'Barber Shop Website Design',
    industryLabel: 'Barber Shop Website',
  },
};
