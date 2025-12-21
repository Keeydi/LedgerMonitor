import { Vehicle, Camera, Violation } from '@/types/parking';

export const mockVehicles: Vehicle[] = [
  { id: '1', plateNumber: 'ABC 1234', ownerName: 'Juan dela Cruz', contactNumber: '+639171234567', registeredAt: new Date('2024-01-15') },
  { id: '2', plateNumber: 'XYZ 5678', ownerName: 'Maria Santos', contactNumber: '+639189876543', registeredAt: new Date('2024-02-20') },
  { id: '3', plateNumber: 'DEF 9012', ownerName: 'Pedro Reyes', contactNumber: '+639201112233', registeredAt: new Date('2024-03-10') },
  { id: '4', plateNumber: 'GHI 3456', ownerName: 'Ana Garcia', contactNumber: '+639154445566', registeredAt: new Date('2024-04-05') },
  { id: '5', plateNumber: 'JKL 7890', ownerName: 'Carlos Mendoza', contactNumber: '+639167778899', registeredAt: new Date('2024-05-12') },
];

export const mockCameras: Camera[] = [
  { id: 'CAM-001', locationId: 'ZONE-A', name: 'Main Entrance', status: 'online', lastCapture: new Date() },
  { id: 'CAM-002', locationId: 'ZONE-B', name: 'Side Gate', status: 'online', lastCapture: new Date() },
  { id: 'CAM-003', locationId: 'ZONE-C', name: 'Parking Lot', status: 'offline', lastCapture: new Date(Date.now() - 3600000) },
];

export const mockViolations: Violation[] = [
  {
    id: 'V001',
    ticketId: 'IP-2024-0001',
    plateNumber: 'ABC 1234',
    cameraLocationId: 'ZONE-A',
    timeDetected: new Date(Date.now() - 1800000),
    status: 'warning',
    warningExpiresAt: new Date(Date.now() + 600000),
  },
  {
    id: 'V002',
    ticketId: 'IP-2024-0002',
    plateNumber: 'XYZ 5678',
    cameraLocationId: 'ZONE-B',
    timeDetected: new Date(Date.now() - 3600000),
    timeIssued: new Date(Date.now() - 1800000),
    status: 'issued',
  },
  {
    id: 'V003',
    ticketId: 'IP-2024-0003',
    plateNumber: 'DEF 9012',
    cameraLocationId: 'ZONE-A',
    timeDetected: new Date(Date.now() - 7200000),
    status: 'cleared',
  },
  {
    id: 'V004',
    ticketId: 'IP-2024-0004',
    plateNumber: 'GHI 3456',
    cameraLocationId: 'ZONE-C',
    timeDetected: new Date(Date.now() - 900000),
    status: 'warning',
    warningExpiresAt: new Date(Date.now() + 900000),
  },
];
