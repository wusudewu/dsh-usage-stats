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
      /* 趋势图头部：范围切换按钮 + 标题 */
      .dshUs-trendHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .dshUs-range { display:flex; gap:4px; }
      .dshUs-rangeBtn { appearance:none; font:inherit; cursor:pointer; color:var(--dsw-alias-label-secondary); background:transparent; border:1px solid var(--dsw-alias-border-l2); border-radius:6px; padding:2px 10px; font-size:12px; }
      .dshUs-rangeBtn:hover { border-color:var(--dsw-alias-label-dimmed); }
      .dshUs-rangeBtn.active { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-1); border-color:var(--dsw-alias-label-dimmed); font-weight:600; }
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

    async function fetchStats(etag) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const headers = etag ? { 'if-none-match': etag } : undefined;
        const res = await fetch('/api/usage-stats', { cache: 'no-store', signal: controller.signal, headers });
        if (res.status === 304) return { notModified: true, etag: etag || null };
        if (!res.ok) throw new Error(await res.text() || 'Failed to fetch stats');
        const json = await res.json();
        const nextEtag = typeof res.headers.get === 'function' ? res.headers.get('etag') : null;
        return { data: json, etag: nextEtag || etag || null };
      } finally {
        clearTimeout(timer);
      }
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
                // 【修复】CSS var() 在 SVG presentation attribute 中不生效
                // （整条属性按无效值回退），主题变量必须走 inline style。
                return react_jsx_runtime.jsx('line', { x1: pad.left, y1: y, x2: width - pad.right, y2: y, strokeWidth: 1, style: { stroke: 'var(--dsw-alias-border-l2)' } });
              }),
              // Paths
              ...paths.map((p, i) =>
                react_jsx_runtime.jsx('path', { d: p.d, fill: 'none', stroke: p.color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p.model)
              ),
              // 【改动②】hover 增强：X 位置垂直虚线 + 各模型 4px 圆点（模型色 + 白描边）
              hover !== null && react_jsx_runtime.jsx('line', {
                x1: xScale(hover.index), y1: pad.top, x2: xScale(hover.index), y2: pad.top + plotH,
                strokeWidth: 1, strokeDasharray: '3 3', style: { stroke: 'var(--dsw-alias-border-l2)' },
              }),
              ...(hover !== null
                ? models.map((model, mi) => {
                    const v = totalTokens(series[hover.index][model] || {});
                    return react_jsx_runtime.jsx('circle', {
                      cx: xScale(hover.index), cy: yScale(v), r: 4,
                      fill: modelColors[mi], strokeWidth: 2, style: { stroke: 'var(--dsw-alias-bg-layer-3)' },
                    }, 'dot-' + model);
                  })
                : []),
              // X labels
              ...labels.map((l, i) =>
                i % labelStep === 0 || i === labels.length - 1
                  ? react_jsx_runtime.jsx('text', { x: xScale(i), y: height - 4, textAnchor: 'middle', fontSize: 10, style: { fill: 'var(--dsw-alias-label-tertiary)' }, children: fmtLabel(l) })
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
        // 【修复③】整圆切片（单模型饼图）的起终点重合，普通 A 弧会退化成
        // 零长度路径（饼图消失、无 hover）。改画两段半圆弧闭合整圈。
        if (endAngle - startAngle >= 359.999) {
          const mid = startAngle + 180;
          const os = polarToCartesian(cx, cy, outerR, startAngle);
          const om = polarToCartesian(cx, cy, outerR, mid);
          let d = 'M ' + os.x.toFixed(1) + ' ' + os.y.toFixed(1) +
            ' A ' + outerR + ' ' + outerR + ' 0 1 1 ' + om.x.toFixed(1) + ' ' + om.y.toFixed(1) +
            ' A ' + outerR + ' ' + outerR + ' 0 1 1 ' + os.x.toFixed(1) + ' ' + os.y.toFixed(1);
          if (innerR > 0) {
            const is = polarToCartesian(cx, cy, innerR, startAngle);
            const im = polarToCartesian(cx, cy, innerR, mid);
            d += ' L ' + is.x.toFixed(1) + ' ' + is.y.toFixed(1) +
              ' A ' + innerR + ' ' + innerR + ' 0 1 0 ' + im.x.toFixed(1) + ' ' + im.y.toFixed(1) +
              ' A ' + innerR + ' ' + innerR + ' 0 1 0 ' + is.x.toFixed(1) + ' ' + is.y.toFixed(1);
          }
          return d + ' Z';
        }
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
                // 【修复】fill/stroke 一律走 inline style：var() 在 SVG
                // presentation attribute 中不生效（整条属性按无效值回退，
                // 原 Other 切片的 var 因此渲染成纯黑）。
                strokeWidth: 1,
                opacity: hover === null || hover.index === i ? 1 : 0.5,
                style: { fill: arc.color, stroke: 'var(--dsw-alias-bg-layer-3)', transition: 'opacity .12s' },
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
          title: '暂无用量数据',
          description: '开始使用后，每日 Token 用量会显示在这里',
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
        if (m !== prevMonth) { monthCells[c] = (m + 1) + '月'; prevMonth = m; }
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
      const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

      return react_jsx_runtime.jsxs('div', { className: 'dshUs-card dshUs-heatCard', children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children: '每日 Token 热力图' }),
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
          '少',
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l2' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l3' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l4' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l5' }),
          react_jsx_runtime.jsx('i', { className: 'dshUs-heatCell l6' }),
          '多',
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

    // ─── Main View ────────────────────────────────────────────────────────
    function UsageStatsView() {
      const [data, setData] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState(null);
      const [range, setRange] = react.useState('7d'); // 折线图时间范围: 24h / 7d / 14d / 30d
      const etagRef = react.useRef(null); // 【修复②】If-None-Match → 304 空响应

      const load = react.useCallback(async () => {
        setLoading(true); setError(null);
        try {
          const result = await fetchStats(etagRef.current);
          if (result.notModified) return; // 数据未变：保留现有渲染，不发大 payload
          etagRef.current = result.etag;
          setData(result.data);
        }
        catch (err) { setError(err.message || 'Failed to load stats'); }
        finally { setLoading(false); }
      }, []);

      // 初始加载 + 每 5 分钟自动刷新
      react.useEffect(() => {
        load();
        const timer = setInterval(load, 5 * 60 * 1000);
        return () => clearInterval(timer);
      }, [load]);

      if (loading) return react_jsx_runtime.jsx('div', { className: 'dshUs-loading', children: '加载用量统计…' });
      if (error) return react_jsx_runtime.jsxs('div', { children: [
        react_jsx_runtime.jsx('div', { className: 'dshUs-error', children: error }),
        react_jsx_runtime.jsx('button', { className: 'dshUs-refresh', onClick: load, children: 'Retry' }),
      ]});
      if (!data) return null;

      const { summary, modelUsage, dailyTrend, rollingDailyTrend, sessions, collectedAt } = data;
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
      const longestChatMs = summary.maxSessionLlmMs || 0; // 最长聊天时长（v0.1.3: 服务端聚合值，bulk 不再下发每会话完整 stats）
      // 当前连续天数：从最近有数据的一天开始往前连续计数
      // 只有最后活跃日是今天或昨天时才计入连续；否则中断
      let currentStreak = 0;
      const todayStr = isoDate(new Date());
      if (dailyTotals.length > 0) {
        const lastDate = dailyTotals[dailyTotals.length - 1].date;
        const gap = dayDiff(lastDate, todayStr); // 0=今天, 1=昨天
        if (gap === 0 || gap === 1) {
          for (let i = dailyTotals.length - 1; i >= 0; i--) {
            currentStreak++;
            const prev = dailyTotals[i - 1];
            if (!prev || dayDiff(prev.date, dailyTotals[i].date) !== 1) break;
          }
        }
      }
      // 最长连续天数：整段日期序列中最长的连续（相邻相隔 1 天）段
      let longestStreak = 0, run = 0;
      for (let i = 0; i < dailyTotals.length; i++) {
        run = (i > 0 && dayDiff(dailyTotals[i - 1].date, dailyTotals[i].date) === 1) ? run + 1 : 1;
        longestStreak = Math.max(longestStreak, run);
      }
      const KPI = [
        { label: '累计 Token 数', value: fmtZhCompact(summary.totalTokens) },       // 累计 Token 数
        { label: '峰值 Token 数', value: fmtZhCompact(peakToken) },                 // 峰值 Token 数
        { label: '最长聊天时长', value: fmtZhDuration(longestChatMs) }, // 最长聊天时长
        { label: '当前连续天数', value: currentStreak + ' 天' },    // 当前连续天数
        { label: '最长连续天数', value: longestStreak + ' 天' },    // 最长连续天数
      ];

      // 【改动②】饼图 Top5 + Other：按 totalTokens 降序取前 5，其余合并为 Other（中性灰主题变量）
      const orderedUsage = [...(modelUsage || [])].sort((a, b) => totalTokens(b) - totalTokens(a));
      const PIE_TOP = 5;
      const pieItems = orderedUsage.slice(0, PIE_TOP).map((m, i) => ({ label: m.model, value: totalTokens(m), color: modelColor(i) }));
      const otherTotal = orderedUsage.slice(PIE_TOP).reduce((s, m) => s + totalTokens(m), 0);
      if (otherTotal > 0) pieItems.push({ label: 'Other', value: otherTotal, color: 'var(--dsw-alias-border-l2)' });
      const pieTotal = pieItems.reduce((s, it) => s + it.value, 0); // Top5+Other 覆盖全部模型 ⇒ 等于 summary.totalTokens

      // 折线图时间范围过滤：24h=24 点, 7d=168 点, 14d=336 点, 30d=720 点（每小时 1 点）
      const RANGE_POINTS = { '24h': 24, '7d': 168, '14d': 336, '30d': 720 };
      const rangePoints = RANGE_POINTS[range] || 168;
      const trendSeries = (rollingDailyTrend.series || []).slice(-rangePoints);
      const trendLabels = (rollingDailyTrend.labels || []).slice(-rangePoints);

      // 【改动③】趋势 Top 6 模型：按所选范围内总 Token 降序取前 6
      const top6Models = (rollingDailyTrend.models || [])
        .map((m) => ({ model: m, total: trendSeries.reduce((s, p) => s + totalTokens(p[m] || {}), 0) }))
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
          // 滚动 24h 模型用量趋势
          react_jsx_runtime.jsxs('div', { className: 'dshUs-card', children: [
            react_jsx_runtime.jsxs('div', { className: 'dshUs-trendHeader', children: [
              // 时间范围切换按钮
              react_jsx_runtime.jsxs('div', { className: 'dshUs-range', children: [
                ['24h', '7d', '14d', '30d'].map((r) =>
                  react_jsx_runtime.jsx('button', {
                    className: 'dshUs-rangeBtn' + (range === r ? ' active' : ''),
                    onClick: () => setRange(r),
                    children: r,
                  }, r)
                ),
              ]}),
              react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children:
                react_jsx_runtime.jsxs('span', { children: [
                  '滚动 24h 模型用量趋势',
                  react_jsx_runtime.jsx('span', { className: 'dshUs-meta', style: { marginLeft: 8 }, children: 'Top 6 模型 · 图例在图表上方 · Y 轴隐藏' }),
                ]})
              }),
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
                series: trendSeries,
                labels: trendLabels,
                models: top6Models,
                width: Math.max(600, trendLabels.length * 60), height: 240,
                modelColors: top6Models.map((_, i) => modelColor(i)),
                tooltipSummary: true, // 双行 tooltip：首行 日期·总tokens，第二行 Top2 灰色小字
              })
            }),
          ]}),

          // Model Usage Distribution
          react_jsx_runtime.jsxs('div', { className: 'dshUs-card', children: [
            react_jsx_runtime.jsx('div', { className: 'dshUs-cardTitle', children: '模型用量分布' }),
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
                    react_jsx_runtime.jsx('th', { style: { textAlign: 'left' }, children: '模型' }),
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
        ]}) : react_jsx_runtime.jsx(EmptyState, {
          title: '暂无用量数据',
          // 【改动⑤】用量页空态描述对齐概念稿
          description: '开始使用后，每日 Token 用量会显示在这里',
        }),

        // Footer
        react_jsx_runtime.jsxs('div', { className: 'dshUs-footer', children: [
          react_jsx_runtime.jsx('span', { className: 'dshUs-footerTime', children: '最后更新: ' + new Date(collectedAt).toLocaleTimeString() + ' · 每 5 分钟自动刷新' }),
          react_jsx_runtime.jsx('button', { className: 'dshUs-refresh', onClick: load, children: '刷新' }),
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
      nav: '用量统计',
      title: '用量统计',
      intro: '跨所有会话跟踪用量统计。',
      empty: '暂无用量数据。',
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