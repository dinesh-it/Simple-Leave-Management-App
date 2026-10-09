// Excel downloads built from row arrays (ExcellentExport 3), never from what is rendered

// rows: array of arrays, the first one is usually the header
export function downloadSheet(filename, sheetName, rows) {
    const a = document.createElement('a');
    a.className = 'd-none';
    document.body.appendChild(a);
    ExcellentExport.convert({ anchor: a, filename, format: 'xlsx' }, [{ name: sheetName, from: { array: rows } }]);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 1000);
}
