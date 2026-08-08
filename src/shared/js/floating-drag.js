/**
 * Safe drag support for Onairo's floating actions.
 * Buttons stay docked to the left or right edge and only move vertically
 * along that side. Switching sides snaps to the nearer edge.
 */
(function () {
  const EDGE = 10;
  const COLLISION_GAP = 12;
  const DRAG_THRESHOLD = 6;
  const controls = new Map();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function storageKey(key) {
    return `onairo_float_side_${key}`;
  }

  function readPosition(key) {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey(key)) || "null");
      if (!value || !Number.isFinite(value.y)) return null;
      const side = value.side === "left" ? "left" : "right";
      return { side, y: value.y };
    } catch (_error) {
      return null;
    }
  }

  function savePosition(key, side, y) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify({ side, y }));
    } catch (_error) {
      /* Storage can be unavailable in private browsing; dragging still works. */
    }
  }

  function viewportBox() {
    const viewport = window.visualViewport;
    return {
      left: viewport ? viewport.offsetLeft : 0,
      top: viewport ? viewport.offsetTop : 0,
      width: viewport ? viewport.width : window.innerWidth,
      height: viewport ? viewport.height : window.innerHeight,
    };
  }

  function safeAreaInsets() {
    let probe = document.getElementById("onairoSafeAreaProbe");
    if (!probe) {
      probe = document.createElement("div");
      probe.id = "onairoSafeAreaProbe";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;visibility:hidden;pointer-events:none;" +
        "padding:env(safe-area-inset-top) env(safe-area-inset-right) " +
        "env(safe-area-inset-bottom) env(safe-area-inset-left)";
      document.body.appendChild(probe);
    }
    const styles = getComputedStyle(probe);
    return {
      top: parseFloat(styles.paddingTop) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0,
      left: parseFloat(styles.paddingLeft) || 0,
    };
  }

  function boundsFor(el) {
    const viewport = viewportBox();
    const safe = safeAreaInsets();
    return {
      minX: viewport.left + safe.left + EDGE,
      minY: viewport.top + safe.top + EDGE,
      maxX: viewport.left + viewport.width - el.offsetWidth - safe.right - EDGE,
      maxY: viewport.top + viewport.height - el.offsetHeight - safe.bottom - EDGE,
    };
  }

  function resolveSide(x, el, bounds, preferredSide) {
    if (preferredSide === "left" || preferredSide === "right") return preferredSide;
    const centerX = x + el.offsetWidth / 2;
    const mid = bounds.minX + (bounds.maxX - bounds.minX + el.offsetWidth) / 2;
    return centerX < mid ? "left" : "right";
  }

  function sideX(side, bounds) {
    return side === "left" ? bounds.minX : bounds.maxX;
  }

  function place(el, x, y, options = {}) {
    const avoidCollision = options.avoidCollision !== false;
    const bounds = boundsFor(el);
    const side = resolveSide(x, el, bounds, options.side);
    let nextX = sideX(side, bounds);
    let nextY = clamp(y, bounds.minY, bounds.maxY);

    if (avoidCollision) {
      controls.forEach((control) => {
        if (control.el === el || control.el.hidden || !control.el.getClientRects().length) return;
        const other = control.el.getBoundingClientRect();
        const otherSide = resolveSide(other.left, control.el, boundsFor(control.el));
        if (otherSide !== side) return;

        const overlaps =
          nextY < other.bottom + COLLISION_GAP &&
          nextY + el.offsetHeight + COLLISION_GAP > other.top;
        if (!overlaps) return;

        const above = other.top - el.offsetHeight - COLLISION_GAP;
        const below = other.bottom + COLLISION_GAP;
        if (above >= bounds.minY) nextY = above;
        else if (below <= bounds.maxY) nextY = below;
        else nextY = clamp(below, bounds.minY, bounds.maxY);
      });
    }

    el.style.left = `${nextX}px`;
    el.style.top = `${nextY}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.dataset.floatSide = side;
    return { side, x: nextX, y: nextY };
  }

  function anchorAiPanel(launcher) {
    const panel = document.getElementById("aiPanel");
    if (!panel || panel.hidden || !launcher.dataset.floatMoved) return;
    if (window.matchMedia("(max-width: 1024px)").matches) {
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
      panel.style.removeProperty("right");
      panel.style.removeProperty("bottom");
      panel.style.removeProperty("max-width");
      panel.style.removeProperty("max-height");
      return;
    }

    const viewport = viewportBox();
    const safe = safeAreaInsets();
    const minX = viewport.left + safe.left + EDGE;
    const minY = viewport.top + safe.top + EDGE;
    const maxRight = viewport.left + viewport.width - safe.right - EDGE;
    const maxBottom = viewport.top + viewport.height - safe.bottom - EDGE;
    const launcherRect = launcher.getBoundingClientRect();
    const panelWidth = Math.min(400, maxRight - minX);
    const panelHeight = Math.min(620, maxBottom - minY);
    const opensLeft = (launcher.dataset.floatSide || "right") === "right";

    let left = opensLeft ? launcherRect.right - panelWidth : launcherRect.left;
    let top = launcherRect.top - panelHeight - 12;
    if (top < minY) top = launcherRect.bottom + 12;

    left = clamp(left, minX, maxRight - panelWidth);
    top = clamp(top, minY, maxBottom - panelHeight);

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.maxWidth = `${maxRight - minX}px`;
    panel.style.maxHeight = `${maxBottom - minY}px`;
  }

  function restore(control) {
    const saved = readPosition(control.key);
    if (!saved) return;
    control.el.dataset.floatMoved = "true";
    const bounds = boundsFor(control.el);
    const position = place(control.el, sideX(saved.side, bounds), saved.y, { side: saved.side });
    savePosition(control.key, position.side, position.y);
    if (control.key === "ai") anchorAiPanel(control.el);
  }

  function makeDraggable(el, key) {
    if (!el || el.dataset.floatDraggable === "true") return;

    const control = { el, key, drag: null, suppressClickUntil: 0 };
    controls.set(key, control);
    el.dataset.floatDraggable = "true";
    el.title = `${el.title ? `${el.title} · ` : ""}Drag up/down · pull left/right to switch side`;

    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const rect = el.getBoundingClientRect();
      control.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        moved: false,
      };
      el.setPointerCapture?.(event.pointerId);
      el.classList.add("float-drag-ready");
    });

    el.addEventListener("pointermove", (event) => {
      const drag = control.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        el.classList.add("is-dragging");
        document.documentElement.classList.add("floating-control-dragging");
      }

      event.preventDefault();
      const position = place(el, drag.originX + dx, drag.originY + dy);
      if (key === "ai") anchorAiPanel(el);
      control.lastPosition = position;
    });

    function finish(event) {
      const drag = control.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      control.drag = null;
      el.releasePointerCapture?.(event.pointerId);
      el.classList.remove("float-drag-ready", "is-dragging");
      document.documentElement.classList.remove("floating-control-dragging");

      if (!drag.moved) return;
      control.suppressClickUntil = performance.now() + 350;
      el.dataset.floatMoved = "true";
      const rect = el.getBoundingClientRect();
      const position = place(el, rect.left, rect.top, { side: el.dataset.floatSide });
      savePosition(key, position.side, position.y);
      if (key === "ai") anchorAiPanel(el);
    }

    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener(
      "click",
      (event) => {
        if (performance.now() > control.suppressClickUntil) return;
        control.suppressClickUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );

    restore(control);
  }

  function mountAvailableControls() {
    makeDraggable(document.getElementById("waFloat"), "whatsapp");
    makeDraggable(document.getElementById("aiLauncher"), "ai");
    controls.forEach((control) => {
      if (control.el.dataset.floatMoved !== "true") return;
      const rect = control.el.getBoundingClientRect();
      const position = place(control.el, rect.left, rect.top, {
        side: control.el.dataset.floatSide || "right",
      });
      savePosition(control.key, position.side, position.y);
    });
  }

  let resizeFrame = 0;
  function reclampControls() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      controls.forEach((control) => {
        if (control.el.dataset.floatMoved !== "true") return;
        const rect = control.el.getBoundingClientRect();
        const position = place(control.el, rect.left, rect.top, {
          side: control.el.dataset.floatSide || "right",
        });
        savePosition(control.key, position.side, position.y);
      });
      const ai = controls.get("ai");
      if (ai) anchorAiPanel(ai.el);
    });
  }

  window.addEventListener("resize", reclampControls);
  window.addEventListener("orientationchange", reclampControls);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", reclampControls);
    window.visualViewport.addEventListener("scroll", reclampControls);
  }

  mountAvailableControls();
  if (!document.getElementById("waFloat") || !document.getElementById("aiLauncher")) {
    const observer = new MutationObserver(() => {
      mountAvailableControls();
      if (
        document.getElementById("waFloat")?.dataset.floatDraggable === "true" &&
        document.getElementById("aiLauncher")?.dataset.floatDraggable === "true"
      ) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#aiLauncher")) {
      requestAnimationFrame(() => {
        const ai = controls.get("ai");
        if (ai) anchorAiPanel(ai.el);
      });
    }
  });
})();
