import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Violation } from '@/types/parking';
import { cn } from '@/lib/utils';

interface WarningTimerProps {
  violation: Violation;
  onCancel?: (id: string) => void;
  onIssueTicket?: (id: string) => void;
}

export function WarningTimer({ violation, onCancel, onIssueTicket }: WarningTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!violation.warningExpiresAt) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expires = new Date(violation.warningExpiresAt!).getTime();
      return Math.max(0, Math.floor((expires - now) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [violation.warningExpiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = timeLeft === 0;
  const isUrgent = timeLeft > 0 && timeLeft <= 300; // 5 minutes

  return (
    <div className={cn(
      "glass-card rounded-xl p-4 border-l-4 animate-slide-up",
      isExpired ? "border-l-destructive" : isUrgent ? "border-l-warning" : "border-l-primary"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn(
            "rounded-lg p-2",
            isExpired ? "bg-destructive/10" : isUrgent ? "bg-warning/10" : "bg-primary/10"
          )}>
            <AlertTriangle className={cn(
              "h-5 w-5",
              isExpired ? "text-destructive" : isUrgent ? "text-warning" : "text-primary"
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground">{violation.plateNumber}</span>
              <Badge variant={isExpired ? "destructive" : isUrgent ? "warning" : "secondary"}>
                {violation.cameraLocationId}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Detected at {new Date(violation.timeDetected).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={cn(
              "font-mono text-xl font-bold",
              isExpired ? "text-destructive" : isUrgent ? "text-warning animate-pulse" : "text-foreground"
            )}>
              {isExpired ? "EXPIRED" : formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onCancel?.(violation.id)}
              className="text-muted-foreground hover:text-success"
            >
              <Check className="h-4 w-4 mr-1" />
              Clear
            </Button>
            {isExpired && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => onIssueTicket?.(violation.id)}
              >
                <X className="h-4 w-4 mr-1" />
                Issue Ticket
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
