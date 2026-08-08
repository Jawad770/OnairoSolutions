/**
 * Shared public-form UX for Onairo lead capture.
 *
 * - Email OR WhatsApp (at least one)
 * - Searchable country selector with auto dial code
 * - Enter moves focus (textarea keeps newlines)
 * - Autofocus + scroll to first invalid field
 * - Values preserved on validation errors
 *
 * Usage:
 *   ONAIRO.FormUX.enhance(form, { contactChannelFields: true });
 *   // or auto-bind any form with data-onairo-form
 */
(function (global) {
  var O = (global.ONAIRO = global.ONAIRO || {});
  var CONTACT_MSG = "Please provide either your Email address or WhatsApp number.";

  function qs(root, sel) {
    return (root || document).querySelector(sel);
  }
  function qsa(root, sel) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function trim(v) {
    return String(v == null ? "" : v).trim();
  }
  function digitsOnly(v) {
    return String(v || "").replace(/\D+/g, "");
  }

  function ensureErrorEl(host) {
    var existing = host.querySelector(":scope > .onairo-field-error");
    if (existing) return existing;
    var el = document.createElement("div");
    el.className = "onairo-field-error";
    el.setAttribute("role", "alert");
    host.appendChild(el);
    return el;
  }

  function ensureFieldIcon(host) {
    var existing = host.querySelector(":scope > .onairo-field-status");
    if (existing) return existing;
    var icon = document.createElement("span");
    icon.className = "onairo-field-status";
    icon.setAttribute("aria-hidden", "true");
    host.appendChild(icon);
    return icon;
  }

  function fieldHost(input) {
    return (
      input.closest(".form-group") ||
      input.closest(".onairo-phone-host") ||
      input.closest(".full") ||
      input.parentElement
    );
  }

  function clearFieldError(input) {
    var host = fieldHost(input);
    if (!host) return;
    host.classList.remove("onairo-invalid");
    host.classList.remove("onairo-valid");
    var err = host.querySelector(":scope > .onairo-field-error");
    if (err) {
      err.textContent = "";
      err.classList.remove("is-visible");
    }
    input.removeAttribute("aria-invalid");
  }

  function setFieldError(input, message) {
    var host = fieldHost(input);
    if (!host) return;
    host.classList.add("onairo-invalid");
    host.classList.remove("onairo-valid");
    ensureFieldIcon(host);
    var err = ensureErrorEl(host);
    if (!err.id) err.id = (input.id || "onairo-field") + "-error";
    err.textContent = message;
    err.classList.add("is-visible");
    input.setAttribute("aria-invalid", "true");
    var describedBy = trim(input.getAttribute("aria-describedby"));
    if (describedBy.indexOf(err.id) === -1) {
      input.setAttribute("aria-describedby", trim(describedBy + " " + err.id));
    }
  }

  function setFieldValid(input) {
    var host = fieldHost(input);
    if (!host || !trim(input.value) || input.type === "file") return;
    host.classList.remove("onairo-invalid");
    host.classList.add("onairo-valid");
    ensureFieldIcon(host);
    input.removeAttribute("aria-invalid");
  }

  function clearFormErrors(form) {
    qsa(form, ".onairo-invalid").forEach(function (el) {
      el.classList.remove("onairo-invalid");
    });
    qsa(form, ".onairo-field-error").forEach(function (el) {
      el.textContent = "";
      el.classList.remove("is-visible");
    });
    qsa(form, "[aria-invalid]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function focusInvalid(input) {
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      try {
        input.focus();
      } catch (__) {}
    }
    var target = fieldHost(input) || input;
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function isTextarea(el) {
    return el && el.tagName === "TEXTAREA";
  }
  function isSelect(el) {
    return el && el.tagName === "SELECT";
  }
  function isButtonLike(el) {
    if (!el) return false;
    if (el.tagName === "BUTTON") return true;
    if (el.tagName === "INPUT" && /^(submit|button|reset|file)$/i.test(el.type)) return true;
    return el.getAttribute("role") === "button";
  }

  function focusables(form) {
    return qsa(form, "input, select, textarea, button").filter(function (el) {
      if (el.disabled || el.type === "hidden") return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.closest(".onairo-phone__panel")) return false;
      if (el.classList.contains("onairo-phone__hidden")) return false;
      var style = global.getComputedStyle ? getComputedStyle(el) : null;
      if (style && (style.visibility === "hidden" || style.display === "none")) return false;
      return true;
    });
  }

  function nextFocusable(form, current) {
    var list = focusables(form);
    var idx = list.indexOf(current);
    if (idx < 0) return null;
    return list[idx + 1] || null;
  }

  function composeInternational(dial, local) {
    var d = trim(dial);
    var n = digitsOnly(local);
    if (!n) return "";
    if (n.charAt(0) === "0") n = n.slice(1);
    var dialDigits = digitsOnly(d);
    if (n.indexOf(dialDigits) === 0) return "+" + n;
    return d + n;
  }

  /* ------------------------------------------------------------------ *
   * Country + phone control
   * ------------------------------------------------------------------ */

  function findCountry(code) {
    var list = O.countries || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i];
    }
    return O.defaultCountry || list[0];
  }

  function enhancePhoneInput(input, options) {
    if (!input || input.dataset.onairoPhone === "1") return null;
    input.dataset.onairoPhone = "1";

    var fieldName = input.getAttribute("name") || "whatsapp";
    var defaultCode = (options && options.defaultCountry) || "PK";
    var country = findCountry(defaultCode);

    var host = fieldHost(input);
    if (host) host.classList.add("onairo-phone-host");

    var wrap = document.createElement("div");
    wrap.className = "onairo-phone";
    wrap.dataset.phoneField = fieldName;

    var countryBox = document.createElement("div");
    countryBox.className = "onairo-phone__country";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "onairo-phone__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Select country");

    var panel = document.createElement("div");
    panel.className = "onairo-phone__panel";
    panel.setAttribute("role", "listbox");

    var search = document.createElement("input");
    search.type = "search";
    search.className = "onairo-phone__search";
    search.placeholder = "Search country…";
    search.setAttribute("autocomplete", "off");
    search.setAttribute("aria-label", "Search countries");

    var list = document.createElement("ul");
    list.className = "onairo-phone__list";

    panel.appendChild(search);
    panel.appendChild(list);
    countryBox.appendChild(trigger);
    countryBox.appendChild(panel);

    var number = document.createElement("input");
    number.type = "tel";
    number.className = "onairo-phone__number";
    number.id = input.id || fieldName + "Number";
    number.placeholder = input.placeholder || "3XX XXXXXXX";
    number.setAttribute("autocomplete", "tel-national");
    number.setAttribute("inputmode", "tel");
    if (input.required) number.required = true;

    var hiddenFull = document.createElement("input");
    hiddenFull.type = "hidden";
    hiddenFull.name = fieldName;
    hiddenFull.className = "onairo-phone__hidden";

    var hiddenCountry = document.createElement("input");
    hiddenCountry.type = "hidden";
    hiddenCountry.name = fieldName === "whatsapp" ? "country" : fieldName + "Country";
    hiddenCountry.className = "onairo-phone__hidden";

    var hiddenCountryCode = document.createElement("input");
    hiddenCountryCode.type = "hidden";
    hiddenCountryCode.name = fieldName === "whatsapp" ? "countryCode" : fieldName + "CountryCode";
    hiddenCountryCode.className = "onairo-phone__hidden";

    var hiddenDial = document.createElement("input");
    hiddenDial.type = "hidden";
    hiddenDial.name = fieldName === "whatsapp" ? "dialCode" : fieldName + "DialCode";
    hiddenDial.className = "onairo-phone__hidden";

    var hiddenLocal = document.createElement("input");
    hiddenLocal.type = "hidden";
    hiddenLocal.name = fieldName === "whatsapp" ? "phoneNumber" : fieldName + "Local";
    hiddenLocal.className = "onairo-phone__hidden";

    // Preserve any prefilled value if present.
    var preset = trim(input.value);
    if (preset) number.value = preset.replace(/^\+\d+\s*/, "");

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(countryBox);
    wrap.appendChild(number);
    wrap.appendChild(hiddenFull);
    wrap.appendChild(hiddenCountry);
    wrap.appendChild(hiddenCountryCode);
    wrap.appendChild(hiddenDial);
    wrap.appendChild(hiddenLocal);
    input.remove();

    var activeIndex = -1;
    var filtered = [];

    function renderTrigger() {
      trigger.innerHTML =
        '<span class="onairo-phone__trigger-flag">' +
        country.flag +
        '</span><span class="onairo-phone__trigger-dial">' +
        country.dial +
        '</span><span class="onairo-phone__trigger-chevron" aria-hidden="true">▾</span>';
    }

    function syncHidden() {
      var local = trim(number.value);
      var localDigits = digitsOnly(local).replace(/^0+/, "") || digitsOnly(local);
      var full = composeInternational(country.dial, local);
      hiddenLocal.value = full ? localDigits : "";
      hiddenCountry.value = full ? country.name : "";
      hiddenCountryCode.value = full ? country.code : "";
      hiddenDial.value = full ? country.dial : "";
      hiddenFull.value = full;
    }

    function closePanel() {
      panel.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function openPanel() {
      panel.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      search.value = "";
      buildList("");
      setTimeout(function () {
        search.focus();
      }, 0);
    }

    function buildList(query) {
      var q = trim(query).toLowerCase();
      filtered = (O.countries || []).filter(function (c) {
        if (!q) return true;
        return (
          c.name.toLowerCase().indexOf(q) !== -1 ||
          c.dial.indexOf(q) !== -1 ||
          c.code.toLowerCase().indexOf(q) !== -1
        );
      });
      list.innerHTML = "";
      if (!filtered.length) {
        var empty = document.createElement("li");
        empty.className = "onairo-phone__option";
        empty.textContent = "No countries found";
        empty.style.cursor = "default";
        list.appendChild(empty);
        activeIndex = -1;
        return;
      }
      filtered.forEach(function (c, i) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "onairo-phone__option" + (c.code === country.code ? " is-active" : "");
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", c.code === country.code ? "true" : "false");
        btn.dataset.index = String(i);
        btn.innerHTML =
          '<span class="onairo-phone__trigger-flag">' +
          c.flag +
          '</span><span class="onairo-phone__option-name">' +
          c.name +
          '</span><span class="onairo-phone__option-dial">' +
          c.dial +
          "</span>";
        btn.addEventListener("click", function () {
          selectCountry(c, true);
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
      activeIndex = Math.max(
        0,
        filtered.findIndex(function (c) {
          return c.code === country.code;
        })
      );
      highlightActive();
    }

    function highlightActive() {
      var opts = qsa(list, ".onairo-phone__option[role='option']");
      opts.forEach(function (opt, i) {
        opt.classList.toggle("is-active", i === activeIndex);
        if (i === activeIndex) {
          opt.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function selectCountry(c, moveNext) {
      country = c;
      renderTrigger();
      syncHidden();
      closePanel();
      if (moveNext) number.focus();
    }

    trigger.addEventListener("click", function () {
      if (panel.classList.contains("is-open")) closePanel();
      else openPanel();
    });

    search.addEventListener("input", function () {
      buildList(search.value);
    });

    search.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!filtered.length) return;
        activeIndex = (activeIndex + 1) % filtered.length;
        highlightActive();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!filtered.length) return;
        activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        highlightActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0 && filtered[activeIndex]) selectCountry(filtered[activeIndex], true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        trigger.focus();
      }
    });

    number.addEventListener("input", syncHidden);
    number.addEventListener("blur", syncHidden);

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) closePanel();
    });

    renderTrigger();
    syncHidden();

    return {
      root: wrap,
      numberInput: number,
      trigger: trigger,
      sync: syncHidden,
      getValues: function () {
        syncHidden();
        return {
          country: hiddenCountry.value,
          countryCode: hiddenCountryCode.value,
          dialCode: hiddenDial.value,
          phoneNumber: hiddenLocal.value,
          full: hiddenFull.value,
        };
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Validation
   * ------------------------------------------------------------------ */

  function validateEmailFormat(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateRequired(form) {
    var firstInvalid = null;
    qsa(form, "[required]").forEach(function (el) {
      if (el.disabled || el.type === "hidden") return;
      if (el.closest(".onairo-phone__panel")) return;
      // Phone widgets use the visible tel input; hidden full number is synced separately.
      if (el.classList && el.classList.contains("onairo-phone__hidden")) return;
      clearFieldError(el);
      if (!el.checkValidity()) {
        setFieldError(el, nativeMessage(el));
        if (!firstInvalid) firstInvalid = el;
      } else {
        setFieldValid(el);
      }
    });
    return firstInvalid;
  }

  function validateContactChannels(form) {
    var emailInput = qs(form, 'input[name="email"], input[type="email"]');
    var phoneWidget = qs(form, '.onairo-phone[data-phone-field="whatsapp"]');
    var whatsappInput = phoneWidget
      ? qs(phoneWidget, 'input[name="whatsapp"]')
      : qs(form, 'input[name="whatsapp"]');
    var numberInput = phoneWidget ? qs(phoneWidget, ".onairo-phone__number") : whatsappInput;

    if (phoneWidget && phoneWidget.__onairoPhone) phoneWidget.__onairoPhone.sync();

    var email = emailInput ? trim(emailInput.value) : "";
    var whatsapp = whatsappInput ? trim(whatsappInput.value) : "";

    if (emailInput) clearFieldError(emailInput);
    if (numberInput) clearFieldError(numberInput);

    if (email && !validateEmailFormat(email)) {
      setFieldError(emailInput, "Please enter a valid email address.");
      return emailInput;
    }

    if (!email && !whatsapp) {
      if (emailInput) setFieldError(emailInput, CONTACT_MSG);
      if (numberInput) setFieldError(numberInput, CONTACT_MSG);
      return emailInput || numberInput;
    }

    if (email) setFieldValid(emailInput);
    if (whatsapp && numberInput) setFieldValid(numberInput);
    return null;
  }

  function nativeMessage(input) {
    var validity = input.validity || {};
    if (validity.valueMissing) return "This field is required.";
    if (validity.typeMismatch && input.type === "email") return "Please enter a valid email address.";
    if (validity.typeMismatch && input.type === "url") return "Please enter a complete URL, including https://.";
    if (validity.tooShort) return "Please enter at least " + input.minLength + " characters.";
    if (validity.tooLong) return "Please shorten this to " + input.maxLength + " characters.";
    if (validity.patternMismatch) return input.title || "Please use the requested format.";
    if (validity.rangeUnderflow) return "Value must be at least " + input.min + ".";
    if (validity.rangeOverflow) return "Value must be no more than " + input.max + ".";
    return input.validationMessage || "Please check this field.";
  }

  function isValidatable(input) {
    return (
      input &&
      !input.disabled &&
      input.type !== "hidden" &&
      !input.closest(".onairo-phone__panel") &&
      !(input.classList && input.classList.contains("onairo-phone__hidden"))
    );
  }

  function validateField(form, input, options) {
    if (!isValidatable(input)) return true;
    clearFieldError(input);
    if (!input.checkValidity()) {
      setFieldError(input, nativeMessage(input));
      return false;
    }
    if (input.type === "email" && trim(input.value) && !validateEmailFormat(trim(input.value))) {
      setFieldError(input, "Please enter a valid email address.");
      return false;
    }
    if (
      options &&
      options.requireEmailOrWhatsapp !== false &&
      (input.name === "email" ||
        input.name === "whatsapp" ||
        input.classList.contains("onairo-phone__number"))
    ) {
      var channelInvalid = validateContactChannels(form);
      if (channelInvalid) return false;
    }
    setFieldValid(input);
    return true;
  }

  function validateForm(form, options) {
    clearFormErrors(form);
    // Sync phone widgets before reading values.
    qsa(form, ".onairo-phone").forEach(function (w) {
      if (w.__onairoPhone) w.__onairoPhone.sync();
    });

    var first = null;
    qsa(form, "input, select, textarea").forEach(function (el) {
      if (!validateField(form, el, options) && !first) first = el;
    });
    if (!first && options && options.requireEmailOrWhatsapp !== false) {
      first = validateContactChannels(form);
    }
    if (first) {
      focusInvalid(first);
      return { ok: false, firstInvalid: first };
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ *
   * Drafts, progress, textarea sizing, and mobile keyboard handling
   * ------------------------------------------------------------------ */

  function draftKey(form) {
    var identity = form.id || form.getAttribute("name") || form.getAttribute("action") || "form";
    return "onairo_form_draft_v2_" + location.pathname + "_" + identity;
  }

  function draftValues(form) {
    var values = {};
    qsa(form, "input, select, textarea").forEach(function (el) {
      if (el.classList.contains("onairo-phone__number")) {
        var phoneRoot = el.closest(".onairo-phone");
        if (phoneRoot) values[phoneRoot.dataset.phoneField + "__local"] = el.value;
        return;
      }
      if (!el.name || el.type === "file" || el.type === "password" || el.type === "hidden") return;
      if (el.type === "checkbox" || el.type === "radio") values[el.name] = el.checked;
      else values[el.name] = el.value;
    });
    return values;
  }

  function writeDraft(form) {
    try {
      var values = draftValues(form);
      var hasContent = Object.keys(values).some(function (key) {
        return values[key] === true || trim(values[key]);
      });
      if (hasContent) {
        localStorage.setItem(draftKey(form), JSON.stringify({ savedAt: Date.now(), values: values }));
      }
    } catch (_) {}
  }

  function clearDraft(form) {
    try {
      localStorage.removeItem(draftKey(form));
    } catch (_) {}
    var notice = qs(form, ".onairo-draft-notice");
    if (notice) notice.remove();
  }

  function restoreDraft(form) {
    var draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(draftKey(form)) || "null");
    } catch (_) {}
    if (!draft || !draft.values) return;
    Object.keys(draft.values).forEach(function (name) {
      if (/__local$/.test(name)) {
        var phoneField = name.replace(/__local$/, "");
        qsa(form, ".onairo-phone").forEach(function (phoneRoot) {
          if (phoneRoot.dataset.phoneField === phoneField) {
            var number = qs(phoneRoot, ".onairo-phone__number");
            if (number) number.value = draft.values[name];
          }
        });
        return;
      }
      qsa(form, "[name]").filter(function (el) {
        return el.name === name;
      }).forEach(function (el) {
        if (el.type === "file" || el.type === "hidden") return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = Boolean(draft.values[name]);
        else el.value = draft.values[name];
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    qsa(form, ".onairo-phone").forEach(function (w) {
      if (w.__onairoPhone) w.__onairoPhone.sync();
    });
    var notice = document.createElement("div");
    notice.className = "onairo-draft-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML =
      '<span>Draft restored</span><button type="button" class="onairo-draft-discard">Discard</button>';
    form.insertBefore(notice, form.firstChild);
    qs(notice, ".onairo-draft-discard").addEventListener("click", function () {
      clearDraft(form);
      form.reset();
    });
  }

  function autoGrow(textarea) {
    if (!textarea || textarea.dataset.onairoAutogrow === "off") return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 360) + "px";
  }

  function installProgress(form) {
    var fields = qsa(form, "input, select, textarea").filter(isValidatable);
    if (fields.length < 6) return function () {};
    var progress = document.createElement("div");
    progress.className = "onairo-form-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Form completion");
    progress.innerHTML =
      '<span class="onairo-form-progress__label">0% complete</span><span class="onairo-form-progress__track"><span></span></span>';
    form.insertBefore(progress, form.firstChild);
    function update() {
      var complete = fields.filter(function (el) {
        if (el.type === "checkbox" || el.type === "radio") return el.checked;
        return Boolean(trim(el.value));
      }).length;
      var percent = Math.round((complete / fields.length) * 100);
      progress.setAttribute("aria-valuenow", String(percent));
      qs(progress, ".onairo-form-progress__label").textContent = percent + "% complete";
      qs(progress, ".onairo-form-progress__track span").style.width = percent + "%";
    }
    update();
    return update;
  }

  function bindViewportFocus(form) {
    var viewport = global.visualViewport;
    var focused = null;
    function reveal() {
      if (!focused || !form.contains(focused)) return;
      var rect = focused.getBoundingClientRect();
      var visibleTop = viewport ? viewport.offsetTop : 0;
      var visibleBottom = visibleTop + (viewport ? viewport.height : global.innerHeight);
      if (rect.bottom > visibleBottom - 20 || rect.top < visibleTop + 20) {
        focused.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    form.addEventListener("focusin", function (e) {
      focused = e.target;
      setTimeout(reveal, 180);
    });
    form.addEventListener("focusout", function () {
      focused = null;
    });
    if (viewport) {
      viewport.addEventListener("resize", reveal);
      viewport.addEventListener("scroll", reveal);
    }
  }

  function setSubmitting(form, submitting, label) {
    var buttons = qsa(form, 'button[type="submit"], input[type="submit"]');
    if (!submitting) {
      global.clearTimeout(Number(form.dataset.onairoRecoveryTimer || 0));
      delete form.dataset.onairoRecoveryTimer;
    }
    form.classList.toggle("onairo-submitting", Boolean(submitting));
    form.setAttribute("aria-busy", String(Boolean(submitting)));
    buttons.forEach(function (button) {
      if (submitting) {
        if (!button.dataset.onairoSubmitLabel) {
          button.dataset.onairoSubmitLabel = button.tagName === "INPUT" ? button.value : button.textContent;
        }
        if (label) {
          if (button.tagName === "INPUT") button.value = label;
          else button.textContent = label;
        }
      } else if (button.dataset.onairoSubmitLabel) {
        if (button.tagName === "INPUT") button.value = button.dataset.onairoSubmitLabel;
        else button.textContent = button.dataset.onairoSubmitLabel;
      }
      button.disabled = Boolean(submitting);
    });
  }

  /* ------------------------------------------------------------------ *
   * Keyboard navigation
   * ------------------------------------------------------------------ */

  function bindKeyboard(form) {
    form.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var target = e.target;
      if (!target || !form.contains(target)) return;
      if (isTextarea(target)) return; // keep newline behaviour
      if (target.classList && target.classList.contains("onairo-phone__search")) return;
      if (isButtonLike(target) && target.type === "submit") return;

      e.preventDefault();

      if (isSelect(target)) {
        // Native select already commits the highlighted option on Enter in most browsers.
        var next = nextFocusable(form, target);
        if (next) next.focus();
        else if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        return;
      }

      var nextEl = nextFocusable(form, target);
      if (nextEl) {
        nextEl.focus();
        if (isSelect(nextEl) || (nextEl.tagName === "INPUT" && nextEl.type !== "checkbox" && nextEl.type !== "radio")) {
          try {
            nextEl.select && nextEl.type !== "file" && nextEl.select();
          } catch (_) {}
        }
        return;
      }

      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    });
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  function enhance(form, options) {
    if (!form || form.dataset.onairoEnhanced === "1") return form;
    form.dataset.onairoEnhanced = "1";
    options = options || {};

    form.setAttribute("novalidate", "");

    // Turn native required off for email/whatsapp so HTML5 doesn't block the OR rule.
    var email = qs(form, 'input[name="email"]');
    var whatsapp = qs(form, 'input[name="whatsapp"]');
    if (email) {
      email.required = false;
      email.removeAttribute("required");
      var emailLabel = email.id ? qs(form, 'label[for="' + email.id + '"]') : null;
      if (emailLabel) emailLabel.textContent = emailLabel.textContent.replace(/\s*\*\s*$/, "").trim() || "Email";
    }
    if (whatsapp) {
      whatsapp.required = false;
      whatsapp.removeAttribute("required");
      var waLabel = whatsapp.id ? qs(form, 'label[for="' + whatsapp.id + '"]') : null;
      if (waLabel) {
        waLabel.textContent = (waLabel.textContent.replace(/\s*\*\s*$/, "").trim() || "WhatsApp") + "";
      }
    }

    qsa(form, 'input[name="whatsapp"], input[data-onairo-phone="whatsapp"]').forEach(function (input) {
      var widget = enhancePhoneInput(input, options);
      if (widget) widget.root.__onairoPhone = widget;
    });

    if (options.enhancePhone !== false) {
      qsa(form, 'input[name="phone"]').forEach(function (input) {
        var widget = enhancePhoneInput(input, options);
        if (widget) widget.root.__onairoPhone = widget;
      });
    }

    bindKeyboard(form);
    bindViewportFocus(form);
    qsa(form, "textarea").forEach(function (textarea) {
      autoGrow(textarea);
      textarea.addEventListener("input", function () {
        autoGrow(textarea);
      });
    });
    restoreDraft(form);
    var updateProgress = installProgress(form);
    var saveTimer = 0;
    if (global.MutationObserver) {
      var submitObserver = new MutationObserver(function () {
        if (
          form.getAttribute("aria-busy") === "true" &&
          !qsa(form, 'button[type="submit"], input[type="submit"]').some(function (button) {
            return button.disabled;
          })
        ) {
          setSubmitting(form, false);
        }
      });
      qsa(form, 'button[type="submit"], input[type="submit"]').forEach(function (button) {
        submitObserver.observe(button, { attributes: true, attributeFilter: ["disabled"] });
      });
    }

    form.addEventListener(
      "submit",
      function (e) {
        var result = validateForm(form, options);
        if (!result.ok) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var hint =
            qs(form, ".form-hint, .lp-hint, [data-form-hint]") ||
            qs(form.parentElement, ".form-hint, .lp-hint");
          if (hint && result.firstInvalid) {
            var host = fieldHost(result.firstInvalid);
            var msg = host && qs(host, ".onairo-field-error.is-visible");
            if (msg && msg.textContent) hint.textContent = msg.textContent;
          }
        } else {
          form.dataset.onairoSubmitted = "true";
          global.clearTimeout(Number(form.dataset.onairoRecoveryTimer || 0));
          form.dataset.onairoRecoveryTimer = String(
            global.setTimeout(function () {
              setSubmitting(form, false);
            }, options.submitRecoveryMs || 30000)
          );
        }
      },
      true
    );

    // Validate touched fields live and persist recoverable drafts.
    form.addEventListener("input", function (e) {
      if (e.target) {
        if (e.target.dataset.onairoTouched === "true" || form.dataset.onairoSubmitted === "true") {
          validateField(form, e.target, options);
        } else {
          clearFieldError(e.target);
        }
        updateProgress();
        global.clearTimeout(saveTimer);
        saveTimer = global.setTimeout(function () {
          writeDraft(form);
        }, 350);
      }
    });
    form.addEventListener("change", function (e) {
      if (e.target) {
        validateField(form, e.target, options);
        updateProgress();
        writeDraft(form);
      }
    });
    form.addEventListener(
      "blur",
      function (e) {
        if (!isValidatable(e.target)) return;
        e.target.dataset.onairoTouched = "true";
        validateField(form, e.target, options);
      },
      true
    );
    form.addEventListener("submit", function () {
      setTimeout(function () {
        if (form.dataset.onairoSubmitted === "true") setSubmitting(form, true, "Submitting…");
      }, 0);
    });

    form.addEventListener("reset", function () {
      setTimeout(function () {
        delete form.dataset.onairoSubmitted;
        global.clearTimeout(Number(form.dataset.onairoRecoveryTimer || 0));
        qsa(form, ".onairo-phone").forEach(function (w) {
          if (w.__onairoPhone) w.__onairoPhone.sync();
        });
        clearFormErrors(form);
        qsa(form, "textarea").forEach(autoGrow);
        updateProgress();
        setSubmitting(form, false);
      }, 0);
    });

    return form;
  }

  function autoEnhance() {
    qsa(document, "form[data-onairo-form], #contactForm, #quoteForm, #lpLeadForm").forEach(function (form) {
      enhance(form, { requireEmailOrWhatsapp: true });
    });
  }

  O.FormUX = {
    CONTACT_MSG: CONTACT_MSG,
    enhance: enhance,
    validate: validateForm,
    validateContactChannels: validateContactChannels,
    enhancePhoneInput: enhancePhoneInput,
    composeInternational: composeInternational,
    setSubmitting: setSubmitting,
    clearDraft: clearDraft,
    autoEnhance: autoEnhance,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoEnhance);
  } else {
    autoEnhance();
  }
})(typeof window !== "undefined" ? window : global);
