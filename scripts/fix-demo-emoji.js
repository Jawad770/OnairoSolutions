/**
 * Fix UTF-8 emoji / punctuation corruption in portfolio demo HTML files.
 * Idempotent-ish: only replaces ?-placeholder icons and U+FFFD / known mojibake.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEMOS_DIR = path.join(__dirname, '..', 'src', 'portfolio', 'demos');

const DEMO_FILES = [
  'boutique.html',
  'building.html',
  'carrental.html',
  'carshowroom.html',
  'carshowroom-admin.html',
  'clinic.html',
  'dental.html',
  'gym.html',
  'hotel.html',
  'it.html',
  'lawfirm.html',
  'menssalon.html',
  'realestate.html',
  'restaurant.html',
  'salon.html',
  'school.html',
  'travel.html',
  'accounting.html',
];

/** Map feature / perfectFor / safety labels → emoji */
const LABEL_EMOJI = [
  [/dual\s*ac|climate\s*ac|^ac$|rear\s*ac/i, '❄️'],
  [/carplay|bluetooth|usb|app\s*control|android/i, '📱'],
  [/^nav$|navigation/i, '🗺️'],
  [/leather|sport\s*seats|premium\s*trim|comfort/i, '💺'],
  [/sunroof|glass\s*roof/i, '☀️'],
  [/^awd$/i, '🚗'],
  [/family|seats|tour\s*groups|group\s*tours/i, '👥'],
  [/safety|abs|airbags|ebd|esc|vsc|traction|stability|lane\s*assist|blind\s*spot|pre-collision|immobilizer|anti-theft|sentry|roll\s*hoops|child\s*seat|central\s*lock|3-point|toyota\s*safety/i, '🛡️'],
  [/airport/i, '✈️'],
  [/business|corporate/i, '💼'],
  [/wedding/i, '💍'],
  [/^vip$/i, '⭐'],
  [/weekend|events|open-air|northern\s*tours|highway/i, '🌴'],
  [/^ev$|efficient|hybrid|22\s*km|supercharge/i, '⚡'],
  [/convertible/i, '🏎️'],
  [/sport\+|sport\s*mode|sport\s*chrono|pdk|led/i, '🏎️'],
  [/burmester|bose|shaker|audio/i, '🔊'],
  [/autopilot|ota|keyless|smart\s*key/i, '🔑'],
  [/parking/i, '🅿️'],
  [/camera|360/i, '📷'],
];

