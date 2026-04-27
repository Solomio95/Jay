export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateSku(prefix: string, colorCode: string, size: string): string {
  return `${prefix}-${colorCode.toUpperCase()}-${size.toUpperCase()}`;
}

export function generateBarcode(): string {
  // Generate EAN-13 compatible barcode
  const prefix = "899"; // Malaysia country code area
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  const base = prefix + digits;

  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return base + checkDigit;
}
