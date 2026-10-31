/* Fit-to-screen for landscape tablets / phones: every scene is laid out at a
   wider design width and scaled (CSS zoom) so it fits one screen without scrolling.
   Desktop (>= 1280 wide and >= 800 high) and portrait keep the normal reflow layout. */
(function () {
  "use strict";
  var root = document.documentElement;
  var scenes = Array.prototype.slice.call(document.querySelectorAll(".scene"));
  var WIDTHS = [880, 1000, 1100, 1300, 1500, 1750];
  var timer = null;
  var lastKey = "";
  var pendingIdx = null;

  function isFit() {
    var w = window.innerWidth, h = window.innerHeight;
    return w > h && (h < 800 || w < 1280);
  }

  function barSpace(h) {
    return h <= 520 ? 46 : 104;
  }

  function currentScene() {
    var st = window.story;
    return st ? Math.max(0, Math.min(scenes.length - 1, st.current)) : 0;
  }

  function alignScroll(i) {
    if (window.story && window.story.align) { window.story.align(i); return; }
    var el = scenes[i], top = 0;
    for (; el; el = el.offsetParent) top += el.offsetTop;
    try { window.scrollTo({ top: top, behavior: "instant" }); } catch (e) { window.scrollTo(0, top); }
  }

  function clearFit() {
    root.classList.remove("fit");
    root.style.removeProperty("--fit-h");
    root.style.removeProperty("--fit-bar");
    scenes.forEach(function (s) {
      var inner = s.querySelector(".scene-inner");
      if (!inner) return;
      inner.style.removeProperty("--z");
      inner.style.removeProperty("--lw");
      inner.classList.remove("wide");
    });
  }

  var dims = { availW: 0, availH: 0 };

  function fitScene(inner) {
    if (!root.classList.contains("fit")) return;
    if (!inner.hasAttribute("data-native-max")) {
      inner.classList.remove("wide");
      inner.setAttribute("data-native-max", getComputedStyle(inner).maxWidth);
    }
    var availW = dims.availW, availH = dims.availH;
    var wide = inner.getAttribute("data-native-max") === "1100px";
    inner.classList.toggle("wide", wide);
    var oldZ = inner.style.getPropertyValue("--z"), oldLw = inner.style.getPropertyValue("--lw");
    var best = null, fallback = null;
    var nat = parseFloat(inner.getAttribute("data-native-max")) || 1100;
    var pref = Math.min(1100, availW);
    var cands = wide ? WIDTHS.slice().sort(function (a, b) { return Math.abs(a - pref) - Math.abs(b - pref); }) : [nat];
    cands.forEach(function (lw) {
      inner.style.setProperty("--z", "1");
      inner.style.setProperty("--lw", lw + "px");
      var h = inner.offsetHeight || 1;
      var z = Math.min(1, availW / lw, availH / h);
      var clipped = inner.scrollWidth > lw + 1;
      if (!clipped) {
        var sc = inner.querySelectorAll(".chart, .table-wrap");
        for (var k = 0; k < sc.length; k++) if (sc[k].scrollWidth > sc[k].clientWidth + 1) { clipped = true; break; }
      }
      if (clipped) { if (!fallback || z > fallback.z + 0.005) fallback = { z: z, lw: lw }; return; }
      if (!best || z > best.z + 0.005) best = { z: z, lw: lw };
    });
    if (!best) best = fallback || { z: Math.min(1, availW / 1100), lw: 1100 };
    var z = best.z;
    inner.style.setProperty("--lw", best.lw + "px");
    inner.style.setProperty("--z", z.toFixed(4));
    /* verify against the real rendered box; shrink if still too tall */
    for (var n = 0; n < 4; n++) {
      var r = inner.getBoundingClientRect();
      if (r.height <= availH + 0.5 && r.width <= availW + 0.5) break;
      z *= Math.min(availH / r.height, availW / r.width) * 0.995;
      inner.style.setProperty("--z", z.toFixed(4));
    }
    return oldZ !== inner.style.getPropertyValue("--z") || oldLw !== inner.style.getPropertyValue("--lw");
  }

  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) {
    var changed = false;
    entries.forEach(function (e) { if (fitScene(e.target)) changed = true; });
    if (changed) alignScroll(currentScene());
  }) : null;
  if (ro) scenes.forEach(function (s) { var i = s.querySelector(".scene-inner"); if (i) ro.observe(i); });

  function layout() {
    var cur = pendingIdx !== null ? pendingIdx : currentScene();
    pendingIdx = null;
    if (!isFit()) {
      if (root.classList.contains("fit")) { clearFit(); alignScroll(cur); }
      lastKey = "";
      return;
    }
    var vw = window.innerWidth, vh = window.innerHeight;
    var key = vw + "x" + vh;
    if (key === lastKey) return;
    lastKey = key;

    var bar = barSpace(vh);
    root.classList.add("fit");
    root.style.setProperty("--fit-h", vh + "px");
    root.style.setProperty("--fit-bar", bar + "px");
    dims.availW = vw - 16; dims.availH = vh - 10 - bar;

    scenes.forEach(function (s) {
      var inner = s.querySelector(".scene-inner");
      if (inner) fitScene(inner);
    });
    alignScroll(cur);
  }

  function schedule() {
    if (pendingIdx === null) pendingIdx = currentScene();
    window.clearTimeout(timer);
    timer = window.setTimeout(function () { window.requestAnimationFrame(layout); }, 120);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lastKey = ""; layout(); });
  layout();
})();
