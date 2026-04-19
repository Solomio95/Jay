// Statutory rate tables. Production values should be loaded at runtime from
// `statutory_rate_tables` via loadStatutoryRates(asOf); the constants here are
// defaults used when no row covers the pay date (which hard-fails payroll
// anyway) and for unit tests.
export * from "./epf-third-schedule.js";
export * from "./socso-categories.js";
export * from "./eis-table.js";
