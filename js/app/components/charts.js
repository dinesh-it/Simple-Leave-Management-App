// Chart.js bar charts shared by the Personal and Team views, coloured per leave type
import * as leave from '../leave.js';
import { show, fmt } from './ui.js';

function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function typeColor(t) {
    return cssVar('--type-' + (t == '-' ? 'other' : t)) || cssVar('--type-other');
}

// Leave types in the order of the config's typeFilter
export function typeOrder(config, types) {
    const order = config.typeFilter || [];
    return types.sort((a, b) => {
        const x = order.indexOf(a);
        const y = order.indexOf(b);
        return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    });
}

// Black or white text, whichever reads better on the bar colour (#rrggbb)
function textOn(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) {
        return '#fff';
    }
    const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111' : '#fff';
}

// Draws every segment's value: inside the segment when it fits, otherwise in a smaller font with a
// halo so it stays readable over the neighbouring colours (labels of one bar are moved apart so they do
// not overlap). A single bar too small for its number gets it just past its end. Stacks with more than one
// segment also get their total at the end. With the 'totals' mode (charts with many bars) only the total of
// each bar is drawn, the split is in the tooltip. The drawn labels are kept on chart.$valueLabels (browser checks).
const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const horizontal = chart.options.indexAxis == 'y';
        const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
        const big = '600 11px ' + family;
        const small = '600 10px ' + family;
        const body = cssVar('--bs-body-color');
        const halo = cssVar('--bs-body-bg');
        const drawn = [];
        const stacks = {};
        const totalsOnly = (chart.options.plugins.valueLabels || {}).mode == 'totals';

        chart.data.datasets.forEach((ds, i) => {
            if (!chart.isDatasetVisible(i)) {
                return;
            }
            chart.getDatasetMeta(i).data.forEach((bar, j) => {
                const value = ds.data[j];
                if (!value) {
                    return;
                }
                const p = bar.getProps(['x', 'y', 'base', 'width', 'height'], true);
                const end = horizontal ? Math.max(p.x, p.base) : Math.min(p.y, p.base);
                const st = stacks[j] || (stacks[j] = { sum: 0, segs: [], end, cross: horizontal ? p.y : p.x });
                st.sum += value;
                st.end = horizontal ? Math.max(st.end, end) : Math.min(st.end, end);
                st.segs.push({ value, p, color: ds.backgroundColor });
            });
        });

        const put = (text, x, y, font, color, withHalo) => {
            ctx.font = font;
            if (withHalo) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = halo;
                ctx.strokeText(text, x, y);
            }
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
        };

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        Object.values(stacks).forEach((st) => {
            let last = null; // position of the previous label in this bar (to keep labels apart)
            let single = false;
            (totalsOnly ? [] : st.segs).forEach((seg) => {
                const { p } = seg;
                const text = fmt(seg.value);
                const length = horizontal ? Math.abs(p.x - p.base) : Math.abs(p.base - p.y);
                const thickness = horizontal ? p.height : p.width;
                ctx.font = big;
                const textWidth = ctx.measureText(text).width;
                const fits = horizontal ? (length >= textWidth + 4 && thickness >= 13) : (thickness >= textWidth + 4 && length >= 13);
                let x = horizontal ? (p.x + p.base) / 2 : p.x;
                let y = horizontal ? p.y : (p.y + p.base) / 2;

                if (!fits && st.segs.length == 1) {
                    // Only segment of the bar: its number goes just past the end, like a total
                    single = true;
                    return;
                }
                // Keep the labels of one bar at least a line apart
                if (!horizontal && last !== null && y > last - 11) {
                    y = last - 11;
                }
                if (horizontal && last !== null && x < last + textWidth + 4) {
                    x = last + textWidth + 4;
                }
                if (fits && (horizontal ? true : Math.abs(y - (p.y + p.base) / 2) < 1)) {
                    put(text, x, y, big, textOn(seg.color), false);
                } else {
                    put(text, x, y, small, body, true);
                }
                last = horizontal ? x : y;
                drawn.push({ text, x, y, total: false, inside: fits });
            });

            if (totalsOnly || st.segs.length > 1 || single) {
                const text = fmt(st.sum);
                ctx.font = big;
                const textWidth = ctx.measureText(text).width;
                let x = horizontal ? st.end + 4 + textWidth / 2 : st.cross;
                let y = horizontal ? st.cross : st.end - 8;
                if (!horizontal && last !== null && y > last - 12) {
                    y = last - 12;
                }
                // Many narrow bars: a total wider than its slot is written upwards, so totals never touch
                const slot = horizontal ? 0 : chart.chartArea.width / Math.max(chart.data.labels.length, 1);
                const upright = !horizontal && textWidth + 3 > slot;
                if (upright) {
                    ctx.save();
                    ctx.translate(x, st.end - 3);
                    ctx.rotate(-Math.PI / 2);
                    ctx.textAlign = 'left';
                    put(text, 0, 0, big, body, true);
                    ctx.restore();
                } else {
                    put(text, x, y, big, body, true);
                }
                drawn.push({ text, x, y, total: totalsOnly || st.segs.length > 1, outside: true, upright });
            }
        });
        ctx.restore();
        chart.$valueLabels = drawn;
    }
};

