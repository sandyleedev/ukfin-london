import React from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass p-6 h-full flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
          <div className="w-10 h-10 rounded-full bg-critical/10 flex items-center justify-center text-critical">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Something went wrong</h3>
            <p className="text-xs text-muted mt-1 max-w-sm font-mono truncate">
              {this.state.error?.message || "Failed to render this component."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg shadow-sm hover:bg-brand-dark transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
