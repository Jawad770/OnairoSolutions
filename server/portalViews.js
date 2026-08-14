function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const LEGACY_NAV = [
  "dashboard",
  "crm",
  "forms",
  "edutrack",
  "products",
  "clients",
  "projects",
  "invoices",
  "support",
  "newsletter",
  "blog",
  "settings",
].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), path: k === "dashboard" ? "" : k }));

function initialsOf(user) {
  const source = (user?.full_name || user?.email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

/** Profile image when one is set, initials otherwise. */
function avatar(user) {
  if (user?.avatar_url) {
    return `<img class="avatar" src="${esc(user.avatar_url)}" alt="${esc(user.full_name || user.email || "User")} profile image">`;
  }
  return `<span class="avatar">${esc(initialsOf(user))}</span>`;
}

function styles() {
  return `
    :root { --bg:#070b14; --card:rgba(17,24,39,.72); --line:rgba(148,163,184,.22); --text:#e2e8f0; --muted:#94a3b8; --accent:#10b981; --danger:#f87171; }
    *{box-sizing:border-box} html,body{max-width:100%;overflow-x:hidden}
    body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:radial-gradient(circle at 20% -10%,#123 0%,#070b14 45%);color:var(--text)}
    body.drawer-open{overflow:hidden;touch-action:none}
    a{color:inherit;text-decoration:none} .app{display:grid;grid-template-columns:260px 1fr;min-height:100vh;min-width:0}
    .side{position:sticky;top:0;height:100vh;padding:22px;border-right:1px solid var(--line);backdrop-filter:blur(14px);background:rgba(10,15,30,.7);overflow-y:auto;z-index:40;-webkit-overflow-scrolling:touch}
    .brand{font-weight:800;letter-spacing:.02em;margin-bottom:6px}.muted{color:var(--muted);font-size:12px}
    .nav{display:grid;gap:8px}.nav a{padding:10px 12px;border:1px solid transparent;border-radius:12px;color:var(--muted);transition:background .18s ease,color .18s ease,border-color .18s ease;min-height:44px;display:flex;align-items:center}
    .nav a:hover,.nav a.active{border-color:var(--line);color:var(--text);background:rgba(148,163,184,.08)}
    .nav a:focus-visible,.btn:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid rgba(16,185,129,.75);outline-offset:2px}
    .main{padding:20px;min-width:0;overflow-x:clip}
    .top{position:sticky;top:0;z-index:30;border:1px solid var(--line);background:rgba(15,23,42,.75);backdrop-filter:blur(12px);padding:12px 16px;border-radius:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .top .btn{width:auto;flex:0 0 auto;min-height:40px}
    .btn{height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgba(148,163,184,.08);color:var(--text);cursor:pointer;font:inherit;transition:transform .16s ease,border-color .16s ease,background .16s ease}
    .btn:hover{transform:translateY(-1px);border-color:rgba(148,163,184,.45)}
    .btn.primary{background:linear-gradient(135deg,#0f766e,#10b981);border:none}
    .btn.danger{border-color:rgba(248,113,113,.45);color:#fecaca;background:rgba(248,113,113,.1)}
    .btn.sm{height:36px;min-height:36px;padding:0 12px;font-size:12px}
    .grid{display:grid;gap:14px}.cards{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:16px}
    .card{border:1px solid var(--line);background:var(--card);backdrop-filter:blur(18px);padding:14px;border-radius:14px;min-width:0}
    .k{font-size:12px;color:var(--muted)} .v{font-size:24px;font-weight:800;margin-top:6px;overflow-wrap:anywhere}
    .panel{margin-top:14px;border:1px solid var(--line);background:var(--card);border-radius:14px;padding:14px;min-width:0}
    .panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
    .table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:8px}
    table{width:100%;border-collapse:collapse;min-width:0} th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:middle}
    .badge{padding:4px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:#d1d5db;white-space:nowrap;display:inline-block}
    .badge.ok{border-color:rgba(16,185,129,.5);color:#6ee7b7;background:rgba(16,185,129,.1)}
    .badge.warn{border-color:rgba(245,158,11,.5);color:#fcd34d;background:rgba(245,158,11,.1)}
    .badge.off{border-color:rgba(248,113,113,.45);color:#fca5a5;background:rgba(248,113,113,.1)}
    .avatar{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:linear-gradient(135deg,#0f766e,#10b981);color:#04140f;flex:0 0 auto;object-fit:cover}
    .who{display:flex;align-items:center;gap:10px;min-width:0}
    .kanban{display:grid;grid-template-columns:repeat(7,minmax(180px,1fr));gap:10px;overflow:auto;-webkit-overflow-scrolling:touch}
    .col{border:1px solid var(--line);background:rgba(2,6,23,.45);padding:10px;border-radius:12px;min-height:360px}
    .lead{border:1px solid var(--line);border-radius:10px;padding:8px;margin-bottom:8px;background:rgba(15,23,42,.7);cursor:grab}
    .form{max-width:420px;width:100%;margin:6vh auto;border:1px solid var(--line);background:rgba(10,15,30,.72);padding:22px;border-radius:16px;backdrop-filter:blur(18px)}
    input,select,textarea{width:100%;max-width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:rgba(2,6,23,.5);color:var(--text);font:inherit}
    input:focus,select:focus,textarea:focus{outline:none;border-color:rgba(16,185,129,.6)}
    .pw-wrap{position:relative;display:block}
    .pw-wrap input{padding-right:46px}
    .pw-toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:8px;background:transparent;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
    .pw-toggle:hover,.pw-toggle:focus-visible{color:var(--text);background:rgba(148,163,184,.12);outline:none}
    .pw-toggle svg{width:18px;height:18px;display:block;pointer-events:none}
    label{font-size:12px;color:var(--muted);display:block;margin-bottom:6px} .row{margin-bottom:12px}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .error{color:#fca5a5;font-size:13px;margin-bottom:8px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.08);padding:10px;border-radius:10px;overflow-wrap:anywhere}
    .notice{color:#6ee7b7;font-size:13px;margin-bottom:8px;border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.08);padding:10px;border-radius:10px;overflow-wrap:anywhere}
    .toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .toolbar input,.toolbar select{width:auto;min-width:150px;flex:1 1 150px;max-width:280px}
    .actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
    .matrix{display:grid;gap:12px;margin-top:10px}
    .mod{border:1px solid var(--line);border-radius:12px;padding:12px;background:rgba(2,6,23,.4)}
    .mod-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .mod-head strong{font-size:14px}
    .perms{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
    .perm{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(15,23,42,.55);cursor:pointer}
    .perm input{width:auto;margin:2px 0 0}
    .perm span{font-size:12.5px;line-height:1.35}
    .perm code{display:block;color:var(--muted);font-size:11px;margin-top:2px}
    .drawer-btn{display:none;min-width:40px}
    .scrim{display:none}
    .pager{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center}
    .pager a,.pager span{padding:7px 11px;border:1px solid var(--line);border-radius:9px;font-size:12px}
    .pager .on{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.5);color:#6ee7b7}
    .modal,.dialog,.lightbox{max-width:min(560px,calc(100vw - 24px));max-height:min(90vh,900px);overflow:auto}
    canvas,svg,img{max-width:100%;height:auto}
    @media (max-width:1100px){
      .app{grid-template-columns:1fr}
      .side{position:fixed;left:0;top:0;width:min(86vw,300px);max-width:100%;transform:translateX(-105%);transition:transform .26s ease;box-shadow:0 24px 60px rgba(0,0,0,.5);height:100dvh}
      body.drawer-open .side{transform:translateX(0)}
      body.drawer-open .scrim{display:block;position:fixed;inset:0;background:rgba(2,6,23,.6);backdrop-filter:blur(2px);z-index:35}
      .drawer-btn{display:inline-flex}
      .kanban{grid-template-columns:repeat(2,minmax(200px,1fr))}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media (max-width:760px){
      .main{padding:12px}
      .top{flex-direction:row;align-items:center;padding:10px 12px}
      .top > div:first-child{flex:1 1 auto;min-width:0}
      .top strong{font-size:14px}
      .row2{grid-template-columns:1fr}
      .toolbar input,.toolbar select,.toolbar .btn{flex:1 1 100%;max-width:none;min-width:0}
      .kanban{grid-template-columns:1fr}
      .cards{grid-template-columns:1fr}
      .perms{grid-template-columns:1fr}
      .form{margin:3vh 12px;padding:18px;width:auto}
      table.stack thead{display:none}
      table.stack,table.stack tbody,table.stack tr,table.stack td{display:block;width:100%}
      table.stack tr{border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;background:rgba(15,23,42,.5)}
      table.stack td{border:none;padding:5px 0;display:flex;gap:10px;justify-content:space-between;align-items:center}
      table.stack td::before{content:attr(data-label);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;flex:0 0 auto}
      table.stack td .actions{justify-content:flex-end}
      .panel .btn.primary,.panel > form > .btn{width:100%}
      .actions .btn,.panel-head .btn,.top .btn,.toolbar .btn.sm{width:auto}
    }
    @media (max-width:374px){
      .main{padding:10px}
      .brand{font-size:15px}
      .btn.sm{padding:0 10px}
    }`;
}

function passwordToggleScript() {
  return `<script>
    (function(){
      var eye='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
      var eyeOff='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.8 21.8 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      function enhance(input){
        if(!input||input.closest('.pw-wrap'))return;
        var wrap=document.createElement('div');
        wrap.className='pw-wrap';
        input.parentNode.insertBefore(wrap,input);
        wrap.appendChild(input);
        var btn=document.createElement('button');
        btn.type='button';
        btn.className='pw-toggle';
        btn.setAttribute('aria-label','Show password');
        btn.setAttribute('title','Show password');
        btn.innerHTML=eye;
        wrap.appendChild(btn);
        btn.addEventListener('click',function(){
          var show=input.type==='password';
          input.type=show?'text':'password';
          btn.setAttribute('aria-label',show?'Hide password':'Show password');
          btn.setAttribute('title',show?'Hide password':'Show password');
          btn.innerHTML=show?eyeOff:eye;
        });
      }
      document.querySelectorAll('input[type="password"]').forEach(enhance);
    })();
  </script>`;
}

function layout({ title, body, user, portalRoute, nav }) {
  const items = user ? (nav && nav.length ? nav : LEGACY_NAV) : [];
  const lowerTitle = String(title || "").toLowerCase();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${esc(title)} • Onairo Portal</title>
  <style>${styles()}</style>
</head>
<body>
  ${user ? `<div class="scrim" id="scrim"></div><div class="app">
    <aside class="side" id="side">
      <div class="brand">Onairo Portal</div>
      <div class="muted">Internal Operating System</div>
      <div class="who" style="margin:14px 0 4px">
        ${avatar(user)}
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis">${esc(user.full_name || user.email)}</div>
          <div class="muted">${esc(user.roleName || user.role || "")}</div>
        </div>
      </div>
      <nav class="nav" style="margin-top:14px">
        ${(() => {
          let html = "";
          let lastSection = null;
          for (const item of items) {
            if (item.disabled) {
              if (item.section && item.section !== lastSection) {
                html += `<div class="muted" style="margin:12px 0 4px;padding:0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(item.section)}</div>`;
                lastSection = item.section;
              }
              html += `<span class="muted" style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;opacity:.7;cursor:not-allowed" aria-disabled="true">${esc(item.label)}<span class="badge warn" style="font-size:10px">${esc(item.badge || "Coming Soon")}</span></span>`;
              continue;
            }
            if (item.section && item.section !== lastSection) {
              html += `<div class="muted" style="margin:12px 0 4px;padding:0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(item.section)}</div>`;
              lastSection = item.section;
            } else if (!item.section) {
              lastSection = null;
            }
            const active =
              lowerTitle === item.label.toLowerCase() ||
              lowerTitle === "catalog manager" && item.path.startsWith("catalog");
            html += `<a href="${portalRoute}/${item.path}" class="${active ? "active" : ""}">${esc(item.label)}</a>`;
          }
          return html;
        })()}
      </nav>
    </aside>
    <main class="main">${body}</main>
  </div>
  <script>
    (function(){
      var btn=document.getElementById('drawerBtn'),scrim=document.getElementById('scrim'),side=document.getElementById('side');
      function setOpen(open){
        document.body.classList.toggle('drawer-open', !!open);
        if(btn){
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        }
        if(side) side.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      function close(){ setOpen(false); }
      function open(){ setOpen(true); }
      function toggle(){ setOpen(!document.body.classList.contains('drawer-open')); }
      if(btn){
        btn.setAttribute('aria-controls','side');
        btn.setAttribute('aria-expanded','false');
        btn.addEventListener('click', function(e){ e.preventDefault(); toggle(); });
      }
      if(side) side.setAttribute('aria-hidden','true');
      if(scrim) scrim.addEventListener('click', close);
      document.querySelectorAll('.side a').forEach(function(a){ a.addEventListener('click', close); });
      document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });
      window.addEventListener('resize', function(){ if(window.matchMedia('(min-width:1101px)').matches) close(); });
    })();
  </script>` : body}
  ${passwordToggleScript()}
</body></html>`;
}

