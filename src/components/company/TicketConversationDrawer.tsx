import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useTicketConversations, type TicketConversation } from '@/hooks/useTicketConversations';
import { Headphones, ArrowDownLeft, ArrowUpRight, Lock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TicketConversationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: {
    freshdesk_ticket_id: string;
    subject?: string;
    status_label?: string;
    priority_label?: string;
    requester_name?: string;
  } | null;
}

function ConversationMessage({ msg }: { msg: TicketConversation }) {
  const isIncoming = msg.incoming ?? false;
  const isPrivate = msg.private_note ?? false;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isPrivate
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : isIncoming
          ? 'border-border/50 bg-card'
          : 'border-primary/20 bg-primary/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        {isIncoming ? (
          <ArrowDownLeft className="h-3 w-3 text-blue-400" />
        ) : (
          <ArrowUpRight className="h-3 w-3 text-green-400" />
        )}
        <span className="font-medium text-foreground">
          {msg.from_email || (isIncoming ? 'Customer' : 'Support')}
        </span>
        {isPrivate && (
          <Badge variant="outline" className="text-[10px] py-0 gap-0.5 text-yellow-500 border-yellow-500/30">
            <Lock className="h-2.5 w-2.5" /> Private Note
          </Badge>
        )}
        {msg.created_date && (
          <span className="ml-auto shrink-0">
            {format(new Date(msg.created_date), 'MMM d, yyyy h:mm a')}
          </span>
        )}
      </div>
      {msg.body_text ? (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
          {msg.body_text}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/40 italic">No content</p>
      )}
    </div>
  );
}

export function TicketConversationDrawer({
  open,
  onOpenChange,
  ticket,
}: TicketConversationDrawerProps) {
  const { data: conversations = [], isLoading } = useTicketConversations(
    ticket?.freshdesk_ticket_id
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {ticket && (
          <div className="space-y-4 pt-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Headphones className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold truncate">
                  {ticket.subject || 'No subject'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {ticket.status_label && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {ticket.status_label}
                  </Badge>
                )}
                {ticket.priority_label && (
                  <Badge variant="secondary" className="text-xs">
                    {ticket.priority_label}
                  </Badge>
                )}
                {ticket.requester_name && <span>from {ticket.requester_name}</span>}
              </div>
            </div>

            {/* Conversation thread */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Headphones className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No conversation entries found</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {conversations.length} message{conversations.length !== 1 ? 's' : ''}
                </p>
                {conversations.map((msg) => (
                  <ConversationMessage key={msg.id} msg={msg} />
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
