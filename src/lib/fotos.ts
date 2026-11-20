/** Foto comprimida con marca de agua (obra, fecha y hora) como data URI JPEG de menos de ~500 KB. */
export async function procesarFoto(file: File, marca: string): Promise<string> {
  const bmp = await createImageBitmap(file);
  for (const [max, calidad] of [[1280, 0.72], [1100, 0.62], [900, 0.55], [720, 0.5]] as const) {
    const esc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const fs = Math.max(14, Math.round(w / 45)), pad = fs * 0.6;
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(marca).width;
    ctx.fillStyle = "rgba(16, 20, 74, 0.72)";
    ctx.fillRect(0, h - fs - pad * 2, Math.min(w, tw + pad * 2), fs + pad * 2);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
    ctx.fillText(marca, pad, h - (fs + pad * 2) / 2);
    const uri = canvas.toDataURL("image/jpeg", calidad);
    if (uri.length <= 650_000) return uri;
  }
  throw new Error("La foto es demasiado grande");
}
