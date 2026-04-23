import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app] Unhandled render error", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen gradient-hero px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <Card className="w-full border-border/60 bg-card/95 backdrop-blur-xl">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <CardTitle>Workspace UI needs a refresh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                The page hit an unexpected render problem. Refresh the app to recover, or return to sign-in if the session changed.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button type="button" className="gap-2" onClick={() => window.location.reload()}>
                  <RefreshCcw className="h-4 w-4" />
                  Reload App
                </Button>
                <Button type="button" variant="outline" onClick={() => window.location.assign("/auth")}>
                  Go To Sign-In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