function chartOptions(horizontal, labels) {
    const text = cssVar('--bs-body-color');
    const grid = cssVar('--bs-border-color-translucent');
    const axis = { stacked: true, ticks: { color: text }, grid: { color: grid } };
    // Every month / person name is shown (no skipping), names are slanted when there are many
    const categoryTicks = { ticks: { color: text, autoSkip: false, maxRotation: 60 } };
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // Room for the stack totals
        layout: { padding: horizontal ? { right: 28 } : { top: labels == 'totals' ? 32 : 24 } },
        indexAxis: horizontal ? 'y' : 'x',
        // Few people or months must not give very wide bars
        datasets: { bar: { maxBarThickness: 64 } },
        plugins: {
            legend: { position: 'bottom', labels: { color: text, boxWidth: 12 } },
            valueLabels: { mode: labels || 'all' },
            // Hovering a bar lists every leave type of that bar and its total
            tooltip: {
                mode: 'index',
                intersect: false,
                filter: (item) => !!item.raw,
                callbacks: {
                    label: (ctx) => ctx.dataset.label + ': ' + fmt(ctx.parsed[horizontal ? 'x' : 'y']) + ' day(s)',
                    footer: (items) => 'Total: ' + fmt(items.reduce((sum, item) => sum + (item.raw || 0), 0)) + ' day(s)'
                }
            }
        },
        scales: {
            x: Object.assign({ beginAtZero: true }, axis, horizontal ? {} : categoryTicks),
            y: Object.assign({ beginAtZero: true }, axis, horizontal ? categoryTicks : {})
        }
    };
}

// Stacked bar chart on canvas, or the empty message when data has no datasets.
// labels: 'all' (a number on every segment) or 'totals' (only the total of each bar, for many bars)
export function drawBarChart(canvas, emptyEl, data, horizontal, labels) {
    const old = Chart.getChart(canvas);
    if (old) {
        old.destroy();
    }
    const empty = !data.datasets.length;
    show(canvas.parentElement, !empty);
    show(emptyEl, empty);
    if (!empty) {
        new Chart(canvas, { type: 'bar', data, options: chartOptions(horizontal, labels), plugins: [valueLabels] });
    }
}

// Chart series: these types get their own colour, in this fixed order (validated colour neighbours);
// every other leave type (ML, PTL, MTL, RL, LOP, ...) is grouped as "Other"
export const CHART_SERIES = ['PL', 'SL', 'OPH', 'CO', 'WFH', 'Other'];

export function chartGroup(type) {
    const base = leave.baseType(type);
    return CHART_SERIES.indexOf(base) >= 0 && base != 'Other' ? base : 'Other';
}

// {key: {type: days}} -> {key: {group: days}}
function grouped(byKey) {
    const out = {};
    Object.keys(byKey).forEach((key) => {
        out[key] = {};
        Object.keys(byKey[key]).forEach((type) => {
            const g = chartGroup(type);
            out[key][g] = (out[key][g] || 0) + byKey[key][type];
        });
    });
    return out;
}

function datasets(groups, valueOf) {
    // A 2px line in the card colour between stacked segments keeps neighbouring colours apart
    const gap = cssVar('--bs-body-bg');
    return CHART_SERIES.filter((g) => groups.has(g)).map((g) => ({
        label: g,
        backgroundColor: typeColor(g),
        borderColor: gap,
        borderWidth: { top: 2 },
        data: valueOf(g)
    }));
}

// Leave days per month (Jan..Dec) per chart series
export function monthChartData(config, rows) {
    const leaveRows = rows.filter((r) => leave.isLeaveType(r.type));
    const totals = grouped(leave.monthlyTotals(leaveRows));
    const groups = new Set(leaveRows.map((r) => chartGroup(r.type)));
    return {
        labels: moment.monthsShort(),
        datasets: datasets(groups, (g) => moment.monthsShort().map((m, i) => (totals[i] && totals[i][g]) || 0))
    };
}

// Leave days per person per chart series, the person with most days first
export function personChartData(rows) {
    const leaveRows = rows.filter((r) => leave.isLeaveType(r.type));
    const summary = grouped(leave.personSummary(leaveRows));
    const total = (n) => Object.values(summary[n]).reduce((a, b) => a + b, 0);
    const names = Object.keys(summary).sort((a, b) => total(b) - total(a) || a.localeCompare(b));
    const groups = new Set(leaveRows.map((r) => chartGroup(r.type)));
    return { labels: names, datasets: datasets(groups, (g) => names.map((n) => summary[n][g] || 0)) };
}

// Charts read the theme colours when drawn, redraw them when the system light / dark setting changes
export function onThemeChange(fn) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(fn, 0));
}
