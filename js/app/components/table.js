// Sortable, searchable table with row highlighting and pagination, replaces DataTables.
// Filters other than the text search are applied by the view before setRows().
import { esc } from './ui.js';

/**
 * columns: [{key, label, value(row) (sort and search value), html(row) (cell content, escaped by the column),
 *            className, hideXs}]
 * options: {rowClass(row), sort: {key, dir: 'asc'|'desc'}, empty() (html), pageSize, onRowClick(row), label}
 */
export class LeaveTable {
    constructor(container, columns, options = {}) {
        this.container = container;
        this.columns = columns;
        this.options = options;
        this.sort = options.sort || { key: columns[0].key, dir: 'asc' };
        this.pageSize = options.pageSize || 10;
        this.page = 0;
        this.rows = [];
        this.search = '';

        container.addEventListener('click', (e) => {
            const sortBtn = e.target.closest('[data-sort]');
            if (sortBtn) {
                this.setSort(sortBtn.dataset.sort);
                return;
            }
            const pageBtn = e.target.closest('[data-page]');
            if (pageBtn) {
                if (!pageBtn.disabled) {
                    this.page = +pageBtn.dataset.page;
                    this.render();
                    // Keep the keyboard focus on the pagination
                    const again = this.container.querySelector('[data-page="' + this.page + '"]:not([data-step])');
                    if (again) {
                        again.focus();
                    }
                }
                return;
            }
            const tr = e.target.closest('tr[data-index]');
            if (tr && this.options.onRowClick) {
                this.options.onRowClick(this.visible[+tr.dataset.index]);
            }
        });
        container.addEventListener('keydown', (e) => {
            const tr = e.target.closest('tr[data-index]');
            if (tr && this.options.onRowClick && (e.key == 'Enter' || e.key == ' ')) {
                e.preventDefault();
                this.options.onRowClick(this.visible[+tr.dataset.index]);
            }
        });
    }

    column(key) {
        return this.columns.find((c) => c.key == key);
    }

    setRows(rows) {
        this.rows = rows;
        this.page = 0;
        this.render();
    }

    setSearch(text) {
        this.search = (text || '').trim().toLowerCase();
        this.page = 0;
        this.render();
    }

    setSort(key) {
        if (this.sort.key == key) {
            this.sort = { key, dir: this.sort.dir == 'asc' ? 'desc' : 'asc' };
        } else {
            this.sort = { key, dir: 'asc' };
        }
        this.page = 0;
        this.render();
        const btn = this.container.querySelector('[data-sort="' + key + '"]');
        if (btn) {
            btn.focus();
        }
    }

    // The rows of any list that match the current search text (no sorting)
    matching(rows) {
        if (!this.search) {
            return rows;
        }
        return rows.filter((row) => this.columns.some((c) => String(c.value(row)).toLowerCase().indexOf(this.search) >= 0));
    }

    // Rows matching the search, in the current sort order (all pages)
    filtered() {
        const rows = this.matching(this.rows);
        const col = this.column(this.sort.key);
        const sign = this.sort.dir == 'asc' ? 1 : -1;
        return rows.slice().sort((a, b) => {
            const x = col.value(a);
            const y = col.value(b);
            if (x < y) {
                return -sign;
            }
            if (x > y) {
                return sign;
            }
            return 0;
        });
    }

    // Previous, page numbers (first, last and the ones around the current page, gaps as "…"), Next
    pagination(pages) {
        if (pages < 2) {
            return '';
        }
        const current = this.page;
        const shown = [];
        for (let i = 0; i < pages; i++) {
            if (i == 0 || i == pages - 1 || Math.abs(i - current) <= 1) {
                shown.push(i);
            } else if (shown[shown.length - 1] !== '…') {
                shown.push('…');
            }
        }
        const item = (page, label, opts = {}) => {
            if (page === '…') {
                return '<li class="page-item disabled"><span class="page-link">…</span></li>';
            }
            const active = !opts.step && page == current;
            return '<li class="page-item' + (active ? ' active' : '') + (opts.disabled ? ' disabled' : '') + '">' +
                '<button type="button" class="page-link" data-page="' + page + '"' + (opts.step ? ' data-step' : '') +
                (opts.disabled ? ' disabled' : '') + (active ? ' aria-current="page"' : '') +
                (opts.aria ? ' aria-label="' + opts.aria + '"' : '') + '>' + label + '</button></li>';
        };
        return '<nav aria-label="' + esc((this.options.label || 'Table') + ' pages') + '"><ul class="pagination pagination-sm mb-0">' +
            item(current - 1, '<i class="bi bi-chevron-left" aria-hidden="true"></i>', { step: true, disabled: current == 0, aria: 'Previous page' }) +
            shown.map((p) => (p === '…' ? item(p) : item(p, String(p + 1), { aria: 'Page ' + (p + 1) }))).join('') +
            item(current + 1, '<i class="bi bi-chevron-right" aria-hidden="true"></i>', { step: true, disabled: current == pages - 1, aria: 'Next page' }) +
            '</ul></nav>';
    }

    render() {
        const all = this.filtered();
        const pages = Math.max(Math.ceil(all.length / this.pageSize), 1);
        this.page = Math.min(Math.max(this.page, 0), pages - 1);
        const first = this.page * this.pageSize;
        this.visible = all.slice(first, first + this.pageSize);
        const hide = (c) => (c.hideXs ? ' d-none d-sm-table-cell' : '');
        const clickable = !!this.options.onRowClick;

        const head = this.columns.map((c) => {
            const sorted = this.sort.key == c.key;
            const aria = sorted ? (this.sort.dir == 'asc' ? 'ascending' : 'descending') : 'none';
            const icon = sorted ? (this.sort.dir == 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up';
            return '<th scope="col" class="' + esc((c.className || '') + hide(c)) + '" aria-sort="' + aria + '">' +
                '<button type="button" class="sort-btn" data-sort="' + esc(c.key) + '">' + esc(c.label) +
                ' <i class="bi ' + icon + (sorted ? '' : ' opacity-25') + '" aria-hidden="true"></i></button></th>';
        }).join('');

        let body;
        if (!all.length) {
            body = '<tr><td colspan="' + this.columns.length + '" class="text-body-secondary text-center py-4">' +
                (this.options.empty ? this.options.empty() : 'No records') + '</td></tr>';
        } else {
            body = this.visible.map((row, i) => {
                const cls = this.options.rowClass ? this.options.rowClass(row) : '';
                return '<tr data-index="' + i + '" class="' + esc(cls) + '"' + (clickable ? ' tabindex="0" role="button"' : '') + '>' +
                    this.columns.map((c) => '<td class="' + esc((c.className || '') + hide(c)) + '">' +
                        (c.html ? c.html(row) : esc(c.value(row))) + '</td>').join('') + '</tr>';
            }).join('');
        }

        const info = all.length ? 'Showing ' + (first + 1) + '–' + (first + this.visible.length) + ' of ' + all.length : '';
        this.container.innerHTML =
            '<div class="table-responsive"><table class="table table-sm table-hover align-middle leave-table mb-0"' +
            (this.options.label ? ' aria-label="' + esc(this.options.label) + '"' : '') + '>' +
            '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2 small text-body-secondary">' +
            '<span class="table-info">' + info + '</span>' + this.pagination(pages) + '</div>';
    }
}
