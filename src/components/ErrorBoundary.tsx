import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, showDetails: false });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { error, showDetails } = this.state;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this section.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-accent transition-colors"
              >
                <Home className="h-4 w-4" />
                Go Home
              </a>
            </div>

            {error && (
              <div className="pt-2">
                <button
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showDetails ? 'Hide' : 'Show'} error details
                </button>
                {showDetails && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 text-left overflow-auto max-h-64">
                    <p className="text-xs font-medium text-destructive mb-2">{error.message}</p>
                    {error.stack && (
                      <pre className="text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words font-mono">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
