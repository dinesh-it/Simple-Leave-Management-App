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

// Draws each segment's value inside it, and the total at the end of stacks with more than one segment.
// A single bar too small for its number gets it just past its end instead; a small segment inside a
// stack is skipped (the stack total and the tooltip still have it).
// The drawn labels are kept on chart.$valueLabels (used by the browser checks).
const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const horizontal = chart.options.indexAxis == 'y';
        const drawn = [];
        const totals = {};
        ctx.save();
        ctx.font = '600 11px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        chart.data.datasets.forEach((ds, i) => {
            const meta = chart.getDatasetMeta(i);
            if (!chart.isDatasetVisible(i)) {
                return;
            }
            meta.data.forEach((bar, j) => {
                const value = ds.data[j];
                if (!value) {
                    return;
                }
                const { x, y, base, width, height } = bar.getProps(['x', 'y', 'base', 'width', 'height'], true);
                const end = horizontal ? Math.max(x, base) : Math.min(y, base);
                const t = totals[j] || (totals[j] = { sum: 0, count: 0, at: end, cross: horizontal ? y : x, inside: false });
                t.sum += value;
                t.count++;
                t.at = horizontal ? Math.max(t.at, end) : Math.min(t.at, end);

                const text = fmt(value);
                const length = horizontal ? Math.abs(x - base) : Math.abs(base - y);
                const thickness = horizontal ? height : width;
                const textWidth = ctx.measureText(text).width;
                if ((horizontal ? length : thickness) < textWidth + 4 || (horizontal ? thickness : length) < 14) {
                    return;
                }
                const lx = horizontal ? (x + base) / 2 : x;
                const ly = horizontal ? y : (y + base) / 2;
                ctx.fillStyle = textOn(ds.backgroundColor);
                ctx.fillText(text, lx, ly);
                t.inside = true;
                drawn.push({ text, x: lx, y: ly, total: false });
            });
        });
        ctx.fillStyle = cssVar('--bs-body-color');
        Object.values(totals).forEach((t) => {
            // One segment whose number fitted inside: nothing more to say
            if (t.count < 2 && t.inside) {
                return;
            }
            const text = fmt(t.sum);
            const lx = horizontal ? t.at + 4 + ctx.measureText(text).width / 2 : t.cross;
            const ly = horizontal ? t.cross : t.at - 8;
            ctx.fillText(text, lx, ly);
            drawn.push({ text, x: lx, y: ly, total: t.count > 1, outside: true });
        });
        ctx.restore();
        chart.$valueLabels = drawn;
    }
};

function chartOptions(horizontal) {
    const text = cssVar('--bs-body-color');
    const grid = cssVar('--bs-border-color-translucent');
    const axis = { stacked: true, ticks: { color: text }, grid: { color: grid } };
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // Room for the stack totals
        layout: { padding: horizontal ? { right: 28 } : { top: 18 } },
        indexAxis: horizontal ? 'y' : 'x',
        // Few people or months must not give very wide bars
        datasets: { bar: { maxBarThickness: 64 } },
        plugins: {
            legend: { position: 'bottom', labels: { color: text, boxWidth: 12 } },
            tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + fmt(ctx.parsed[horizontal ? 'x' : 'y']) + ' day(s)' } }
        },
        scales: {
            x: Object.assign({ beginAtZero: true }, axis),
            y: Object.assign({ beginAtZero: true }, axis)
        }
    };
}

// Stacked bar chart on canvas, or the empty message when data has no datasets
export function drawBarChart(canvas, emptyEl, data, horizontal) {
    const old = Chart.getChart(canvas);
    if (old) {
        old.destroy();
    }
    const empty = !data.datasets.length;
    show(canvas.parentElement, !empty);
    show(emptyEl, empty);
    if (!empty) {
        new Chart(canvas, { type: 'bar', data, options: chartOptions(horizontal), plugins: [valueLabels] });
    }
}

// Leave days per month (Jan..Dec), one dataset per leave type; WFH and the other types count as listed
export function monthChartData(config, rows) {
    const leaveRows = rows.filter((r) => leave.isLeaveType(r.type));
    const types = typeOrder(config, Array.from(new Set(leaveRows.map((r) => leave.baseType(r.type)))));
    const totals = leave.monthlyTotals(leaveRows);
    return {
        labels: moment.monthsShort(),
        datasets: types.map((t) => ({
            label: t,
            backgroundColor: typeColor(t),
            data: moment.monthsShort().map((m, i) => (totals[i] && totals[i][t]) || 0)
        }))
    };
}

// Charts read the theme colours when drawn, redraw them when the system light / dark setting changes
export function onThemeChange(fn) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(fn, 0));
}
