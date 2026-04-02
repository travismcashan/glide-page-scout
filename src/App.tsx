// GLIDE® Growth App
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandLoader } from "@/components/BrandLoader";
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
import KnowledgePage from "./pages/KnowledgePage";
import BrandGuidePage from "./pages/BrandGuidePage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import UsagePage from "./pages/UsagePage";
import ServicesPage from "./pages/ServicesPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import PipelinePage from "./pages/PipelinePage";
import NotFound from "./pages/NotFound";
import FeedbackSideTabs from "./components/feedback/FeedbackSideTabs";

function RedirectGroups() {
  const { groupId } = useParams<{ groupId: string }>();
  const { search } = useLocation();
  return <Navigate to={`/lists/${groupId}${search}`} replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { search } = useLocation();
  const isSharedView = new URLSearchParams(search).get('view') === 'shared';
  if (isSharedView) return <>{children}</>;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><BrandLoader size={64} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

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
            <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center"><p>Something went wrong. <a href="/" className="underline">Go home</a></p></div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><CrawlPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/sites/:domain/:tab" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/sites/:domain/crawls/:dateSlug/:tab" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/sites/:domain/crawls/:dateSlug" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/sites/:domain" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/results/:sessionId" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/results/:domain/:dateSlug" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
              <Route path="/sites" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
              <Route path="/lists" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
              <Route path="/lists/:groupId/:tab" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
              <Route path="/lists/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/groups" element={<Navigate to="/lists" replace />} />
              <Route path="/groups/:groupId" element={<RedirectGroups />} />
              <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
              <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><GlobalChatPage /></ProtectedRoute>} />
              <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/usage" element={<ProtectedRoute><UsagePage /></ProtectedRoute>} />
              <Route path="/brand" element={<ProtectedRoute><BrandGuidePage /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
              <Route path="/services/:id" element={<ProtectedRoute><ServiceDetailPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FeedbackSideTabs />
            <Analytics />
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
        </ProductProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
