import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CrawlPage from "./pages/CrawlPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import WishlistPage from "./pages/WishlistPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CrawlPage />} />
          {/* New taxonomy: /sites/{domain}, with optional /crawls/{date} and /{tab} */}
          <Route path="/sites/:domain/:tab" element={<ResultsPage />} />
          <Route path="/sites/:domain/crawls/:dateSlug/:tab" element={<ResultsPage />} />
          <Route path="/sites/:domain/crawls/:dateSlug" element={<ResultsPage />} />
          <Route path="/sites/:domain" element={<ResultsPage />} />
          {/* Legacy routes — redirect-compatible */}
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="/results/:domain/:dateSlug" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
