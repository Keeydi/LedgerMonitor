import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Phone } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockVehicles } from '@/data/mockData';
import { Vehicle } from '@/types/parking';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plateNumber: '',
    ownerName: '',
    contactNumber: '',
  });

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddVehicle = () => {
    if (!newVehicle.plateNumber || !newVehicle.ownerName || !newVehicle.contactNumber) return;
    
    const vehicle: Vehicle = {
      id: Date.now().toString(),
      ...newVehicle,
      registeredAt: new Date(),
    };
    setVehicles([...vehicles, vehicle]);
    setNewVehicle({ plateNumber: '', ownerName: '', contactNumber: '' });
    setIsDialogOpen(false);
  };

  const handleDeleteVehicle = (id: string) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Vehicle Registry" 
        subtitle="Manage registered vehicles"
      />

      <div className="p-6 space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by plate or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-secondary"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Register New Vehicle</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plateNumber">Plate Number</Label>
                  <Input
                    id="plateNumber"
                    placeholder="ABC 1234"
                    value={newVehicle.plateNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, plateNumber: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Owner Name</Label>
                  <Input
                    id="ownerName"
                    placeholder="Juan dela Cruz"
                    value={newVehicle.ownerName}
                    onChange={(e) => setNewVehicle({ ...newVehicle, ownerName: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    placeholder="+639171234567"
                    value={newVehicle.contactNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, contactNumber: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <Button onClick={handleAddVehicle} className="w-full">
                  Register Vehicle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Plate Number</TableHead>
                <TableHead className="text-muted-foreground">Owner</TableHead>
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-muted-foreground">Registered</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.map((vehicle) => (
                <TableRow key={vehicle.id} className="border-border">
                  <TableCell className="font-mono font-medium">{vehicle.plateNumber}</TableCell>
                  <TableCell>{vehicle.ownerName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {vehicle.contactNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(vehicle.registeredAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
