import { Car, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { WarningTimer } from '@/components/dashboard/WarningTimer';
import { CameraFeed } from '@/components/dashboard/CameraFeed';
import { RecentTickets } from '@/components/dashboard/RecentTickets';
import { mockVehicles, mockCameras, mockViolations } from '@/data/mockData';

export default function Dashboard() {
  const activeWarnings = mockViolations.filter(v => v.status === 'warning');
  const issuedTickets = mockViolations.filter(v => v.status === 'issued');
  const clearedToday = mockViolations.filter(v => v.status === 'cleared');

  const handleCancelWarning = (id: string) => {
    console.log('Cancel warning:', id);
  };

  const handleIssueTicket = (id: string) => {
    console.log('Issue ticket:', id);
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Dashboard" 
        subtitle="Monitor parking violations in real-time"
      />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Registered Vehicles"
            value={mockVehicles.length}
            icon={Car}
            trend={{ value: 12, isPositive: true }}
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Warnings */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Active Warnings
              <span className="ml-2 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-sm">
                {activeWarnings.length}
              </span>
            </h2>
            {activeWarnings.length > 0 ? (
              <div className="space-y-3">
                {activeWarnings.map((violation) => (
                  <WarningTimer
                    key={violation.id}
                    violation={violation}
                    onCancel={handleCancelWarning}
                    onIssueTicket={handleIssueTicket}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <p className="text-muted-foreground">No active warnings</p>
              </div>
            )}
          </div>

          {/* Camera Feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Camera Feed</h2>
            <CameraFeed camera={mockCameras[0]} />
          </div>
        </div>

        {/* Recent Activity */}
        <RecentTickets violations={mockViolations} />
      </div>
    </div>
  );
}
