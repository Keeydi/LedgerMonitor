import { useState } from 'react';
import { FileText, Filter, Download, Eye } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Violation } from '@/types/parking';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Tickets() {
  const [violations] = useState<Violation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredViolations = violations.filter((v) => {
    if (statusFilter === 'all') return true;
    return v.status === statusFilter;
  });

  const getStatusConfig = (status: Violation['status']) => {
    switch (status) {
      case 'warning':
        return { label: 'Warning', variant: 'warning' as const };
      case 'pending':
        return { label: 'Pending', variant: 'secondary' as const };
      case 'issued':
        return { label: 'Issued', variant: 'destructive' as const };
      case 'cancelled':
        return { label: 'Cancelled', variant: 'outline' as const };
      case 'cleared':
        return { label: 'Cleared', variant: 'success' as const };
      default:
        return { label: status, variant: 'secondary' as const };
    }
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Tickets" 
        subtitle="All parking violation records"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground hidden sm:inline">Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {violations.length > 0 ? (
          <>
            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {filteredViolations.map((violation) => {
                const statusConfig = getStatusConfig(violation.status);
                return (
                  <div key={violation.id} className="glass-card rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{violation.ticketId}</span>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="font-mono font-medium text-lg">{violation.plateNumber}</div>
                    <div className="text-sm text-muted-foreground">{violation.cameraLocationId}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Detected: {new Date(violation.timeDetected).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="glass-card rounded-xl overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Ticket ID</TableHead>
                      <TableHead className="text-muted-foreground">Plate Number</TableHead>
                      <TableHead className="text-muted-foreground">Location</TableHead>
                      <TableHead className="text-muted-foreground">Detected</TableHead>
                      <TableHead className="text-muted-foreground">Issued</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredViolations.map((violation) => {
                      const statusConfig = getStatusConfig(violation.status);
                      return (
                        <TableRow key={violation.id} className="border-border">
                          <TableCell className="font-mono text-sm">{violation.ticketId}</TableCell>
                          <TableCell className="font-mono font-medium">{violation.plateNumber}</TableCell>
                          <TableCell>{violation.cameraLocationId}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(violation.timeDetected).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {violation.timeIssued 
                              ? new Date(violation.timeIssued).toLocaleString() 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Tickets Yet</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              Violation tickets will appear here when they are issued
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
