import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProductProvider } from "@/contexts/ProductContext";
import CrawlPage from "./pages/CrawlPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import WishlistPage from "./pages/WishlistPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import GlobalChatPage from "./pages/GlobalChatPage";
import BrandGuidePage from "./pages/BrandGuidePage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ProductProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<CrawlPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/sites/:domain/:tab" element={<ResultsPage />} />
              <Route path="/sites/:domain/crawls/:dateSlug/:tab" element={<ResultsPage />} />
              <Route path="/sites/:domain/crawls/:dateSlug" element={<ResultsPage />} />
              <Route path="/sites/:domain" element={<ResultsPage />} />
              <Route path="/results/:sessionId" element={<ResultsPage />} />
              <Route path="/results/:domain/:dateSlug" element={<ResultsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/connections" element={<ConnectionsPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/chat" element={<GlobalChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/brand" element={<BrandGuidePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ProductProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
