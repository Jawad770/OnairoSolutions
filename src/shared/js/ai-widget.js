(function () {
  const STORAGE_KEY = "onairo_ai_session_v1";
  const SUGGESTIONS = [
    "What website packages do you offer?",
    "Tell me about EduTrack",
    "Show a dental clinic demo",
    "I need a custom business website",
  ];

  const ICON_BOT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v2M8 8h8a3 3 0 013 3v5a3 3 0 01-3 3H8a3 3 0 01-3-3v-5a3 3 0 013-3z"/><circle cx="9.5" cy="13" r="1" fill="currentColor"/><circle cx="14.5" cy="13" r="1" fill="currentColor"/><path d="M9 19v2M15 19v2"/></svg>`;
  const ICON_SEND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
  const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  const ICON_RESTART = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/></svg>`;
  const ICON_THEME = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Lightweight markdown → safe HTML */
  function renderMarkdown(src) {
    let text = escapeHtml(src);
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const lines = text.split("\n");
    const out = [];
    let inList = false;
    for (const line of lines) {
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push(`<li>${bullet[1]}</li>`);
        continue;
      }
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (!line.trim()) continue;
      out.push(`<p class="md-p">${line}</p>`);
    }
    if (inList) out.push("</ul>");
    return out.join("") || `<p class="md-p"></p>`;
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function preferredTheme() {
    const saved = localStorage.getItem("onairo_ai_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function createWidget() {
    const root = document.createElement("div");
    root.className = "ai-widget";
    root.dataset.theme = preferredTheme();
    root.innerHTML = `
      <button type="button" class="ai-launcher" id="aiLauncher" aria-label="Open Onairo AI consultant" aria-expanded="false" aria-controls="aiPanel">${ICON_BOT}</button>
      <div class="ai-panel" id="aiPanel" hidden role="dialog" aria-modal="true" aria-labelledby="aiTitle" tabindex="-1">
        <div class="ai-header">
          <div class="ai-header-avatar">O</div>
          <div class="ai-header-copy">
            <strong id="aiTitle">Onairo AI</strong>
            <span>Business consultant</span>
          </div>
          <div class="ai-header-actions">
            <button type="button" class="ai-icon-btn" id="aiTheme" title="Toggle theme" aria-label="Toggle theme">${ICON_THEME}</button>
            <button type="button" class="ai-icon-btn" id="aiRestart" title="Restart conversation" aria-label="Restart">${ICON_RESTART}</button>
            <button type="button" class="ai-icon-btn" id="aiClose" title="Close" aria-label="Close">${ICON_CLOSE}</button>
          </div>
        </div>
        <div class="ai-messages" id="aiMessages"></div>
        <div class="ai-suggestions" id="aiSuggestions"></div>
        <form class="ai-composer" id="aiForm">
          <textarea id="aiInput" rows="1" placeholder="Ask about websites, EduTrack, demos…" maxlength="2000" aria-label="Message"></textarea>
          <button type="submit" class="ai-send" id="aiSend" aria-label="Send">${ICON_SEND}</button>
        </form>
        <div class="ai-footer-note">Answers use Onairo’s published knowledge · Human team for final quotes</div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  function mount() {
    if (document.getElementById("aiLauncher")) return;
    const root = createWidget();
    const launcher = root.querySelector("#aiLauncher");
    const panel = root.querySelector("#aiPanel");
    const messagesEl = root.querySelector("#aiMessages");
    const suggestionsEl = root.querySelector("#aiSuggestions");
    const form = root.querySelector("#aiForm");
    const input = root.querySelector("#aiInput");
    const sendBtn = root.querySelector("#aiSend");

    let session = loadSession() || { sessionId: null, conversationId: null, history: [] };
    let ready = false;
    let streaming = false;
    let abortController = null;
    let lastFailedMessage = null;
    let focusBeforeOpen = null;

    function updateViewport() {
      const viewport = window.visualViewport;
      root.style.setProperty("--ai-vv-height", `${viewport ? viewport.height : window.innerHeight}px`);
      root.style.setProperty("--ai-vv-top", `${viewport ? viewport.offsetTop : 0}px`);
      if (!panel.hidden) scrollBottom();
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      root.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("ai-dialog-open", open);
      if (open) {
        focusBeforeOpen = document.activeElement;
        updateViewport();
        requestAnimationFrame(() => input.focus());
      } else {
        const target =
          focusBeforeOpen && document.contains(focusBeforeOpen) ? focusBeforeOpen : launcher;
        focusBeforeOpen = null;
        target.focus();
      }
    }

    function scrollBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addMessage(role, content, opts = {}) {
      const div = document.createElement("div");
      div.className = `ai-msg ${role}${opts.error ? " error" : ""}`;
      if (role === "assistant" && !opts.error) {
        div.innerHTML = renderMarkdown(content);
      } else {
        div.textContent = content;
      }
      messagesEl.appendChild(div);
      scrollBottom();
      return div;
    }

    function showTyping(show) {
      let el = messagesEl.querySelector(".ai-typing");
      if (!show) {
        if (el) el.remove();
        return;
      }
      if (!el) {
        el = document.createElement("div");
        el.className = "ai-typing";
        el.innerHTML = "<span></span><span></span><span></span>";
        messagesEl.appendChild(el);
      }
      scrollBottom();
    }

    function renderSuggestions() {
      suggestionsEl.innerHTML = "";
      SUGGESTIONS.forEach((text) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ai-chip";
        btn.textContent = text;
        btn.addEventListener("click", () => {
          input.value = text;
          form.requestSubmit();
        });
        suggestionsEl.appendChild(btn);
      });
    }

    function restoreHistory() {
      messagesEl.innerHTML = "";
      if (!session.history || !session.history.length) {
        addMessage(
          "assistant",
          "Hi — I’m the Onairo Solutions business consultant.\n\nI can help you explore websites, EduTrack, industry demos, and next steps. What are you looking to achieve?"
        );
        renderSuggestions();
        return;
      }
      session.history.forEach((m) => addMessage(m.role, m.content));
      suggestionsEl.innerHTML = "";
    }

    async function ensureSession(forceNew) {
      if (!forceNew && session.conversationId) return session;
      const res = await fetch(forceNew ? "/api/ai/conversation/restart" : "/api/ai/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId || undefined,
          conversationId: forceNew ? session.conversationId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not start chat");
      session = {
        sessionId: data.sessionId,
        conversationId: data.conversationId,
        history: forceNew ? [] : session.history || [],
      };
      saveSession(session);
      return session;
    }

    async function checkStatus() {
      try {
        const res = await fetch("/api/ai/status");
        const data = await res.json();
        ready = Boolean(data.ready);
        if (!ready) {
          messagesEl.innerHTML = "";
          const box = document.createElement("div");
          box.className = "ai-unavailable";
          box.textContent =
            "Our AI consultant is temporarily unavailable. Please WhatsApp us or use the contact form — we’ll help personally.";
          messagesEl.appendChild(box);
          form.style.display = "none";
          suggestionsEl.innerHTML = "";
        }
      } catch {
        ready = false;
      }
    }

    async function sendMessage(text) {
      if (!ready || streaming) return;
      const message = String(text || "").trim();
      if (!message) return;

      suggestionsEl.innerHTML = "";
      addMessage("user", message);
      session.history = session.history || [];
      session.history.push({ role: "user", content: message });
      saveSession(session);
      input.value = "";
      streaming = true;
      sendBtn.disabled = true;
      showTyping(true);
      lastFailedMessage = null;

      const assistantEl = document.createElement("div");
      assistantEl.className = "ai-msg assistant";
      assistantEl.hidden = true;
      messagesEl.appendChild(assistantEl);

      let assembled = "";
      abortController = new AbortController();

      try {
        await ensureSession(false);
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: session.conversationId,
            message,
          }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const lines = part.split("\n");
            let event = "message";
            let dataLine = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;
            let payload = {};
            try {
              payload = JSON.parse(dataLine);
            } catch {
              continue;
            }
            if (event === "token" && payload.content) {
              showTyping(false);
              assistantEl.hidden = false;
              assembled += payload.content;
              assistantEl.innerHTML = renderMarkdown(assembled);
              scrollBottom();
            } else if (event === "error") {
              showTyping(false);
              if (payload.message === "cancelled") return;
              lastFailedMessage = message;
              addMessage("assistant", payload.message || "Something went wrong.", { error: true });
              const retry = document.createElement("button");
              retry.type = "button";
              retry.className = "ai-chip";
              retry.textContent = "Retry";
              retry.addEventListener("click", () => {
                if (lastFailedMessage) sendMessage(lastFailedMessage);
              });
              suggestionsEl.appendChild(retry);
            } else if (event === "lead") {
              /* optional subtle note — keep quiet; assistant will confirm */
            } else if (event === "done") {
              showTyping(false);
            }
          }
        }

        if (assembled.trim()) {
          session.history.push({ role: "assistant", content: assembled.trim() });
          saveSession(session);
        }
      } catch (err) {
        showTyping(false);
        if (err.name === "AbortError") return;
        lastFailedMessage = message;
        addMessage(
          "assistant",
          "I couldn’t reach the consultant just now. Please try again, or WhatsApp our team.",
          { error: true }
        );
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "ai-chip";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => {
          if (lastFailedMessage) sendMessage(lastFailedMessage);
        });
        suggestionsEl.appendChild(retry);
      } finally {
        streaming = false;
        sendBtn.disabled = false;
        abortController = null;
        showTyping(false);
      }
    }

    launcher.addEventListener("click", async () => {
      const opening = panel.hidden;
      setOpen(opening);
      if (opening && !messagesEl.childElementCount) {
        await checkStatus();
        if (ready) restoreHistory();
      }
    });

    root.querySelector("#aiClose").addEventListener("click", () => {
      if (abortController) {
        fetch("/api/ai/chat/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: session.conversationId }),
        }).catch(() => {});
        abortController.abort();
      }
      setOpen(false);
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        root.querySelector("#aiClose").click();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    root.querySelector("#aiTheme").addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      localStorage.setItem("onairo_ai_theme", next);
    });

    root.querySelector("#aiRestart").addEventListener("click", async () => {
      if (streaming) return;
      try {
        await ensureSession(true);
        session.history = [];
        saveSession(session);
        restoreHistory();
      } catch (err) {
        addMessage("assistant", err.message || "Could not restart.", { error: true });
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage(input.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    });

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    }

    // Warm status check quietly
    checkStatus().catch(() => {});
  }

  function injectAssets() {
    const root = typeof ONAIRO !== "undefined" && ONAIRO.root ? ONAIRO.root() : "";
    if (!document.querySelector('link[data-ai-widget]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${root}src/shared/css/ai-widget.css`;
      link.dataset.aiWidget = "1";
      document.head.appendChild(link);
    }
  }

  function boot() {
    injectAssets();
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
