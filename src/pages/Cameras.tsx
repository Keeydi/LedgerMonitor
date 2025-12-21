import { Header } from '@/components/layout/Header';
import { CameraFeed } from '@/components/dashboard/CameraFeed';
import { mockCameras } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

export default function Cameras() {
  const onlineCameras = mockCameras.filter(c => c.status === 'online');

  return (
    <div className="min-h-screen">
      <Header 
        title="Camera Monitoring" 
        subtitle="Live feeds from all surveillance points"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Status Summary */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Badge variant="success" className="px-3 py-1.5 sm:px-4 sm:py-2">
            {onlineCameras.length} Online
          </Badge>
          <Badge variant="destructive" className="px-3 py-1.5 sm:px-4 sm:py-2">
            {mockCameras.length - onlineCameras.length} Offline
          </Badge>
        </div>

        {/* Camera Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {mockCameras.map((camera) => (
            <CameraFeed key={camera.id} camera={camera} />
          ))}
        </div>
      </div>
    </div>
  );
}
