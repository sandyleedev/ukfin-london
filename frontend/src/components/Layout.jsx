import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import Header from "./Header.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { useDashboard } from "../DataContext.jsx";

export default function Layout() {
  const { data, error } = useDashboard();

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-critical font-semibold mb-3 text-base">Could not load dashboard</div>
          <p className="text-sm text-muted">{error}</p>
          <p className="text-xs text-muted mt-4">
            From <code className="text-brand">backend/</code>: <code className="text-brand">python build_dashboard.py</code> then <code className="text-brand">uvicorn api:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg text-ink font-sans">
      <Header generatedAt={data?.generated_at} />
      <main className="flex-1 overflow-auto no-scrollbar p-6">
        {!data ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-3">
            <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
            <span className="text-sm">Loading supervision intelligence…</span>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        )}
      </main>
    </div>
  );
}