function login({ portalRoute, csrfToken, error, notice, next }) {
  return layout({
    title: "Login",
    portalRoute,
    body: `<div class="form">
      <h1 style="margin:0 0 8px;font-size:28px">Onairo Internal Portal</h1>
      <p class="muted" style="margin:0 0 16px">Secure staff access only</p>
      ${error ? `<div class="error">${esc(error)}</div>` : ""}
      ${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
      <form method="post" action="${portalRoute}/login">
        <input type="hidden" name="CSRFToken" value="${esc(csrfToken)}">
        ${next ? `<input type="hidden" name="next" value="${esc(next)}">` : ""}
        <div class="row"><label>Email</label><input type="email" name="email" required autocomplete="email"></div>
        <div class="row"><label>Password</label><input type="password" name="password" required autocomplete="current-password"></div>
        <div class="row" style="display:flex;align-items:center;gap:8px"><input style="width:auto" type="checkbox" id="remember" name="rememberMe"><label for="remember" style="margin:0">Remember me</label></div>
        <button class="btn primary" type="submit" style="width:100%">Sign In</button>
      </form>
      <a class="muted" href="mailto:hello@onairosolutions.com" style="display:block;margin-top:12px">Forgot password</a>
    </div>`,
  });
}

function denied({ portalRoute, message, user, nav }) {
  const body = `<div class="form" style="max-width:520px">
    <h1 style="margin:0 0 8px;font-size:22px">Access denied</h1>
    <p class="muted" style="margin:0 0 14px">${esc(message)}</p>
    <a class="btn primary" href="${portalRoute}">Back to dashboard</a>
  </div>`;
  return layout({ title: "Access denied", portalRoute, user, nav, body });
}

