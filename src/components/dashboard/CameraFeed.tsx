import { useState } from 'react';
import { Camera as CameraIcon, RefreshCw, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera } from '@/types/parking';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CameraFeedProps {
  camera: Camera;
  onRefresh?: () => void;
}

export function CameraFeed({ camera, onRefresh }: CameraFeedProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isOnline = camera.status === 'online';

  const CameraContent = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <div className={cn("relative bg-muted flex items-center justify-center", fullscreen ? "aspect-video w-full" : "aspect-video")}>
      {isOnline ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
          <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
            <CameraIcon className={cn("opacity-30", fullscreen ? "h-20 w-20" : "h-12 w-12")} />
            <span className={cn(fullscreen ? "text-lg" : "text-sm")}>Live Feed</span>
            <span className={cn("font-mono", fullscreen ? "text-base" : "text-xs")}>
              Last capture: {new Date(camera.lastCapture).toLocaleTimeString()}
            </span>
          </div>
          {/* Simulated detection overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-foreground/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <span className="status-indicator status-warning" />
              <span className={cn("font-mono text-background", fullscreen ? "text-sm" : "text-xs")}>1 vehicle detected</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <CameraIcon className={cn("opacity-30", fullscreen ? "h-20 w-20" : "h-12 w-12")} />
          <span className={cn(fullscreen ? "text-lg" : "text-sm")}>Camera Offline</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="glass-card rounded-xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <CameraIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-foreground">{camera.name}</h3>
              <p className="text-xs text-muted-foreground">{camera.locationId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isOnline ? "success" : "destructive"}>
              <span className={cn(
                "status-indicator mr-1.5",
                isOnline ? "status-active" : "status-violation"
              )} />
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>

        <CameraContent />

        {/* Controls */}
        <div className="flex items-center justify-between p-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Next capture in 15:00
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-4xl w-[95vw] bg-card border-border p-0">
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CameraIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <DialogTitle>{camera.name}</DialogTitle>
                  <p className="text-xs text-muted-foreground">{camera.locationId}</p>
                </div>
              </div>
              <Badge variant={isOnline ? "success" : "destructive"}>
                <span className={cn(
                  "status-indicator mr-1.5",
                  isOnline ? "status-active" : "status-violation"
                )} />
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </DialogHeader>
          <CameraContent fullscreen />
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Last capture: {new Date(camera.lastCapture).toLocaleString()}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
