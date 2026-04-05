import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/BrandLoader";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-md px-6">
        <BrandLoader size={64} />
        <h1 className="mt-6 text-5xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
        <p className="mt-3 text-sm text-muted-foreground/70">
          The page <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> doesn't exist. It may have been moved or removed.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/leads')} className="gap-1.5">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>
        <div className="mt-8 text-xs text-muted-foreground/50">
          <p>Looking for something? Try:</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
            <a href="/leads" className="hover:text-foreground transition-colors">Leads</a>
            <a href="/deals" className="hover:text-foreground transition-colors">Deals</a>
            <a href="/companies" className="hover:text-foreground transition-colors">Companies</a>
            <a href="/crawls" className="hover:text-foreground transition-colors">Crawls</a>
            <a href="/settings" className="hover:text-foreground transition-colors">Settings</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
