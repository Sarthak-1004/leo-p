import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { StudentInsights } from "../types/domain";
// Loads live analytics, or returns the sample data in the demo preview.
export function useInsights(mode: "demo" | "live", sample: StudentInsights) {
  const [data, setData] = useState<StudentInsights | null>(mode === "demo" ? sample : null), [error, setError] = useState("");
  useEffect(() => {
    if (mode === "demo") return;
    const c = new AbortController();
    api<StudentInsights>("/student/insights", { signal: c.signal }).then(setData).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Dashboard data could not be loaded"); });
    return () => c.abort();
  }, [mode]);
  return useMemo(() => ({ data, setData, error }), [data, error]);
}
