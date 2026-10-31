/* Interactive "ลองเล่น" widgets: s-methods (DT / RF / XGB), s-split, s-tuning (grid / k-fold).
   Opens a shared dialog from buttons [data-play]. All numbers are illustrative ("ตัวอย่าง"). */
(function () {
  "use strict";

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var NS = "http://www.w3.org/2000/svg";

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function sv(tag, attrs, cls) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    return e;
  }

  /* timers: everything is cleared when the dialog closes (no loops while hidden) */
  var timers = [];
  function later(fn, ms) {
    var t = window.setTimeout(function () {
      var i = timers.indexOf(t);
      if (i > -1) timers.splice(i, 1);
      fn();
    }, reduce ? 0 : ms);
    timers.push(t);
    return t;
  }
  function clearTimers() {
    timers.forEach(function (t) { window.clearTimeout(t); });
    timers = [];
  }
  function raf2(fn) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(fn); });
  }
  function btn(label, aria, cls) {
    var b = h("button", "pl-btn" + (cls ? " " + cls : ""), label);
    b.type = "button";
    b.setAttribute("aria-label", aria || label);
    return b;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------------- dialog ---------------- */
  var overlay, dlg, titleEl, instrEl, bodyEl, closeBtn, lastFocus = null, cleanup = null;

  function ensure() {
    if (overlay) return;
    overlay = h("div", "pl-overlay");
    overlay.hidden = true;
    dlg = h("div", "pl-dialog");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-labelledby", "pl-title");
    var head = h("div", "pl-head");
    head.appendChild(h("span", "pl-badge", "🎮 ลองเล่น"));
    titleEl = h("h3", "pl-title");
    titleEl.id = "pl-title";
    head.appendChild(titleEl);
    closeBtn = btn("✕", "ปิดหน้าต่างลองเล่น", "pl-close");
    head.appendChild(closeBtn);
    instrEl = h("p", "pl-instr");
    bodyEl = h("div", "pl-body");
    dlg.appendChild(head);
    dlg.appendChild(instrEl);
    dlg.appendChild(bodyEl);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    closeBtn.addEventListener("click", closePlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closePlay(); });
    overlay.addEventListener("wheel", function (e) { if (e.target === overlay) e.preventDefault(); }, { passive: false });
    /* keep the player's Space / arrow shortcuts out of the dialog */
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closePlay(); }
      else if (e.key === "Tab") {
        var f = dlg.querySelectorAll("button:not([disabled])");
        if (f.length) {
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      e.stopPropagation();
    });
    /* focus may fall to <body> when a button becomes disabled: still honour Esc and block player keys */
    document.addEventListener("keydown", function (e) {
      if (overlay.hidden || dlg.contains(e.target)) return;
      if (e.key === "Escape") { e.preventDefault(); closePlay(); }
      else if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); }
      e.stopPropagation();
    }, true);
    dlg.addEventListener("wheel", function (e) { e.stopPropagation(); }, { passive: true });
    dlg.addEventListener("touchmove", function (e) { e.stopPropagation(); }, { passive: true });
  }

  function openPlay(key, opener) {
    var def = WIDGETS[key];
    if (!def) return;
    ensure();
    if (window.story && typeof window.story.pause === "function") window.story.pause();
    clearTimers();
    if (cleanup) { cleanup(); cleanup = null; }
    lastFocus = opener || document.activeElement;
    titleEl.textContent = def.title;
    instrEl.textContent = def.instr;
    bodyEl.innerHTML = "";
    bodyEl.className = "pl-body pl-" + key;
    overlay.hidden = false;
    document.documentElement.classList.add("pl-open");
    cleanup = def.build(bodyEl) || null;
    closeBtn.focus();
  }

  function closePlay() {
    if (!overlay || overlay.hidden) return;
    clearTimers();
    if (cleanup) { cleanup(); cleanup = null; }
    overlay.hidden = true;
    bodyEl.innerHTML = "";
    document.documentElement.classList.remove("pl-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- 1. Decision tree walker ---------------- */
  function buildDT(root) {
    var S = { age: 0, eng: 0, typ: 0 };
    var groups = [
      { k: "age", label: "อายุรถ", opts: ["≤ 5 ปี", "> 5 ปี"] },
      { k: "eng", label: "ขนาดเครื่องยนต์", opts: ["≤ 2000cc", "> 2000cc"] },
      { k: "typ", label: "ประเภท", opts: ["เก๋ง", "กระบะ"] }
    ];
    var ctl = h("div", "pl-controls");
    var btns = {};
    groups.forEach(function (g) {
      var wrap = h("div", "pl-group");
      wrap.appendChild(h("span", "pl-glabel", g.label));
      var seg = h("div", "pl-seg");
      btns[g.k] = g.opts.map(function (o, i) {
        var b = btn(o, g.label + " " + o);
        b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        b.addEventListener("click", function () {
          S[g.k] = i;
          sync();
          run();
        });
        seg.appendChild(b);
        return b;
      });
      wrap.appendChild(seg);
      ctl.appendChild(wrap);
    });
    var again = btn("↻ เดินใหม่", "เดินตามต้นไม้ใหม่", "pl-primary");
    again.addEventListener("click", run);
    ctl.appendChild(again);
    root.appendChild(ctl);

    var N = {
      q1: { x: 240, y: 36, t: "อายุ ≤ 5 ปี?" },
      q2: { x: 125, y: 124, t: "เครื่อง ≤ 2000cc?" },
      q3: { x: 355, y: 124, t: "เป็นเก๋ง?" },
      l1: { x: 62, y: 214, leaf: 1, t: "฿520,000" },
      l2: { x: 188, y: 214, leaf: 1, t: "฿690,000" },
      l3: { x: 292, y: 214, leaf: 1, t: "฿280,000" },
      l4: { x: 418, y: 214, leaf: 1, t: "฿340,000" }
    };
    var E = [
      ["q1", "q2", "ใช่"], ["q1", "q3", "ไม่"],
      ["q2", "l1", "ใช่"], ["q2", "l2", "ไม่"],
      ["q3", "l3", "ใช่"], ["q3", "l4", "ไม่"]
    ];
    var svg = sv("svg", { viewBox: "0 0 480 256", "class": "pl-svg pl-tree", role: "img", "aria-label": "ต้นไม้ตัดสินใจตัวอย่าง" });
    var edgeEls = {}, nodeEls = {};
    E.forEach(function (e) {
      var a = N[e[0]], b = N[e[1]];
      var y1 = a.y + 17, y2 = b.y - 17;
      var g = sv("g", {});
      g.appendChild(sv("line", { x1: a.x, y1: y1, x2: b.x, y2: y2 }, "pl-edge"));
      var tx = sv("text", { x: (a.x + b.x) / 2 + (b.x < a.x ? -12 : 12), y: (y1 + y2) / 2 + 4, "text-anchor": "middle" }, "pl-elabel");
      tx.textContent = e[2];
      g.appendChild(tx);
      svg.appendChild(g);
      edgeEls[e[0] + e[1]] = g;
    });
    Object.keys(N).forEach(function (k) {
      var n = N[k];
      var g = sv("g", {}, "pl-node" + (n.leaf ? " leaf" : ""));
      g.appendChild(sv("rect", { x: n.x - 58, y: n.y - 17, width: 116, height: 34, rx: n.leaf ? 17 : 9 }));
      var tx = sv("text", { x: n.x, y: n.y + 5, "text-anchor": "middle" });
      tx.textContent = n.t;
      g.appendChild(tx);
      svg.appendChild(g);
      nodeEls[k] = g;
    });
    var dot = sv("g", {}, "pl-dotg");
    dot.appendChild(sv("circle", { r: 11, cx: 0, cy: 0 }, "pl-walker"));
    var car = sv("text", { x: 0, y: 5, "text-anchor": "middle" }, "pl-walker-ico");
    car.textContent = "🚗";
    dot.appendChild(car);
    svg.appendChild(dot);
    root.appendChild(svg);

    var out = h("div", "pl-result");
    out.setAttribute("aria-live", "polite");
    root.appendChild(out);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> ต้นไม้และราคาด้านบนสมมติขึ้นเพื่ออธิบายแนวคิด ไม่ใช่ผลการศึกษา — สังเกตว่าแต่ละเส้นทางถามเพียงบางคำถาม"));

    function sync() {
      groups.forEach(function (g) {
        btns[g.k].forEach(function (b, i) { b.setAttribute("aria-pressed", S[g.k] === i ? "true" : "false"); });
      });
    }
    function setDot(k, animate) {
      if (!animate) dot.style.transition = "none";
      dot.style.transform = "translate(" + N[k].x + "px," + N[k].y + "px)";
      if (!animate) { void dot.getBoundingClientRect(); dot.style.transition = ""; }
    }
    function run() {
      clearTimers();
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].setAttribute("class", "pl-node" + (N[k].leaf ? " leaf" : "")); });
      Object.keys(edgeEls).forEach(function (k) { edgeEls[k].setAttribute("class", ""); });
      out.innerHTML = "<span class=\"pl-muted\">กำลังเดินตามต้นไม้…</span>";
      var mid = S.age === 0 ? "q2" : "q3";
      var leaf = mid === "q2" ? (S.eng === 0 ? "l1" : "l2") : (S.typ === 0 ? "l3" : "l4");
      var path = ["q1", mid, leaf];
      setDot("q1", false);
      var step = 0;
      function lit(k) { nodeEls[k].setAttribute("class", "pl-node lit" + (N[k].leaf ? " leaf" : "")); }
      function done() {
        var why = "อายุ " + (S.age === 0 ? "≤ 5 ปี" : "> 5 ปี") + " → " +
          (mid === "q2" ? "เครื่อง " + (S.eng === 0 ? "≤ 2000cc" : "> 2000cc") : (S.typ === 0 ? "เป็นเก๋ง" : "เป็นกระบะ"));
        out.innerHTML = "<span class=\"pl-ex\">ตัวอย่าง</span> ใบสุดท้ายตอบว่า <b>" + N[leaf].t + "</b><br><span class=\"pl-muted\">เส้นทาง: " + why + "</span>";
      }
      function next() {
        lit(path[step]);
        if (step === path.length - 1) { done(); return; }
        var from = path[step], to = path[step + 1];
        later(function () {
          edgeEls[from + to].setAttribute("class", "lit");
          setDot(to, true);
          step++;
          later(next, 620);
        }, 380);
      }
      later(next, 80);
    }
    setDot("q1", false);
    later(run, 250);
  }

  /* ---------------- 2. Random forest ---------------- */
  function buildRF(root) {
    var TRUE = 500, MIN = 300, MAX = 700, MAXT = 12;
    var preds = [], avgs = [];
    var ctl = h("div", "pl-controls");
    var add = btn("🌳 ปลูกต้นไม้เพิ่ม", "ปลูกต้นไม้เพิ่มหนึ่งต้น", "pl-primary");
    var rst = btn("↺ รีเซ็ต", "รีเซ็ตป่า");
    ctl.appendChild(add); ctl.appendChild(rst);
    var count = h("span", "pl-count", "");
    ctl.appendChild(count);
    root.appendChild(ctl);

    var axis = h("div", "pl-axis");
    var truth = h("div", "pl-truth", "<span>ราคาจริง (ตัวอย่าง)</span>");
    truth.style.left = ((TRUE - MIN) / (MAX - MIN) * 100) + "%";
    var avgLine = h("div", "pl-avgline", "<span></span>");
    avgLine.style.opacity = "0";
    axis.appendChild(truth); axis.appendChild(avgLine);
    root.appendChild(axis);
    root.appendChild(h("div", "pl-ticks", "<span>300k</span><span>400k</span><span>500k</span><span>600k</span><span>700k</span>"));

    var stats = h("div", "pl-stats");
    stats.setAttribute("aria-live", "polite");
    root.appendChild(stats);

    var svg = sv("svg", { viewBox: "0 0 320 110", "class": "pl-svg pl-line", role: "img", "aria-label": "ค่าเฉลี่ยสะสมของต้นไม้" });
    root.appendChild(h("p", "pl-sub", "ค่าเฉลี่ยสะสม เมื่อมีต้นไม้ 1 → 12 ต้น"));
    root.appendChild(svg);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> แต่ละต้นทายราคา (พันบาท) คลาดเคลื่อนต่างกัน ค่าเฉลี่ยของหลายต้นจึงนิ่งและใกล้ราคาจริงขึ้น — นี่คือเหตุผลที่ Random Forest ลดความแปรปรวนได้ (สุ่มใหม่ทุกครั้งที่ปลูก)"));

    function draw() {
      svg.innerHTML = "";
      var X0 = 30, X1 = 310, Y0 = 8, Y1 = 92;
      var px = function (n) { return X0 + (n - 1) / (MAXT - 1) * (X1 - X0); };
      var py = function (v) { return Y1 - (Math.max(380, Math.min(620, v)) - 380) / 240 * (Y1 - Y0); };
      svg.appendChild(sv("line", { x1: X0, y1: Y1, x2: X1, y2: Y1 }, "pl-axisl"));
      svg.appendChild(sv("line", { x1: X0, y1: py(TRUE), x2: X1, y2: py(TRUE) }, "pl-truthl"));
      var tt = sv("text", { x: X1, y: py(TRUE) - 3, "text-anchor": "end" }, "pl-svgt");
      tt.textContent = "ราคาจริง 500k (ตัวอย่าง)";
      svg.appendChild(tt);
      [1, 4, 8, 12].forEach(function (n) {
        var t = sv("text", { x: px(n), y: 105, "text-anchor": "middle" }, "pl-svgt");
        t.textContent = n;
        svg.appendChild(t);
      });
      if (avgs.length) {
        var pts = avgs.map(function (v, i) { return px(i + 1).toFixed(1) + "," + py(v).toFixed(1); }).join(" ");
        svg.appendChild(sv("polyline", { points: pts }, "pl-poly"));
        avgs.forEach(function (v, i) { svg.appendChild(sv("circle", { cx: px(i + 1), cy: py(v), r: 3 }, "pl-pt")); });
      }
    }
    function pos(v) { return Math.max(0, Math.min(100, (v - MIN) / (MAX - MIN) * 100)); }
    function update() {
      var n = preds.length;
      count.textContent = "ต้นไม้ " + n + " / " + MAXT + " ต้น";
      add.disabled = n >= MAXT;
      if (!n) {
        avgLine.style.opacity = "0";
        stats.innerHTML = "<span class=\"pl-muted\">กดปลูกต้นไม้เพื่อเริ่ม</span>";
      } else {
        var avg = avgs[n - 1];
        avgLine.style.opacity = "1";
        avgLine.style.left = pos(avg) + "%";
        avgLine.firstChild.textContent = "เฉลี่ย " + Math.round(avg) + "k";
        var mn = Math.min.apply(null, preds), mx = Math.max.apply(null, preds);
        stats.innerHTML = "<div><b>" + Math.round(avg) + "k</b><small>ค่าเฉลี่ย (ตัวอย่าง)</small></div>" +
          "<div><b>" + Math.round(mn) + "–" + Math.round(mx) + "k</b><small>ช่วงที่แต่ละต้นทาย</small></div>" +
          "<div><b>" + Math.round(Math.abs(avg - TRUE)) + "k</b><small>คลาดจากราคาจริง</small></div>";
      }
      draw();
    }
    function plant() {
      if (preds.length >= MAXT) return;
      var v = Math.max(MIN + 10, Math.min(MAX - 10, TRUE + gauss() * 70));
      preds.push(v);
      var sum = 0;
      preds.forEach(function (x) { sum += x; });
      avgs.push(sum / preds.length);
      var i = preds.length - 1;
      var b = h("span", "pl-bubble", "🌳<em>" + Math.round(v) + "</em>");
      b.title = "ต้นที่ " + (i + 1) + ": " + Math.round(v) + "k";
      b.style.left = pos(v) + "%";
      b.style.top = "-30px";
      b.style.opacity = "0";
      axis.appendChild(b);
      raf2(function () { b.style.top = (22 + (i % 6) * 20) + "px"; b.style.opacity = "1"; });
      update();
    }
    function reset() {
      preds = []; avgs = [];
      var bs = axis.querySelectorAll(".pl-bubble");
      for (var i = 0; i < bs.length; i++) axis.removeChild(bs[i]);
      update();
    }
    add.addEventListener("click", plant);
    rst.addEventListener("click", reset);
    update();
  }

  /* ---------------- 3. XGBoost ---------------- */
  function buildXGB(root) {
    var NAMES = ["รถ A", "รถ B", "รถ C", "รถ D", "รถ E"];
    var TARGET = [420, 560, 310, 690, 480];
    var LR = 0.3, MAXR = 12, SCALE = 800;
    var base = TARGET.reduce(function (a, b) { return a + b; }, 0) / TARGET.length;
    var pred, maes;
    var ctl = h("div", "pl-controls");
    var add = btn("➕ เพิ่มต้นไม้ถัดไป", "เพิ่มต้นไม้ต้นถัดไป", "pl-primary");
    var rst = btn("↺ รีเซ็ต", "รีเซ็ต XGBoost");
    ctl.appendChild(add); ctl.appendChild(rst);
    var info = h("span", "pl-count", "");
    ctl.appendChild(info);
    root.appendChild(ctl);
    root.appendChild(h("p", "pl-legend", "<i class=\"pl-k pred\"></i>ค่าทำนายปัจจุบัน <i class=\"pl-k tgt\"></i>ราคาจริง (ตัวอย่าง) <i class=\"pl-k res\"></i>ส่วนที่ยังคลาด · learning rate = 0.3"));
    var rows = h("div", "pl-xrows");
    var els = TARGET.map(function (t, i) {
      var r = h("div", "pl-xrow");
      r.appendChild(h("span", "pl-xname", NAMES[i]));
      var tr = h("div", "pl-xtrack");
      var fill = h("div", "pl-xfill");
      var res = h("div", "pl-xres");
      var tick = h("div", "pl-xtick");
      tick.style.left = (t / SCALE * 100) + "%";
      tr.appendChild(fill); tr.appendChild(res); tr.appendChild(tick);
      r.appendChild(tr);
      var val = h("span", "pl-xval", "");
      r.appendChild(val);
      rows.appendChild(r);
      return { fill: fill, res: res, val: val };
    });
    root.appendChild(rows);
    root.appendChild(h("p", "pl-sub", "ค่าคลาดเคลื่อนเฉลี่ย (MAE ตัวอย่าง, พันบาท) แต่ละรอบ"));
    var svg = sv("svg", { viewBox: "0 0 320 110", "class": "pl-svg pl-line", role: "img", "aria-label": "ความคลาดเคลื่อนรวมต่อรอบ" });
    root.appendChild(svg);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> ต้นไม้ต้นใหม่ทายส่วนที่ยังคลาดของต้นก่อนหน้า แล้วเพิ่มกลับเข้าไปทีละ 30% — ความคลาดจึงลดลงทีละรอบ ตัวเลขทั้งหมดสมมติขึ้น"));

    function mae() {
      var s = 0;
      TARGET.forEach(function (t, i) { s += Math.abs(t - pred[i]); });
      return s / TARGET.length;
    }
    function drawChart() {
      svg.innerHTML = "";
      var X0 = 30, X1 = 310, Y0 = 12, Y1 = 92, top = maes[0] || 1;
      var px = function (n) { return X0 + n / MAXR * (X1 - X0); };
      var py = function (v) { return Y1 - v / top * (Y1 - Y0); };
      svg.appendChild(sv("line", { x1: X0, y1: Y1, x2: X1, y2: Y1 }, "pl-axisl"));
      [0, 4, 8, 12].forEach(function (n) {
        var t = sv("text", { x: px(n), y: 105, "text-anchor": "middle" }, "pl-svgt");
        t.textContent = n;
        svg.appendChild(t);
      });
      var t0 = sv("text", { x: X0 - 4, y: Y0 + 4, "text-anchor": "end" }, "pl-svgt");
      t0.textContent = Math.round(top);
      svg.appendChild(t0);
      var pts = maes.map(function (v, i) { return px(i).toFixed(1) + "," + py(v).toFixed(1); }).join(" ");
      svg.appendChild(sv("polyline", { points: pts }, "pl-poly xgb"));
      maes.forEach(function (v, i) { svg.appendChild(sv("circle", { cx: px(i), cy: py(v), r: i === maes.length - 1 ? 4 : 2.5 }, "pl-pt xgb")); });
      var last = maes[maes.length - 1];
      var lt = sv("text", { x: Math.min(px(maes.length - 1) + 6, 280), y: Math.max(py(last) - 8, 10) }, "pl-svgt");
      lt.textContent = Math.round(last);
      svg.appendChild(lt);
    }
    function render() {
      var r = maes.length - 1;
      info.textContent = "ต้นไม้ " + r + " / " + MAXR + " ต้น";
      add.disabled = r >= MAXR;
      TARGET.forEach(function (t, i) {
        var e = els[i], p = pred[i], lo = Math.min(p, t), hi = Math.max(p, t);
        e.fill.style.width = (p / SCALE * 100) + "%";
        e.res.style.left = (lo / SCALE * 100) + "%";
        e.res.style.width = ((hi - lo) / SCALE * 100) + "%";
        e.val.textContent = Math.round(p) + " (" + (t - p >= 0 ? "ขาด " : "เกิน ") + Math.round(Math.abs(t - p)) + ")";
      });
      drawChart();
    }
    function reset() {
      pred = TARGET.map(function () { return base; });
      maes = [mae()];
      render();
    }
    add.addEventListener("click", function () {
      if (maes.length - 1 >= MAXR) return;
      pred = pred.map(function (p, i) {
        return p + LR * (TARGET[i] - p) * (0.8 + 0.2 * Math.random());
      });
      maes.push(mae());
      render();
    });
    rst.addEventListener("click", reset);
    reset();
  }

  /* ---------------- 4. Split ---------------- */
  function buildSplit(root) {
    var COUNTS = [18, 12, 6, 4], NAMES = ["รุ่น A", "รุ่น B", "รุ่น C", "รุ่น D"];
    var mode = "strat";
    var cls = [];
    COUNTS.forEach(function (n, c) { for (var i = 0; i < n; i++) cls.push(c); });
    var total = cls.length;

    var ctl = h("div", "pl-controls");
    var seg = h("div", "pl-seg");
    var bPlain = btn("สุ่มธรรมดา", "สุ่มธรรมดา");
    var bStrat = btn("สุ่มแบบแบ่งชั้น (Stratified)", "สุ่มแบบแบ่งชั้น");
    bPlain.setAttribute("aria-pressed", "false");
    bStrat.setAttribute("aria-pressed", "true");
    seg.appendChild(bPlain); seg.appendChild(bStrat);
    var go = btn("🔀 สุ่มใหม่", "สุ่มแบ่งชุดใหม่", "pl-primary");
    ctl.appendChild(seg); ctl.appendChild(go);
    root.appendChild(ctl);
    root.appendChild(h("p", "pl-legend", COUNTS.map(function (n, c) {
      return "<i class=\"pl-k c" + c + "\"></i>" + NAMES[c] + " (" + n + " คัน)";
    }).join(" ")));

    var stage = h("div", "pl-sstage");
    var zTrain = h("div", "pl-zone train", "<span>ชุดฝึก 80%</span>");
    var zTest = h("div", "pl-zone test", "<span>ชุดทดสอบ 20%</span>");
    stage.appendChild(h("div", "pl-poollabel", "ข้อมูลทั้งหมด 40 คัน (ตัวอย่าง)"));
    stage.appendChild(zTrain); stage.appendChild(zTest);
    var dots = cls.map(function (c) {
      var d = h("i", "pl-sdot c" + c);
      stage.appendChild(d);
      return d;
    });
    root.appendChild(stage);
    var bars = h("div", "pl-sbars");
    root.appendChild(bars);
    var verdict = h("p", "pl-result");
    verdict.setAttribute("aria-live", "polite");
    root.appendChild(verdict);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> 40 คันนี้สมมติขึ้น รุ่น D มีน้อย (4 คัน) จึงเห็นสัดส่วนเบี่ยงง่ายเมื่อสุ่มธรรมดา ลองกด 'สุ่มใหม่' หลายๆ ครั้ง"));

    var assign = null; /* 0 = train, 1 = test */
    function doSplit() {
      assign = cls.map(function () { return 0; });
      if (mode === "plain") {
        var idx = shuffle(cls.map(function (_, i) { return i; }));
        for (var k = 0; k < 8; k++) assign[idx[k]] = 1;
      } else {
        COUNTS.forEach(function (n, c) {
          var ids = [];
          cls.forEach(function (cc, i) { if (cc === c) ids.push(i); });
          shuffle(ids);
          var nTest = n - Math.round(0.8 * n);
          for (var k = 0; k < nTest; k++) assign[ids[k]] = 1;
        });
      }
    }
    function layout(spread) {
      var W = stage.clientWidth || 300, S = 20;
      var zw1 = Math.floor(W * 0.8) - 4, zw2 = W - Math.floor(W * 0.8) - 4;
      var zTop = 76;
      zTrain.style.cssText = "left:0;width:" + zw1 + "px;top:" + zTop + "px";
      zTest.style.cssText = "left:" + (W - zw2) + "px;width:" + zw2 + "px;top:" + zTop + "px";
      var cnt = [0, 0];
      var order = cls.map(function (_, i) { return i; }).sort(function (a, b) { return cls[a] - cls[b] || a - b; });
      var poolStep = Math.min(S, (W - 16) / 20);
      order.forEach(function (i, n) {
        var d = dots[i], x, y;
        if (!spread || assign === null) {
          x = 8 + (n % 20) * poolStep; y = 26 + Math.floor(n / 20) * S;
        } else {
          var z = assign[i], zw = z ? zw2 : zw1, ox = z ? W - zw2 : 0;
          var cols = Math.max(1, Math.floor((zw - 16) / S));
          var k = cnt[z]++;
          x = ox + 8 + (k % cols) * S; y = zTop + 30 + Math.floor(k / cols) * S;
        }
        d.style.transform = "translate(" + x + "px," + y + "px)";
      });
    }
    function share(ids) {
      var cnts = [0, 0, 0, 0];
      ids.forEach(function (i) { cnts[cls[i]]++; });
      return cnts.map(function (c) { return ids.length ? c / ids.length * 100 : 0; });
    }
    function bar(label, sh, n) {
      var r = h("div", "pl-brow");
      r.appendChild(h("span", "pl-blabel", label + "<small>" + n + " คัน</small>"));
      var t = h("div", "pl-btrack");
      sh.forEach(function (p, c) {
        var s = h("span", "pl-bseg c" + c, p >= 11 ? Math.round(p) + "%" : "");
        s.style.width = p + "%";
        s.title = NAMES[c] + " " + p.toFixed(1) + "%";
        t.appendChild(s);
      });
      r.appendChild(t);
      return r;
    }
    function showBars() {
      var all = cls.map(function (_, i) { return i; });
      var tr = all.filter(function (i) { return !assign[i]; }), te = all.filter(function (i) { return assign[i]; });
      var sa = share(all), st = share(tr), se = share(te);
      bars.innerHTML = "";
      bars.appendChild(bar("ทั้งหมด", sa, total));
      bars.appendChild(bar("ชุดฝึก", st, tr.length));
      bars.appendChild(bar("ชุดทดสอบ", se, te.length));
      var drift = function (s) { return Math.max.apply(null, s.map(function (p, c) { return Math.abs(p - sa[c]); })); };
      var d1 = drift(st), d2 = drift(se);
      verdict.innerHTML = "สัดส่วนเบี่ยงจากข้อมูลทั้งหมดสูงสุด: ชุดฝึก <b>" + d1.toFixed(1) + "</b> จุด% · ชุดทดสอบ <b>" + d2.toFixed(1) + "</b> จุด%" +
        (mode === "plain" && d2 > 12 ? " <span class=\"pl-warn\">— เบี่ยงมาก!</span>" : "") +
        (mode === "strat" ? " <span class=\"pl-good\">— แบ่งตามรุ่นก่อนสุ่ม สัดส่วนจึงใกล้เคียง</span>" : "");
    }
    function shuffleRun() {
      clearTimers();
      assign = null;
      layout(false);
      bars.innerHTML = "";
      verdict.textContent = "กำลังสุ่ม…";
      later(function () {
        doSplit();
        layout(true);
        later(showBars, 650);
      }, 450);
    }
    function setMode(m) {
      mode = m;
      bPlain.setAttribute("aria-pressed", m === "plain" ? "true" : "false");
      bStrat.setAttribute("aria-pressed", m === "strat" ? "true" : "false");
      shuffleRun();
    }
    bPlain.addEventListener("click", function () { setMode("plain"); });
    bStrat.addEventListener("click", function () { setMode("strat"); });
    go.addEventListener("click", shuffleRun);
    function onResize() { layout(assign !== null); }
    window.addEventListener("resize", onResize);
    dots.forEach(function (d) { d.style.transition = "none"; });
    layout(false);
    void stage.getBoundingClientRect();
    dots.forEach(function (d) { d.style.transition = ""; });
    later(shuffleRun, 200);
    return function () { window.removeEventListener("resize", onResize); };
  }

  /* ---------------- 5. Grid search ---------------- */
  function buildGrid(root) {
    var DEPTH = [3, 5, 7, 9, 11], LEAF = [1, 2, 4, 8, 16];
    var seed = 20241;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    var mae = [], lo = 1e9, hi = -1e9;
    for (var r = 0; r < 5; r++) {
      mae.push([]);
      for (var c = 0; c < 5; c++) {
        var v = 38 + 2.4 * Math.pow(r - 2.1, 2) + 1.7 * Math.pow(c - 1.3, 2) + (rnd() - 0.5) * 1.6;
        mae[r].push(v);
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    var trained, bestKey, sweeping = false;
    var ctl = h("div", "pl-controls");
    var all = btn("▶ ค้นหาทั้งหมด", "ค้นหาทุกช่องในตาราง", "pl-primary");
    var rst = btn("↺ รีเซ็ต", "รีเซ็ตตาราง");
    ctl.appendChild(all); ctl.appendChild(rst);
    var count = h("span", "pl-count", "");
    ctl.appendChild(count);
    root.appendChild(ctl);

    var wrap = h("div", "pl-gwrap");
    wrap.appendChild(h("span", "pl-gx", "min_samples_leaf →"));
    var colHead = h("div", "pl-grow head");
    colHead.appendChild(h("span", "pl-gh pl-gy", "max_depth ↓"));
    LEAF.forEach(function (l) { colHead.appendChild(h("span", "pl-gh", l)); });
    wrap.appendChild(colHead);
    var cells = [];
    DEPTH.forEach(function (d, r) {
      var row = h("div", "pl-grow");
      row.appendChild(h("span", "pl-gh", d));
      cells.push([]);
      LEAF.forEach(function (l, c) {
        var b = h("button", "pl-cell", "?");
        b.type = "button";
        b.setAttribute("aria-label", "ฝึกโมเดล max_depth " + d + " min_samples_leaf " + l);
        b.addEventListener("click", function () { if (!sweeping) train(r, c); });
        b.addEventListener("mouseenter", function () { info(r, c); });
        b.addEventListener("focus", function () { info(r, c); });
        row.appendChild(b);
        cells[r].push(b);
      });
      wrap.appendChild(row);
    });
    root.appendChild(wrap);
    root.appendChild(h("p", "pl-legend", "สี: <i class=\"pl-k gdark\"></i>MAE ต่ำ (ดี) <i class=\"pl-k glight\"></i>MAE สูง (แย่) · <span class=\"pl-ex\">ตัวอย่าง</span> หน่วยพันบาท"));
    var out = h("div", "pl-result");
    out.setAttribute("aria-live", "polite");
    root.appendChild(out);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> ค่า CV MAE ในตารางเป็นพื้นผิวสมมติที่สร้างขึ้นเพื่ออธิบาย ไม่ใช่ผลการศึกษา — GridSearchCV ลองทุกช่องแล้วเลือกช่องที่ MAE ต่ำที่สุด"));

    function info(r, c) {
      if (!trained[r][c] || sweeping) return;
      out.innerHTML = "max_depth=" + DEPTH[r] + ", min_samples_leaf=" + LEAF[c] + " → CV MAE <b>" + mae[r][c].toFixed(1) + "</b> <span class=\"pl-ex\">ตัวอย่าง</span>";
    }
    function paint(r, c) {
      var b = cells[r][c];
      if (!trained[r][c]) {
        b.className = "pl-cell"; b.textContent = "?"; b.style.background = ""; b.style.color = "";
        return;
      }
      var t = (mae[r][c] - lo) / (hi - lo); /* 0 best .. 1 worst */
      var isBest = bestKey === r + "," + c;
      b.className = "pl-cell done" + (isBest ? " best" : "");
      b.style.background = "hsl(210," + Math.round(78 - t * 40) + "%," + Math.round(26 + t * 62) + "%)";
      b.style.color = t < 0.45 ? "#fff" : "var(--navy)";
      b.innerHTML = (isBest ? "<span class=\"crown\">👑</span>" : "") + mae[r][c].toFixed(1);
    }
    function repaintAll() {
      for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) paint(r, c);
    }
    function status() {
      var n = 0;
      trained.forEach(function (row) { row.forEach(function (x) { if (x) n++; }); });
      count.textContent = "ฝึกแล้ว " + n + " / 25 ช่อง";
    }
    function markDone(r, c) {
      trained[r][c] = true;
      var cur = bestKey ? mae[+bestKey.split(",")[0]][+bestKey.split(",")[1]] : 1e9;
      if (mae[r][c] < cur) bestKey = r + "," + c;
      repaintAll();
      status();
    }
    function train(r, c) {
      if (trained[r][c]) { info(r, c); return; }
      var b = cells[r][c];
      b.className = "pl-cell busy"; b.textContent = "…";
      later(function () { markDone(r, c); info(r, c); }, 260);
    }
    function reset() {
      clearTimers();
      sweeping = false;
      all.disabled = false;
      trained = DEPTH.map(function () { return [false, false, false, false, false]; });
      bestKey = null;
      repaintAll();
      status();
      out.innerHTML = "<span class=\"pl-muted\">คลิกช่องใดก็ได้เพื่อ 'ฝึก' โมเดลชุดนั้น</span>";
    }
    all.addEventListener("click", function () {
      reset();
      sweeping = true;
      all.disabled = true;
      var i = 0;
      (function step() {
        if (i >= 25) {
          sweeping = false;
          all.disabled = false;
          var br = +bestKey.split(",")[0], bc = +bestKey.split(",")[1];
          out.innerHTML = "👑 ดีที่สุด: max_depth=<b>" + DEPTH[br] + "</b>, min_samples_leaf=<b>" + LEAF[bc] + "</b> → CV MAE <b>" + mae[br][bc].toFixed(1) + "</b> <span class=\"pl-ex\">ตัวอย่าง</span>";
          return;
        }
        var r = Math.floor(i / 5), c = i % 5;
        cells[r][c].className = "pl-cell busy";
        out.innerHTML = "กำลังลอง max_depth=" + DEPTH[r] + ", min_samples_leaf=" + LEAF[c] + "…";
        later(function () {
          markDone(r, c);
          i++;
          later(step, 40);
        }, 110);
      })();
    });
    rst.addEventListener("click", reset);
    reset();
  }

  /* ---------------- 6. K-fold ---------------- */
  function buildKFold(root) {
    var SCORES = [38.2, 41.5, 36.9, 40.1, 39.3];
    var cur = 0, auto = null;
    var ctl = h("div", "pl-controls");
    var prev = btn("◀ fold ก่อนหน้า", "fold ก่อนหน้า");
    var next = btn("fold ถัดไป ▶", "fold ถัดไป");
    var autoB = btn("▶ เล่นอัตโนมัติ", "เล่นอัตโนมัติ", "pl-primary");
    ctl.appendChild(prev); ctl.appendChild(next); ctl.appendChild(autoB);
    root.appendChild(ctl);
    root.appendChild(h("p", "pl-legend", "<i class=\"pl-k ktrain\"></i>ใช้ฝึก (Train) <i class=\"pl-k kval\"></i>ใช้ตรวจ (Validation)"));
    var title = h("p", "pl-ktitle", "");
    title.setAttribute("aria-live", "polite");
    root.appendChild(title);
    var row = h("div", "pl-krow");
    var blocks = [0, 1, 2, 3, 4].map(function (i) {
      var b = h("div", "pl-kblock", "<span>ส่วนที่ " + (i + 1) + "</span><small></small>");
      row.appendChild(b);
      return b;
    });
    root.appendChild(row);
    var chips = h("div", "pl-kchips");
    var chipEls = SCORES.map(function (s, i) {
      var c = h("div", "pl-kchip", "<small>fold " + (i + 1) + "</small><b>–</b>");
      chips.appendChild(c);
      return c;
    });
    root.appendChild(chips);
    var mean = h("div", "pl-kmean", "");
    mean.setAttribute("aria-live", "polite");
    root.appendChild(mean);
    root.appendChild(h("p", "pl-note", "<span class=\"pl-ex\">ตัวอย่าง</span> คะแนน (MAE พันบาท) ของแต่ละรอบสมมติขึ้น ไม่ใช่ผลการศึกษา — ทุกส่วนได้เป็น Validation เพียงครั้งเดียว แล้วเอาคะแนนมาเฉลี่ย"));

    function stop() {
      if (auto) { window.clearTimeout(auto); auto = null; }
      autoB.textContent = "▶ เล่นอัตโนมัติ";
      autoB.setAttribute("aria-label", "เล่นอัตโนมัติ");
    }
    function render() {
      title.innerHTML = "รอบที่ <b>" + (cur + 1) + " / 5</b> — ส่วนที่ " + (cur + 1) + " เป็น Validation อีก 4 ส่วนใช้ฝึก";
      blocks.forEach(function (b, i) {
        var v = i === cur;
        b.className = "pl-kblock " + (v ? "val" : "train");
        b.lastChild.textContent = v ? "Validation" : "Train";
      });
      var sum = 0;
      chipEls.forEach(function (c, i) {
        var shown = i <= cur;
        c.className = "pl-kchip" + (i === cur ? " now" : "") + (shown ? " shown" : "");
        c.lastChild.textContent = shown ? SCORES[i].toFixed(1) : "–";
        if (shown) sum += SCORES[i];
      });
      var n = cur + 1;
      mean.innerHTML = "ค่าเฉลี่ยของ " + n + " รอบแรก = (" + SCORES.slice(0, n).map(function (s) { return s.toFixed(1); }).join(" + ") + ") ÷ " + n +
        " = <b>" + (sum / n).toFixed(2) + "</b> <span class=\"pl-ex\">ตัวอย่าง</span>";
      prev.disabled = cur === 0;
      next.disabled = cur === 4;
    }
    prev.addEventListener("click", function () { stop(); if (cur > 0) { cur--; render(); } });
    next.addEventListener("click", function () { stop(); if (cur < 4) { cur++; render(); } });
    autoB.addEventListener("click", function () {
      if (auto) { stop(); return; }
      cur = 0; render();
      autoB.textContent = "⏸ หยุด";
      autoB.setAttribute("aria-label", "หยุดเล่นอัตโนมัติ");
      (function tick() {
        auto = window.setTimeout(function () {
          if (cur < 4) { cur++; render(); tick(); } else { stop(); }
        }, reduce ? 0 : 1100);
      })();
    });
    render();
    return stop;
  }

  var WIDGETS = {
    dt: { title: "เดินตามต้นไม้ตัดสินใจ", instr: "เลือกคุณสมบัติของรถตัวอย่าง แล้วดูจุดเดินลงตามคำถามจนถึงราคาที่ใบของต้นไม้", build: buildDT },
    rf: { title: "ป่าไม้สุ่ม: ยิ่งหลายต้น ยิ่งนิ่ง", instr: "กด 'ปลูกต้นไม้เพิ่ม' ทีละต้น แล้วดูค่าเฉลี่ยเข้าใกล้ราคาจริง", build: buildRF },
    xgb: { title: "XGBoost: ต้นใหม่แก้ความคลาดของต้นก่อน", instr: "กด 'เพิ่มต้นไม้ถัดไป' ทีละรอบ แล้วดูแท่งที่คลาดหดลงและกราฟความคลาดเคลื่อนลดลง", build: buildXGB },
    split: { title: "แบ่งชุดข้อมูล: สุ่มธรรมดา vs แบ่งชั้น", instr: "สลับโหมด แล้วกด 'สุ่มใหม่' หลายๆ ครั้ง เปรียบเทียบสัดส่วนแต่ละรุ่นในชุดฝึกและชุดทดสอบ", build: buildSplit },
    grid: { title: "Grid Search: ลองทุกช่องแล้วเลือกที่ดีที่สุด", instr: "คลิกช่องใดก็ได้เพื่อฝึกโมเดลชุดนั้น หรือกด 'ค้นหาทั้งหมด' ให้ลองครบทั้ง 25 ช่อง", build: buildGrid },
    kfold: { title: "K-Fold Cross Validation (K = 5)", instr: "กดสลับ fold ดูว่าส่วนไหนเป็น Validation ในแต่ละรอบ แล้วดูค่าเฉลี่ยคะแนนที่คำนวณสด", build: buildKFold }
  };

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-play]") : null;
    if (!t) return;
    var key = t.getAttribute("data-play");
    if (WIDGETS[key]) openPlay(key, t);
  });
})();
