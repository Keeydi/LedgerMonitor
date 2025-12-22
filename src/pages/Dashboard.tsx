import { useState } from 'react';
import { Car, AlertTriangle, FileText, CheckCircle, Camera, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Vehicle, Camera as CameraType, Violation } from '@/types/parking';

export default function Dashboard() {
  const navigate = useNavigate();
  const [vehicles] = useState<Vehicle[]>([]);
  const [cameras] = useState<CameraType[]>([]);
  const [violations] = useState<Violation[]>([]);

  const activeWarnings = violations.filter(v => v.status === 'warning');
  const issuedTickets = violations.filter(v => v.status === 'issued');
  const clearedToday = violations.filter(v => v.status === 'cleared');

  const hasData = vehicles.length > 0 || cameras.length > 0 || violations.length > 0;

  return (
    <div className="min-h-screen">
      <Header 
        title="Dashboard" 
        subtitle="Monitor parking violations in real-time"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Registered Vehicles"
            value={vehicles.length}
            icon={Car}
          />
          <StatCard
            title="Active Warnings"
            value={activeWarnings.length}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Tickets Issued"
            value={issuedTickets.length}
            icon={FileText}
            variant="destructive"
          />
          <StatCard
            title="Cleared Today"
            value={clearedToday.length}
            icon={CheckCircle}
            variant="success"
          />
        </div>

        {!hasData ? (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <div className="max-w-md mx-auto">
              <Camera className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to ParkGuard</h3>
              <p className="text-muted-foreground mb-6">
                Get started by adding cameras and registering vehicles to begin monitoring parking violations
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/cameras')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Camera
                </Button>
                <Button variant="outline" onClick={() => navigate('/vehicles')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Active Warnings */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                Active Warnings
                <span className="ml-2 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs sm:text-sm">
                  {activeWarnings.length}
                </span>
              </h2>
              <div className="glass-card rounded-xl p-6 sm:p-8 text-center">
                <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-success mx-auto mb-3" />
                <p className="text-muted-foreground text-sm sm:text-base">No active warnings</p>
              </div>
            </div>

            {/* Camera Feed Placeholder */}
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Camera Feed</h2>
              <div className="glass-card rounded-xl p-6 text-center">
                <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-4">No cameras configured</p>
                <Button size="sm" onClick={() => navigate('/cameras')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Camera
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
