import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, ExternalLink, Maximize2, X } from 'lucide-react';

type GalleryPage = {
  id: string;
  url: string;
  title: string | null;
  screenshot_url: string | null;
};

export function ScreenshotGallery({ pages }: { pages: GalleryPage[] }) {
  const [selectedPage, setSelectedPage] = useState<GalleryPage | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Camera className="h-5 w-5 text-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Screenshots</h2>
          <span className="text-sm text-muted-foreground ml-auto">{pages.length} pages</span>
        </div>
        <div className="p-4">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {pages.map(page => (
              <div
                key={page.id}
                className="break-inside-avoid cursor-pointer group rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => setSelectedPage(page)}
              >
                <div className="relative">
                  <img
                    src={page.screenshot_url!}
                    alt={`Screenshot of ${page.title || page.url}`}
                    className="w-full block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-full p-2">
                      <Maximize2 className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 bg-muted/30">
                  <p className="text-xs font-medium truncate">{page.title || page.url}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{page.url}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Medium view dialog */}
      <Dialog open={!!selectedPage && !fullscreen} onOpenChange={(open) => { if (!open) setSelectedPage(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 gap-0">
          {selectedPage && (
            <>
              <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-4">
                  <p className="font-medium text-sm truncate">{selectedPage.title || selectedPage.url}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{selectedPage.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={selectedPage.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" /> Visit
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                    <Maximize2 className="h-3 w-3 mr-1" /> Full
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <img
                  src={selectedPage.screenshot_url!}
                  alt={`Screenshot of ${selectedPage.title || selectedPage.url}`}
                  className="w-full rounded-lg border border-border"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen overlay */}
      {fullscreen && selectedPage && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <p className="font-medium">{selectedPage.title || selectedPage.url}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedPage.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={selectedPage.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" /> Visit
                </Button>
              </a>
              <Button variant="outline" size="icon" onClick={() => { setFullscreen(false); setSelectedPage(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <img
              src={selectedPage.screenshot_url!}
              alt={`Screenshot of ${selectedPage.title || selectedPage.url}`}
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
