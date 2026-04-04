import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Map, Archive, Trash2, GitMerge } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { BrandLoader } from '@/components/BrandLoader';
import Phase0Map from '@/components/company/cleanup/Phase0Map';
import PhaseCleanup from '@/components/company/cleanup/PhaseCleanup';
import { useCompaniesForMatching } from '@/hooks/useCompaniesForMatching';

export default function CompanyMappingPage() {
  const navigate = useNavigate();
  const { companies, loading, refetch } = useCompaniesForMatching();
  const [activeTab, setActiveTab] = useState('mapping');

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto py-8" style={{ paddingLeft: 20, paddingRight: 20 }}>
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
      <main className="mx-auto py-8" style={{ paddingLeft: 20, paddingRight: 20 }}>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Map, clean up, and organize your company data across all systems.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="mapping" className="gap-1.5">
              <Map className="h-3.5 w-3.5" />
              Mapping
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              Archive
            </TabsTrigger>
            <TabsTrigger value="delete" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-1.5">
              <GitMerge className="h-3.5 w-3.5" />
              Merge
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapping">
            <Phase0Map
              companies={companies}
              onComplete={() => navigate('/companies')}
              onSkip={() => navigate('/companies')}
              onRefetch={refetch}
            />
          </TabsContent>

          <TabsContent value="archive">
            <PhaseCleanup companies={companies} onRefetch={refetch} initialTab="archive" />
          </TabsContent>

          <TabsContent value="delete">
            <PhaseCleanup companies={companies} onRefetch={refetch} initialTab="delete" />
          </TabsContent>

          <TabsContent value="merge">
            <PhaseCleanup companies={companies} onRefetch={refetch} initialTab="merge" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
