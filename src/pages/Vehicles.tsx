import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Phone, Car } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from '@/hooks/use-toast';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    plateNumber: '',
    ownerName: '',
    contactNumber: '',
  });

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ plateNumber: '', ownerName: '', contactNumber: '' });
    setEditingVehicle(null);
  };

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plateNumber: vehicle.plateNumber,
        ownerName: vehicle.ownerName,
        contactNumber: vehicle.contactNumber,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSaveVehicle = () => {
    if (!formData.plateNumber || !formData.ownerName || !formData.contactNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (editingVehicle) {
      setVehicles(vehicles.map(v => 
        v.id === editingVehicle.id 
          ? { ...v, ...formData }
          : v
      ));
      toast({
        title: "Vehicle Updated",
        description: "Vehicle details updated successfully",
      });
    } else {
      const vehicle: Vehicle = {
        id: Date.now().toString(),
        ...formData,
        registeredAt: new Date(),
      };
      setVehicles([...vehicles, vehicle]);
      toast({
        title: "Vehicle Registered",
        description: "New vehicle registered successfully",
      });
    }
    handleCloseDialog();
  };

  const handleDeleteVehicle = (id: string) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
    toast({
      title: "Vehicle Deleted",
      description: "Vehicle removed from registry",
    });
  };

  return (
    <div className="min-h-screen">
      <Header 
        title="Vehicle Registry" 
        subtitle="Manage registered vehicles"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by plate or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-secondary"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? handleOpenDialog() : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border mx-4 sm:mx-auto max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Register New Vehicle'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plateNumber">Plate Number</Label>
                  <Input
                    id="plateNumber"
                    placeholder="ABC 1234"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Owner Name</Label>
                  <Input
                    id="ownerName"
                    placeholder="Juan dela Cruz"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    placeholder="+639171234567"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="bg-secondary"
                  />
                </div>
                <Button onClick={handleSaveVehicle} className="w-full">
                  {editingVehicle ? 'Save Changes' : 'Register Vehicle'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {vehicles.length > 0 ? (
          <>
            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="glass-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-lg">{vehicle.plateNumber}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(vehicle)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="text-destructive hover:text-destructive h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-foreground">{vehicle.ownerName}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {vehicle.contactNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Registered: {new Date(vehicle.registeredAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="glass-card rounded-xl overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
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
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(vehicle)}>
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
          </>
        ) : (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <Car className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Vehicles Registered</h3>
            <p className="text-muted-foreground mb-6">
              Add your first vehicle to the registry
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vehicle
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
