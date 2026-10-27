import { Protected } from "../app/Protected";
import { PortalShell } from "./PortalShell";
export function AdminLayout() {
  return <Protected role="admin"><PortalShell admin /></Protected>;
}
