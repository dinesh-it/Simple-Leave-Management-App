// Sortable, searchable table with row highlighting and "Show more", replaces DataTables.
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
        this.pageSize = options.pageSize || 50;
        this.limit = this.pageSize;
        this.rows = [];
        this.search = '';

        container.addEventListener('click', (e) => {
            const sortBtn = e.target.closest('[data-sort]');
            if (sortBtn) {
                this.setSort(sortBtn.dataset.sort);
                return;
            }
            if (e.target.closest('[data-more]')) {
                this.limit += this.pageSize;
                this.render();
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
        this.limit = this.pageSize;
        this.render();
    }

    setSearch(text) {
        this.search = (text || '').trim().toLowerCase();
        this.limit = this.pageSize;
        this.render();
    }

    setSort(key) {
        if (this.sort.key == key) {
            this.sort = { key, dir: this.sort.dir == 'asc' ? 'desc' : 'asc' };
        } else {
            this.sort = { key, dir: 'asc' };
        }
        this.render();
        const btn = this.container.querySelector('[data-sort="' + key + '"]');
        if (btn) {
            btn.focus();
        }
    }

    // Rows matching the search, in the current sort order (what the user sees, before "Show more")
    filtered() {
        let rows = this.rows;
        if (this.search) {
            rows = rows.filter((row) => this.columns.some((c) => String(c.value(row)).toLowerCase().indexOf(this.search) >= 0));
        }
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

    render() {
        const all = this.filtered();
        this.visible = all.slice(0, this.limit);
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

        const more = all.length > this.visible.length ?
            '<button type="button" class="btn btn-sm btn-outline-secondary" data-more>Show more</button>' : '';
        this.container.innerHTML =
            '<div class="table-responsive"><table class="table table-sm table-hover align-middle leave-table mb-0"' +
            (this.options.label ? ' aria-label="' + esc(this.options.label) + '"' : '') + '>' +
            '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
            '<div class="d-flex justify-content-between align-items-center gap-2 mt-2 small text-body-secondary">' +
            '<span>' + (all.length ? 'Showing ' + this.visible.length + ' of ' + all.length : '') + '</span>' + more + '</div>';
    }
}
