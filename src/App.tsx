// GLIDE® Ascend App
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
import { AppLayout } from "@/components/AppLayout";
import CrawlPage from "./pages/CrawlPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
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
import CompaniesPage from "./pages/CompaniesPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";
import CompanyCleanupPage from "./pages/CompanyCleanupPage";
import CompanyMappingPage from "./pages/CompanyMappingPage";
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
              {/* CrawlPage: full-width, no sidebar */}
              <Route path="/" element={<ProtectedRoute><CrawlPage /></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/groups" element={<Navigate to="/lists" replace />} />
              <Route path="/groups/:groupId" element={<RedirectGroups />} />
              <Route path="/integrations" element={<Navigate to="/connections" replace />} />
              {/* All other pages: sidebar layout */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/sites/:domain/:tab" element={<ResultsPage />} />
                <Route path="/sites/:domain/crawls/:dateSlug/:tab" element={<ResultsPage />} />
                <Route path="/sites/:domain/crawls/:dateSlug" element={<ResultsPage />} />
                <Route path="/sites/:domain" element={<ResultsPage />} />
                <Route path="/results/:sessionId" element={<ResultsPage />} />
                <Route path="/results/:domain/:dateSlug" element={<ResultsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/sites" element={<HistoryPage />} />
                <Route path="/lists" element={<GroupsPage />} />
                <Route path="/lists/:groupId/:tab" element={<GroupDetailPage />} />
                <Route path="/lists/:groupId" element={<GroupDetailPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="/companies" element={<CompaniesPage />} />
                <Route path="/companies/cleanup" element={<CompanyCleanupPage />} />
                <Route path="/companies/mapping" element={<CompanyMappingPage />} />
                <Route path="/companies/:id" element={<CompanyDetailPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/chat" element={<GlobalChatPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/usage" element={<UsagePage />} />
                <Route path="/brand" element={<BrandGuidePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/services/:id" element={<ServiceDetailPage />} />
              </Route>
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
