// Back-compat re-export. The real implementation lives in AuthContext.
export { useAuth, isManager, isHrAdmin } from "./AuthContext";
export type { AppRole, Profile } from "./AuthContext";
