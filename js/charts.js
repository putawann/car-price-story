/* Small, dependency-free SVG / DOM chart helpers. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var COLORS = {
    navy: "#17507F",
    blue: "#2F80ED",
    sky: "#DCEBF8",
    sky2: "#BBD9F2",
    muted: "#5B7086",
    line: "#D7E6F4",
    dt: "#2E9E5B",
    rf: "#2F6FB8",
    xgb: "#E8833A"
  };

  var uid = 0;

  function motionOff() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function E(tag, attrs, text) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function comma(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function makeSvg(container, label, width, height) {
    clear(container);
    var svg = E("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": label,
      focusable: "false"
    });
    container.appendChild(svg);
    return svg;
  }

  /* Size the viewBox to the real box (scale 1) so chart text keeps its pixel size.
     If the box is narrower than minW the chart keeps minW and scrolls sideways. */
  function fitSize(container, minW, defW, defH, minH) {
    var cw = Math.round(container.clientWidth || 0);
    if (!cw) return { W: defW, H: defH, scroll: false };
    var probe = document.createElement("svg");
    var mh = 0;
    try {
      container.appendChild(probe);
      mh = parseFloat(getComputedStyle(probe).maxHeight);
      container.removeChild(probe);
    } catch (err) { mh = 0; }
    var H = mh > 0 ? Math.max(minH, Math.min(defH + 40, Math.round(mh))) : defH;
    return { W: Math.max(cw, minW), H: H, scroll: cw < minW };
  }

  function finishSvg(container, svg, f) {
    if (!f.scroll) return;
    svg.style.width = f.W + "px";
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    container.style.overflowX = "auto";
  }

  function animateIn(node, frames, options) {
    if (!node || !node.animate) return;
    if (motionOff()) return;
    node.animate(frames, Object.assign({ fill: "both" }, options || {}));
  }

  /* ---------------------------------------------------------
     Line chart (price index / OOB MAE)
     --------------------------------------------------------- */
  function lineChart(container, opts) {
    if (!container) return;
    var L = 60, R = 30, T = 36, B = 48;
    var labels = opts.labels || [];
    var values = opts.values || [];
    var color = opts.color || COLORS.blue;
    var format = opts.format || function (v) { return comma(v); };
    var points = opts.points !== false;
    var dense = values.length >= 8;
    var fit = fitSize(container, values.length * (dense ? 40 : 56) + L + R, 600, 290, 200);
    var W = fit.W, H = fit.H;
    var svg = makeSvg(container, opts.ariaLabel || "กราฟเส้น", W, H);
    finishSvg(container, svg, fit);
    var plotW = W - L - R;
    var plotH = H - T - B;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var pad = (max - min) * 0.16 || 1;
    var yMin = min - pad;
    var yMax = max + pad;
    var ticks = opts.ticks && opts.ticks.length > 1 ? opts.ticks : null;
    var tickFormat = opts.tickFormat || format;
    if (ticks) {
      yMin = ticks[0];
      yMax = ticks[ticks.length - 1];
    }
    var n = values.length;

    var defs = E("defs");
    var gid = "grad" + (++uid);
    var grad = E("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" });
    append(grad,
      E("stop", { offset: "0%", "stop-color": color, "stop-opacity": ".22" }),
      E("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" })
    );
    defs.appendChild(grad);
    svg.appendChild(defs);

    function xAt(i) {
      return n <= 1 ? L + plotW / 2 : L + (i * plotW) / (n - 1);
    }
    function yAt(v) {
      return T + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    }

    /* grid + y labels */
    var tickCount = ticks ? ticks.length : 5;
    for (var g = 0; g < tickCount; g++) {
      var gv = ticks ? ticks[g] : yMin + ((yMax - yMin) * g) / 4;
      var gy = yAt(gv);
      append(svg, E("line", {
        x1: L, y1: gy, x2: W - R, y2: gy,
        stroke: "#EAF2FA", "stroke-width": 1
      }));
      append(svg, E("text", {
        x: L - 10, y: gy + 4, "text-anchor": "end",
        "font-family": "Prompt, sans-serif", "font-size": "13.5", fill: COLORS.muted
      }, tickFormat(gv)));
    }

    /* x labels */
    labels.forEach(function (label, i) {
      append(svg, E("text", {
        x: xAt(i), y: H - B + 24, "text-anchor": "middle",
        "font-family": "Prompt, sans-serif", "font-size": "13", fill: COLORS.muted
      }, label));
    });

    if (opts.xLabel) {
      append(svg, E("text", {
        x: L + plotW / 2, y: H - 8, "text-anchor": "middle",
        "font-family": "Prompt, sans-serif", "font-size": "13", fill: "#7F95A8"
      }, opts.xLabel));
    }

    var lineD = values.map(function (v, i) {
      return (i === 0 ? "M" : "L") + xAt(i).toFixed(2) + " " + yAt(v).toFixed(2);
    }).join(" ");
    var areaD = lineD + " L" + xAt(n - 1).toFixed(2) + " " + (T + plotH) + " L" + xAt(0).toFixed(2) + " " + (T + plotH) + " Z";

    var area = E("path", { d: areaD, fill: "url(#" + gid + ")", opacity: motionOff() ? 1 : 0 });
    var path = E("path", {
      d: lineD, fill: "none", stroke: color, "stroke-width": 3,
      "stroke-linecap": "round", "stroke-linejoin": "round"
    });
    append(svg, area, path);

    if (!motionOff()) {
      animateIn(area, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 900, easing: "ease-out" });
    }

    if (path.getTotalLength) {
      var len = path.getTotalLength();
      if (motionOff()) {
        path.style.strokeDasharray = "none";
      } else {
        path.style.strokeDasharray = len + " " + len;
        path.style.strokeDashoffset = len;
        animateIn(path, [
          { strokeDashoffset: len },
          { strokeDashoffset: 0 }
        ], { duration: 1900, delay: 250, easing: "ease-in-out" });
      }
    }

    /* points + value labels */
    var pointGroup = E("g");
    /* when neighbouring labels would collide, put every second label under its point */
    var stagger = dense;
    values.forEach(function (v, i) {
      var cx = xAt(i), cy = yAt(v);
      var circle = E("circle", {
        cx: cx, cy: cy, r: 4.6, fill: "#fff", stroke: color, "stroke-width": 2.6
      });
      var label = E("text", {
        x: i === 0 ? cx - 4 : i === n - 1 ? cx + 4 : cx, y: stagger && i % 2 === 1 ? cy + 21 : cy - 12,
        "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
        "font-family": "Prompt, sans-serif", "font-size": points ? "13" : "0",
        "font-weight": "600", fill: COLORS.navy
      }, format(v));
      if (!points) label.setAttribute("opacity", "0");
      pointGroup.appendChild(circle);
      pointGroup.appendChild(label);
      if (!motionOff()) {
        animateIn(circle, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 500 + i * 110, easing: "ease-out" });
        animateIn(label, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 560 + i * 110, easing: "ease-out" });
      }
    });
    svg.appendChild(pointGroup);

    /* annotation */
    if (opts.annotation && n > 1) {
      var ai = Math.max(0, Math.min(n - 1, opts.annotation.index || 0));
      var ax = xAt(ai), ay = yAt(values[ai]);
      var annColor = opts.annotation.color || "#C4651D";
      var annGroup = E("g", { opacity: motionOff() ? 1 : 0 });
      var text = opts.annotation.text || "";
      var tw = text.length * 8 + 24;
      var tx = Math.max(L + 4, Math.min(W - R - tw, ax - tw / 2));
      var ty = Math.max(T + 4, ay - 54);
      var seg = opts.annotation.segment;
      if (seg) {
        /* pill above a segment, with a small arrow pointing down onto the line */
        var s0 = seg[0], s1 = seg[1], st = seg[2] === undefined ? 0.5 : seg[2];
        var sx = xAt(s0) + (xAt(s1) - xAt(s0)) * st;
        var sy = yAt(values[s0]) + (yAt(values[s1]) - yAt(values[s0])) * st;
        tx = Math.max(L + 4, Math.min(W - R - tw, sx - tw / 2));
        ty = Math.max(T + 4, sy - 70);
        append(annGroup,
          E("line", {
            x1: sx, y1: ty + 24, x2: sx, y2: sy - 8,
            stroke: annColor, "stroke-width": 1.6, "stroke-linecap": "round"
          }),
          E("path", {
            d: "M" + (sx - 5) + " " + (sy - 14) + " L" + sx + " " + (sy - 6) + " L" + (sx + 5) + " " + (sy - 14),
            fill: "none", stroke: annColor, "stroke-width": 1.6,
            "stroke-linecap": "round", "stroke-linejoin": "round"
          })
        );
      } else {
        append(annGroup, E("line", {
          x1: ax, y1: ay + 8, x2: ax, y2: T + plotH,
          stroke: annColor, "stroke-width": 1.4, "stroke-dasharray": "5 5", opacity: ".7"
        }));
      }
      append(annGroup,
        E("rect", {
          x: tx, y: ty, width: tw, height: 24, rx: 12,
          fill: "#FFF6EC", stroke: "#F0BC84", "stroke-width": 1
        }),
        E("text", {
          x: tx + tw / 2, y: ty + 16, "text-anchor": "middle",
          "font-family": "Prompt, sans-serif", "font-size": "13",
          "font-weight": "600", fill: annColor
        }, text)
      );
      svg.appendChild(annGroup);
      if (!motionOff()) {
        animateIn(annGroup, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2100, easing: "ease-out" });
      }
    }
  }

  /* ---------------------------------------------------------
     Vertical bar chart (MAE per fold)
     --------------------------------------------------------- */
  function barChart(container, opts) {
    if (!container) return;
    var L = 58, R = 76, T = 34, B = 46;
    var labels = opts.labels || [];
    var values = opts.values || [];
    var color = opts.color || COLORS.blue;
    var fit = fitSize(container, 410, 560, 270, 200);
    var W = fit.W, H = fit.H;
    var svg = makeSvg(container, opts.ariaLabel || "กราฟแท่ง", W, H);
    finishSvg(container, svg, fit);
    var plotW = W - L - R;
    var plotH = H - T - B;
    var max = Math.max.apply(null, values.concat([opts.mean || 0]));
    var rawStep = (max * 1.1) / 4;
    var mag = Math.pow(10, Math.floor(Math.log(rawStep) / Math.LN10));
    var step = mag;
    [1, 2, 2.5, 5, 10].some(function (m) { step = m * mag; return step >= rawStep; });
    var yMax = step * 4;
    var n = values.length;
    var slot = plotW / n;
    var bw = Math.min(64, slot * 0.5);
    var mean = opts.mean;

    function yAt(v) { return T + plotH - (v / yMax) * plotH; }

    for (var g = 0; g <= 4; g++) {
      var gv = step * g;
      var gy = yAt(gv);
      append(svg, E("line", {
        x1: L, y1: gy, x2: W - R, y2: gy,
        stroke: "#EAF2FA", "stroke-width": 1
      }));
      append(svg, E("text", {
        x: L - 10, y: gy + 4, "text-anchor": "end",
        "font-family": "Prompt, sans-serif", "font-size": "13", fill: COLORS.muted
      }, comma(gv)));
    }

    var rects = [];
    values.forEach(function (v, i) {
      var cx = L + slot * i + slot / 2;
      var y = yAt(v);
      var h = T + plotH - y;
      var rect = E("rect", {
        x: cx - bw / 2, y: y, width: bw, height: h, rx: 7,
        fill: color, opacity: ".9"
      });
      rect.style.transformBox = "fill-box";
      rect.style.transformOrigin = "bottom";
      rects.push(rect);
      append(svg, rect,
        E("text", {
          x: cx, y: y - 9, "text-anchor": "middle",
          "font-family": "Prompt, sans-serif", "font-size": "13",
          "font-weight": "600", fill: COLORS.navy
        }, comma(v)),
        E("text", {
          x: cx, y: H - B + 24, "text-anchor": "middle",
          "font-family": "Prompt, sans-serif", "font-size": "14", fill: COLORS.muted
        }, labels[i])
      );
      if (!motionOff() && rect.animate) {
        rect.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 800, delay: 250 + i * 110, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both"
        });
      }
    });

    if (mean) {
      var my = yAt(mean);
      append(svg,
        E("line", {
          x1: L, y1: my, x2: W - R, y2: my,
          stroke: COLORS.navy, "stroke-width": 1.5, "stroke-dasharray": "6 5", opacity: ".75"
        }),
        E("text", {
          x: W - R + 8, y: my - 2, "text-anchor": "start",
          "font-family": "Prompt, sans-serif", "font-size": "13",
          fill: COLORS.navy
        }, "mean"),
        E("text", {
          x: W - R + 8, y: my + 14, "text-anchor": "start",
          "font-family": "Prompt, sans-serif", "font-size": "13",
          "font-weight": "600", fill: COLORS.navy
        }, comma(mean))
      );
    }
  }

  /* ---------------------------------------------------------
     Horizontal bar rows (importance / comparison)
     --------------------------------------------------------- */
  function hBars(container, items, opts) {
    if (!container) return;
    opts = opts || {};
    clear(container);
    var max = opts.max || Math.max.apply(null, items.map(function (d) { return d.value; }));
    if (!max) max = 1;
    items.forEach(function (item, i) {
      var row = document.createElement("div");
      row.className = "bar-row" + (item.highlight ? " rank-1" : "");

      var label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = item.label;
      label.title = item.label;

      var track = document.createElement("div");
      track.className = "bar-track";
      var fill = document.createElement("span");
      fill.className = "bar-fill " + (item.colorClass || opts.colorClass || "xgb");
      fill.style.width = "0";
      fill.style.setProperty("--d", String(i * 70));
      track.appendChild(fill);

      var value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = item.display || comma(item.value);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      container.appendChild(row);

      var pct = Math.max(3, (item.value / max) * 100);
      if (motionOff()) {
        fill.style.width = pct + "%";
      } else {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            fill.style.width = pct + "%";
          });
        });
      }

      if (item.count !== false) {
        countUp(value, item.value, {
          duration: 900,
          delay: 150 + i * 70,
          decimals: item.decimals || 0,
          suffix: item.suffix || ""
        });
      }
    });
  }

  /* ---------------------------------------------------------
     Count-up number
     --------------------------------------------------------- */
  function countUp(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var duration = opts.duration === undefined ? 1200 : opts.duration;
    var delay = opts.delay || 0;
    var decimals = opts.decimals || 0;
    var suffix = opts.suffix || "";
    var prefix = opts.prefix || "";
    var finalText = opts.finalText || null;

    if (el.__countRAF) cancelAnimationFrame(el.__countRAF);
    if (el.__countTimer) clearTimeout(el.__countTimer);

    function format(v) {
      if (finalText && v >= target) return finalText;
      if (opts.format) return opts.format(v);
      if (decimals > 0) return v.toFixed(decimals);
      return Math.round(v).toLocaleString("en-US");
    }

    if (motionOff() || duration <= 0) {
      el.textContent = finalText || format(target) + suffix;
      return;
    }

    el.textContent = prefix + format(0) + suffix;

    el.__countTimer = setTimeout(function () {
      var start = null;
      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + format(target * eased) + suffix;
        if (p < 1) {
          el.__countRAF = requestAnimationFrame(frame);
        } else {
          el.textContent = prefix + (finalText || format(target)) + suffix;
          el.__countRAF = null;
        }
      }
      el.__countRAF = requestAnimationFrame(frame);
    }, delay);
  }

  window.StoryCharts = {
    COLORS: COLORS,
    lineChart: lineChart,
    barChart: barChart,
    hBars: hBars,
    countUp: countUp,
    comma: comma,
    motionOff: motionOff
  };
})();
