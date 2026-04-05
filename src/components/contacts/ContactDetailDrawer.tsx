import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Mail, Sparkles, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ContactDetailContent } from './ContactDetailContent';

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  seniority: string | null;
  role_type: string | null;
  is_primary: boolean;
  lead_status: string | null;
  lifecycle_stage: string | null;
  enrichment_data: any;
  created_at: string;
};

type Deal = {
  id: string;
  name: string;
  amount: number | null;
  stage: string | null;
  status: string;
  close_date: string | null;
};

export function ContactDetailDrawer({
  contact,
  onClose,
  companyName,
  companyId,
  onEnrich,
}: {
  contact: Contact | null;
  onClose: () => void;
  companyName?: string;
  companyId?: string;
  onEnrich?: (contact: Contact) => void;
}) {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Fetch company deals when drawer opens
  useEffect(() => {
    if (!contact || !companyId) {
      setDeals([]);
      return;
    }
    let cancelled = false;
    setDealsLoading(true);
    supabase
      .from('deals')
      .select('id, name, amount, stage, status, close_date')
      .eq('company_id', companyId)
      .order('close_date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setDeals(data || []);
          setDealsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [contact?.id, companyId]);

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg p-0 flex flex-col">
        {contact && (
          <>
            <div className="flex-1 overflow-y-auto">
              <ContactDetailContent
                contact={contact}
                deals={deals}
                dealsLoading={dealsLoading}
                companyName={companyName}
              />
            </div>
            <div className="border-t p-3 flex items-center gap-2 shrink-0">
              {contact.email && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" /> Email</a>
                </Button>
              )}
              {onEnrich && (
                <Button variant="outline" size="sm" onClick={() => onEnrich(contact)} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Enrich
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onClose(); navigate(`/contacts/${contact.id}`); }}
                className="gap-1.5 ml-auto"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Full Profile
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
