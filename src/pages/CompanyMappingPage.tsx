import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { BrandLoader } from '@/components/BrandLoader';
import Phase0Map from '@/components/company/cleanup/Phase0Map';
import { useCompaniesForMatching } from '@/hooks/useCompaniesForMatching';

export default function CompanyMappingPage() {
  const navigate = useNavigate();
  const { companies, loading, refetch } = useCompaniesForMatching();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Mapping</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              QuickBooks is the source of truth. Map each company to its HubSpot, Harvest, and Freshdesk records.
            </p>
          </div>
        </div>

        <Phase0Map
          companies={companies}
          onComplete={() => navigate('/companies')}
          onSkip={() => navigate('/companies')}
          onRefetch={refetch}
        />
      </main>
    </div>
  );
}
