import type {ReactNode} from "react";
import {DemoProvider} from "./DemoProvider";
import {LiveProvider} from "./LiveProvider";
const demoMode=import.meta.env.VITE_DEMO_MODE==="true";
export function PreviewProvider({children}:{children:ReactNode}){return demoMode?<DemoProvider>{children}</DemoProvider>:<LiveProvider>{children}</LiveProvider>;}
