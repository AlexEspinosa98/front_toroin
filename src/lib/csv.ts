export function descargarCSV(nombre: string, filas: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const quincenas = (anio: number, mes: number) => {
  const p = (n: number) => String(n).padStart(2, "0");
  const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { q1: [`${anio}-${p(mes)}-01`, `${anio}-${p(mes)}-15`], q2: [`${anio}-${p(mes)}-16`, `${anio}-${p(mes)}-${p(fin)}`], mes: [`${anio}-${p(mes)}-01`, `${anio}-${p(mes)}-${p(fin)}`] } as const;
};
