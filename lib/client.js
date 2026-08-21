window.__ModuleLoader__.load({
  id: 'dsh-usage-stats',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    let react_jsx_runtime = require('react/jsx-runtime');
    let react = require('react');

    // ─── CSS ──────────────────────────────────────────────────────────────
    const css = `
      .dshUs-body { max-width:960px; color:var(--dsw-alias-label-primary); flex-direction:column; gap:16px; display:flex; }
      .dshUs-card { background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; }
      .dshUs-cardTitle { color:var(--dsw-alias-label-primary); font-size:14px; font-weight:600; line-height:1.5; }
      .dshUs-legend { display:flex; flex-wrap:wrap; gap:10px 16px; font-size:12px; }
      .dshUs-legendItem { display:flex; align-items:center; gap:4px; }
      .dshUs-legendDot { width:8px; height:8px; border-radius:50%; flex:none; }
      .dshUs-chartWrap { width:100%; overflow-x:auto; overflow-y:hidden; }
      .dshUs-chartWrap svg { display:block; }
      .dshUs-chartBody { position:relative; display:inline-block; }
      .dshUs-tip { position:fixed; z-index:1000; pointer-events:none; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:8px 10px; font-size:12px; line-height:1.6; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.25); }
      .dshUs-tipHeader { font-weight:600; margin-bottom:4px; color:var(--dsw-alias-label-primary); }
      .dshUs-tipRow { display:flex; align-items:center; gap:6px; color:var(--dsw-alias-label-primary); }
      .dshUs-tipRow .dshUs-tipVal { margin-left:auto; font-weight:600; }
      /* GitHub-style heatmap calendar */
      .dshUs-heatCard { --usage-chart-base:#2da44e;
        --color-usage-chart-1:color-mix(in srgb,var(--dsw-alias-border-l2) 55%,var(--dsw-alias-bg-layer-3));
        --color-usage-chart-2:color-mix(in srgb,var(--usage-chart-base) 16%,var(--dsw-alias-bg-layer-3));
        --color-usage-chart-3:color-mix(in srgb,var(--usage-chart-base) 34%,var(--dsw-alias-bg-layer-3));
        --color-usage-chart-4:color-mix(in srgb,var(--usage-chart-base) 55%,var(--dsw-alias-bg-layer-3));
        --color-usage-chart-5:color-mix(in srgb,var(--usage-chart-base) 78%,var(--dsw-alias-bg-layer-3));
        --color-usage-chart-6:var(--usage-chart-base); }
      .dshUs-heatLayout { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; }
      .dshUs-heatWeekdays { display:grid; grid-template-rows:repeat(7,12px); gap:3px; font-size:10px; color:var(--dsw-alias-label-tertiary); align-items:center; text-align:right; margin-right:2px; }
      .dshUs-heatMonths { display:grid; grid-template-columns:repeat(52,12px); gap:3px; height:14px; font-size:9px; color:var(--dsw-alias-label-tertiary); align-items:end; }
      .dshUs-heatGrid { display:grid; grid-template-columns:repeat(52,12px); grid-template-rows:repeat(7,12px); gap:3px; }
      .dshUs-heatCell { border-radius:2px; background:var(--color-usage-chart-1); }
      .dshUs-heatCell.l2 { background:var(--color-usage-chart-2); }
      .dshUs-heatCell.l3 { background:var(--color-usage-chart-3); }
      .dshUs-heatCell.l4 { background:var(--color-usage-chart-4); }
      .dshUs-heatCell.l5 { background:var(--color-usage-chart-5); }
      .dshUs-heatCell.l6 { background:var(--color-usage-chart-6); }
      .dshUs-heatCell.future { background:transparent; border:1px solid transparent; }
      /* 【改动④】今日格描边（outline 不占布局） */
      .dshUs-heatCell.today { outline:2px solid var(--dsw-alias-label-primary); outline-offset:1px; }
      .dshUs-heatLegend { display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:10px; color:var(--dsw-alias-label-tertiary); }
      .dshUs-heatLegend i { width:10px; height:10px; border-radius:2px; }
      /* KPI strip: label on top, value below, 1x5 grid with border separators */
      .dshUs-kpis { display:grid; grid-template-columns:repeat(5,1fr); background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:12px; }
      .dshUs-kpi { display:flex; flex-direction:column; align-items:center; gap:4px; padding:14px 8px; border-right:1px solid var(--dsw-alias-border-l2); text-align:center; min-width:0; }
      .dshUs-kpi:last-child { border-right:none; }
      .dshUs-kpiLabel { color:var(--dsw-alias-label-tertiary); font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      .dshUs-kpiValue { font-size:clamp(14px,2.2vw,22px); font-weight:700; color:var(--dsw-alias-label-primary); font-variant-numeric:tabular-nums; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace; letter-spacing:.2px; }
      /* 【改动⑤】KPI 响应式：≤760px 降为 2 列，第 3 格去掉左侧重分割线 */
      @media (max-width:760px){ .dshUs-kpis{grid-template-columns:repeat(2,1fr);} .dshUs-kpi:nth-child(3){border-right:none;} }
      .dshUs-emptyCard { border:1px dashed var(--dsw-alias-border-l2); border-radius:12px; padding:40px 16px; display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; }
      .dshUs-emptyTitle { color:var(--dsw-alias-label-tertiary); font-size:14px; font-weight:600; }
      .dshUs-emptyDesc { color:var(--dsw-alias-label-tertiary); font-size:13px; max-width:320px; }
      .dshUs-loading { color:var(--dsw-alias-label-tertiary); padding:24px 0; font-size:13px; }
      .dshUs-error { color:var(--dsw-alias-label-error); padding:12px 0; font-size:13px; }
      .dshUs-refresh { appearance:none; font:inherit; cursor:pointer; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:5px 14px; font-size:13px; align-self:flex-start; }
      .dshUs-refresh:hover { border-color:var(--dsw-alias-label-dimmed); }
      .dshUs-pieTable { width:100%; border-collapse:collapse; font-size:12px; }
      .dshUs-pieTable th { color:var(--dsw-alias-label-tertiary); font-weight:500; text-align:right; padding:4px 8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
      .dshUs-pieTable td { padding:4px 8px; border-bottom:1px solid var(--dsw-alias-border-l2); text-align:right; color:var(--dsw-alias-label-primary); }
      .dshUs-pieTable td:first-child { text-align:left; }
      .dshUs-pieLayout { display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
      .dshUs-pieChartWrap { flex:none; position:relative; }
      .dshUs-pieCenter { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:1; pointer-events:none; }
      .dshUs-pieCenterValue { font-size:20px; font-weight:800; color:var(--dsw-alias-label-primary); font-variant-numeric:tabular-nums; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace; }
      .dshUs-pieCenterLabel { font-size:11px; color:var(--dsw-alias-label-tertiary); }
      .dshUs-meta { color:var(--dsw-alias-label-tertiary); font-size:11px; font-weight:400; }
      /* 【改动④】热力图 tooltip 第二行（当日 Top2 模型） */
      .dshUs-tipSub { color:var(--dsw-alias-label-tertiary); font-size:11px; margin-top:2px; }
      .dshUs-pieLegend { flex:1; min-width:200px; }
      .dshUs-barGroup { display:flex; gap:2px; align-items:flex-end; }
      .dshUs-bar { border-radius:2px 2px 0 0; min-width:6px; }
      .dshUs-footer { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
      .dshUs-footerTime { color:var(--dsw-alias-label-tertiary); font-size:11px; }
    `;

    const styleId = 'dsh-usage-stats/styles';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + styleId + '"]') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-usage-stats';
      tag.dataset.pluginCss = styleId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    // ─── Colors ───────────────────────────────────────────────────────────
    const MODEL_COLORS = [
      '#4F8CFF', '#36B37E', '#FF8C00', '#FF5C5C', '#9B59B6', '#00BCD4',
      '#FFD700', '#FF69B4', '#7FFF00', '#FF6347', '#40E0D0', '#C0C0C0',
    ];
    function modelColor(index) { return MODEL_COLORS[index % MODEL_COLORS.length]; }

    // ─── Utilities ────────────────────────────────────────────────────────
    function fmtTok(n) {
      if (!n) return '0';
      if (n < 1000) return n.toLocaleString();
      if (n < 1e6) return (n / 1000).toFixed(1) + 'K';
      return (n / 1e6).toFixed(2) + 'M';
    }
    function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
    function shortDate(str) {
      if (!str) return '';
      const parts = str.split('-');
      if (parts.length >= 3) return parts[1] + '/' + parts[2];
      return str;
    }
    function isoDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // Heatmap tier by tokens: 0 → 1 (grey), <1K → 2, <5K → 3, <20K → 4, <100K → 5, ≥100K → 6 (deepest green).
    function heatTier(v) {
      if (v <= 0) return 1;
      if (v < 1000) return 2;
      if (v < 5000) return 3;
      if (v < 20000) return 4;
      if (v < 100000) return 5;
      return 6;
    }
    // Large numbers in Chinese units: ≥1e8 → "5.4亿", ≥1e4 → "1020万", else standard.
    function fmtZhCompact(n) {
      n = Number(n) || 0;
      const abs = Math.abs(n);
      if (abs >= 1e8) {
        const v = (n / 1e8).toFixed(1);
        return (v.endsWith('.0') ? v.slice(0, -2) : v) + '亿';
      }
      if (abs >= 1e4) return Math.round(n / 1e4) + '万';
      return n.toLocaleString('zh-CN');
    }
    // Duration in Chinese units: <1 min → "N 秒", <1 h → "N 分钟",
    // <1 d → "12 小时 21 分钟", else → "2 天"(+ "N 小时" when odd hours remain).
    function fmtZhDuration(ms) {
      const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
      if (s < 60) return s + ' 秒';
      const m = Math.floor(s / 60);
      if (m < 60) return m + ' 分钟';
      const h = Math.floor(m / 60);
      if (h < 24) return h + ' 小时 ' + (m % 60) + ' 分钟';
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return d + ' 天' + (rh > 0 ? ' ' + rh + ' 小时' : '');
    }

    async function fetchStats() {
      const res = await fetch('/api/usage-stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text() || 'Failed to fetch stats');
      return await res.json();
    }

    function totalTokens(m) { return (m.uncachedInputTokens || 0) + (m.outputTokens || 0) + (m.cacheReadTokens || 0) + (m.cacheWriteTokens || 0); }

    // ─── SVG Line Chart ───────────────────────────────────────────────────
    function LineChart({ series, labels, models, width, height, modelColors, formatLabel, tooltipSummary }) {
      const [hover, setHover] = react.useState(null);
      if (!labels || labels.length === 0) return null;
      const pad = { top: 8, right: 8, bottom: 24, left: 8 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      const fmtLabel = formatLabel || shortDate;

      // 【改动③】summary tooltip helpers：当日全部模型合计 / 按 tokens 降序取 Top-N
      const dayTotalOf = (pt, ms) => ms.reduce((s, m) => s + totalTokens(pt[m] || {}), 0);
      const topModelsOf = (pt, ms) => ms
        .map((m) => ({ model: m, tokens: totalTokens(pt[m] || {}) }))
        .filter((x) => x.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      // Compute max value across all models
      let maxVal = 0;
      for (const pt of series) {
        for (const m of models) {
          const v = totalTokens(pt[m] || {});
          if (v > maxVal) maxVal = v;
        }
      }
      if (maxVal === 0) maxVal = 1;

      const xScale = (i) => pad.left + (i / Math.max(labels.length - 1, 1)) * plotW;
      const yScale = (v) => pad.top + plotH - (v / maxVal) * plotH;

      // Build paths
      const paths = models.map((model, mi) => {
        const pts = series.map((pt, i) => {
          const v = totalTokens(pt[model] || {});
          return { x: xScale(i), y: yScale(v) };
        });
        // Smooth monotone path
        let d = '';
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) { d += 'M' + pts[i].x.toFixed(0) + ',' + pts[i].y.toFixed(0); continue; }
          const prev = pts[i - 1];
          const cpx1 = prev.x + (pts[i].x - prev.x) / 2;
          const cpy1 = prev.y;
          const cpx2 = prev.x + (pts[i].x - prev.x) / 2;
          const cpy2 = pts[i].y;
          d += 'C' + cpx1.toFixed(0) + ',' + cpy1.toFixed(0) + ' ' + cpx2.toFixed(0) + ',' + cpy2.toFixed(0) + ' ' + pts[i].x.toFixed(0) + ',' + pts[i].y.toFixed(0);
        }
        return { model: model, d: d, color: modelColors[mi] };
      });

      // X-axis labels (show every nth)
      const labelStep = Math.max(1, Math.floor(labels.length / 8));

      // Snap the cursor to the nearest data point and show its value.
      const onMove = (ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        if (px < pad.left || px > width - pad.right || py < pad.top || py > height - pad.bottom) {
          setHover(null);
          return;
        }
        const index = Math.round(((px - pad.left) / plotW) * Math.max(labels.length - 1, 1));
        setHover({ x: ev.clientX, y: ev.clientY, index: Math.max(0, Math.min(labels.length - 1, index)) });
      };

      return react_jsx_runtime.jsx('div', {
        className: 'dshUs-chartBody',
        onMouseMove: onMove,
        onMouseLeave: () => setHover(null),
        children: [
          react_jsx_runtime.jsx('svg', {
            width: width, height: height, viewBox: '0 0 ' + width + ' ' + height,
            children: [
              // Grid lines
              ...Array.from({ length: 5 }, (_, i) => {
                const y = pad.top + (plotH / 5) * i;
                return react_jsx_runtime.jsx('line', { x1: pad.left, y1: y, x2: width - pad.right, y2: y, stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 1 });
              }),
              // Paths
              ...paths.map((p, i) =>
                react_jsx_runtime.jsx('path', { d: p.d, fill: 'none', stroke: p.color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p.model)
              ),
              // 【改动②】hover 增强：X 位置垂直虚线 + 各模型 4px 圆点（模型色 + 白描边）
              hover !== null && react_jsx_runtime.jsx('line', {
                x1: xScale(hover.index), y1: pad.top, x2: xScale(hover.index), y2: pad.top + plotH,
                stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 1, strokeDasharray: '3 3',
              }),
              ...(hover !== null
                ? models.map((model, mi) => {
                    const v = totalTokens(series[hover.index][model] || {});
                    return react_jsx_runtime.jsx('circle', {
                      cx: xScale(hover.index), cy: yScale(v), r: 4,
                      fill: modelColors[mi], stroke: 'var(--dsw-alias-bg-layer-3)', strokeWidth: 2,
                    }, 'dot-' + model);
                  })
                : []),
              // X labels
              ...labels.map((l, i) =>
                i % labelStep === 0 || i === labels.length - 1
                  ? react_jsx_runtime.jsx('text', { x: xScale(i), y: height - 4, textAnchor: 'middle', fill: 'var(--dsw-alias-label-tertiary)', fontSize: 10, children: fmtLabel(l) })
                  : null
              ),
            ]
          }),
          hover !== null && react_jsx_runtime.jsxs('div', {
            className: 'dshUs-tip',
            style: { left: hover.x + 14, top: hover.y + 14 },
            children: [
              // 【改动③】summary 模式：首行 "日期 · 总tokens"；明细模式保持原样
              react_jsx_runtime.jsx('div', { className: 'dshUs-tipHeader', children: tooltipSummary
                ? fmtLabel(labels[hover.index]) + ' · ' + fmtTok(dayTotalOf(series[hover.index], models))
                : fmtLabel(labels[hover.index]) }),
              ...(!tooltipSummary ? models.map((model, mi) => {
                const v = totalTokens(series[hover.index][model] || {});
                return react_jsx_runtime.jsxs('div', { className: 'dshUs-tipRow', children: [
                  react_jsx_runtime.jsx('span', { className: 'dshUs-legendDot', style: { background: modelColors[mi] } }),
                  react_jsx_runtime.jsx('span', { children: model }),
                  react_jsx_runtime.jsx('span', { className: 'dshUs-tipVal', children: fmtTok(v) }),
                ]}, model);
              }) : []),
              // 【改动③】summary 模式：第二行灰色小字 Top2 模型（无数据则省略，与热力图 tooltip 一致）
              ...(tooltipSummary ? (() => {
                const t2 = topModelsOf(series[hover.index], models).slice(0, 2).map((x) => x.model + ' ' + fmtTok(x.tokens)).join(' · ');
                return t2.length > 0 ? [react_jsx_runtime.jsx('div', { className: 'dshUs-tipSub', children: t2 })] : [];
              })() : []),
            ]
          }),
        ]
      });
    }

    // ─── SVG Pie Chart ────────────────────────────────────────────────────
    function PieChart({ items, size, innerRadius }) {
      const [hover, setHover] = react.useState(null);
      if (!items || items.length === 0) return null;
      const total = items.reduce((s, i) => s + i.value, 0);
      if (total === 0) return null;
      const cx = size / 2, cy = size / 2;
      const r = size / 2 - 4;
      const ir = innerRadius || 0;

      let cumulative = 0;
      const arcs = items.map((item, idx) => {
        const angle = (item.value / total) * 360;
        const startAngle = cumulative;
        cumulative += angle;
        // 【改动②】支持调用方指定切片颜色（Other 用中性灰主题变量），缺省回落调色板取模
        return { ...item, startAngle, endAngle: cumulative, color: item.color || modelColor(idx) };
      });

      function polarToCartesian(cx, cy, rad, angleDeg) {
        const radian = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + rad * Math.cos(radian), y: cy + rad * Math.sin(radian) };
      }

      function describeArc(startAngle, endAngle, outerR, innerR) {
        const start = polarToCartesian(cx, cy, outerR, startAngle);
        const end = polarToCartesian(cx, cy, outerR, endAngle);
        const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
        const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)} L ${innerStart.x.toFixed(1)} ${innerStart.y.toFixed(1)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x.toFixed(1)} ${innerEnd.y.toFixed(1)} Z`;
      }

      // 【改动③】饼图 hover 增强：删除原生 <title>，改自绘 tooltip；非 hover 扇区淡化
      return react_jsx_runtime.jsx('div', {
        className: 'dshUs-chartBody',
        onMouseLeave: () => setHover(null),
        children: [
          react_jsx_runtime.jsx('svg', {
            width: size, height: size, viewBox: '0 0 ' + size + ' ' + size,
            children: arcs.map((arc, i) =>
              react_jsx_runtime.jsx('path', {
                d: describeArc(arc.startAngle, arc.endAngle, r, ir),
                fill: arc.color,
                stroke: 'var(--dsw-alias-bg-layer-3)',
                strokeWidth: 1,
                opacity: hover === null || hover.index === i ? 1 : 0.5,
                style: { transition: 'opacity .12s' },
                onMouseEnter: (ev) => setHover({ x: ev.clientX, y: ev.clientY, index: i }),
              }, i)
            )
          }),
          hover !== null && react_jsx_runtime.jsxs('div', {
            className: 'dshUs-tip',
            style: { left: hover.x + 12, top: hover.y + 12 },
            children: [
              react_jsx_runtime.jsxs('div', { className: 'dshUs-tipRow', children: [
                react_jsx_runtime.jsx('span', { className: 'dshUs-legendDot', style: { background: arcs[hover.index].color } }),
                react_jsx_runtime.jsx('span', { children: arcs[hover.index].label }),
                react_jsx_runtime.jsx('span', { className: 'dshUs-tipVal', children: fmtTok(arcs[hover.index].value) + ' · ' + fmtPct(arcs[hover.index].value / total) }),
              ]}),
            ]
          }),
        ]
      });
    }

    // ─── KPI Strip ────────────────────────────────────────────────────────
    function KpiStrip({ items }) {
      if (!items || items.length === 0) return null;
      return react_jsx_runtime.jsx('div', { className: 'dshUs-kpis', children: items.map((item) =>
        react_jsx_runtime.jsxs('div', { className: 'dshUs-kpi', children: [
          react_jsx_runtime.jsx('div', { className: 'dshUs-kpiLabel', children: item.label }),
          react_jsx_runtime.jsx('div', { className: 'dshUs-kpiValue', children: item.value }),
        ]}, item.label)
      )});
    }

    // ─── Heatmap Calendar (GitHub-style contribution graph) ───────────────
    function HeatmapCalendar({ series, models }) {
      const [hover, setHover] = react.useState(null);
      const WEEKS = 52, DAYS = 7;

      // Aggregate total tokens per date from dailyTrend.series — the
      // equivalent of "snapshot.dailyModelUsage[] grouped by date".
      // 【改动④】同时保留当日各模型明细，供 tooltip 第二行展示 Top2 模型
      const totals = new Map();
      let anyData = false;
      for (const point of series || []) {
        let total = 0;
        const list = [];
        for (const m of models || []) {
          const t = point[m] ? totalTokens(point[m]) : 0;
          total += t;
          if (t > 0) list.push({ model: m, tokens: t });
        }
        if (total > 0) anyData = true;
        list.sort((a, b) => b.tokens - a.tokens);
        totals.set(point.date, { total, list });
      }

      if (!anyData) {
        return react_jsx_runtime.jsx(EmptyState, {
          title: '\u6682\u65E0\u7528\u91CF\u6570\u636E',
          description: '\u5F00\u59CB\u4F7F\u7528\u540E\uFF0C\u6BCF\u65E5 Token \u7528\u91CF\u4F1A\u663E\u793A\u5728\u8FD9\u91CC',
        });
      }

      // Build the 52-week matrix ending at the current week (Monday first).
      const today = new Date();
      const todayKey = isoDate(today); // 【改动④】今日标记（isoDate(new Date())）
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // 0 = Monday
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - (WEEKS - 1) * DAYS);

      // Row-major cells: index = row * WEEKS + column, one column per week.
      const cells = new Array(WEEKS * DAYS);
      const monthCells = new Array(WEEKS).fill('');
      let prevMonth = -1;
      for (let c = 0; c < WEEKS; c++) {
        const colDate = new Date(start);
        colDate.setDate(start.getDate() + c * DAYS);
        const m = colDate.getMonth();
        if (m !== prevMonth) { monthCells[c] = (m + 1) + '\u6708'; prevMonth = m; }
        for (let r = 0; r < DAYS; r++) {
          const d = new Date(colDate);
          d.setDate(colDate.getDate() + r);
          const key = isoDate(d);
          const future = d > today;
          // Only stash real data; everything else renders as level 1 (grey).
          // Row-major grid fill: visual row r, column c → index r*WEEKS+c.
          const day = totals.get(key);
          cells[r * WEEKS + c] = {
            key,
            future,
            isToday: key === todayKey, // 【改动④】今日格标记
            tier: future ? 0 : heatTier(day ? day.total : 0),
            tokens: day ? day.total : 0,
            list: day ? day.list : [],
          };
        }
      }

      // 【改动④】左侧星期标注改中文（月份标签保持 "X月" 不动）
      const weekdays = ['\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u65E5'];

      return react_jsx_runtime.jsxs('div', { className: 'dshUs-card dshUs-heatCard', children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children: '\u6BCF\u65E5 Token \u70ED\u529B\u56FE' }),
        react_jsx_runtime.jsx('div', {
          className: 'dshUs-heatLayout',
          onMouseLeave: () => setHover(null),
          children: [
            react_jsx_runtime.jsx('div', { className: 'dshUs-heatWeekdays', children: weekdays.map((w) =>
              react_jsx_runtime.jsx('span', { children: w }, w)
            )}),
            react_jsx_runtime.jsxs('div', { children: [
              react_jsx_runtime.jsx('div', { className: 'dshUs-heatMonths', children: monthCells.map((label, c) =>
                react_jsx_runtime.jsx('span', { children: label }, c)
              )}),
              react_jsx_runtime.jsx('div', { className: 'dshUs-heatGrid', children: cells.map((cell, i) =>
                react_jsx_runtime.jsx('span', {
                  className: 'dshUs-heatCell' + (cell.tier > 1 ? ' l' + cell.tier : '') + (cell.future ? ' future' : '') + (cell.isToday ? ' today' : ''),
                  onMouseEnter: cell.future ? undefined : (ev) => {
                    // 【改动④】两行 tooltip：第一行 "日期 · tokens"，第二行当日 Top2 模型（无则省略）
                    const sub = cell.list.slice(0, 2).map((x) => x.model + ' ' + fmtTok(x.tokens)).join(' · ');
                    setHover({ x: ev.clientX, y: ev.clientY, header: cell.key + ': ' + cell.tokens.toLocaleString('en-US') + ' tokens', sub });
                  },
                }, i)
              )}),
            ]}),
          ]
        }),
        react_jsx_runtime.jsxs('div', { className: 'dshUs-heatLegend', children: [
          '\u5C11',
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l2' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l3' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l4' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l5' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l6' }),
          '\u591A',
        ]}),
        hover !== null && react_jsx_runtime.jsxs('div', {
          className: 'dshUs-tip',
          style: { left: hover.x + 12, top: hover.y + 12 },
          children: [
            react_jsx_runtime.jsx('div', { children: hover.header }),
            hover.sub.length > 0 && react_jsx_runtime.jsx('div', { className: 'dshUs-tipSub', children: hover.sub }),
          ]
        }),
      ]});
    }

    // ─── Empty State ──────────────────────────────────────────────────────
    function EmptyState({ title, description }) {
      return react_jsx_runtime.jsxs('div', { className: 'dshUs-emptyCard', children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-emptyTitle', children: title }),
        react_jsx_runtime.jsx('div', { className: 'dshUs-emptyDesc', children: description }),
      ]});
    }

    // ─── Coding Plan Quota Card (Z.ai only) ───────────────────────────────
    function PlansCard() {
      const [state, setState] = react.useState({ loading: true, available: false, plans: [], reason: null });

      const load = react.useCallback(async () => {
        setState({ loading: true, available: false, plans: [], reason: null });
        try {
          const res = await fetch('/api/usage-stats/plan', { cache: 'no-store' });
          const data = await res.json();
          setState({
            loading: false,
            available: !!data.available,
            plans: Array.isArray(data.plans) ? data.plans : [],
            reason: typeof data.reason === 'string' ? data.reason : null,
          });
        } catch {
          setState({ loading: false, available: false, plans: [], reason: 'error' });
        }
      }, []);

      react.useEffect(() => { load(); }, [load]);

      const planRows = (state.plans || []).map((p, i) =>
        react_jsx_runtime.jsxs('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }, children: [
          react_jsx_runtime.jsx('span', { children: p.name }),
          p.percent !== null && p.percent !== undefined && react_jsx_runtime.jsx('span', { className: 'dshUs-kpiValue', style: { fontSize: 16 }, children: p.percent + '%' }),
          p.resetsAt !== '' && p.resetsAt !== undefined && react_jsx_runtime.jsx('span', { className: 'dshUs-meta', children: '\u00B7 \u91CD\u7F6E ' + new Date(p.resetsAt).toLocaleString() }),
        ]}, 'plan-' + i)
      );

      let body;
      if (state.loading) {
        body = react_jsx_runtime.jsx('div', { className: 'dshUs-loading', children: '\u52A0\u8F7D\u989D\u5EA6\u2026' });
      } else if (!state.available) {
        body = react_jsx_runtime.jsx('div', { className: 'dshUs-meta', children: state.reason === 'no_credential'
          ? '\u672A\u914D\u7F6E ZAI_API_KEY\uFF0C\u989D\u5EA6\u6570\u636E\u4E0D\u4F1A\u663E\u793A'
          : '\u989D\u5EA6\u6570\u636E\u6682\u4E0D\u53EF\u7528' });
      } else if (planRows.length === 0) {
        body = react_jsx_runtime.jsx('div', { className: 'dshUs-meta', children: '\u6682\u65E0\u989D\u5EA6\u6570\u636E' });
      } else {
        body = react_jsx_runtime.jsx('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: planRows });
      }

      return react_jsx_runtime.jsxs('div', { className: 'dshUs-card', children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children: '\u989D\u5EA6' }),
        body,
      ]});
    }

    // ─── Main View ────────────────────────────────────────────────────────
    function UsageStatsView() {
      const [data, setData] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState(null);

      const load = react.useCallback(async () => {
        setLoading(true); setError(null);
        try { setData(await fetchStats()); }
        catch (err) { setError(err.message || 'Failed to load stats'); }
        finally { setLoading(false); }
      }, []);

      react.useEffect(() => { load(); }, [load]);

      if (loading) return react_jsx_runtime.jsx('div', { className: 'dshUs-loading', children: '\u52A0\u8F7D\u7528\u91CF\u7EDF\u8BA1\u2026' });
      if (error) return react_jsx_runtime.jsxs('div', { children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-error', children: error }),
        react_jsx_runtime.jsx('button', { className: 'dshUs-refresh', onClick: load, children: 'Retry' }),
      ]});
      if (!data) return null;

      const { summary, modelUsage, dailyTrend, sessions, collectedAt } = data;
      const hasData = sessions && sessions.length > 0;

      // 【改动①】KPI 五指标：累计 / 峰值 / 最长聊天时长 / 当前连续 / 最长连续（全部由前端计算）
      const DAY_MS = 86400000;
      const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS); // b 比 a 晚 1 天 ⇒ 1
      // dailyTrend.series 按天合计，只保留总量>0 的日子，按日期升序
      const dailyTotals = (dailyTrend.series || [])
        .map((point) => ({
          date: point.date,
          total: (dailyTrend.models || []).reduce((s, m) => s + totalTokens(point[m] || {}), 0),
        }))
        .filter((d) => d.total > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      const peakToken = dailyTotals.reduce((m, d) => Math.max(m, d.total), 0);                       // 峰值单日 Token
      const longestChatMs = (sessions || []).reduce((m, s) => Math.max(m, s.stats?.llmMs || 0), 0); // 最长聊天时长
      // 当前连续天数：从最近有数据的一天开始往前连续计数
      // 连续天数从最近有活动的日期向前计数（今天尚未结束不计入连续）
      let currentStreak = 0;
      for (let i = dailyTotals.length - 1; i >= 0; i--) {
        currentStreak++;
        const prev = dailyTotals[i - 1];
        if (!prev || dayDiff(prev.date, dailyTotals[i].date) !== 1) break;
      }
      // 最长连续天数：整段日期序列中最长的连续（相邻相隔 1 天）段
      let longestStreak = 0, run = 0;
      for (let i = 0; i < dailyTotals.length; i++) {
        run = (i > 0 && dayDiff(dailyTotals[i - 1].date, dailyTotals[i].date) === 1) ? run + 1 : 1;
        longestStreak = Math.max(longestStreak, run);
      }
      const KPI = [
        { label: '\u7D2F\u8BA1 Token \u6570', value: fmtZhCompact(summary.totalTokens) },       // 累计 Token 数
        { label: '\u5CF0\u503C Token \u6570', value: fmtZhCompact(peakToken) },                 // 峰值 Token 数
        { label: '\u6700\u957F\u804A\u5929\u65F6\u957F', value: fmtZhDuration(longestChatMs) }, // 最长聊天时长
        { label: '\u5F53\u524D\u8FDE\u7EED\u5929\u6570', value: currentStreak + ' \u5929' },    // 当前连续天数
        { label: '\u6700\u957F\u8FDE\u7EED\u5929\u6570', value: longestStreak + ' \u5929' },    // 最长连续天数
      ];

      // 【改动②】饼图 Top5 + Other：按 totalTokens 降序取前 5，其余合并为 Other（中性灰主题变量）
      const orderedUsage = [...(modelUsage || [])].sort((a, b) => totalTokens(b) - totalTokens(a));
      const PIE_TOP = 5;
      const pieItems = orderedUsage.slice(0, PIE_TOP).map((m, i) => ({ label: m.model, value: totalTokens(m), color: modelColor(i) }));
      const otherTotal = orderedUsage.slice(PIE_TOP).reduce((s, m) => s + totalTokens(m), 0);
      if (otherTotal > 0) pieItems.push({ label: 'Other', value: otherTotal, color: 'var(--dsw-alias-border-l2)' });
      const pieTotal = pieItems.reduce((s, it) => s + it.value, 0); // Top5+Other 覆盖全部模型 ⇒ 等于 summary.totalTokens

      // 【改动③】每日趋势 Top 6 模型：按总 Token 降序取前 6，图例与折线同步截断
      const top6Models = (dailyTrend.models || [])
        .map((m) => ({ model: m, total: (dailyTrend.series || []).reduce((s, p) => s + totalTokens(p[m] || {}), 0) }))
        .filter((x) => x.total > 0) // 【改动】先剔除全零模型，避免占用 Top 6 名额
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
        .map((x) => x.model);

      return react_jsx_runtime.jsxs('div', { className: 'dshUs-body', children: [
        hasData ? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, { children: [
          // KPI strip (label on top, value below) — 【改动①】新五指标
          react_jsx_runtime.jsx(KpiStrip, { items: KPI }),
          // Daily Token Heatmap Calendar (GitHub-style contribution graph)
          react_jsx_runtime.jsx(HeatmapCalendar, {
            series: dailyTrend.series || [],
            models: dailyTrend.models || [],
          }),
          // Daily Model Token Trend
          react_jsx_runtime.jsxs('div', { className: 'dshUs-card', children: [
            // 【改动③】meta 标注 Top 6 模型
            react_jsx_runtime.jsxs('div', { className: 'dshUs-cardTitle', children: [
              '\u6BCF\u65E5\u6A21\u578B\u7528\u91CF\u8D8B\u52BF',
              react_jsx_runtime.jsx('span', { className: 'dshUs-meta', style: { marginLeft: 8 }, children: 'Top 6 \u6A21\u578B · \u56FE\u4F8B\u5728\u56FE\u8868\u4E0A\u65B9 · Y \u8F74\u9690\u85CF' }),
            ]}),
            // Legend（与折线同步截断为 Top 6）
            top6Models.length > 0 && react_jsx_runtime.jsx('div', { className: 'dshUs-legend', children: top6Models.map((m, i) =>
              react_jsx_runtime.jsxs('span', { className: 'dshUs-legendItem', children: [
                react_jsx_runtime.jsx('span', { className: 'dshUs-legendDot', style: { background: modelColor(i) } }),
                m,
              ]}, m)
            )}),
            react_jsx_runtime.jsx('div', { className: 'dshUs-chartWrap', children:
              react_jsx_runtime.jsx(LineChart, {
                series: dailyTrend.series || [],
                labels: dailyTrend.labels || [],
                models: top6Models,
                width: Math.max(600, (dailyTrend.labels?.length || 1) * 60), height: 240,
                modelColors: top6Models.map((_, i) => modelColor(i)),
                tooltipSummary: true, // 【改动③】概念稿双行 tooltip：首行 日期·总tokens，第二行 Top2 灰色小字
              })
            }),
          ]}),

          // Model Usage Distribution
          react_jsx_runtime.jsxs('div', { className: 'dshUs-card', children: [
            react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children: '\u6A21\u578B\u7528\u91CF\u5206\u5E03' }),
            react_jsx_runtime.jsxs('div', { className: 'dshUs-pieLayout', children: [
              // 【改动②】饼图 Top5 + Other；容器相对定位用于中心悬浮总数（指针事件穿透）
              react_jsx_runtime.jsxs('div', { className: 'dshUs-pieChartWrap', children: [
                react_jsx_runtime.jsx(PieChart, {
                  items: pieItems,
                  size: 180, innerRadius: 50,
                }),
                react_jsx_runtime.jsxs('div', { className: 'dshUs-pieCenter', children: [
                  react_jsx_runtime.jsx('div', { className: 'dshUs-pieCenterValue', children: fmtTok(pieTotal) }),
                  react_jsx_runtime.jsx('div', { className: 'dshUs-pieCenterLabel', children: 'tokens' }),
                ]}),
              ]}),
              react_jsx_runtime.jsx('div', { className: 'dshUs-pieLegend', children:
                react_jsx_runtime.jsxs('table', { className: 'dshUs-pieTable', children: [
                  react_jsx_runtime.jsx('thead', { children: react_jsx_runtime.jsxs('tr', { children: [
                    react_jsx_runtime.jsx('th', { style: { textAlign: 'left' }, children: '\u6A21\u578B' }),
                    react_jsx_runtime.jsx('th', { children: '%' }),
                    react_jsx_runtime.jsx('th', { children: 'tokens' }),
                  ]})}),
                  react_jsx_runtime.jsx('tbody', { children: pieItems.map((it) => {
                    return react_jsx_runtime.jsxs('tr', { children: [
                      react_jsx_runtime.jsxs('td', { children: [
                        react_jsx_runtime.jsx('span', { className: 'dshUs-legendDot', style: { display: 'inline-block', marginRight: 6, background: it.color } }),
                        it.label,
                      ]}),
                      react_jsx_runtime.jsx('td', { children: fmtPct(pieTotal > 0 ? it.value / pieTotal : 0) }),
                      react_jsx_runtime.jsx('td', { children: fmtTok(it.value) }),
                    ]}, it.label);
                  })}),
                ]})
              }),
            ]}),
          ]}),
          react_jsx_runtime.jsx(PlansCard, {}),
        ]}) : react_jsx_runtime.jsx(EmptyState, {
          title: '\u6682\u65E0\u7528\u91CF\u6570\u636E',
          // 【改动⑤】用量页空态描述对齐概念稿
          description: '\u5F00\u59CB\u4F7F\u7528\u540E\uFF0C\u6BCF\u65E5 Token \u7528\u91CF\u4F1A\u663E\u793A\u5728\u8FD9\u91CC',
        }),

        // Footer
        react_jsx_runtime.jsxs('div', { className: 'dshUs-footer', children: [
          react_jsx_runtime.jsx('span', { className: 'dshUs-footerTime', children: '\u6700\u540E\u66F4\u65B0: ' + new Date(collectedAt).toLocaleTimeString() }),
          react_jsx_runtime.jsx('button', { className: 'dshUs-refresh', onClick: load, children: '\u5237\u65B0' }),
        ]}),
      ]});
    }

    // ─── Plugin Registration ──────────────────────────────────────────────
    const inject = ['slots', 'locale'];
    const NS = 'usage-stats';

    const en = {
      nav: 'Usage Stats',
      title: 'Usage Statistics',
      intro: 'Track usage statistics across all sessions.',
      empty: 'No usage data available yet.',
    };
    const zh = {
      nav: '\u7528\u91CF\u7EDF\u8BA1',
      title: '\u7528\u91CF\u7EDF\u8BA1',
      intro: '\u8DE8\u6240\u6709\u4F1A\u8BDD\u8DDF\u8E2A\u7528\u91CF\u7EDF\u8BA1\u3002',
      empty: '\u6682\u65E0\u7528\u91CF\u6570\u636E\u3002',
    };

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage-stats: dictionaries');
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'usage-stats',
        order: 5,
        label: () => t('nav'),
        locale: NS,
        inject: () => ({}),
      }, UsageStatsView));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});