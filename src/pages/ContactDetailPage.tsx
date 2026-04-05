import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { ContactDetailContent } from '@/components/contacts/ContactDetailContent';

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: c } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (cancelled || !c) { setLoading(false); return; }
      setContact(c);

      // Fetch company and deals in parallel
      const [companyRes, dealsRes] = await Promise.all([
        c.company_id
          ? supabase.from('companies').select('id, name, domain, logo_url').eq('id', c.company_id).single()
          : Promise.resolve({ data: null }),
        c.company_id
          ? supabase.from('deals').select('id, name, amount, stage, status, close_date').eq('company_id', c.company_id).order('close_date', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      if (!cancelled) {
        setCompany(companyRes.data);
        setDeals(dealsRes.data || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BrandLoader size={36} />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Contact not found.
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <button
        onClick={() => company ? navigate(`/companies/${company.id}`) : navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {company ? `Back to ${company.name}` : 'Back'}
      </button>

      <ContactDetailContent
        contact={contact}
        deals={deals}
        companyName={company?.name}
      />
    </div>
  );
}
