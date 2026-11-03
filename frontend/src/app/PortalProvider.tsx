import {lazy,Suspense,type ReactNode} from "react";
import {LiveProvider} from "./LiveProvider";
import {LoadingState} from "../components/ui";
const demoMode=import.meta.env.VITE_DEMO_MODE==="true";
// The fixture preview (and its sample data) is a separate chunk that live mode never loads.
const DemoProvider=lazy(()=>import("./DemoProvider").then(m=>({default:m.DemoProvider})));
export function PreviewProvider({children}:{children:ReactNode}){return demoMode?<Suspense fallback={<LoadingState/>}><DemoProvider>{children}</DemoProvider></Suspense>:<LiveProvider>{children}</LiveProvider>;}
