import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Car, 
  Camera, 
  AlertTriangle, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/vehicles', icon: Car, label: 'Vehicles' },
  { path: '/cameras', icon: Camera, label: 'Cameras' },
  { path: '/warnings', icon: AlertTriangle, label: 'Warnings' },
  { path: '/tickets', icon: FileText, label: 'Tickets' },
];

function NavContent({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex-1 space-y-1 p-3">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile sidebar using Sheet
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-card border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="font-semibold text-lg">ParkGuard</span>
            </div>
          </div>

          <NavContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Desktop sidebar
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 hidden lg:block",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                <span className="font-semibold text-lg">ParkGuard</span>
              </div>
            )}
            {collapsed && <Shield className="h-8 w-8 text-primary mx-auto" />}
          </div>

          <NavContent collapsed={collapsed} />

          {/* Collapse Toggle */}
          <div className="border-t border-border p-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
