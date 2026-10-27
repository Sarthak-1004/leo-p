import {useContext} from "react";
import {PortalContext} from "./context";
export function usePreview(){const context=useContext(PortalContext);if(!context)throw new Error("Portal provider missing");return context;}
