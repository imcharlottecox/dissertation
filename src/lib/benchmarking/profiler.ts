export type BenchRow = {name: string, n: number; ms: number;}
export const benchRows: BenchRow[] = [];

export function measure<T>(name: string, n: number, fn: () => T): T {
    const start = performance.now();
    const functionResult = fn();
    const end = performance.now();
    const ms = end - start;
    benchRows.push({name, n, ms});
    return functionResult;
}

export function clearBenchRows() {
    benchRows.length = 0;
}

export function downloadBenchRowsAsCsv(filename = 'benchmark.csv') {
    const header = 'name,n,ms\n';
    const csvContent = benchRows.map(row => `${row.name},${row.n},${row.ms}`).join('\n');
    const csvData = header + csvContent;
    const blob = new Blob([csvData], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}