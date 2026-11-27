import { Component, Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { ErrorState, LoadingState } from "../components/ui";

// Shows the error state instead of a blank screen when a page fails to load or render.
// The error clears when the path changes, without remounting pages that are working.
class PageErrorBoundary extends Component<{ children: ReactNode; path: string }, { failedAt: string | null }> {
  state = { failedAt: null as string | null };
  static getDerivedStateFromError() {
    return { failedAt: "" };
  }
  componentDidCatch() {
    this.setState({ failedAt: this.props.path });
  }
  render() {
    const failed =
      this.state.failedAt !== null && (this.state.failedAt === "" || this.state.failedAt === this.props.path);
    return failed ? <ErrorState retry={() => window.location.reload()} /> : this.props.children;
  }
}

// The page area of a layout: pages load on demand while the navigation stays in place.
export function PageOutlet() {
  const { pathname } = useLocation();
  return (
    <PageErrorBoundary path={pathname}>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </PageErrorBoundary>
  );
}
