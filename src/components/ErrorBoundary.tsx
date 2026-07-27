// ErrorBoundary — last-resort UI when a render throw would otherwise
// white-screen the kids app. Class component required for getDerivedStateFromError.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[ErrorBoundary]", error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            fontFamily: "Fredoka, system-ui, sans-serif",
            background: "linear-gradient(160deg, #FFF6E0 0%, #FFE4A8 100%)",
            color: "#3D2C1E",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }} aria-hidden>
            💨
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Oops — PootBox hiccuped</h1>
          <p style={{ margin: 0, maxWidth: 320, color: "#92705A" }}>
            Something went wrong. Tap reload to keep playing.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "12px 24px",
              borderRadius: 14,
              border: "none",
              background: "#F59E0B",
              color: "#3D2C1E",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
