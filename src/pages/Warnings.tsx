import { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { WarningTimer } from '@/components/dashboard/WarningTimer';
import { Violation } from '@/types/parking';

export default function Warnings() {
  const [violations] = useState<Violation[]>([]);
  const activeWarnings = violations.filter(v => v.status === 'warning');

  const handleCancelWarning = (id: string) => {
    console.log('Cancel warning:', id);
  };

  const handleIssueTicket = (id: string) => {
    console.log('Issue ticket:', id);
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Active Warnings" 
        subtitle="Vehicles with pending violations"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {activeWarnings.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-sm sm:text-base">{activeWarnings.length} active warnings</span>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {activeWarnings.map((violation) => (
                <WarningTimer
                  key={violation.id}
                  violation={violation}
                  onCancel={handleCancelWarning}
                  onIssueTicket={handleIssueTicket}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-success mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">All Clear</h3>
            <p className="text-muted-foreground text-sm sm:text-base">No active parking warnings at this time</p>
          </div>
        )}
      </div>
    </div>
  );
}
