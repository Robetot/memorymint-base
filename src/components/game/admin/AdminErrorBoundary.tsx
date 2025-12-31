import React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): AdminErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Admin panel crashed";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // Visible UI should handle the user; logging stays minimal.
    console.error("[AdminPanel] render error", error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted/30 to-background">
        <Card className="max-w-md w-full border-destructive/40">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Admin panel error</h2>
              <p className="text-muted-foreground text-sm mt-1">{this.state.message || "Admin panel crashed"}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Retry
              </Button>
              {this.props.onClose && (
                <Button variant="ghost" onClick={this.props.onClose}>
                  <X className="h-4 w-4 mr-2" aria-hidden="true" />
                  Close
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
