import { useState } from 'react';
import { Plus, Camera as CameraIcon } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { CameraFeed } from '@/components/dashboard/CameraFeed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera } from '@/types/parking';
import { toast } from '@/hooks/use-toast';

export default function Cameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    locationId: '',
    status: 'online' as 'online' | 'offline',
  });

  const onlineCameras = cameras.filter(c => c.status === 'online');

  const handleAddCamera = () => {
    if (!newCamera.name.trim() || !newCamera.locationId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const camera: Camera = {
      id: `CAM-${String(cameras.length + 1).padStart(3, '0')}`,
      name: newCamera.name.trim(),
      locationId: newCamera.locationId.trim().toUpperCase(),
      status: newCamera.status,
      lastCapture: new Date(),
    };

    setCameras([...cameras, camera]);
    setNewCamera({ name: '', locationId: '', status: 'online' });
    setIsDialogOpen(false);
    toast({
      title: "Camera Added",
      description: `${camera.name} has been added successfully`,
    });
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Camera Monitoring" 
        subtitle="Live feeds from all surveillance points"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header with Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Badge variant="success" className="px-3 py-1.5 sm:px-4 sm:py-2">
              {onlineCameras.length} Online
            </Badge>
            <Badge variant="destructive" className="px-3 py-1.5 sm:px-4 sm:py-2">
              {cameras.length - onlineCameras.length} Offline
            </Badge>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Camera
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Camera</DialogTitle>
                <DialogDescription>
                  Configure a new surveillance camera for the system
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Camera Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main Entrance"
                    value={newCamera.name}
                    onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="locationId">Zone / Location ID</Label>
                  <Input
                    id="locationId"
                    placeholder="e.g., ZONE-A"
                    value={newCamera.locationId}
                    onChange={(e) => setNewCamera({ ...newCamera, locationId: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select
                    value={newCamera.status}
                    onValueChange={(value: 'online' | 'offline') => 
                      setNewCamera({ ...newCamera, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCamera}>
                  Add Camera
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Camera Grid */}
        {cameras.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cameras.map((camera) => (
              <CameraFeed key={camera.id} camera={camera} />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <CameraIcon className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Cameras Configured</h3>
            <p className="text-muted-foreground mb-6">
              Add your first surveillance camera to start monitoring
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Camera
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
