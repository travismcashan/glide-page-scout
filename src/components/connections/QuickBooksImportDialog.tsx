import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Phase0Import from '@/components/company/cleanup/Phase0Import';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function QuickBooksImportDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QuickBooks Import</DialogTitle>
        </DialogHeader>
        <Phase0Import
          onComplete={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
