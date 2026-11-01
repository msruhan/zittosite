type Tlv = { tag: string; value: string };

/** CRC16-CCITT, the checksum QRIS appends in tag 63. */
export function qrisCrc16(value: string): string {
  let crc = 0xffff;
  for (let i = 0; i < value.length; i += 1) {
    crc ^= value.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function qrisMerchantName(payload: string): string | null {
  const name = parse(payload).find((element) => element.tag === "59")?.value ?? "";
  return name || null;
}

/** Turns a static merchant QR into a dynamic one for an exact Rupiah amount. */
export function qrisWithAmount(payload: string, amount: number): string {
  validateStatic(payload);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_999) {
    throw new Error("Nominal QRIS tidak valid.");
  }
  const result: Tlv[] = [];
  let amountInserted = false;
  for (const element of parse(payload)) {
    if (["54", "55", "56", "57", "63"].includes(element.tag)) continue;
    if (element.tag === "01") {
      result.push({ tag: "01", value: "12" });
      continue;
    }
    if (element.tag === "58" && !amountInserted) {
      result.push({ tag: "54", value: String(amount) });
      amountInserted = true;
    }
    result.push(element);
  }
  if (!amountInserted) throw new Error("QRIS tidak memiliki kode negara.");
  const withoutCrc = result.map(encode).join("");
  const crcInput = `${withoutCrc}6304`;
  return `${crcInput}${qrisCrc16(crcInput)}`;
}

export function validateStatic(payload: string): void {
  const value = payload.trim();
  if (!value.startsWith("000201")) throw new Error("QRIS statis tidak valid.");
  const elements = parse(value);
  for (const tag of ["00", "01", "52", "53", "58", "59", "60", "63"]) {
    if (!elements.some((element) => element.tag === tag)) {
      throw new Error("QRIS statis tidak lengkap.");
    }
  }
  if (elements.find((element) => element.tag === "01")?.value !== "11") {
    throw new Error("Sumber QRIS harus bertipe statis.");
  }
  if (elements.find((element) => element.tag === "53")?.value !== "360") {
    throw new Error("QRIS harus memakai mata uang IDR.");
  }
  const crc = elements[elements.length - 1];
  if (crc?.tag !== "63" || crc.value.length !== 4) throw new Error("CRC QRIS tidak ditemukan.");
  if (qrisCrc16(value.slice(0, -4)) !== crc.value.toUpperCase()) {
    throw new Error("CRC QRIS tidak valid.");
  }
}

function parse(payload: string): Tlv[] {
  const elements: Tlv[] = [];
  let position = 0;
  while (position < payload.length) {
    if (position + 4 > payload.length) throw new Error("Struktur QRIS terpotong.");
    const tag = payload.slice(position, position + 2);
    const lengthRaw = payload.slice(position + 2, position + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthRaw)) {
      throw new Error("Struktur QRIS tidak valid.");
    }
    const length = Number(lengthRaw);
    const end = position + 4 + length;
    if (end > payload.length) throw new Error("Panjang QRIS tidak valid.");
    elements.push({ tag, value: payload.slice(position + 4, end) });
    position = end;
  }
  return elements;
}

function encode(element: Tlv): string {
  if (element.value.length > 99) throw new Error("Nilai QRIS terlalu panjang.");
  return `${element.tag}${String(element.value.length).padStart(2, "0")}${element.value}`;
}
