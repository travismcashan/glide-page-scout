import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TicketConversation = {
  id: string;
  freshdesk_ticket_id: string;
  freshdesk_conversation_id: string | null;
  body_text: string | null;
  incoming: boolean | null;
  private_note: boolean | null;
  from_email: string | null;
  to_emails: string[] | null;
  support_email: string | null;
  source: number | null;
  created_date: string | null;
};

export function useTicketConversations(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket-conversations', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freshdesk_ticket_conversations' as any)
        .select('id, freshdesk_ticket_id, freshdesk_conversation_id, body_text, incoming, private_note, from_email, to_emails, support_email, source, created_date')
        .eq('freshdesk_ticket_id', ticketId!)
        .order('created_date', { ascending: true });
      if (error) throw error;
      return (data || []) as TicketConversation[];
    },
    enabled: !!ticketId,
    staleTime: 5 * 60 * 1000,
  });
}
