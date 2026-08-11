/* Crestwood Academy — public interactions (mobile-first) */

(function () {
  "use strict";

  var header = document.getElementById("site-header");
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-primary-nav]");
  var backdrop = document.querySelector("[data-nav-backdrop]");
  var desktopQuery = window.matchMedia("(min-width: 1100px)");
  var moreWrap = document.querySelector("[data-nav-more]");
  var moreToggle = document.querySelector("[data-nav-more-toggle]");
  var moreMenu = document.querySelector("[data-nav-more-menu]");
  var lockScrollY = 0;

  function measureNavTop() {
    if (!header) return;
    // After body lock, header is fixed at top — drawer starts below header height.
    var top;
    if (document.body.classList.contains("nav-open")) {
      top = Math.round(header.offsetHeight || header.getBoundingClientRect().height);
    } else {
      top = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    }
    document.documentElement.style.setProperty("--nav-top", top + "px");
  }

  function closeMore() {
    if (!moreToggle || !moreMenu) return;
    moreToggle.setAttribute("aria-expanded", "false");
    moreMenu.hidden = true;
  }

  function closeNav() {
    if (!toggle || !nav) return;
    if (!nav.classList.contains("is-open")) {
      closeMore();
      return;
    }
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    nav.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.documentElement.classList.remove("nav-open");
    document.body.classList.remove("nav-open");
    document.body.style.top = "";
    window.scrollTo(0, lockScrollY);
    closeMore();
  }

  function openNav() {
    if (!toggle || !nav) return;
    lockScrollY = window.scrollY || window.pageYOffset || 0;

    // Lock page scroll first so the logo/header cannot drift with the page.
    document.body.style.top = "-" + lockScrollY + "px";
    document.documentElement.classList.add("nav-open");
    document.body.classList.add("nav-open");

    toggle.setAttribute("aria-expanded", "true");
    nav.hidden = false;
    nav.classList.add("is-open");
    if (backdrop) backdrop.hidden = false;

    // Header is now fixed at top — place drawer directly under it.
    requestAnimationFrame(function () {
      measureNavTop();
    });
  }

  function onScroll() {
    if (!header || document.body.classList.contains("nav-open")) return;
    if (window.scrollY > 12) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && nav) {
    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var open = toggle.getAttribute("aria-expanded") === "true";
      if (open) {
        closeNav();
      } else {
        openNav();
      }
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeNav();
      });
    });

    if (backdrop) {
      backdrop.addEventListener("click", closeNav);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (nav.classList.contains("is-open")) {
          closeNav();
        } else {
          closeMore();
        }
      }
    });

    function onBreakpointChange(event) {
      if (event.matches) {
        closeNav();
      } else {
        closeMore();
      }
    }

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", onBreakpointChange);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(onBreakpointChange);
    }
  }

  if (moreToggle && moreMenu) {
    moreToggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var open = moreToggle.getAttribute("aria-expanded") === "true";
      if (open) {
        closeMore();
      } else {
        moreToggle.setAttribute("aria-expanded", "true");
        moreMenu.hidden = false;
      }
    });

    document.addEventListener("click", function (event) {
      if (!moreWrap) return;
      if (!moreWrap.contains(event.target)) {
        closeMore();
      }
    });
  }

  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -24px 0px" }
    );
    reveals.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var lightbox = document.querySelector("[data-lightbox-modal]");
  var lightboxImage = document.querySelector("[data-lightbox-image]");
  var lightboxCaption = document.querySelector("[data-lightbox-caption]");
  var lightboxClose = document.querySelector("[data-lightbox-close]");

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
  }

  document.querySelectorAll("[data-lightbox]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!lightbox || !lightboxImage) return;
      event.preventDefault();
      lightboxImage.src = link.getAttribute("href") || "";
      lightboxImage.alt = link.getAttribute("title") || "Gallery image";
      if (lightboxCaption) {
        lightboxCaption.textContent = link.getAttribute("title") || "";
      }
      lightbox.hidden = false;
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }
  if (lightbox) {
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (lightbox && !lightbox.hidden) {
        closeLightbox();
        event.stopPropagation();
      }
    }
  });

  window.addEventListener("pageshow", function () {
    document.querySelectorAll("form.public-form button[type='submit']").forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      if (btn.getAttribute("data-original-label")) {
        btn.textContent = btn.getAttribute("data-original-label");
      }
    });
  });

  document.querySelectorAll("form.public-form").forEach(function (form) {
    form.addEventListener("submit", function () {
      var btn = form.querySelector('button[type="submit"]');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      btn.classList.add("is-loading");
      var original = btn.textContent;
      btn.setAttribute("data-original-label", original);
      btn.textContent = "Sending…";
    });
  });
})();
