import type {ReactNode} from "react";
import {Navigate,useLocation} from "react-router";
import {usePreview} from "./PreviewContext";
import {LoadingState} from "../components/ui";
import type {Role} from "../types/domain";
export function Protected({role,children}:{role:Role;children:ReactNode}) {
  const {mode,currentUser,authStatus}=usePreview();const location=useLocation();
  if(mode==="demo")return children;if(authStatus==="loading")return <LoadingState/>;
  if(!currentUser)return <Navigate to={`/${role}/login`} replace state={{from:location.pathname}}/>;
  if(currentUser.role!==role)return <Navigate to={`/${currentUser.role}/dashboard`} replace/>;
  if(role==="student"&&!currentUser.accessActive&&location.pathname!=="/student/access-expired")return <Navigate to="/student/access-expired" replace/>;
  return children;
}
