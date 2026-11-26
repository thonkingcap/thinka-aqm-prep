import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportCaught } from "../lib/errorReport.ts";

/** Catches a crash anywhere in the page: reports it (lib/errorReport.ts) and offers a reload instead of a blank screen. */
export default class ErrorScreen extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportCaught("react", error, { componentStack: info.componentStack?.slice(0, 1500) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="main" id="main">
        <div className="page">
          <h1>Something broke on this page</h1>
          <p>It's been reported to Daniel. Reloading usually fixes it; your progress is saved on this device.</p>
          <p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>{" "}
            <a className="btn btn-ghost" href="#/home" onClick={() => this.setState({ failed: false })}>Go home</a>
          </p>
        </div>
      </main>
    );
  }
}