/** Title / heading keywords → emoji (order matters: more specific first) */
const TITLE_EMOJI = [
  [/fully\s*insured|insurance/i, '🛡️'],
  [/airport/i, '✈️'],
  [/24\/7\s*support|support|hotline|emergency\s*contact|emergency\s*care|emergency\s*travel|emergency\s*dentistry/i, '🆘'],
  [/premium\s*fleet|fleet\s*swaps/i, '🚗'],
  [/digital\s*booking|secure\s*payments|bank\s*installments/i, '💳'],
  [/sanitized|detailed|vehicle\s*inspection/i, '✨'],
  [/unlimited|city\s*km|volume\s*pricing/i, '♾️'],
  [/chauffeur/i, '🤵'],
  [/gst\s*invoice/i, '📄'],
  [/wedding\s*cars|wedding/i, '💍'],
  [/corporate\s*package|corporate\s*law|business\s*law|business\s*automation/i, '💼'],
  [/roadside/i, '🛠️'],
  [/experienced\s*guides|guides/i, '🧭'],
  [/luxury\s*hotels|hotels/i, '🏨'],
  [/best\s*price|affordable/i, '💰'],
  [/\bvisa\b/i, '🛂'],
  [/invisalign|aligners?/i, '😁'],
  [/custom\s*itinerar|customized\s*tours/i, '🗺️'],
  [/travel\s*insurance/i, '🛡️'],
  [/destinations/i, '🌍'],
  [/happy\s*travelers|happy\s*clients/i, '😊'],
  [/customer\s*rating|google\s*rating|rating/i, '⭐'],
  [/family\s*discounts|family\s*friendly|family\s*law/i, '👨‍👩‍👧‍👦'],
  [/early\s*bird/i, '🐦'],
  [/sustainable/i, '🌿'],
  [/phone|call/i, '📞'],
  [/email|mail/i, '✉️'],
  [/address|location|office\s*address|clinic\s*address/i, '📍'],
  [/hours|opening|business\s*hours|office\s*hours|mon\b/i, '🕐'],
  [/parking/i, '🅿️'],
  [/members|community/i, '👥'],
  [/trainers|elite\s*trainers|personal\s*training/i, '🏋️'],
  [/24\/7\s*access|open\s*24/i, '🔓'],
  [/nutrition/i, '🥗'],
  [/modern\s*equipment|comfort\s*equipment|equipment/i, '💪'],
  [/website\s*development|web\s*application/i, '💻'],
  [/mobile\s*apps?/i, '📱'],
  [/ui\/ux|design/i, '🎨'],
  [/cloud/i, '☁️'],
  [/cybersecurity|cyber\s*law/i, '🔒'],
  [/ai\s*integration/i, '🤖'],
  [/api\s*development|erp|crm/i, '⚙️'],
  [/maintenance\s*&\s*support|maintenance/i, '🛠️'],
  [/cardiology|heart/i, '❤️'],
  [/pediatrics|children'?s\s*dentistry|child/i, '👶'],
  [/lab\s*tests|on-site\s*lab|pharmacy/i, '🧪'],
  [/dental|general\s*dentistry|general\s*medicine|braces|crowns|implants|veneers|whitening|root\s*canal|invisalign|smile|cosmetic\s*dentistry|laser\s*dentistry|pain-free|3d\s*scanner|cad\/cam|digital\s*x-ray|intraoral/i, '🦷'],
  [/experienced\s*dentists|latest\s*technology|flexible\s*appointments/i, '🦷'],
  [/pmdc|short\s*wait/i, '✅'],
  [/criminal\s*defense/i, '⚖️'],
  [/civil\s*litigation|litigation|strategic\s*representation/i, '⚖️'],
  [/intellectual\s*property/i, '💡'],
  [/employment|immigration|tax\s*law|confidential/i, '📋'],
  [/legal\s*aid|pro\s*bono|campus\s*outreach|ngo/i, '🤝'],
  [/award|top\s*tier|client\s*choice|excellence|cases\s*won|years\s*experience|experienced\s*attorneys|personal\s*attention|transparent|fast\s*response/i, '🏆'],
  [/verified\s*listings|legal\s*documentation|virtual\s*tours|whatsapp-first|transfer\s*&\s*docs/i, '🏠'],
  [/search/i, '🔍'],
  [/beds?/i, '🛏️'],
  [/baths?/i, '🛁'],
  [/sqft|sq\s*ft/i, '📐'],
  [/whatsapp|enquire/i, '💬'],
  [/browse\s*inventory/i, '🚗'],
  [/g\+12|tower|foundation|structure|cladding|complete/i, '🏗️'],
  [/bahria|rawalpindi|phase/i, '📍'],
  [/1,\s*2\s*&\s*3-bed|bed\s*units/i, '🏠'],
];

function emojiForLabel(label) {
  const t = String(label || '').trim();
  for (const [re, emoji] of LABEL_EMOJI) {
    if (re.test(t)) return emoji;
  }
  return '✨';
}

function emojiForTitle(title) {
  const t = String(title || '').trim();
  for (const [re, emoji] of TITLE_EMOJI) {
    if (re.test(t)) return emoji;
  }
  return '✨';
}

function isLikelyUrlQuery(s, index) {
  // Don't touch ? in URLs / query strings / wa.me links
  const before = s.slice(Math.max(0, index - 80), index);
  if (/\bhttps?:\/\/[^\s"'<>]*$/i.test(before)) return true;
  if (/wa\.me\/[^"'<>\s]*$/i.test(before)) return true;
  if (/[?&][a-z0-9_%=.-]*$/i.test(before) && /[=&]/.test(before.slice(-20))) return true;
  // CSS google fonts urls
  if (/fonts\.googleapis\.com[^\s"']*$/i.test(before)) return true;
  if (/unsplash\.com[^\s"']*$/i.test(before)) return true;
  return false;
}

function fixJsFeatureIcons(html) {
  return html.replace(
    /(\{\s*i:\s*)'(?:\?{1,12})'(\s*,\s*t:\s*)'([^']+)'/g,
    (full, pre, mid, label) => `${pre}'${emojiForLabel(label)}'${mid}'${label}'`
  );
}

function fixHtmlIconSlots(html) {
  // <div class="...icon...">??</div><h3>Title</h3>
  html = html.replace(
    /(<(?:div|span)[^>]*class="[^"]*(?:icon|ico|why-ico|c-ico|float-icon|service-icon|trust-icon|contact-icon|logo-mark|loader-smile|loader-plane|loader-scales)[^"]*"[^>]*>)\s*\?{1,12}\s*(<\/(?:div|span)>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 200);
      const m =
        after.match(/<(?:h3|h2|h4|strong|b)[^>]*>([^<]+)/i) ||
        after.match(/<div>\s*<(?:strong|b)[^>]*>([^<]+)/i);
      const title = m ? m[1].replace(/&amp;/g, '&') : '';
      return `${open}${emojiForTitle(title) || '✨'}${close}`;
    }
  );

  // hero-meta-item / trust / contact rows: ?? <strong>Title
  html = html.replace(
    /(<(?:div|span|li|p)[^>]*>)\s*\?{1,12}\s*(<(?:strong|b)[^>]*>)([^<]+)/gi,
    (full, open, strongOpen, title) => {
      if (/https?:|fonts\.|unsplash|wa\.me/i.test(open)) return full;
      return `${open}${emojiForTitle(title)} ${strongOpen}${title}`;
    }
  );

  // <span>?</span>Title or trust-card
  html = html.replace(
    /(<span>)\?{1,8}(<\/span>)(\s*)([^<]{2,60})/g,
    (full, open, close, sp, rest) => {
      const title = rest.trim().split(/[\n<]/)[0];
      return `${open}${emojiForTitle(title)}${close}${sp}${rest}`;
    }
  );

  // Contact / info lines: <p>?? text  or <strong>?? Location
  html = html.replace(
    /(<(?:p|li|strong|span)[^>]*>)\s*\?{1,12}\s+(?=[A-Za-z0-9+📍📞])/g,
    (full, open, offset, whole) => {
      if (isLikelyUrlQuery(whole, offset)) return full;
      const after = whole.slice(offset + full.length, offset + full.length + 80);
      let emoji = '✨';
      if (/phone|tel:|\+\d|042-|03\d/i.test(after) || /Phone/i.test(open + after)) emoji = '📞';
      else if (/mail|@/i.test(after)) emoji = '✉️';
      else if (/address|location|road|street|plot|shop|gulberg|islamabad|lahore|bahria/i.test(after))
        emoji = '📍';
      else if (/hour|mon|tue|wed|thu|fri|sat|sun|am|pm|closed/i.test(after)) emoji = '🕐';
      else if (/parking/i.test(after)) emoji = '🅿️';
      else if (/whatsapp|enquire/i.test(after)) emoji = '💬';
      else if (/search|browse/i.test(after)) emoji = '🔍';
      else emoji = emojiForTitle(after);
      return `${open}${emoji} `;
    }
  );

  // map placeholder lone ??
  html = html.replace(/(map-placeholder[^>]*>[\s\S]{0,40}<span>)\?{1,4}(<\/span>)/gi, '$1📍$2');

  // dental / brand logos that are just smile
  html = html.replace(/(loader-smile[^>]*>)\?{1,4}/gi, '$1😁');
  html = html.replace(/(logo-mark[^>]*>)\?{1,4}/gi, '$1🦷');
  html = html.replace(/(loader-plane[^>]*>)\?{1,4}/gi, '$1✈️');
  html = html.replace(/(loader-scales[^>]*>)\?{1,4}/gi, '$1⚖️');
  html = html.replace(/(logo-icon[^>]*>)\?{1,4}/gi, '$1🚗');

  return html;
}

function fixStarsAndBadges(html) {
  // Star rows that became ?????
  html = html.replace(/(<(?:div|span)[^>]*class="[^"]*stars[^"]*"[^>]*>)\?{3,6}(<\/)/gi, '$1★★★★★$2');
  html = html.replace(/(class="t-stars">)\?{3,6}/gi, '$1★★★★★');
  html = html.replace(/(class="stars">)\?{3,6}/gi, '$1★★★★★');

  // Badges
  html = html.replace(/\?{1,4}\s*Luxury Collection/g, '✨ Luxury Collection');
  html = html.replace(/\?{1,4}\s*Most Rented/g, '🔥 Most Rented');
  html = html.replace(/\?{1,12}\s*Family Discounts/g, '👨‍👩‍👧‍👦 Family Discounts');
  html = html.replace(/\?{1,4}\s*Early Bird/g, '🐦 Early Bird');

  // Weather / temperature
  html = html.replace(/(\?\?|\?)\s+(\d+)\uFFFD?C/g, '☀️ $2°C');
  html = html.replace(/(\?\?|\?)\s+(\d+)°C/g, '☀️ $2°C');
  html = html.replace(/textContent\s*=\s*'\?\?\s*'\s*\+/g, "textContent = '☀️ ' +");

  // Rating like 4.9?
  html = html.replace(/(\d\.\d)\?(<\/strong>|<)/g, '$1⭐$2');
  html = html.replace(/(>)(\d\.\d)\?(<\/)/g, '$1$2⭐$3');

  // Phase checkmarks in building
  html = html.replace(
    /(class="phase[^"]*"[^>]*>)\?\s*(Foundation|Structure|Cladding)/gi,
    '$1✓ $2'
  );

  // Car ticker bullets
  html = html.replace(/(ticker-inner[\s\S]*?<span>)\?(?=\s*[A-Za-z])/g, '$1•');
  html = html.replace(/(<span>)\?\s+(Toyota|Honda|Suzuki|Hyundai|Kia|MG|BMW|Mercedes)/g, '$1• $2');

  // Trust pills / hero badges with leading ?
  html = html.replace(/(trust-pill[^>]*>\s*<span>)\?\s*/gi, '$1⭐ ');
  html = html.replace(/(hero-badge[^>]*>)\?\s*/gi, '$1✨ ');
  html = html.replace(/(hero-badge[^>]*>)\?\?\s*/gi, '$1🚀 ');

  // Terminal lines
  html = html.replace(/(terminal-line[^>]*>)\?\s*/gi, '$1✓ ');

  // CTA arrows Explore Programs ?
  html = html.replace(/(Explore Programs)\s*\?/g, '$1 →');
  html = html.replace(/(Browse Inventory)\s*(<\/a>)/g, '🚗 Browse Inventory$2');

  return html;
}

function fixTravelLanguages(html) {
  html = html.replace(
    /(<option\s+value="ur">)\?{2,8}(<\/option>)/gi,
    '$1اردو$2'
  );
  html = html.replace(
    /(<option\s+value="ar">)\?{2,12}(<\/option>)/gi,
    '$1العربية$2'
  );
  return html;
}

function fixCssContentPlaceholders(html) {
  // Checkmarks in list ::before
  html = html.replace(
    /(li(?:\.yes)?::before\s*\{\s*content:\s*['"])\?(['"])/gi,
    '$1✓$2'
  );
  html = html.replace(
    /(\.pkg-card\s+li::before\s*\{\s*content:\s*['"])\?(['"])/gi,
    '$1✓$2'
  );
  // Process / journey arrows
  html = html.replace(
    /((?:process-step|journey-step|flow-step|piece)[^{]*::after\s*\{[^}]*content:\s*["'])\?(["'])/gi,
    '$1→$2'
  );
  // BA handle
  html = html.replace(
    /(\.ba-handle::after\s*\{[^}]*content:\s*['"])\?(['"])/gi,
    '$1↔$2'
  );
  // Cursor blink
  html = html.replace(
    /(\.cursor-blink::after\s*\{\s*content:\s*['"])\?(['"])/gi,
    '$1|$2'
  );
  // Badge dots / strip ornaments
  html = html.replace(
    /(\.badge-item::before\s*\{\s*content:\s*['"])\?(['"])/gi,
    '$1◆$2'
  );
  html = html.replace(
    /(uc-strip::(?:before|after)\s*\{\s*content:\s*['"])\?(['"])/gi,
    '$1•$2'
  );
  // IG overlay
  html = html.replace(
    /(\.ig-item::after\s*\{[^}]*content:\s*['"])\?(['"])/gi,
    '$1📷$2'
  );
  return html;
}

function fixFffdSafe(html) {
  // Multi-pass contextual FFFD fixes without collapsing all whitespace

  html = html.replace(/\uFFFD\s*(20\d{2})/g, '© $1');

  html = html.replace(/([A-Za-z])\uFFFD([a-z]{1,3})\b/g, "$1'$2");

  html = html.replace(/(\d)\uFFFD(?=C\b| Camera| View)/g, '$1°');
  html = html.replace(/(\d)\uFFFD(C\b)/g, '$1°$2');

  html = html.replace(/(aria-label="Close[^"]*"[^>]*>)\uFFFD(<\/button>)/gi, '$1×$2');
  html = html.replace(/(class="[^"]*close[^"]*"[^>]*>)\uFFFD(<\/button>)/gi, '$1×$2');

  html = html.replace(/(aria-label="Previous[^"]*"[^>]*>)\uFFFD(<\/button>)/gi, '$1‹$2');
  html = html.replace(/(aria-label="Next[^"]*"[^>]*>)\uFFFD(<\/button>)/gi, '$1›$2');
  html = html.replace(/((?:gallery|spin|lightbox)-nav[^>]*prev[^>]*>)\uFFFD/gi, (m) =>
    m.replace(/\uFFFD/, '‹')
  );
  html = html.replace(/((?:gallery|spin|lightbox)-nav[^>]*next[^>]*>)\uFFFD/gi, (m) =>
    m.replace(/\uFFFD/, '›')
  );

  html = html.replace(/(Select)\uFFFD(<\/)/g, '$1…$2');
  html = html.replace(/(requests|Select)\uFFFD/g, '$1…');

  html = html.replace(/(id="detailEstimate"[^>]*>)\uFFFD(<\/)/g, '$1—$2');
  html = html.replace(/(id="detailMobilePrice"[^>]*>)\uFFFD(<\/)/g, '$1—$2');

  html = html.replace(/(\d{2})\uFFFD(\d{2}\b)/g, '$1–$2');

  html = html.replace(
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Friday|Saturday|Sunday)\uFFFD(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sunday|Friday)/gi,
    '$1–$2'
  );
  html = html.replace(/\b(AM|PM)\s*\uFFFD\s*(?=\d)/gi, '$1 – ');
  html = html.replace(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*\uFFFD\s*(?=\d)/gi, '$1 – ');

  html = html.replace(/\b(XS|S|M|L|XL)\uFFFD(?=S|M|L|XL|\d)/g, '$1 – ');

  // Quotes in testimonials / blockquotes
  html = html.replace(/(<(?:p|blockquote)[^>]*>)\uFFFD/g, '$1“');
  html = html.replace(/\uFFFD(<\/(?:p|blockquote)>)/g, '”$1');
  // Closing quote before period end inside tags: own.�</
  html = html.replace(/([.!?])\uFFFD(<\/)/g, '$1”$2');

  // Em dash attribution / separators (default for remaining letter-FFFD-letter word boundaries)
  html = html.replace(/([A-Za-z0-9.)])\s*\uFFFD\s*([A-Za-z0-9])/g, '$1 — $2');

  // Any leftover FFFD → em dash
  html = html.replace(/\uFFFD/g, '—');

  return html;
}

function fixRealEstateSpecs(html) {
  html = html.replace(/(class="spec">)\?{1,4}\s*(<strong>\d+<\/strong>\s*Beds)/gi, '$1🛏️ $2');
  html = html.replace(/(class="spec">)\?{1,4}\s*(<strong>\d+<\/strong>\s*Baths)/gi, '$1🛁 $2');
  html = html.replace(/(class="spec">)\?{1,4}\s*(<strong>[\d,]+<\/strong>\s*sqft)/gi, '$1📐 $2');
  html = html.replace(/(class="spec">)\?{1,4}\s*(<strong>\d+<\/strong>\s*Parking)/gi, '$1🅿️ $2');
  html = html.replace(/(search-btn[^>]*>)\?{1,4}\s*/gi, '$1🔍 ');
  html = html.replace(/(listing-wa[^>]*>)\?{1,4}\s*/gi, '$1💬 ');
  html = html.replace(/(btn-red[^>]*>)\?{1,4}\s*/gi, '$1🚗 ');
  html = html.replace(/(btn-outline[^>]*id="heroWa"[^>]*>)\?{1,4}\s*/gi, '$1💬 ');
  html = html.replace(/(id="heroWa"[^>]*>)\?{1,4}\s*/gi, '$1💬 ');
  return html;
}

function fixSchoolContact(html) {
  html = html.replace(/(href="tel:[^"]*">)\?{1,4}\s*/gi, '$1📞 ');
  html = html.replace(/(href="mailto:[^"]*">)\?\s*/gi, '$1✉️ ');
  return html;
}

function fixLeftovers(html) {
  // WhatsApp / enquire / waitlist CTAs
  html = html.replace(/\?{1,4}\s*(Enquire(?:\s+on)?\s+WhatsApp)/gi, '💬 $1');
  html = html.replace(/\?{1,4}\s*(WhatsApp\s+\w+)/gi, '💬 $1');
  html = html.replace(/\?{1,4}\s*(Enquire)\b/gi, '💬 $1');
  html = html.replace(/\?{1,4}\s*(Join Waitlist)/gi, '📋 $1');

  // Empty inventory placeholder
  html = html.replace(
    /(<div[^>]*style="[^"]*font-size:\s*3rem[^"]*"[^>]*>)\?{1,4}(<\/div>)/gi,
    '$1🚗$2'
  );
  html = html.replace(/(No cars in inventory[\s\S]{0,80}?>)\?{1,4}(<\/div>)/gi, '$1🚗$2');
  html = html.replace(
    /(margin-bottom:\.5rem">)\?{1,4}(<\/div>\s*\n\s*No cars)/gi,
    '$1🚗$2'
  );

  // Dental / gym emoji slots by following heading
  html = html.replace(
    /(<(?:div|span)[^>]*class="[^"]*(?:emoji|supp-emoji|challenge-emoji|treat-ico)[^"]*"[^>]*>)\s*\?{1,8}\s*(<\/(?:div|span)>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 160);
      const m = after.match(/<(?:h3|strong)[^>]*>([^<]+)/i);
      const title = m ? m[1] : '';
      let emoji = emojiForTitle(title);
      if (/whey|protein/i.test(title)) emoji = '🥛';
      else if (/pre-?workout/i.test(title)) emoji = '⚡';
      else if (/creatine/i.test(title)) emoji = '💪';
      else if (/omega|vitamin/i.test(title)) emoji = '💊';
      else if (/shred|fat/i.test(title)) emoji = '🔥';
      else if (/100k|club|volume/i.test(title)) emoji = '🏋️';
      else if (/dawn|patrol|am\b/i.test(title)) emoji = '🌅';
      else if (/smile|consult/i.test(title)) emoji = '😁';
      return `${open}${emoji}${close}`;
    }
  );

  // Resource / award headings with leading ??
  html = html.replace(/(<h3>)\?{1,4}\s*(Download)/gi, '$1📄 $2');
  html = html.replace(/(<h3>)\?{1,4}\s*(Virtual Clinic Tour)/gi, '$1🏥 $2');
  html = html.replace(/(<h3>)\?{1,4}\s*(Oral Health)/gi, '$1📰 $2');
  html = html.replace(/(<h3>)\?{1,4}\s*(Top Dental)/gi, '$1🏆 $2');
  html = html.replace(/(<h3>)\?{1,4}\s*/g, (full, open, offset, whole) => {
    const after = whole.slice(offset + full.length, offset + full.length + 60);
    return `${open}${emojiForTitle(after)} `;
  });

  // Duration clocks
  html = html.replace(/(class="treat-dur">)\?\s*/gi, '$1🕐 ');

  // Zoom / expand buttons
  html = html.replace(/(class="ba-zoom"[^>]*>)\?(<\/button>)/gi, '$1🔍$2');

  // Star spans inside aria-label="5 stars"
  html = html.replace(
    /(aria-label="5 stars">)(?:<span>\?<\/span>){5}/gi,
    '$1<span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>'
  );
  html = html.replace(
    /(class="stars"[^>]*>)(?:<span>\?<\/span>){5}/gi,
    '$1<span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>'
  );

  // IT office location flags (were 4-byte flag emoji → ????)
  html = html.replace(/(<div class="glass-card">)\?{2,8}\s*(Lahore HQ)/gi, '$1🇵🇰 $2');
  html = html.replace(/(<div class="glass-card">)\?{2,8}\s*(Dubai)/gi, '$1🇦🇪 $2');
  html = html.replace(/(<div class="glass-card">)\?{2,8}\s*(Riyadh)/gi, '$1🇸🇦 $2');
  html = html.replace(/(<div class="glass-card">)\?{2,8}\s*(London)/gi, '$1🇬🇧 $2');
  html = html.replace(/(<div class="glass-card">)\?{2,8}\s*(Austin)/gi, '$1🇺🇸 $2');

  // Number ranges wrongly turned into em dashes (avoid time strings like 8:30 AM — 5:30)
  html = html.replace(/(?<![:\d])(\d{1,2})\s*—\s*(\d{1,2})(?!\d|:)/g, '$1–$2');
  html = html.replace(
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Friday)\s*—\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sunday|Friday)\b/gi,
    '$1–$2'
  );

  // Correct false-positive Invisalign → visa passport emoji
  html = html.replace(
    /(treat-ico">)🛂(<\/div><h3>Invisalign)/gi,
    '$1😁$2'
  );

  // Accented place names that became letter — letter via FFFD
  html = html.replace(/Mal\s*—\s*Atoll/g, 'Malé Atoll');
  html = html.replace(/G\s*—\s*reme/g, 'Göreme');
  html = html.replace(/caf\s*—\s*culture/gi, 'café culture');

  // Star ratings in package lists: 4? Hotel → 4★ Hotel
  html = html.replace(/(\d)\?\s+(Hotel|Water|Family|Resort|Star)/gi, '$1★ $2');

  // Back to top
  html = html.replace(/(aria-label="Back to top">)\?(<\/a>)/gi, '$1↑$2');

  // Plane decoration
  html = html.replace(/(class="plane-fly"[^>]*>)\?(<\/div>)/gi, '$1✈️$2');

  // Social icons
  html = html.replace(/(aria-label="YouTube">)\?(<\/a>)/gi, '$1▶$2');
  html = html.replace(/(aria-label="TikTok">)\?(<\/a>)/gi, '$1♪$2');
  html = html.replace(/(aria-label="Instagram">)\?(<\/a>)/gi, '$1IG$2');
  html = html.replace(/(aria-label="Twitter">)\?(<\/a>)/gi, '$1𝕏$2');
  html = html.replace(/(aria-label="Facebook">)\?(<\/a>)/gi, '$1f$2');

  // Building availability dots
  html = html.replace(/(class="avail(?:-few)?">)\?(<\/span>)/gi, '$1●$2');

  // App store buttons
  html = html.replace(
    /(store-btn[^>]*>\s*<span>)\?(<\/span>\s*<div>\s*<small>Download on the)/gi,
    '$1$2'
  );
  html = html.replace(
    /(store-btn[^>]*>\s*<span>)\?(<\/span>\s*<div>\s*<small>Get it on)/gi,
    '$1▶$2'
  );

  // Car rental JS rating stars
  html = html.replace(
    /vehicle-rating">\?\s*'\s*\+\s*v\.rating/g,
    "vehicle-rating\">⭐ ' + v.rating"
  );
  html = html.replace(
    /var stars = '\?'\.repeat\(r\.rating\) \+ '\?'\.repeat\(5 - r\./g,
    "var stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r."
  );
  // also template form
  html = html.replace(
    /stars = '\?'\.repeat\(([^)]+)\) \+ '\?'\.repeat\(/g,
    "stars = '★'.repeat($1) + '☆'.repeat("
  );

  // Boutique / flow CSS arrows still as ?
  html = html.replace(
    /(piece:not\(:last-child\):after\{content:")\?(")/gi,
    '$1→$2'
  );
  html = html.replace(
    /(flow-step:not\(:last-child\):after\{content:")\?(")/gi,
    '$1→$2'
  );
  html = html.replace(
    /(how-step:not\(:last-child\):after\{content:")\?(")/gi,
    '$1→$2'
  );
  // any remaining CSS arrow placeholders in :after{content:"?"}
  html = html.replace(
    /((?:piece|flow-step|how-step|journey-step|process-step)[^{]{0,40}:after\{content:")\?(")/gi,
    '$1→$2'
  );

  // Newsletter / CTA send buttons
  html = html.replace(/(<button class="demo-action">)\?(<\/button>)/gi, '$1→$2');

  // Timeline dots
  html = html.replace(/(class="tl-dot">)\?(<\/div>)/gi, '$1●$2');

  // Lightbox / generic prev-next that are still ?
  html = html.replace(/(aria-label="Previous"[^>]*>)\?(<\/button>)/gi, '$1‹$2');
  html = html.replace(/(aria-label="Next"[^>]*>)\?(<\/button>)/gi, '$1›$2');
  html = html.replace(/(class="lb-btn prev"[^>]*>)\?(<\/button>)/gi, '$1‹$2');
  html = html.replace(/(class="lb-btn next"[^>]*>)\?(<\/button>)/gi, '$1›$2');

  return html;
}

function fixRemainingQuestionIcons(html) {
  // Generic: class containers that still have only ? as content
  html = html.replace(
    /(<(?:div|span)[^>]*class="[^"]*(?:icon|ico|float-icon|service-icon|trust-icon|contact-icon|c-ico|why-ico|emoji|supp-emoji|challenge-emoji)[^"]*"[^>]*>)\s*\?{1,12}\s*(<\/(?:div|span)>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 220);
      const m =
        after.match(/<(?:h3|h2|h4|strong|b)[^>]*>([^<]+)/i) ||
        after.match(/<div>\s*<(?:strong|b)[^>]*>([^<]+)/i);
      return `${open}${emojiForTitle(m ? m[1] : '')}${close}`;
    }
  );

  // bonus-card / feature-card style="font-size:2rem">??
  html = html.replace(
    /(<div[^>]*style="font-size:2rem"[^>]*>)\?{1,8}(<\/div>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 120);
      const m = after.match(/<h3[^>]*>([^<]+)/i);
      return `${open}${emojiForTitle(m ? m[1] : '')}${close}`;
    }
  );

  // hotel-loc ?? City
  html = html.replace(/(hotel-loc[^>]*>)\?{1,4}\s*/gi, '$1📍 ');

  // weather display
  html = html.replace(/(id="ttWeather"[^>]*>)\?{1,4}\s*/gi, '$1☀️ ');

  // float-card ico
  html = html.replace(
    /(<span class="ico">)\?{1,8}(<\/span>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 120);
      const m = after.match(/<strong[^>]*>([^<]+)/i);
      return `${open}${emojiForTitle(m ? m[1] : '')}${close}`;
    }
  );

  // CTA section ico at bottom of travel
  html = html.replace(/(<div class="ico">)\?{1,8}(<\/div>)/gi, '$1✈️$2');

  // building construction phases already handled; lone ? in content:'?' left as CSS

  // menssalon Location / Hours
  html = html.replace(/(<strong>)\?{1,4}\s*(Location)/gi, '$1📍 $2');
  html = html.replace(/(<strong>)\?\s*(Hours)/gi, '$1🕐 $2');
  html = html.replace(/(<strong>)\?{1,4}\s*(Monday)/gi, '$1🚫 $2');

  // restaurant address / phone / parking
  html = html.replace(/(<p>)\?{1,4}\s+(\d|[\w].{0,5}(?:Road|Street|Avenue))/g, '$1📍 $2');
  html = html.replace(/(<p>)\?{1,4}\s+(0\d{2}[-.\s])/g, '$1📞 $2');
  html = html.replace(/(<p>)\?{1,4}\s+(Free parking)/gi, '$1🅿️ $2');

  // trust-card single ?
  html = html.replace(
    /(trust-(?:card|icon|pill)[^>]*>)\s*\?\s*(<\/(?:div|span)>)/gi,
    (full, open, close, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 100);
      const m = after.match(/<(?:strong|h3)[^>]*>([^<]+)/i) || after.match(/^([^<]{2,40})/);
      return `${open}${emojiForTitle(m ? m[1] : 'Award')}${close}`;
    }
  );

  return html;
}

function countPlaceholders(html) {
  const qq = (html.match(/\?{2,}/g) || []).length;
  const fffd = (html.match(/\uFFFD/g) || []).length;
  return { qq, fffd };
}

function processFile(file) {
  const fp = path.join(DEMOS_DIR, file);
  if (!fs.existsSync(fp)) {
    return { file, skipped: true };
  }
  let html = fs.readFileSync(fp, 'utf8');
  // Strip BOM if present
  if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);

  const before = countPlaceholders(html);

  html = fixTravelLanguages(html);
  html = fixJsFeatureIcons(html);
  html = fixStarsAndBadges(html);
  html = fixCssContentPlaceholders(html);
  html = fixRealEstateSpecs(html);
  html = fixSchoolContact(html);
  html = fixHtmlIconSlots(html);
  html = fixRemainingQuestionIcons(html);
  html = fixLeftovers(html);
  html = fixFffdSafe(html);

  // Second pass for icon slots that depended on FFFD-cleaned titles
  html = fixHtmlIconSlots(html);
  html = fixRemainingQuestionIcons(html);
  html = fixLeftovers(html);
  html = fixJsFeatureIcons(html);

  const after = countPlaceholders(html);

  fs.writeFileSync(fp, html, { encoding: 'utf8' });

  return { file, before, after, changed: before.qq !== after.qq || before.fffd !== after.fffd || true };
}

function main() {
  console.log('Fixing demo emoji/encoding in', DEMOS_DIR);
  const results = [];
  for (const file of DEMO_FILES) {
    const r = processFile(file);
    results.push(r);
    if (r.skipped) {
      console.log('SKIP', file);
      continue;
    }
    console.log(
      file.padEnd(26),
      `?? ${r.before.qq}->${r.after.qq}`,
      `FFFD ${r.before.fffd}->${r.after.fffd}`
    );
  }

  // Verify remaining ?? (excluding URL query false positives by checking demo bodies)
  console.log('\n=== Remaining ?? sample (non-URL) ===');
  for (const file of DEMO_FILES) {
    const fp = path.join(DEMOS_DIR, file);
    if (!fs.existsSync(fp)) continue;
    const s = fs.readFileSync(fp, 'utf8');
    const re = /\?{2,}/g;
    let m;
    const hits = [];
    while ((m = re.exec(s))) {
      if (isLikelyUrlQuery(s, m.index)) continue;
      // skip ternary / JS ? : carefully — still report
      hits.push(JSON.stringify(s.slice(Math.max(0, m.index - 25), m.index + m[0].length + 35)));
      if (hits.length >= 5) break;
    }
    if (hits.length) {
      console.log(file, 'remaining non-URL ?? :', hits.length >= 5 ? '5+' : hits.length);
      hits.forEach((h) => console.log(' ', h));
    }
  }
}

main();
