/* Presentation player + scene animations. */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var Charts = window.StoryCharts;
  var C = Charts.COLORS;

  var scenes = $$(".scene");
  var total = scenes.length;

  var currentIndex = 0;
  var playing = false;
  var ended = false;
  var dwellTimer = null;
  var progressRAF = null;
  var sceneStart = 0;
  var sceneDuration = 8000;
  var sceneTimers = [];
  var timerScene = "";
  var navLockUntil = 0;
  var appSwitchTimer = null;
  var activeImportance = "xgb";

  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function motionOff() {
    return !!(reduceQuery && reduceQuery.matches);
  }

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    sceneTimers.push({ id: id, scene: timerScene });
    return id;
  }

  /* Only the timers of the scene being (re)played are cleared, so activating
     another scene (e.g. while scrolling past it) never kills a running animation. */
  function clearSceneTimers(sceneId) {
    sceneTimers = sceneTimers.filter(function (t) {
      if (t.scene !== sceneId) return true;
      window.clearTimeout(t.id);
      return false;
    });
    if (sceneId === "s-app" && appSwitchTimer) {
      window.clearTimeout(appSwitchTimer);
      appSwitchTimer = null;
    }
  }

  function sceneIndexById(id) {
    for (var i = 0; i < total; i++) {
      if (scenes[i].id === id) return i;
    }
    return -1;
  }

  function comma(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  /* =========================================================
     Static content rendering
     ========================================================= */

  function renderMembers() {
    var grid = $("#members-grid");
    if (!grid) return;
    grid.innerHTML = "";
    DATA.members.forEach(function (m, i) {
      var card = document.createElement("article");
      card.className = "member-card reveal";
      card.style.setProperty("--d", String(220 + i * 110));
      card.innerHTML =
        '<span class="member-id tnum">' + m.id + "</span>" +
        '<div class="member-name">' + m.name + "</div>";
      grid.appendChild(card);
    });
  }

  function renderRelated() {
    var grid = $("#related-grid");
    if (!grid) return;
    grid.innerHTML = "";
    DATA.related.forEach(function (item, i) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "paper-card reveal";
      card.style.setProperty("--d", String(260 + i * 90));
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("aria-label", "พลิกดูตัวแปรและวิธีการศึกษาของ " + item.short);

      var pillClass = item.bestKind === "mlr" ? "badge" : "pill " + item.bestKind;
      card.innerHTML =
        '<span class="paper-inner">' +
          '<span class="paper-face paper-front">' +
            '<span class="paper-year">' + item.year + " · " + item.author + "</span>" +
            '<span class="paper-title">' + item.short + "</span>" +
            '<span class="paper-result">' + item.result + "</span>" +
            '<span class="paper-best">' + (item.bestKind === "mlr" ? "วิธีหลัก:" : "ดีที่สุด:") +
              ' <span class="' + pillClass + '">' + item.best + "</span></span>" +
            '<span class="paper-flip-hint">คลิกเพื่อดูรายละเอียด ↻</span>' +
          "</span>" +
          '<span class="paper-face paper-back">' +
            '<h5>ตัวแปรอิสระ</h5><p>' + item.variables + "</p>" +
            '<h5>วิธีการศึกษา</h5><p>' + item.methods + "</p>" +
            '<span class="paper-flip-hint">↻ คลิกเพื่อกลับ</span>' +
          "</span>" +
        "</span>";

      card.addEventListener("click", function () {
        var flipped = card.classList.toggle("flipped");
        card.setAttribute("aria-pressed", flipped ? "true" : "false");
      });
      grid.appendChild(card);
    });

    var tally = $("#related-tally");
    if (!tally) return;
    var counts = { rf: 0, xgb: 0, mlr: 0 };
    DATA.related.forEach(function (r) { counts[r.bestKind] += 1; });
    tally.innerHTML =
      '<span>สรุปตัวแบบที่ได้ผลดีที่สุด:</span>' +
      '<span class="tally-pill"><span class="tally-dot" style="background:var(--rf)"></span>Random Forest ×' + counts.rf + "</span>" +
      '<span class="tally-pill"><span class="tally-dot" style="background:var(--xgb)"></span>XGBoost ×' + counts.xgb + "</span>" +
      '<span class="small">อีก 1 เรื่องใช้ MLR เพื่อวิเคราะห์ปัจจัย</span>';
  }

  function iconSvg(name) {
    var icons = {
      car: '<path d="M3 13l2-5h14l2 5v4H3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
      brand: '<path d="M20 13l-7 7-9-9V4h7z"/><circle cx="8" cy="8" r="1.2"/>',
      model: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
      fuel: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
      engine: '<rect x="4" y="9" width="12" height="9" rx="2"/><path d="M16 12h3v4h-3M8 6V4h5v2"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
      road: '<path d="M8 21L10 3M16 21L14 3"/><path d="M12 5v3M12 11v3M12 17v3"/>',
      age: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (icons[name] || icons.car) + "</svg>";
  }

  function renderVariables() {
    var grid = $("#variables-grid");
    if (!grid) return;
    grid.innerHTML = "";
    DATA.variables.items.forEach(function (v, i) {
      var card = document.createElement("div");
      card.className = "var-card reveal";
      card.style.setProperty("--d", String(320 + i * 70));
      card.innerHTML =
        '<div class="var-icon">' + iconSvg(v.icon) + "</div>" +
        "<div>" +
          '<div class="var-code">' + v.code + "</div>" +
          '<div class="var-name">' + v.name + "</div>" +
          '<div class="var-detail">' + v.detail + "</div>" +
        "</div>";
      grid.appendChild(card);
    });
  }

  function renderRecommendations() {
    var list = $("#rec-list");
    if (!list) return;
    list.innerHTML = "";
    DATA.conclusion.recommendations.forEach(function (text, i) {
      var item = document.createElement("div");
      item.className = "rec-item reveal";
      item.style.setProperty("--d", String(250 + i * 150));
      item.innerHTML = '<span class="rec-num">' + (i + 1) + "</span><p>" + text + "</p>";
      list.appendChild(item);
    });
  }

  /* ---------- tables ---------- */
  function renderTable(target, headers, rows, opts) {
    opts = opts || {};
    var el = typeof target === "string" ? $(target) : target;
    if (!el) return;
    el.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";
    var table = document.createElement("table");
    table.className = "data-table" + (opts.wrap ? " wrap-cells" : "");

    var thead = document.createElement("thead");
    var htr = document.createElement("tr");
    headers.forEach(function (h, i) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      if (opts.numCols && opts.numCols.indexOf(i) !== -1) th.className = "num";
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (row, ri) {
      var tr = document.createElement("tr");
      if (opts.bestRow && ri === 0) tr.className = "best-row";
      row.forEach(function (cell, ci) {
        var td = document.createElement("td");
        td.textContent = cell;
        if (opts.numCols && opts.numCols.indexOf(ci) !== -1) td.className = "num";
        if (opts.chosenCol === ci) td.classList.add("chosen");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    el.appendChild(wrap);
  }

  var MODEL_META = {
    dt: {
      color: C.dt,
      topHead: ["อันดับ", "max_depth", "min_samples_leaf", "ccp_alpha", "MAE (บาท)", "SD (บาท)"],
      topNum: [0, 1, 2, 4, 5],
      aria: "Decision Tree"
    },
    rf: {
      color: C.rf,
      topHead: ["อันดับ", "max_features", "min_samples_leaf", "MAE (บาท)", "SD (บาท)"],
      topNum: [0, 1, 2, 3, 4],
      aria: "Random Forest"
    },
    xgb: {
      color: C.xgb,
      topHead: ["อันดับ", "max_depth", "min_child_weight", "reg_lambda", "n_estimators", "MAE (บาท)", "SD (บาท)"],
      topNum: [0, 1, 2, 3, 4, 5, 6],
      aria: "XGBoost"
    }
  };

  function initModel(key, data, ids) {
    var meta = MODEL_META[key];
    renderTable(ids.params, ["Hyperparameter", "ค่าที่ทดลอง", "ค่าที่เลือก"], data.params, { chosenCol: 2, wrap: true });
    renderTable(ids.top5, meta.topHead, data.top5, { bestRow: true, numCols: meta.topNum });
    renderTable(ids.cv, ["Metric", "5-fold CV", "Test"], data.cv, { numCols: [1, 2] });

    var r2 = $(ids.r2);
    if (r2) {
      r2.innerHTML = "";
      data.folds.forEach(function (row) {
        var chip = document.createElement("span");
        chip.className = "r2-chip";
        chip.textContent = "Fold " + row[0] + " · R² " + row[1];
        r2.appendChild(chip);
      });
      var mean = document.createElement("span");
      mean.className = "r2-chip strong";
      mean.textContent = "เฉลี่ย · R² " + data.mean.r2;
      r2.appendChild(mean);
      var sd = document.createElement("span");
      sd.className = "r2-chip";
      sd.textContent = "SD · R² " + data.sd.r2;
      r2.appendChild(sd);
    }
  }

  /* ---------- app thumbs ---------- */
  function buildAppThumbs() {
    var wrap = $("#app-thumbs");
    if (!wrap) return;
    wrap.innerHTML = "";
    DATA.app.screens.forEach(function (s, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb";
      btn.setAttribute("aria-label", "ดูหน้าจอ " + s.step + " " + s.desc);
      btn.setAttribute("aria-current", i === 0 ? "true" : "false");
      btn.innerHTML = '<img src="' + s.src + '" alt="' + s.alt + '" loading="lazy" decoding="async">';
      btn.addEventListener("click", function () { showScreen(i, true); });
      wrap.appendChild(btn);
    });
  }

  function showScreen(index, animate) {
    var s = DATA.app.screens[index];
    var img = $("#app-screen");
    if (!s || !img) return;

    var label = $("#app-step-label");
    if (label) label.textContent = s.step + " · " + s.desc;
    $$("#app-thumbs .thumb").forEach(function (btn, i) {
      btn.setAttribute("aria-current", i === index ? "true" : "false");
    });

    if (appSwitchTimer) {
      window.clearTimeout(appSwitchTimer);
      appSwitchTimer = null;
    }

    if (!animate || motionOff()) {
      img.src = s.src;
      img.alt = s.alt;
      img.classList.remove("switching");
      return;
    }

    img.classList.add("switching");
    appSwitchTimer = window.setTimeout(function () {
      img.src = s.src;
      img.alt = s.alt;
      var done = function () { img.classList.remove("switching"); };
      if (img.complete) {
        window.requestAnimationFrame(done);
      } else {
        img.addEventListener("load", done, { once: true });
      }
      appSwitchTimer = null;
    }, 180);
  }

  /* =========================================================
     Animators (called when a scene enters the viewport)
     ========================================================= */

  function animPrice() {
    var d = DATA.priceIndex;
    Charts.lineChart($("#price-chart"), {
      labels: d.labels,
      values: d.values,
      color: C.blue,
      format: function (v) { return v.toFixed(2); },
      ticks: [50, 65, 80, 95, 110],
      tickFormat: function (v) { return String(v); },
      annotation: { index: 3, segment: [2, 3, 0.7], text: "ราคาผันผวน" },
      xLabel: "ปี พ.ศ. (ดัชนีปีฐาน 2558 = 100)",
      ariaLabel: "กราฟเส้นดัชนีราคารถยนต์มือสอง ตั้งแต่ 98.11 ถึง 70.41"
    });
  }

  function animFunnelDrops() {
    var layer = $("#s-data .funnel-drops");
    var badges = $$("#s-data .source-badge");
    if (!layer) return;
    layer.innerHTML = "";
    if (motionOff() || !layer.animate || badges.length < 2) return;
    var ROUNDS = 3, PER_BADGE = 4, FALL = 1300;
    for (var r = 0; r < ROUNDS; r++) {
      (function (round) {
        later(function () {
          var lr = layer.getBoundingClientRect();
          var mid = lr.left + lr.width / 2;
          badges.forEach(function (badge, bi) {
            var br = badge.getBoundingClientRect();
            var dx = br.left + br.width / 2 - mid;
            var dy = br.bottom - lr.top;
            for (var k = 0; k < PER_BADGE; k++) {
              var dot = document.createElement("span");
              dot.className = "drop";
              dot.style.background = bi === 0 ? "#2F80ED" : "#E8833A";
              layer.appendChild(dot);
              dot.animate([
                { opacity: 0, transform: "translate(" + (dx + (k - 1.5) * 6) + "px," + (dy - 4) + "px) scale(.7)" },
                { opacity: 1, offset: 0.18 },
                { opacity: 1, offset: 0.8 },
                { opacity: 0, transform: "translate(" + ((k - 1.5) * 8) + "px," + (lr.height + 8) + "px) scale(.8)" }
              ], { duration: FALL, delay: k * 260 + bi * 130, easing: "ease-in", fill: "both" });
            }
          });
        }, 1200 + round * 2300);
      })(r);
    }
  }

  function animData() {
    animFunnelDrops();
    Charts.countUp($("#data-count"), DATA.dataPrep.n, {
      duration: 1900,
      delay: 500,
      finalText: "46,074",
      suffix: ""
    });
  }

  function animSplit() {
    var source = $("#split-source");
    var train = $("#split-train");
    var test = $("#split-test");
    if (!source || !train || !test) return;

    source.innerHTML = "";
    train.innerHTML = "";
    test.innerHTML = "";
    source.classList.remove("done");

    var colors = ["#2F80ED", "#2E9E5B", "#E8833A", "#8E6BC8"];
    var labels = ["ตัวอย่างรุ่น A", "ตัวอย่างรุ่น B", "ตัวอย่างรุ่น C", "ตัวอย่างรุ่น D"];
    var dots = [];

    labels.forEach(function (labelText, rowIndex) {
      var row = document.createElement("div");
      row.className = "split-row";
      var label = document.createElement("span");
      label.className = "split-row-label";
      label.textContent = labelText;
      row.appendChild(label);
      for (var j = 0; j < 10; j++) {
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = colors[rowIndex];
        dot.setAttribute("aria-hidden", "true");
        row.appendChild(dot);
        dots.push({ el: dot, row: rowIndex, index: j });
      }
      source.appendChild(row);
    });

    later(function () {
      if (!document.body.contains(source)) return;
      var firstRects = dots.map(function (d) { return d.el.getBoundingClientRect(); });
      dots.forEach(function (d) {
        var target = d.index < 8 ? train : test;
        target.appendChild(d.el);
      });
      source.classList.add("done");

      if (motionOff()) return;
      window.requestAnimationFrame(function () {
        void train.offsetWidth;
        dots.forEach(function (d, i) {
          var first = firstRects[i];
          var last = d.el.getBoundingClientRect();
          var dx = first.left - last.left;
          var dy = first.top - last.top;
          if (!dx && !dy) return;
          if (!d.el.animate) return;
          d.el.animate(
            [{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "translate(0,0)" }],
            { duration: 850, delay: i * 12, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }
          );
        });
      });
    }, 1400);
  }

  function animPermutation() {
    var base = $("#perm-base");
    var shuffled = $("#perm-shuffled");
    var diff = $(".perm-diff");
    if (base) base.style.width = "0";
    if (shuffled) shuffled.style.width = "0";
    if (diff) diff.classList.remove("show");

    var cells = $$("#perm-table .perm-col-x3");
    var cellTexts = cells.map(function (cell) { return cell.textContent; });
    /* fixed shuffle order: C1,C2,C3,C4 -> C3,C1,C4,C2 */
    var order = [2, 0, 3, 1];
    cells.forEach(function (cell, i) {
      cell.textContent = cellTexts[i];
      cell.classList.add("shuffling");
      if (!motionOff() && cell.animate) {
        cell.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-8px)" },
            { transform: "translateY(8px)" },
            { transform: "translateY(0)" }
          ],
          { duration: 550, delay: 500 + i * 130, easing: "ease-in-out", fill: "both" }
        );
      }
    });

    later(function () {
      cells.forEach(function (cell, i) { cell.textContent = cellTexts[order[i]]; });
    }, 1400);

    later(function () {
      cells.forEach(function (cell) { cell.classList.remove("shuffling"); });
      if (base) base.style.width = "45%";
    }, 1900);

    later(function () {
      if (shuffled) shuffled.style.width = "100%";
    }, 3300);

    later(function () {
      if (diff) diff.classList.add("show");
    }, 4800);
  }

  function animModel(key) {
    var data = DATA[key];
    var meta = MODEL_META[key];
    var combo = $("#" + key + "-combo");
    if (combo) {
      Charts.countUp(combo, data.combos, {
        duration: 1500,
        delay: 250,
        finalText: comma(data.combos)
      });
    }

    var foldValues = data.folds.map(function (row) { return Number(row[2].replace(/,/g, "")); });
    Charts.barChart($("#" + key + "-fold-chart"), {
      labels: data.folds.map(function (row) { return "Fold " + row[0]; }),
      values: foldValues,
      mean: Number(data.mean.mae.replace(/,/g, "")),
      color: meta.color,
      ariaLabel: "กราฟแท่ง MAE แยกรายรอบของ " + meta.aria
    });

    if (key === "rf") {
      Charts.lineChart($("#rf-oob-chart"), {
        labels: data.oob.labels,
        values: data.oob.values,
        color: meta.color,
        format: function (v) { return comma(v); },
        ticks: [52400, 52600, 52800, 53000, 53200],
        annotation: { index: data.oob.markerIndex, text: data.oob.markerText },
        xLabel: "n_estimators (จำนวนต้นไม้)",
        ariaLabel: "กราฟ OOB MAE ตามจำนวนต้นไม้ ตั้งแต่ 53,180 ถึง 52,496"
      });
    }
  }

  function renderComparison() {
    var root = $("#comparison-grid");
    if (!root) return;
    root.innerHTML = "";

    DATA.comparison.forEach(function (metric, gi) {
      var group = document.createElement("div");
      group.className = "metric-group";

      var head = document.createElement("h3");
      head.textContent = metric.label;
      var dir = document.createElement("span");
      dir.className = "dir";
      dir.textContent = metric.better === "สูงดี" ? "ยิ่งสูงยิ่งดี" : "ยิ่งต่ำยิ่งดี";
      head.appendChild(dir);
      group.appendChild(head);

      var models = [
        { key: "dt", name: "Decision Tree" },
        { key: "rf", name: "Random Forest" },
        { key: "xgb", name: "XGBoost" }
      ];
      var max = Math.max(metric.dt, metric.rf, metric.xgb);

      models.forEach(function (m, mi) {
        var value = metric[m.key];
        var row = document.createElement("div");
        row.className = "model-bar-row" + (m.key === "xgb" ? " winner" : "");

        var name = document.createElement("span");
        name.className = "model-name";
        name.textContent = m.name;

        var barTrack = document.createElement("span");
        barTrack.className = "bar-track";
        var fill = document.createElement("span");
        fill.className = "bar-fill " + m.key;
        fill.style.width = "0";
        fill.style.setProperty("--d", String(gi * 120 + mi * 80));
        barTrack.appendChild(fill);

        var val = document.createElement("span");
        val.className = "bar-value tnum";
        val.textContent = "0";
        row.appendChild(name);
        row.appendChild(barTrack);
        row.appendChild(val);
        group.appendChild(row);

        var pct = (value / max) * 100;
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            fill.style.width = pct + "%";
          });
        });

        var decimals = metric.format === "dec4" ? 4 : metric.format === "dec2" ? 2 : 0;
        Charts.countUp(val, value, {
          duration: 1000,
          delay: 250 + gi * 150 + mi * 90,
          decimals: decimals
        });
      });

      root.appendChild(group);
    });
  }

  function renderImportanceTable(model) {
    var root = $("#importance-table");
    if (!root) return;
    root.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";
    var table = document.createElement("table");
    table.className = "data-table";

    var thead = document.createElement("thead");
    var htr = document.createElement("tr");
    ["ตัวแปร", "Decision Tree", "Random Forest", "XGBoost"].forEach(function (h) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    DATA.importance.ranks.forEach(function (row) {
      var tr = document.createElement("tr");
      if (row[model] <= 2) tr.className = "best-row";
      [row.name, row.dt, row.rf, row.xgb].forEach(function (cell, ci) {
        var td = document.createElement("td");
        td.textContent = cell;
        if (ci > 0) td.className = "num";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    root.appendChild(wrap);
  }

  function renderImportance(model) {
    activeImportance = model;
    var deltas = DATA.importance.deltas.slice().sort(function (a, b) { return b[model] - a[model]; });
    var items = deltas.map(function (d, i) {
      return {
        label: d.name,
        value: d[model],
        display: comma(d[model]),
        colorClass: model,
        highlight: i === 0
      };
    });
    Charts.hBars($("#importance-chart"), items, { max: deltas[0][model] });

    $$(".tab").forEach(function (btn) {
      btn.setAttribute("aria-selected", btn.getAttribute("data-model") === model ? "true" : "false");
    });
    renderImportanceTable(model);
  }

  function startImportanceCycle() {
    if (!playing) return;
    var idx = sceneIndexById("s-importance");
    later(function () {
      if (playing && currentIndex === idx) renderImportance("dt");
    }, 2600);
    later(function () {
      if (playing && currentIndex === idx) renderImportance("rf");
    }, 5600);
    later(function () {
      if (playing && currentIndex === idx) renderImportance("xgb");
    }, 8600);
  }

  function animApp() {
    Charts.countUp($("#app-price"), DATA.app.price, {
      duration: 1900,
      delay: 500,
      finalText: "651,000"
    });
    showScreen(0, false);
    DATA.app.screens.forEach(function (s, i) {
      if (i === 0) return;
      later(function () {
        if (document.body.contains($("#app-screen"))) showScreen(i, true);
      }, 1000 + i * 1700);
    });
  }

  function animConclusion() {
    Charts.countUp($("#concl-mae"), DATA.conclusion.mae, {
      duration: 1600, delay: 300, finalText: "51,271"
    });
    Charts.countUp($("#concl-pct"), DATA.conclusion.percent, {
      duration: 1600, delay: 500, decimals: 2, suffix: "%", finalText: "94.23"
    });
    Charts.countUp($("#concl-r2"), DATA.conclusion.r2, {
      duration: 1600, delay: 700, decimals: 4, finalText: "0.9423"
    });
  }

  function animThanks() {
    var box = $("#confetti");
    if (!box || motionOff()) return;
    box.innerHTML = "";
    var palette = [C.blue, C.sky2, C.xgb, C.dt, C.rf, "#F5C542"];
    for (var i = 0; i < 36; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = (i * 37 % 100) + "%";
      piece.style.background = palette[i % palette.length];
      piece.style.animationDuration = (3.4 + (i % 5) * 0.45) + "s";
      piece.style.animationDelay = ((i % 7) * 0.22) + "s";
      piece.style.animationIterationCount = "1";
      piece.style.animationFillMode = "forwards";
      box.appendChild(piece);
    }
  }

  /* =========================================================
     Scene activation
     ========================================================= */

  function activateScene(index, opts) {
    opts = opts || {};
    var scene = scenes[index];
    if (!scene) return;

    if (!scene.classList.contains("inview") || opts.replay) {
      scene.classList.remove("inview");
      void scene.offsetWidth;
      scene.classList.add("inview");
    }

    if (!scene.dataset.animated || opts.replay) {
      scene.dataset.animated = "1";
      clearSceneTimers(scene.id);
      timerScene = scene.id;
      var fn = SCENE_ANIM[scene.id];
      if (fn) {
        try { fn(scene); } catch (err) { console.error("Scene animation failed:", scene.id, err); }
      }
      timerScene = "";
    }
  }

  /* =========================================================
     Player
     ========================================================= */

  var counterEl = $("#scene-counter");
  var progressEl = $("#progress");
  var progressFill = $("#progress-fill");
  var playBtn = $("#play-btn");
  var prevBtn = $("#prev-btn");
  var nextBtn = $("#next-btn");
  var sideNav = $("#side-nav");

  function updateCounter() {
    if (counterEl) counterEl.textContent = (currentIndex + 1) + " / " + total;
  }

  function updateDots() {
    $$(".dot-btn", sideNav).forEach(function (btn, i) {
      if (i === currentIndex) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  function setProgress(index, fraction) {
    if (!progressFill) return;
    var f = fraction === undefined ? 0 : fraction;
    var pct = ((index + Math.max(0, Math.min(1, f))) / total) * 100;
    progressFill.style.width = pct + "%";
  }

  function updatePlayBtn() {
    if (!playBtn) return;
    playBtn.textContent = playing ? "⏸" : "▶";
    playBtn.setAttribute("aria-label", playing ? "หยุดการเล่นชั่วคราว" : "เล่นเรื่องราว");
    playBtn.title = playing ? "หยุด" : "เล่น";
  }

  function startDwell() {
    window.clearTimeout(dwellTimer);
    if (progressRAF) window.cancelAnimationFrame(progressRAF);
    sceneStart = performance.now();
    sceneDuration = Number(scenes[currentIndex].dataset.duration) || 8000;

    function tick(now) {
      if (!playing) return;
      var p = Math.min(1, (now - sceneStart) / sceneDuration);
      setProgress(currentIndex, p);
      if (p < 1) progressRAF = window.requestAnimationFrame(tick);
    }
    progressRAF = window.requestAnimationFrame(tick);

    dwellTimer = window.setTimeout(function () {
      if (!playing) return;
      if (currentIndex < total - 1) {
        goTo(currentIndex + 1);
      } else {
        playing = false;
        ended = true;
        updatePlayBtn();
        setProgress(total - 1, 1);
      }
    }, sceneDuration);
  }

  function goTo(index, opts) {
    opts = opts || {};
    if (!total) return;
    var target = Math.max(0, Math.min(total - 1, index));
    currentIndex = target;
    ended = false;
    updateCounter();
    updateDots();
    setProgress(target, 0);
    /* In play mode every visit replays the scene animation; scroll mode plays it once. */
    activateScene(target, { replay: playing });

    var scene = scenes[target];
    if (scene) {
      var behavior = (opts.instant || motionOff()) ? "auto" : "smooth";
      /* While the programmatic scroll runs, the observer must not move `current`. */
      navLockUntil = performance.now() + (behavior === "smooth" ? 1400 : 150);
      var top = 0;
      for (var el = scene; el; el = el.offsetParent) top += el.offsetTop;
      try {
        window.scrollTo({ top: top, behavior: behavior });
      } catch (err) {
        window.scrollTo(0, top);
      }
    }
    if (playing) startDwell();
  }

  function play() {
    if (playing) return;
    if (ended) {
      currentIndex = 0;
      ended = false;
    }
    playing = true;
    updatePlayBtn();
    goTo(currentIndex);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    ended = false;
    window.clearTimeout(dwellTimer);
    if (progressRAF) window.cancelAnimationFrame(progressRAF);
    progressRAF = null;
    updatePlayBtn();
  }

  function togglePlay() {
    if (playing) pause();
    else play();
  }

  function nextScene() {
    if (playing) pause();
    if (currentIndex < total - 1) goTo(currentIndex + 1);
  }

  function prevScene() {
    if (playing) pause();
    if (currentIndex > 0) goTo(currentIndex - 1);
  }

  function buildDots() {
    if (!sideNav) return;
    sideNav.innerHTML = "";
    scenes.forEach(function (scene, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dot-btn";
      var title = scene.dataset.title || ("ฉาก " + (i + 1));
      btn.setAttribute("data-tip", title);
      btn.setAttribute("aria-label", "ไปยังฉาก: " + title);
      btn.addEventListener("click", function () {
        pause();
        goTo(i);
      });
      sideNav.appendChild(btn);
    });
  }

  function addReplayButtons() {
    scenes.forEach(function (scene, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "replay-btn";
      btn.textContent = "↻ เล่นแอนิเมชันอีกครั้ง";
      btn.setAttribute("aria-label", "เล่นแอนิเมชันของฉากนี้ใหม่");
      btn.addEventListener("click", function () {
        pause();
        currentIndex = i;
        updateCounter();
        updateDots();
        setProgress(i, 0);
        activateScene(i, { replay: true });
      });
      scene.appendChild(btn);
    });
  }

  function initPlayer() {
    buildDots();
    addReplayButtons();
    updateCounter();
    updateDots();
    setProgress(0, 0);
    updatePlayBtn();

    if (playBtn) playBtn.addEventListener("click", togglePlay);
    if (nextBtn) nextBtn.addEventListener("click", nextScene);
    if (prevBtn) prevBtn.addEventListener("click", prevScene);

    var heroPlay = $("#hero-play");
    if (heroPlay) heroPlay.addEventListener("click", play);

    var restart = $("#restart-btn");
    if (restart) {
      restart.addEventListener("click", function () {
        pause();
        ended = false;
        goTo(0);
      });
    }

    if (progressEl) {
      progressEl.addEventListener("click", function (e) {
        var rect = progressEl.getBoundingClientRect();
        var ratio = rect.width ? (e.clientX - rect.left) / rect.width : 0;
        ratio = Math.max(0, Math.min(0.9999, ratio));
        var idx = Math.floor(ratio * total);
        goTo(idx);
      });
    }

    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        nextScene();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevScene();
      } else if (e.key === "Home") {
        e.preventDefault();
        pause();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        pause();
        goTo(total - 1);
      }
    });

    window.addEventListener("wheel", function () {
      navLockUntil = 0;
      if (playing) pause();
    }, { passive: true });

    window.addEventListener("touchmove", function () {
      navLockUntil = 0;
      if (playing) pause();
    }, { passive: true });

    var io = new IntersectionObserver(function (entries) {
      if (playing || performance.now() < navLockUntil) return;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var idx = scenes.indexOf(entry.target);
        if (idx === -1) return;
        currentIndex = idx;
        updateCounter();
        updateDots();
        setProgress(idx, 0);
        activateScene(idx);
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    scenes.forEach(function (scene) { io.observe(scene); });

    scenes.forEach(function (btnScene) {
      var replay = $(".replay-btn", btnScene);
      if (replay) replay.setAttribute("aria-label", "เล่นแอนิเมชันของฉาก " + (btnScene.dataset.title || "") + " อีกครั้ง");
    });
  }

  /* =========================================================
     Scene animation map
     ========================================================= */
  var SCENE_ANIM = {
    "s-background": animPrice,
    "s-data": animData,
    "s-split": animSplit,
    "s-permutation": animPermutation,
    "s-dt": function () { animModel("dt"); },
    "s-rf": function () { animModel("rf"); },
    "s-xgb": function () { animModel("xgb"); },
    "s-compare": renderComparison,
    "s-importance": function () {
      renderImportance(activeImportance);
      startImportanceCycle();
    },
    "s-app": animApp,
    "s-conclusion": animConclusion,
    "s-thanks": animThanks
  };

  /* =========================================================
     Init
     ========================================================= */
  renderMembers();
  renderRelated();
  renderVariables();
  renderRecommendations();
  buildAppThumbs();

  initModel("dt", DATA.dt, { params: "#dt-params", top5: "#dt-top5", cv: "#dt-cv", r2: "#dt-r2" });
  initModel("rf", DATA.rf, { params: "#rf-params", top5: "#rf-top5", cv: "#rf-cv", r2: "#rf-r2" });
  initModel("xgb", DATA.xgb, { params: "#xgb-params", top5: "#xgb-top5", cv: "#xgb-cv", r2: "#xgb-r2" });

  $$(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      renderImportance(btn.getAttribute("data-model"));
    });
  });

  var appNote = $("#app-note");
  if (appNote) appNote.textContent = DATA.app.note;

  initPlayer();
  activateScene(0);

  window.story = {
    play: play,
    pause: pause,
    next: nextScene,
    prev: prevScene,
    goTo: function (index) { pause(); goTo(index); },
    get current() { return currentIndex; },
    get total() { return total; },
    get playing() { return playing; }
  };
})();
