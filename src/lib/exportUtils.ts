export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  formatter?: (row: T) => string | number | boolean | null | undefined;
}

export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: ColumnDef<T>[]
) {
  if (!rows || rows.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Header row
  const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');

  // Data rows
  const csvRows = rows.map((row) => {
    return columns
      .map((col) => {
        let val: any;
        if (col.formatter) {
          val = col.formatter(row);
        } else {
          val = row[col.key as keyof T];
        }

        if (val === null || val === undefined) {
          val = '';
        } else if (typeof val === 'boolean') {
          val = val ? 'Yes' : 'No';
        } else {
          val = String(val).replace(/"/g, '""');
        }

        return `"${val}"`;
      })
      .join(',');
  });

  const csvContent = [headers, ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
