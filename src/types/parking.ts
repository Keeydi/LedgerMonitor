export interface Vehicle {
  id: string;
  plateNumber: string;
  ownerName: string;
  contactNumber: string;
  registeredAt: Date;
}

export interface Camera {
  id: string;
  locationId: string;
  name: string;
  status: 'online' | 'offline';
  lastCapture: Date;
}

export interface Detection {
  id: string;
  cameraId: string;
  plateNumber: string;
  timestamp: Date;
  confidence: number;
  imageUrl?: string;
}

export interface Violation {
  id: string;
  ticketId: string;
  plateNumber: string;
  cameraLocationId: string;
  timeDetected: Date;
  timeIssued?: Date;
  status: 'warning' | 'pending' | 'issued' | 'cancelled' | 'cleared';
  warningExpiresAt?: Date;
}

export type ViolationStatus = Violation['status'];
