import { BrowserRouter } from "react-router";
import { PreviewProvider } from "./app/PortalProvider";
import { AppRoutes } from "./routes/AppRoutes";
export default function App() {
  return (
    <BrowserRouter>
      <PreviewProvider>
        <AppRoutes />
      </PreviewProvider>
    </BrowserRouter>
  );
}
