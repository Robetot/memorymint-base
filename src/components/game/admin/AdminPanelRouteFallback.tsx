import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function AdminPanelRouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-muted/30 to-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold">Loading admin panel…</p>
            <p className="text-sm text-muted-foreground">Preparing the admin interface</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
