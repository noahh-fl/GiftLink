import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((args: { error: Error | null; reset: () => void }) => ReactNode);
  resetKeys?: ReadonlyArray<unknown>;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.hasError) {
      return;
    }

    const prevKeys = prevProps.resetKeys;
    const nextKeys = this.props.resetKeys;

    if (!prevKeys && !nextKeys) {
      return;
    }

    if (prevKeys?.length !== nextKeys?.length) {
      this.reset();
      return;
    }

    if (prevKeys && nextKeys) {
      for (let index = 0; index < prevKeys.length; index += 1) {
        if (!Object.is(prevKeys[index], nextKeys[index])) {
          this.reset();
          return;
        }
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;

      if (typeof fallback === "function") {
        return fallback({ error: this.state.error, reset: this.reset });
      }

      if (fallback) {
        return fallback;
      }

      return null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
