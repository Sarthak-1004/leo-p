import { Protected } from "../app/Protected";
import { PortalShell } from "./PortalShell";
export function StudentLayout() {
  return <Protected role="student"><PortalShell admin={false} /></Protected>;
}
