import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { FarcasterProvider } from "@/contexts/FarcasterContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// QueryClient instance - stable singleton
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Auth-kit config for browser-based Sign in with Farcaster
const authKitConfig = {
  rpcUrl: 'https://mainnet.optimism.io',
  domain: typeof window !== 'undefined' ? window.location.host : 'memorymint.xyz',
  siweUri: typeof window !== 'undefined' ? window.location.origin : 'https://memorymint.xyz',
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthKitProvider config={authKitConfig}>
      <FarcasterProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </FarcasterProvider>
    </AuthKitProvider>
  </QueryClientProvider>
);

export default App;
