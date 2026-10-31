/* "ลองเล่น" playgrounds: s-metrics, s-permutation, s-rf-3 (OOB), fold pages, s-compare, s-importance.
   Vanilla JS, no modules. Real numbers come only from DATA; example values are labelled "ตัวอย่าง". */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(reduceMq && reduceMq.matches); }
  function hasData() { return typeof DATA !== "undefined" && DATA; }

  /* ---------- helpers ---------- */
  function el(tag, cls, text, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function comma(n) { return Math.round(n).toLocaleString("en-US"); }
  function toNum(s) { return Number(String(s).replace(/,/g, "")); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* tween 0..1 progress; returns cancel fn. Reduced motion: jumps to the end. */
  function tween(dur, onFrame, onDone) {
    if (reduced() || dur <= 0) { onFrame(1); if (onDone) onDone(); return function () {}; }
    var start = null, raf = 0, dead = false;
    function step(ts) {
      if (dead) return;
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      onFrame(easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return function () { dead = true; cancelAnimationFrame(raf); };
  }

  /* ---------- shared overlay dialog ---------- */
  var openState = null;

  function focusables(root) {
    return Array.prototype.slice.call(root.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) { return n.offsetParent !== null || n instanceof SVGElement; });
  }

  function closeDialog() {
    if (!openState) return;
    var st = openState;
    openState = null;
    try { if (st.cleanup) st.cleanup(); } catch (e) { /* ignore */ }
    if (st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
    document.documentElement.classList.remove("pm-lock");
    if (st.lastFocus && st.lastFocus.focus) { try { st.lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function openDialog(opts) {
    closeDialog();
    if (window.story && typeof window.story.pause === "function") window.story.pause();
    var overlay = el("div", "pm-overlay");
    var card = el("div", "pm-dialog " + (opts.cls || ""), null, {
      role: "dialog", "aria-modal": "true", "aria-labelledby": "pm-dlg-title", tabindex: "-1"
    });
    var head = el("div", "pm-dlg-head");
    head.appendChild(el("span", "pm-play-badge", "🎮 ลองเล่น"));
    var h = el("h3", "pm-dlg-title", opts.title, { id: "pm-dlg-title" });
    head.appendChild(h);
    var closeBtn = el("button", "pm-close", "✕", { type: "button", "aria-label": "ปิดหน้าต่างลองเล่น" });
    head.appendChild(closeBtn);
    card.appendChild(head);
    card.appendChild(el("p", "pm-instr", opts.instruction));
    var body = el("div", "pm-body");
    card.appendChild(body);
    overlay.appendChild(card);

    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) closeDialog(); });
    closeBtn.addEventListener("click", closeDialog);
    card.addEventListener("keydown", function (e) {
      e.stopPropagation(); /* keep Space / arrows away from the story player */
      if (e.key === "Escape") { e.preventDefault(); closeDialog(); return; }
      if (e.key === "Tab") {
        var f = focusables(card);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    ["keyup", "keypress"].forEach(function (t) { card.addEventListener(t, function (e) { e.stopPropagation(); }); });

    document.documentElement.classList.add("pm-lock");
    document.body.appendChild(overlay);
    openState = { overlay: overlay, lastFocus: document.activeElement, cleanup: null };
    openState.cleanup = opts.build(body);
    requestAnimationFrame(function () { overlay.classList.add("pm-open"); });
    closeBtn.focus({ preventScroll: true });
  }

  /* Escape also works when focus fell back to the page */
  document.addEventListener("keydown", function (e) {
    if (openState && e.key === "Escape") closeDialog();
  });

  /* ---------- launcher buttons ---------- */
  function addLaunch(sceneId, ariaLabel, openFn) {
    var scene = document.getElementById(sceneId);
    if (!scene) return;
    var inner = scene.querySelector(".scene-inner");
    if (!inner || inner.querySelector(".pm-launch")) return;
    var b = el("button", "pm-launch reveal", "🎮 ลองเล่น", { type: "button", "aria-label": ariaLabel });
    b.style.setProperty("--d", "600");
    b.addEventListener("click", openFn);
    inner.insertBefore(b, inner.firstChild);
  }

  /* =========================================================
     1. METRICS  (drag predicted dots)
     ========================================================= */
  var CARS = [
    { n: "A", y: 320000 }, { n: "B", y: 450000 }, { n: "C", y: 580000 },
    { n: "D", y: 690000 }, { n: "E", y: 820000 }, { n: "F", y: 960000 }
  ];
  var START_ERR = [20000, -30000, 15000, -25000, 40000, -60000];
  var Y_MAX = 1100000;

  function computeMetrics(preds) {
    var n = CARS.length, mean = 0, i;
    for (i = 0; i < n; i++) mean += CARS[i].y;
    mean /= n;
    var sse = 0, sst = 0, sae = 0, sape = 0;
    for (i = 0; i < n; i++) {
      var e = preds[i] - CARS[i].y;
      sse += e * e; sst += Math.pow(CARS[i].y - mean, 2);
      sae += Math.abs(e); sape += Math.abs(e) / CARS[i].y;
    }
    return { r2: 1 - sse / sst, mae: sae / n, rmse: Math.sqrt(sse / n), mape: 100 * sape / n, sse: sse };
  }

  function buildMetrics(body) {
    var preds = CARS.map(function (c, i) { return c.y + START_ERR[i]; });
    var cancelTween = null;

    var layout = el("div", "pm-metrics");
    var left = el("div", "pm-metrics-chart");
    var cap = el("div", "pm-sub");
    cap.appendChild(el("span", "badge example", "ตัวอย่าง"));
    cap.appendChild(el("span", "pm-sub-txt", "รถ 6 คัน · ราคาจริง ● กับราคาที่ทำนาย ◯ (ลากได้)"));
    left.appendChild(cap);

    var W = 520, H = 290, L = 58, R = 12, T = 14, B = 34;
    var plotW = W - L - R, plotH = H - T - B;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "pm-svg", role: "group", "aria-label": "กราฟราคาจริงและราคาทำนายของรถตัวอย่าง 6 คัน" });
    function yAt(v) { return T + plotH * (1 - v / Y_MAX); }
    function xAt(i) { return L + plotW * (i + 0.5) / CARS.length; }
    [0, 250000, 500000, 750000, 1000000].forEach(function (g) {
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: yAt(g), y2: yAt(g), class: "pm-grid" }));
      svg.appendChild(svgEl("text", { x: L - 8, y: yAt(g) + 4, "text-anchor": "end", class: "pm-axis" }, g === 0 ? "0" : (g / 1000) + "k"));
    });
    var items = CARS.map(function (c, i) {
      var g = svgEl("g", {});
      var stick = svgEl("line", { x1: xAt(i), x2: xAt(i), class: "pm-stick" });
      var last = i === CARS.length - 1;
      var errTxt = svgEl("text", { x: xAt(i) + (last ? -12 : 12), "text-anchor": last ? "end" : "start", class: "pm-errtxt" });
      var actual = svgEl("circle", { cx: xAt(i), cy: yAt(c.y), r: 7, class: "pm-actual" });
      var pg = svgEl("g", {
        class: "pm-pred", tabindex: "0", role: "slider",
        "aria-label": "ราคาทำนายรถ " + c.n + " (ราคาจริง " + comma(c.y) + " บาท)",
        "aria-valuemin": "0", "aria-valuemax": String(Y_MAX)
      });
      var hit = svgEl("circle", { cx: xAt(i), r: 22, class: "pm-hit" });
      var dot = svgEl("circle", { cx: xAt(i), r: 10, class: "pm-pred-dot" });
      pg.appendChild(hit); pg.appendChild(dot);
      g.appendChild(stick); g.appendChild(actual); g.appendChild(pg); g.appendChild(errTxt);
      svg.appendChild(g);
      svg.appendChild(svgEl("text", { x: xAt(i), y: H - 12, "text-anchor": "middle", class: "pm-axis pm-carlabel" }, "รถ " + c.n));
      return { stick: stick, errTxt: errTxt, hit: hit, dot: dot, pg: pg };
    });
    left.appendChild(svg);

    var legend = el("div", "pm-legend");
    legend.innerHTML = '<span><i class="pm-key actual"></i>ราคาจริง</span><span><i class="pm-key pred"></i>ราคาที่ทำนาย</span><span><i class="pm-key stick"></i>ความคลาดเคลื่อน</span>';
    left.appendChild(legend);

    var right = el("div", "pm-metrics-cards");
    var cards = {};
    [
      ["r2", "R²", "ยิ่งสูงยิ่งดี (เต็ม 1)"],
      ["mae", "MAE", "บาท · ยิ่งต่ำยิ่งดี"],
      ["rmse", "RMSE", "บาท · ยิ่งต่ำยิ่งดี"],
      ["mape", "MAPE", "% · ยิ่งต่ำยิ่งดี"]
    ].forEach(function (m) {
      var c = el("div", "pm-mcard pm-mcard-" + m[0]);
      c.appendChild(el("div", "pm-mname", m[1]));
      var v = el("div", "pm-mval tnum", "–");
      c.appendChild(v);
      c.appendChild(el("div", "pm-munit", m[2]));
      right.appendChild(c);
      cards[m[0]] = { box: c, val: v };
    });

    var sentence = el("p", "pm-sentence", "", { "aria-live": "polite" });
    var actions = el("div", "pm-actions");
    var bRand = el("button", "pm-btn", "🎲 สุ่มใหม่", { type: "button", "aria-label": "สุ่มราคาทำนายใหม่" });
    var bPerf = el("button", "pm-btn pm-btn-primary", "🎯 ทำนายเป๊ะ", { type: "button", "aria-label": "ทำให้ราคาทำนายตรงกับราคาจริงทุกคัน" });
    actions.appendChild(bRand); actions.appendChild(bPerf);

    layout.appendChild(left);
    var rightWrap = el("div", "pm-metrics-right");
    rightWrap.appendChild(right);
    rightWrap.appendChild(sentence);
    rightWrap.appendChild(actions);
    layout.appendChild(rightWrap);
    body.appendChild(layout);

    function render() {
      var i;
      for (i = 0; i < CARS.length; i++) {
        var py = yAt(preds[i]), ay = yAt(CARS[i].y), it = items[i];
        it.dot.setAttribute("cy", py); it.hit.setAttribute("cy", py);
        it.stick.setAttribute("y1", ay); it.stick.setAttribute("y2", py);
        var e = Math.round(preds[i] - CARS[i].y);
        it.errTxt.setAttribute("y", (ay + py) / 2 + 4);
        it.errTxt.textContent = e === 0 ? "" : (e > 0 ? "+" : "−") + comma(Math.abs(e));
        it.pg.setAttribute("aria-valuenow", String(Math.round(preds[i])));
        it.pg.setAttribute("aria-valuetext", comma(preds[i]) + " บาท (คลาดเคลื่อน " + (e > 0 ? "+" : e < 0 ? "−" : "") + comma(Math.abs(e)) + ")");
      }
      var m = computeMetrics(preds);
      cards.r2.val.textContent = m.r2.toFixed(4);
      cards.mae.val.textContent = comma(m.mae);
      cards.rmse.val.textContent = comma(m.rmse);
      cards.mape.val.textContent = m.mape.toFixed(2);
      var maxAbs = 0, maxI = 0;
      for (i = 0; i < CARS.length; i++) {
        var a = Math.abs(preds[i] - CARS[i].y);
        if (a > maxAbs) { maxAbs = a; maxI = i; }
      }
      var big = false;
      if (m.sse < 0.5) {
        sentence.textContent = "ทำนายเป๊ะทุกคัน: ความคลาดเคลื่อนเป็น 0 จึงได้ R² = 1 ส่วน MAE, RMSE และ MAPE เท่ากับ 0";
      } else {
        var ratio = m.rmse / m.mae;
        big = ratio >= 1.35;
        sentence.textContent = big
          ? "รถ " + CARS[maxI].n + " พลาดไป " + comma(maxAbs) + " บาท ทำให้ RMSE (" + comma(m.rmse) + ") สูงกว่า MAE (" + comma(m.mae) + ") ถึง " + ratio.toFixed(2) + " เท่า เพราะ RMSE ยกกำลังสองก่อนเฉลี่ย จึงไวต่อความพลาดก้อนใหญ่ที่สุด"
          : "ความพลาดกระจายใกล้เคียงกัน RMSE (" + comma(m.rmse) + ") จึงใกล้ MAE (" + comma(m.mae) + ") ลองลากรถสักคันให้พลาดมาก ๆ แล้วดู RMSE พุ่งขึ้นแรงที่สุด";
      }
      cards.rmse.box.classList.toggle("pm-hot", big);
    }

    /* pointer drag */
    function valueFromEvent(e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return clamp((T + plotH - p.y) / plotH * Y_MAX, 0, Y_MAX);
    }
    items.forEach(function (it, i) {
      var dragging = false;
      it.pg.addEventListener("pointerdown", function (e) {
        if (cancelTween) { cancelTween(); cancelTween = null; }
        dragging = true;
        try { it.pg.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        it.pg.classList.add("pm-drag");
        preds[i] = valueFromEvent(e); render();
        e.preventDefault();
      });
      it.pg.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        preds[i] = valueFromEvent(e); render();
      });
      function end(e) {
        if (!dragging) return;
        dragging = false;
        it.pg.classList.remove("pm-drag");
        try { it.pg.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      }
      it.pg.addEventListener("pointerup", end);
      it.pg.addEventListener("pointercancel", end);
      it.pg.addEventListener("keydown", function (e) {
        var step = e.shiftKey ? 50000 : 10000, d = 0;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") d = step;
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -step;
        else if (e.key === "PageUp") d = 50000;
        else if (e.key === "PageDown") d = -50000;
        else if (e.key === "Home") { preds[i] = 0; render(); e.preventDefault(); return; }
        else if (e.key === "End") { preds[i] = Y_MAX; render(); e.preventDefault(); return; }
        else return;
        e.preventDefault();
        preds[i] = clamp(preds[i] + d, 0, Y_MAX);
        render();
      });
    });

    function animateTo(targets) {
      if (cancelTween) cancelTween();
      var from = preds.slice();
      cancelTween = tween(550, function (t) {
        for (var i = 0; i < preds.length; i++) preds[i] = from[i] + (targets[i] - from[i]) * t;
        render();
      }, function () { cancelTween = null; });
    }
    bPerf.addEventListener("click", function () { animateTo(CARS.map(function (c) { return c.y; })); });
    bRand.addEventListener("click", function () {
      var bigIdx = Math.random() < 0.5 ? Math.floor(Math.random() * CARS.length) : -1;
      animateTo(CARS.map(function (c, i) {
        var mag = i === bigIdx ? 0.25 + Math.random() * 0.15 : 0.02 + Math.random() * 0.1;
        var sign = Math.random() < 0.5 ? -1 : 1;
        return clamp(c.y * (1 + sign * mag), 0, Y_MAX);
      }));
    });

    render();
    return function () { if (cancelTween) cancelTween(); };
  }

  /* =========================================================
     2. PERMUTATION IMPORTANCE
     ========================================================= */
  var PERM = {
    base: 52000,
    pi: [95000, 3000, 61000, 17000, 110000, 6000], /* ตัวอย่าง */
    scaleMax: 200000
  };

  function buildPermutation(body) {
    var COLS = 6, ROWS = 5;
    var letters = "ABCDEF";
    var grid = [], c, r;
    for (c = 0; c < COLS; c++) { grid[c] = []; for (r = 0; r < ROWS; r++) grid[c][r] = letters[c] + (r + 1); }
    var timers = [];
    var selected = -1;
    var results = {};
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

    var layout = el("div", "pm-perm");
    var left = el("div", "pm-perm-left");
    var cap = el("div", "pm-sub");
    cap.appendChild(el("span", "badge example", "ตัวอย่าง"));
    cap.appendChild(el("span", "pm-sub-txt", "เลือกคอลัมน์ที่จะสลับ"));
    left.appendChild(cap);

    var picks = el("div", "pm-picks", null, { role: "group", "aria-label": "เลือกคอลัมน์ที่จะสลับ" });
    var pickBtns = [];
    for (c = 0; c < COLS; c++) {
      (function (ci) {
        var b = el("button", "pm-pick", "X" + (ci + 1), { type: "button", "aria-pressed": "false", "aria-label": "สลับคอลัมน์ X" + (ci + 1) });
        b.addEventListener("click", function () { shuffleCol(ci); });
        picks.appendChild(b); pickBtns.push(b);
      })(c);
    }
    left.appendChild(picks);

    var table = el("table", "pm-ptable");
    var thead = el("thead"), htr = el("tr");
    for (c = 0; c < COLS; c++) htr.appendChild(el("th", null, "X" + (c + 1)));
    thead.appendChild(htr); table.appendChild(thead);
    var tbody = el("tbody"), cells = [];
    for (r = 0; r < ROWS; r++) {
      var tr = el("tr");
      for (c = 0; c < COLS; c++) {
        var td = el("td", null, grid[c][r]);
        tr.appendChild(td);
        (cells[c] = cells[c] || [])[r] = td;
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    left.appendChild(el("div", "pm-table-wrap")).appendChild(table);
    var again = el("button", "pm-btn pm-btn-primary", "🔀 สลับอีกครั้ง", { type: "button", "aria-label": "สลับคอลัมน์ที่เลือกอีกครั้ง" });
    again.hidden = true;
    left.appendChild(again);

    var right = el("div", "pm-perm-right");
    var cap2 = el("div", "pm-sub");
    cap2.appendChild(el("span", "badge example", "ตัวอย่าง"));
    cap2.appendChild(el("span", "pm-sub-txt", "Error ของโมเดล (บาท)"));
    right.appendChild(cap2);
    function barRow(label, cls) {
      var row = el("div", "pm-brow");
      var lab = el("span", "pm-blabel", label);
      var track = el("div", "pm-btrack");
      var fill = el("span", "pm-bfill " + cls);
      track.appendChild(fill);
      var val = el("span", "pm-bval tnum", "");
      row.appendChild(lab); row.appendChild(track); row.appendChild(val);
      right.appendChild(row);
      return { label: lab, fill: fill, val: val };
    }
    var rBase = barRow("Error_base", "rf");
    var rShuf = barRow("Error_shuffled", "xgb");
    var piBox = el("div", "pm-pi", "เลือกคอลัมน์ด้านซ้ายเพื่อเริ่มสลับ", { "aria-live": "polite" });
    right.appendChild(piBox);
    right.appendChild(el("div", "pm-sub-txt pm-chips-title", "ผลที่ลองแล้ว (PI ตัวอย่าง)"));
    var chips = el("div", "pm-chips");
    right.appendChild(chips);
    right.appendChild(el("p", "pm-note", "ค่าในหน้านี้เป็นตัวอย่างเพื่ออธิบายแนวคิด ไม่ใช่ผลจริงของงานวิจัย ผลจริงดูได้ในหน้า \"อะไรทำให้ราคาเปลี่ยนมากที่สุด\""));

    layout.appendChild(left); layout.appendChild(right);
    body.appendChild(layout);

    function setBars(base, shuf, animate) {
      var wB = base / PERM.scaleMax * 100, wS = shuf / PERM.scaleMax * 100;
      rBase.fill.style.width = (animate ? 0 : wB) + "%";
      rShuf.fill.style.width = (animate ? 0 : wS) + "%";
      rBase.val.textContent = comma(base);
      rShuf.val.textContent = shuf == null ? "" : comma(shuf);
      if (animate) {
        later(function () { rBase.fill.style.width = wB + "%"; }, 30);
        later(function () { rShuf.fill.style.width = wS + "%"; }, reduced() ? 30 : 650);
      }
    }
    setBars(PERM.base, PERM.base, false);
    rShuf.fill.style.width = "0%"; rShuf.val.textContent = "";

    function derange(arr) {
      var n = arr.length, out, ok, i;
      do {
        out = arr.slice();
        for (i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
        ok = true; for (i = 0; i < n; i++) if (out[i] === arr[i]) ok = false;
      } while (!ok);
      return out;
    }
    function resetColumn(ci) {
      for (var r2 = 0; r2 < ROWS; r2++) { grid[ci][r2] = letters[ci] + (r2 + 1); cells[ci][r2].textContent = grid[ci][r2]; }
    }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function renderChips() {
      chips.innerHTML = "";
      Object.keys(results).sort().forEach(function (k) {
        chips.appendChild(el("span", "pm-chip", "X" + (Number(k) + 1) + ": +" + comma(results[k])));
      });
    }

    function shuffleCol(ci) {
      clearTimers();
      if (selected !== -1 && selected !== ci) {
        resetColumn(selected);
        for (var r3 = 0; r3 < ROWS; r3++) cells[selected][r3].classList.remove("pm-shuf", "pm-col");
      }
      selected = ci;
      pickBtns.forEach(function (b, i) { b.setAttribute("aria-pressed", i === ci ? "true" : "false"); b.classList.toggle("on", i === ci); });
      for (var k = 0; k < COLS; k++) for (var q = 0; q < ROWS; q++) cells[k][q].classList.toggle("pm-col", k === ci);
      again.hidden = false;
      resetColumn(ci);
      rShuf.label.textContent = "Error_X" + (ci + 1) + "_shuffled";
      piBox.textContent = "กำลังสลับค่าในคอลัมน์ X" + (ci + 1) + " ...";
      rBase.fill.style.width = (PERM.base / PERM.scaleMax * 100) + "%";
      rShuf.fill.style.width = "0%"; rShuf.val.textContent = "";

      var final = derange(grid[ci]);
      var ticks = reduced() ? 0 : 7;
      var i2;
      for (i2 = 0; i2 < ticks; i2++) {
        (function (n) {
          later(function () {
            var tmp = grid[ci].slice().sort(function () { return Math.random() - 0.5; });
            for (var rr = 0; rr < ROWS; rr++) { cells[ci][rr].textContent = tmp[rr]; cells[ci][rr].classList.add("pm-shuf"); }
          }, n * 110);
        })(i2);
      }
      later(function () {
        for (var rr = 0; rr < ROWS; rr++) { cells[ci][rr].textContent = final[rr]; cells[ci][rr].classList.remove("pm-shuf"); }
        grid[ci] = final;
        var jitter = 1 + (Math.random() * 0.16 - 0.08);
        var pi = Math.round(PERM.pi[ci] * jitter / 100) * 100;
        var shuf = PERM.base + pi;
        results[ci] = pi;
        rShuf.val.textContent = comma(shuf);
        rBase.val.textContent = comma(PERM.base);
        rBase.fill.style.width = (PERM.base / PERM.scaleMax * 100) + "%";
        rShuf.fill.style.width = (shuf / PERM.scaleMax * 100) + "%";
        piBox.textContent = "PI ของ X" + (ci + 1) + " = " + comma(shuf) + " − " + comma(PERM.base) + " = " + comma(pi) + " บาท" +
          (pi >= 50000 ? " → สลับแล้วพังมาก แปลว่าสำคัญ" : pi <= 8000 ? " → แทบไม่เปลี่ยน แปลว่าสำคัญน้อย" : " → เพิ่มขึ้นพอสมควร");
        renderChips();
      }, ticks * 110 + (reduced() ? 0 : 150));
    }
    again.addEventListener("click", function () { if (selected !== -1) shuffleCol(selected); });
    return clearTimers;
  }

  /* =========================================================
     3. RF OOB slider
     ========================================================= */
  function buildOob(body) {
    var oob = DATA.rf.oob;
    var labels = oob.labels.map(Number), vals = oob.values;
    var n = vals.length, idx = oob.markerIndex != null ? oob.markerIndex : 0;
    var autoTimer = 0;

    var wrap = el("div", "pm-oob");
    var W = 520, H = 250, L = 62, R = 18, T = 18, B = 40;
    var plotW = W - L - R, plotH = H - T - B;
    var lo = 52400, hi = 53300;
    function xAt(i) { return L + plotW * i / (n - 1); }
    function yAt(v) { return T + plotH * (1 - (v - lo) / (hi - lo)); }
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "pm-svg", role: "img", "aria-label": "กราฟ OOB MAE ตามจำนวนต้นไม้ พร้อมตัวชี้ที่เลื่อนได้" });
    [52500, 52750, 53000, 53250].forEach(function (g) {
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: yAt(g), y2: yAt(g), class: "pm-grid" }));
      svg.appendChild(svgEl("text", { x: L - 8, y: yAt(g) + 4, "text-anchor": "end", class: "pm-axis" }, comma(g)));
    });
    var d = "";
    vals.forEach(function (v, i) { d += (i ? "L" : "M") + xAt(i).toFixed(1) + " " + yAt(v).toFixed(1); });
    svg.appendChild(svgEl("path", { d: d, class: "pm-line rf" }));
    var dots = vals.map(function (v, i) {
      svg.appendChild(svgEl("text", { x: xAt(i), y: H - 16, "text-anchor": "middle", class: "pm-axis" }, labels[i] >= 1000 ? "1,000" : String(labels[i])));
      var dot = svgEl("circle", { cx: xAt(i), cy: yAt(v), r: 5, class: "pm-oobdot" });
      dot.style.cursor = "pointer";
      dot.addEventListener("click", function () { stopAuto(); setIdx(i); });
      svg.appendChild(dot);
      return dot;
    });
    svg.appendChild(svgEl("text", { x: W / 2, y: H - 1, "text-anchor": "middle", class: "pm-axis" }, "จำนวนต้นไม้ (n_estimators)"));
    var mk = svgEl("g", { class: "pm-oobmk" });
    mk.appendChild(svgEl("line", { x1: 0, x2: 0, y1: T, y2: T + plotH, class: "pm-mkline" }));
    mk.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 9, class: "pm-mkdot" }));
    svg.appendChild(mk);
    wrap.appendChild(svg);
    wrap.appendChild(el("div", "pm-axisnote", "แกนตั้งแสดงช่วง 52,400 – 53,300 (ไม่เริ่มที่ 0) เพื่อให้เห็นการลดลงชัดขึ้น"));

    var slider = el("input", "pm-range", null, {
      type: "range", min: "0", max: String(n - 1), step: "1", value: String(idx),
      "aria-label": "จำนวนต้นไม้ n_estimators"
    });
    var sliderRow = el("div", "pm-slider-row");
    var play = el("button", "pm-btn", "▶ เพิ่มต้นไม้ทีละขั้น", { type: "button", "aria-label": "เล่นอัตโนมัติ เพิ่มจำนวนต้นไม้ทีละขั้น" });
    sliderRow.appendChild(slider); sliderRow.appendChild(play);
    wrap.appendChild(sliderRow);

    var read = el("div", "pm-oob-read", null, { "aria-live": "polite" });
    wrap.appendChild(read);
    body.appendChild(wrap);

    function setIdx(i) {
      idx = clamp(i, 0, n - 1);
      slider.value = String(idx);
      mk.style.transform = "translate(" + xAt(idx).toFixed(1) + "px," + yAt(vals[idx]).toFixed(1) + "px)";
      mk.querySelector("line").setAttribute("y1", T - yAt(vals[idx]));
      mk.querySelector("line").setAttribute("y2", T + plotH - yAt(vals[idx]));
      dots.forEach(function (dt, k) { dt.classList.toggle("on", k === idx); });
      var drop = vals[0] - vals[idx];
      var step = idx > 0 ? vals[idx - 1] - vals[idx] : 0;
      slider.setAttribute("aria-valuetext", labels[idx] + " ต้น OOB MAE " + comma(vals[idx]) + " บาท");
      read.innerHTML = "";
      var top = el("div", "pm-oob-top");
      top.appendChild(el("span", "pm-oob-n tnum", comma(labels[idx]) + " ต้น"));
      if (idx === oob.markerIndex) top.appendChild(el("span", "pm-chosen", "✓ ที่เลือก"));
      read.appendChild(top);
      read.appendChild(el("div", "pm-oob-mae tnum", "OOB MAE " + comma(vals[idx]) + " บาท"));
      read.appendChild(el("div", "pm-oob-drop",
        idx === 0 ? "จุดเริ่มต้น 50 ต้น (ใช้เป็นฐานเปรียบเทียบ)"
          : "ลดลงจาก 50 ต้น " + comma(drop) + " บาท (ขั้นล่าสุดลด " + comma(step) + " บาท)" +
            (step < 80 ? " · เพิ่มต้นไม้แล้วดีขึ้นน้อยมาก" : "")));
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = 0; }
      play.textContent = "▶ เพิ่มต้นไม้ทีละขั้น";
    }
    play.addEventListener("click", function () {
      if (autoTimer) { stopAuto(); return; }
      if (idx >= n - 1) setIdx(0);
      play.textContent = "⏸ หยุด";
      autoTimer = setInterval(function () {
        if (idx >= n - 1) { stopAuto(); return; }
        setIdx(idx + 1);
        if (idx >= n - 1) stopAuto();
      }, reduced() ? 350 : 700);
    });
    slider.addEventListener("input", function () { stopAuto(); setIdx(Number(slider.value)); });
    setIdx(idx);
    return stopAuto;
  }

  /* =========================================================
     4. FOLD pages (inline)
     ========================================================= */
  function initFolds(key, sceneId) {
    var scene = document.getElementById(sceneId);
    if (!scene || !DATA[key]) return;
    var data = DATA[key];
    var block = scene.querySelector(".model-block");
    var grid = scene.querySelector(".model-grid-2");
    if (!block || !grid || block.querySelector(".pm-fold")) return;
    var vals = data.folds.map(function (r) { return toNum(r[1]); });
    var mean = toNum(data.mean.mae);

    var panel = el("div", "pm-fold");
    var head = el("div", "pm-fold-head");
    head.appendChild(el("span", "pm-play-badge", "🎮 ลองเล่น"));
    head.appendChild(el("span", "pm-fold-prompt", "คลิกแถวในตาราง หรือแท่งในกราฟ เพื่อดูว่า Fold นั้นใช้ข้อมูลส่วนไหนตรวจสอบ"));
    panel.appendChild(head);
    var strip = el("div", "pm-strip", null, { role: "group", "aria-label": "5 ส่วนของข้อมูล" });
    var blocks = vals.map(function (v, i) {
      var b = el("div", "pm-blk", "Train");
      b.dataset.fold = String(i + 1);
      strip.appendChild(b);
      return b;
    });
    panel.appendChild(strip);
    var res = el("p", "pm-fold-res", "ยังไม่ได้เลือก Fold", { "aria-live": "polite" });
    panel.appendChild(res);
    block.appendChild(panel);

    var current = -1;
    function select(i) {
      current = i;
      blocks.forEach(function (b, k) {
        var on = k === i;
        b.classList.toggle("val", on);
        b.textContent = on ? "Validation" : "Train";
      });
      var rows = scene.querySelectorAll("#" + key + "-folds tbody tr.pm-fold-row");
      rows.forEach(function (tr, k) { tr.classList.toggle("pm-sel", k === i); tr.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      var rects = scene.querySelectorAll("#" + key + "-fold-chart svg rect[rx='7']");
      rects.forEach(function (rc, k) { rc.classList.toggle("pm-sel-bar", k === i); });
      var diff = vals[i] - mean;
      res.textContent = "Fold " + (i + 1) + ": ใช้ส่วนที่ " + (i + 1) + " ตรวจสอบ อีก 4 ส่วนเป็นข้อมูลฝึก → MAE " + comma(vals[i]) + " บาท" +
        (Math.abs(diff) < 0.5 ? " เท่ากับค่าเฉลี่ย " : (diff < 0 ? " ต่ำกว่าค่าเฉลี่ย " : " สูงกว่าค่าเฉลี่ย ") + comma(Math.abs(diff)) + " บาท ") +
        "(ค่าเฉลี่ย " + comma(mean) + " บาท)";
    }

    function decorateRows() {
      var rows = scene.querySelectorAll("#" + key + "-folds tbody tr");
      rows.forEach(function (tr, k) {
        if (k >= vals.length || tr.classList.contains("pm-fold-row")) return;
        tr.classList.add("pm-fold-row");
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        tr.setAttribute("aria-pressed", "false");
        tr.setAttribute("aria-label", "เลือก Fold " + (k + 1) + " MAE " + comma(vals[k]) + " บาท");
      });
      scene.querySelectorAll("#" + key + "-fold-chart svg rect[rx='7']").forEach(function (rc) { rc.classList.add("pm-fold-bar"); });
    }
    decorateRows();

    var tableHost = scene.querySelector("#" + key + "-folds");
    var chartHost = scene.querySelector("#" + key + "-fold-chart");
    if (tableHost) {
      tableHost.addEventListener("click", function (e) {
        var tr = e.target.closest ? e.target.closest("tr.pm-fold-row") : null;
        if (!tr) return;
        select(Array.prototype.indexOf.call(tr.parentNode.children, tr));
      });
      tableHost.addEventListener("keydown", function (e) {
        var tr = e.target.closest ? e.target.closest("tr.pm-fold-row") : null;
        if (!tr) return;
        var k = Array.prototype.indexOf.call(tr.parentNode.children, tr);
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); select(k); }
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          var nxt = tr.parentNode.children[k + (e.key === "ArrowDown" ? 1 : -1)];
          if (nxt && nxt.classList.contains("pm-fold-row")) { e.preventDefault(); e.stopPropagation(); nxt.focus(); select(k + (e.key === "ArrowDown" ? 1 : -1)); }
        }
      });
    }
    if (chartHost) {
      chartHost.addEventListener("click", function (e) {
        var rc = e.target.closest ? e.target.closest("rect[rx='7']") : null;
        if (!rc) return;
        decorateRows();
        var all = chartHost.querySelectorAll("rect[rx='7']");
        select(Array.prototype.indexOf.call(all, rc));
      });
    }
  }

  /* =========================================================
     5. COMPARE race
     ========================================================= */
  function buildCompare(body) {
    var metrics = DATA.comparison;
    var models = [
      { key: "dt", name: "Decision Tree", cls: "dt" },
      { key: "rf", name: "Random Forest", cls: "rf" },
      { key: "xgb", name: "XGBoost", cls: "xgb" }
    ];
    var cur = 0, zoom = false, cancel = null, timers = [];
    function fmt(m, v) { return m.format === "dec4" ? v.toFixed(4) : m.format === "dec2" ? v.toFixed(2) : comma(v); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    var wrap = el("div", "pm-cmp");
    var tabs = el("div", "pm-cmp-tabs", null, { role: "group", "aria-label": "เลือกตัวชี้วัด" });
    var tbtn = metrics.map(function (m, i) {
      var b = el("button", "pm-pick", m.label.replace(" (บาท)", "").replace("-squared", "²").replace(" (%)", ""), { type: "button", "aria-pressed": "false", "aria-label": "แสดงตัวชี้วัด " + m.label });
      b.addEventListener("click", function () { show(i); });
      tabs.appendChild(b);
      return b;
    });
    wrap.appendChild(tabs);
    var dir = el("div", "pm-cmp-dir");
    wrap.appendChild(dir);
    var rowsHost = el("div", "pm-cmp-rows");
    wrap.appendChild(rowsHost);
    var opt = el("label", "pm-check");
    var cb = el("input", null, null, { type: "checkbox" });
    opt.appendChild(cb);
    opt.appendChild(el("span", null, "ขยายส่วนต่าง (แกนไม่เริ่มที่ 0 · ใช้ดูความต่างเล็ก ๆ ของ R²)"));
    wrap.appendChild(opt);
    var verdict = el("p", "pm-cmp-verdict", "", { "aria-live": "polite" });
    wrap.appendChild(verdict);
    var again = el("button", "pm-btn", "🔁 แข่งอีกครั้ง", { type: "button", "aria-label": "แสดงการแข่งตัวชี้วัดนี้อีกครั้ง" });
    wrap.appendChild(again);
    body.appendChild(wrap);

    function widths(m) {
      var v = models.map(function (x) { return m[x.key]; });
      if (!zoom) { var mx = Math.max.apply(null, v); return v.map(function (a) { return a / mx * 100; }); }
      var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
      return v.map(function (a) { return hi === lo ? 100 : 30 + 70 * (a - lo) / (hi - lo); });
    }

    function show(i) {
      cur = i;
      if (cancel) cancel();
      timers.forEach(clearTimeout); timers = [];
      var m = metrics[i];
      tbtn.forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      var higher = m.better === "สูงดี";
      dir.textContent = m.label + " · " + (higher ? "ยิ่งสูงยิ่งดี" : "ยิ่งต่ำยิ่งดี (แท่งสั้นกว่า = ดีกว่า)");
      var vs = models.map(function (x) { return m[x.key]; });
      var best = 0;
      vs.forEach(function (v, k) { if (higher ? v > vs[best] : v < vs[best]) best = k; });
      var order = vs.map(function (v, k) { return k; }).sort(function (a, b) { return higher ? vs[b] - vs[a] : vs[a] - vs[b]; });
      var w = widths(m);
      rowsHost.innerHTML = "";
      var fills = [], vals = [], crowns = [];
      models.forEach(function (x, k) {
        var row = el("div", "pm-crow");
        row.appendChild(el("span", "pm-cname", x.name));
        var track = el("div", "pm-ctrack");
        var fill = el("span", "pm-cfill " + x.cls);
        track.appendChild(fill);
        row.appendChild(track);
        var v = el("span", "pm-cval tnum", "");
        v.textContent = reduced() ? fmt(m, vs[k]) : "…";
        row.appendChild(v);
        var crown = el("span", "pm-crown", k === best ? "👑" : "", { "aria-hidden": "true" });
        row.appendChild(crown);
        rowsHost.appendChild(row);
        fills.push(fill); vals.push(v); crowns.push(crown);
      });
      var finish = function () {
        vals.forEach(function (v, k) { v.textContent = fmt(m, vs[k]); });
        crowns[best].classList.add("on");
        var gap = Math.abs(vs[best] - vs[order[1]]);
        verdict.textContent = models[best].name + " ดีที่สุดในตัวชี้วัด " + m.label + " (" + fmt(m, vs[best]) +
          ") นำอันดับ 2 (" + models[order[1]].name + ") อยู่ " + (m.format === "dec4" ? gap.toFixed(4) : m.format === "dec2" ? gap.toFixed(2) : comma(gap));
      };
      verdict.textContent = "";
      if (reduced()) {
        fills.forEach(function (f, k) { f.style.width = w[k] + "%"; });
        finish();
        return;
      }
      /* race: every bar runs from 0 to its value; leaders finish with a crown */
      cancel = tween(1300, function (t) {
        for (var k = 0; k < models.length; k++) {
          var tk = Math.min(1, t * (1500 / (1100 + 200 * order.indexOf(k))));
          fills[k].style.width = (w[k] * tk) + "%";
          vals[k].textContent = fmt(m, vs[k] * tk);
        }
      }, function () { cancel = null; finish(); });
    }
    cb.addEventListener("change", function () { zoom = cb.checked; show(cur); });
    again.addEventListener("click", function () { show(cur); });
    show(0);
    return function () { if (cancel) cancel(); timers.forEach(clearTimeout); };
  }

  /* =========================================================
     6. IMPORTANCE guessing game
     ========================================================= */
  function buildGuess(body) {
    var deltas = DATA.importance.deltas;
    function dl(name) { for (var i = 0; i < deltas.length; i++) if (deltas[i].name === name) return deltas[i].xgb; return 0; }
    var CARDS = [
      { id: "age", label: "อายุรถยนต์", full: "อายุของรถยนต์", icon: "⏳" },
      { id: "eng", label: "ขนาดเครื่องยนต์", full: "ขนาดเครื่องยนต์", icon: "⚙️" },
      { id: "gear", label: "ระบบเกียร์", full: "ระบบเกียร์", icon: "🕹️" }
    ];
    CARDS.forEach(function (c) { c.value = dl(c.full); });
    var truth = CARDS.slice().sort(function (a, b) { return b.value - a.value; }).map(function (c) { return c.id; });
    var order = ["gear", "age", "eng"]; /* starting order, user rearranges */
    var revealed = false, cancel = null, timers = [];
    var SLOT = 74, CARD_H = 64;

    var wrap = el("div", "pm-guess");
    wrap.appendChild(el("div", "pm-guess-axis", null)).innerHTML = '<span>⬆ สำคัญที่สุด</span><span>สำคัญน้อยที่สุด ⬇</span>';
    var list = el("div", "pm-glist", null, { role: "list", "aria-label": "เรียงอันดับความสำคัญ" });
    list.style.height = (SLOT * 3 - 10) + "px";
    wrap.appendChild(list);
    var msg = el("p", "pm-gmsg", "ลากการ์ด (หรือกดปุ่ม ▲ ▼) เพื่อเรียงจากสำคัญที่สุดไปน้อยที่สุด แล้วกด \"ดูเฉลย\"", { "aria-live": "polite" });
    wrap.appendChild(msg);
    var actions = el("div", "pm-actions");
    var bShow = el("button", "pm-btn pm-btn-primary", "👀 ดูเฉลย", { type: "button", "aria-label": "ดูเฉลยอันดับความสำคัญของตัวแปร" });
    var bAgain = el("button", "pm-btn", "↺ เล่นใหม่", { type: "button", "aria-label": "เล่นใหม่" });
    actions.appendChild(bShow); actions.appendChild(bAgain);
    wrap.appendChild(actions);
    body.appendChild(wrap);

    var nodes = {};
    CARDS.forEach(function (c) {
      var n = el("div", "pm-gcard", null, { role: "listitem" });
      var rank = el("span", "pm-grank", "");
      var info = el("div", "pm-ginfo");
      info.appendChild(el("span", "pm-gname", c.icon + " " + c.label));
      var barWrap = el("div", "pm-gbarwrap");
      var bar = el("span", "pm-gbar");
      barWrap.appendChild(bar);
      var valTxt = el("span", "pm-gval tnum", "");
      barWrap.appendChild(valTxt);
      info.appendChild(barWrap);
      var mark = el("span", "pm-gmark", "", { "aria-hidden": "true" });
      var ctrl = el("div", "pm-gctrl");
      var up = el("button", "pm-mv", "▲", { type: "button", "aria-label": "เลื่อน " + c.label + " ขึ้น" });
      var dn = el("button", "pm-mv", "▼", { type: "button", "aria-label": "เลื่อน " + c.label + " ลง" });
      ctrl.appendChild(up); ctrl.appendChild(dn);
      var grip = el("span", "pm-grip", "⋮⋮", { "aria-hidden": "true" });
      n.appendChild(grip); n.appendChild(rank); n.appendChild(info); n.appendChild(mark); n.appendChild(ctrl);
      list.appendChild(n);
      nodes[c.id] = { node: n, rank: rank, bar: bar, val: valTxt, mark: mark, up: up, dn: dn };
      up.addEventListener("click", function () { move(c.id, -1); });
      dn.addEventListener("click", function () { move(c.id, 1); });
      attachDrag(c.id, n);
    });

    function layoutCards(skipId, offY) {
      order.forEach(function (id, i) {
        var nd = nodes[id];
        nd.rank.textContent = String(i + 1);
        nd.node.style.transform = "translateY(" + (id === skipId ? offY : i * SLOT) + "px)";
        nd.node.classList.toggle("dragging", id === skipId);
        nd.up.disabled = revealed; nd.dn.disabled = revealed;
      });
    }
    function move(id, d) {
      if (revealed) return;
      var i = order.indexOf(id), j = i + d;
      if (j < 0 || j > 2) return;
      order.splice(i, 1); order.splice(j, 0, id);
      layoutCards();
      var b = nodes[id][d < 0 ? "up" : "dn"];
      if (b && !b.disabled) b.focus({ preventScroll: true });
    }
    function attachDrag(id, node) {
      var startY = 0, baseTop = 0, dragging = false;
      node.addEventListener("pointerdown", function (e) {
        if (revealed || (e.target.closest && e.target.closest("button"))) return;
        dragging = true;
        startY = e.clientY; baseTop = order.indexOf(id) * SLOT;
        try { node.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        layoutCards(id, baseTop);
        e.preventDefault();
      });
      node.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var y = clamp(baseTop + e.clientY - startY, 0, SLOT * 2);
        var target = clamp(Math.round(y / SLOT), 0, 2);
        var cur = order.indexOf(id);
        if (target !== cur) { order.splice(cur, 1); order.splice(target, 0, id); }
        layoutCards(id, y);
      });
      function end(e) {
        if (!dragging) return;
        dragging = false;
        try { node.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        layoutCards();
      }
      node.addEventListener("pointerup", end);
      node.addEventListener("pointercancel", end);
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      layoutCards();
      var maxV = Math.max.apply(null, CARDS.map(function (c) { return c.value; }));
      var score = 0;
      order.forEach(function (id, i) {
        var c = CARDS.filter(function (x) { return x.id === id; })[0];
        var ok = truth[i] === id;
        if (ok) score++;
        var nd = nodes[id];
        nd.node.classList.add("revealed", ok ? "ok" : "bad");
        nd.mark.textContent = ok ? "✓" : "✗ (จริง: อันดับ " + (truth.indexOf(id) + 1) + ")";
        nd.val.textContent = "";
        nd.bar.style.width = "0%";
        (function (nd2, cc, delay) {
          timers.push(setTimeout(function () {
            nd2.bar.style.width = (cc.value / maxV * 100) + "%";
            if (reduced()) { nd2.val.textContent = comma(cc.value) + " บาท"; return; }
            cancel = tween(900, function (t) { nd2.val.textContent = comma(cc.value * t) + " บาท"; });
          }, reduced() ? 0 : delay));
        })(nd, c, i * 250);
      });
      msg.textContent = "ถูก " + score + " จาก 3 · ค่าจริงของ XGBoost คือ MAE ที่เพิ่มขึ้นเมื่อสลับตัวแปรนั้น (บาท) · อายุรถกับขนาดเครื่องยนต์ต่างกันไม่มาก (" +
        comma(dl("อายุของรถยนต์")) + " เทียบ " + comma(dl("ขนาดเครื่องยนต์")) + ") แต่ระบบเกียร์ต่ำสุดอย่างชัดเจน (" + comma(dl("ระบบเกียร์")) + ")";
      bShow.disabled = true;
    }
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      if (cancel) cancel();
      revealed = false;
      order = ["gear", "age", "eng"];
      CARDS.forEach(function (c) {
        var nd = nodes[c.id];
        nd.node.classList.remove("revealed", "ok", "bad");
        nd.mark.textContent = ""; nd.val.textContent = ""; nd.bar.style.width = "0%";
      });
      msg.textContent = "ลากการ์ด (หรือกดปุ่ม ▲ ▼) เพื่อเรียงจากสำคัญที่สุดไปน้อยที่สุด แล้วกด \"ดูเฉลย\"";
      bShow.disabled = false;
      layoutCards();
    }
    bShow.addEventListener("click", reveal);
    bAgain.addEventListener("click", reset);
    layoutCards();
    return function () { timers.forEach(clearTimeout); if (cancel) cancel(); };
  }

  /* ---------- wire up ---------- */
  function init() {
    if (!hasData()) return;
    addLaunch("s-metrics", "เปิดหน้าต่างลองเล่น ลากจุดทำนายแล้วดูตัวชี้วัดเปลี่ยน", function () {
      openDialog({ title: "ลากจุดทำนาย แล้วดูตัวชี้วัดเปลี่ยนทันที", instruction: "ลากจุดสีส้ม (หรือกดลูกศรเมื่อโฟกัส) เพื่อเปลี่ยนราคาที่ทำนาย แท่งความคลาดเคลื่อนและตัวชี้วัดทั้งสี่จะคำนวณใหม่ทันที", cls: "pm-wide", build: buildMetrics });
    });
    addLaunch("s-permutation", "เปิดหน้าต่างลองเล่น เลือกคอลัมน์ที่จะสลับ", function () {
      openDialog({ title: "เลือกคอลัมน์ที่จะสลับ แล้วดู Error เปลี่ยน", instruction: "กดเลือก X1 ถึง X6 ค่าในคอลัมน์นั้นจะถูกสลับ แล้วดูว่า Error เพิ่มขึ้นเท่าไร", cls: "pm-wide", build: buildPermutation });
    });
    addLaunch("s-rf-3", "เปิดหน้าต่างลองเล่น เลื่อนจำนวนต้นไม้ดู OOB MAE", function () {
      openDialog({ title: "เพิ่มต้นไม้ แล้วดู OOB MAE ลดลง", instruction: "เลื่อนแถบ (หรือกดลูกศร) เพื่อเลือกจำนวนต้นไม้ แล้วดู OOB MAE จริงจากการศึกษา", build: buildOob });
    });
    addLaunch("s-compare", "เปิดหน้าต่างลองเล่น แข่งกันทีละตัวชี้วัด", function () {
      openDialog({ title: "แข่งกันทีละตัวชี้วัด", instruction: "กดเลือกตัวชี้วัด แล้วดูสามตัวแบบแข่งกัน ค่าที่แสดงเป็นผลจริงบนชุดทดสอบ", build: buildCompare });
    });
    addLaunch("s-importance", "เปิดหน้าต่างลองเล่น เดาก่อนดูเฉลย", function () {
      openDialog({ title: "เดาก่อนดูเฉลย: ตัวแปรไหนสำคัญที่สุด", instruction: "ลากหรือกดปุ่มเพื่อเรียงการ์ดจากสำคัญที่สุดไปน้อยที่สุด แล้วกด \"ดูเฉลย\"", build: buildGuess });
    });
    initFolds("dt", "s-dt-2");
    initFolds("rf", "s-rf-2");
    initFolds("xgb", "s-xgb-2");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.PlayMetrics = { open: openDialog, close: closeDialog };
})();
