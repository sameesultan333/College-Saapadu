import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  onReset: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Prevents a single uncaught render error (e.g. a transient bad API
// response) from unmounting the whole app to a blank white screen with no
// way to recover short of a manual page reload. Falls back to a simple
// screen that clears the session and returns to login.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Dashboard crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem", fontFamily: "sans-serif" }}>
          <p>Something went wrong loading the dashboard.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}
          >
            Back to login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
