// Band-table and rate inputs for MY statutory calcs.
// These are *initial* rates used for scaffolding. HR Admin uploads the current
// year's tables via the admin screen, which writes to `statutory_rate_tables`.
// The production code loads the effective row for the pay date; these constants
// are only used in tests and local dev.
export * from "./epf-rates.js";
export * from "./socso-table.js";
export * from "./eis-table.js";
export * from "./pcb-formula.js";
