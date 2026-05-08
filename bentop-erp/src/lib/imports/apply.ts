import { generateSlug } from "@/lib/sku";

export function requireImportConfirmation(dryRun: boolean, confirm: unknown) {
  if (!dryRun && confirm !== "IMPORT") {
    throw new Error('Real imports require confirm: "IMPORT"');
  }
}

export function toImportNumber(value: unknown, fieldName: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return number;
}

export function toImportInteger(value: unknown, fieldName: string) {
  const number = toImportNumber(value, fieldName);
  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be a whole number`);
  }
  return number;
}

export function slugFromImportName(name: string) {
  return generateSlug(name) || `import-${Date.now()}`;
}

export type ImportApplySummary = {
  created: number;
  updated: number;
  skipped: number;
};

export function emptyImportApplySummary(): ImportApplySummary {
  return { created: 0, updated: 0, skipped: 0 };
}
