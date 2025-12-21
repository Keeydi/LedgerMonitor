import { Camera as CameraIcon, RefreshCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera } from '@/types/parking';
import { cn } from '@/lib/utils';

interface CameraFeedProps {
  camera: Camera;
  onRefresh?: () => void;
}

export function CameraFeed({ camera, onRefresh }: CameraFeedProps) {
  const isOnline = camera.status === 'online';

  return (
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

      {/* Camera Feed Placeholder */}
      <div className="relative aspect-video bg-secondary flex items-center justify-center">
        {isOnline ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
              <CameraIcon className="h-12 w-12 opacity-30" />
              <span className="text-sm">Live Feed</span>
              <span className="text-xs font-mono">
                Last capture: {new Date(camera.lastCapture).toLocaleTimeString()}
              </span>
            </div>
            {/* Simulated detection overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
                <span className="status-indicator status-warning" />
                <span className="text-xs font-mono text-foreground">1 vehicle detected</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <CameraIcon className="h-12 w-12 opacity-30" />
            <span className="text-sm">Camera Offline</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-t border-border">
        <span className="text-xs text-muted-foreground">
          Next capture in 15:00
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