/** Standalone (unauthenticated) page used by invitation + password flows. */
function standalone({ portalRoute, title, heading, description, error, notice, formHtml }) {
  return layout({
    title,
    portalRoute,
    body: `<div class="form">
      <h1 style="margin:0 0 8px;font-size:24px">${esc(heading)}</h1>
      ${description ? `<p class="muted" style="margin:0 0 16px">${esc(description)}</p>` : ""}
      ${error ? `<div class="error">${esc(error)}</div>` : ""}
      ${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
      ${formHtml || ""}
    </div>`,
  });
}

/** Permission matrix grouped by module with select/clear helpers and search. */
function permissionMatrix({ modules, granted, disabled, lockedKeys = [] }) {
  const grantedSet = new Set(granted);
  const locked = new Set(lockedKeys);
  const body = modules
    .map((mod) => {
      const boxes = mod.actions
        .map(([action, label]) => {
          const key = `${mod.key}.${action}`;
          const isLocked = locked.has(key) || disabled;
          return `<label class="perm" data-search="${esc((key + " " + label + " " + mod.label).toLowerCase())}">
            <input type="checkbox" name="permissions" value="${esc(key)}" ${grantedSet.has(key) ? "checked" : ""} ${isLocked ? "disabled" : ""}>
            <span>${esc(label)}<code>${esc(key)}</code></span>
          </label>`;
        })
        .join("");
      return `<section class="mod" data-module="${esc(mod.key)}" data-search="${esc(mod.label.toLowerCase())}">
        <div class="mod-head">
          <strong>${esc(mod.label)}</strong>
          ${disabled ? "" : `<span class="actions">
            <button type="button" class="btn sm" data-mod-select="${esc(mod.key)}">Select module</button>
            <button type="button" class="btn sm" data-mod-clear="${esc(mod.key)}">Clear module</button>
          </span>`}
        </div>
        <div class="perms">${boxes}</div>
      </section>`;
    })
    .join("");

  return `<div class="toolbar" style="margin-bottom:10px">
      <input type="search" id="permSearch" placeholder="Search permissions">
      ${disabled ? "" : `<button type="button" class="btn sm" id="permAll">Select all</button>
      <button type="button" class="btn sm" id="permNone">Clear all</button>`}
    </div>
    <div class="matrix" id="matrix">${body}</div>
    <script>
      (function(){
        var matrix=document.getElementById('matrix');
        if(!matrix)return;
        function boxes(scope){return (scope||matrix).querySelectorAll('input[name="permissions"]:not([disabled])');}
        function setAll(scope,val){boxes(scope).forEach(function(b){b.checked=val;});}
        var all=document.getElementById('permAll'),none=document.getElementById('permNone');
        if(all)all.addEventListener('click',function(){setAll(matrix,true);});
        if(none)none.addEventListener('click',function(){setAll(matrix,false);});
        matrix.querySelectorAll('[data-mod-select]').forEach(function(b){
          b.addEventListener('click',function(){setAll(matrix.querySelector('[data-module="'+b.dataset.modSelect+'"]'),true);});
        });
        matrix.querySelectorAll('[data-mod-clear]').forEach(function(b){
          b.addEventListener('click',function(){setAll(matrix.querySelector('[data-module="'+b.dataset.modClear+'"]'),false);});
        });
        var search=document.getElementById('permSearch');
        if(search)search.addEventListener('input',function(){
          var q=search.value.trim().toLowerCase();
          matrix.querySelectorAll('.mod').forEach(function(mod){
            var shown=0;
            mod.querySelectorAll('.perm').forEach(function(p){
              var hit=!q||p.dataset.search.indexOf(q)>-1;
              p.style.display=hit?'':'none';
              if(hit)shown++;
            });
            mod.style.display=(shown||(!q))?'':'none';
          });
        });
      })();
    </script>`;
}

module.exports = { layout, login, denied, standalone, permissionMatrix, esc, initialsOf, avatar };
