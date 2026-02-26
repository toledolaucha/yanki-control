export type Role = 'admin' | 'empleado';

export type ShiftPeriod = 'mañana' | 'tarde' | 'noche';

export type ContainerKey =
  | 'efectivo'
  | 'mercado_pago'
  | 'caja_chica'
  | 'caja_fuerte';

export type TransactionCategory =
  | 'venta'
  | 'proveedor'
  | 'sueldo'
  | 'retiro_chica'
  | 'deposito_chica'
  | 'retiro_fuerte'
  | 'deposito_fuerte'
  | 'otro_ingreso'
  | 'otro_egreso';

export type TransactionType = 'ingreso' | 'egreso' | 'transferencia';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // demo only – never do this in production
  role: Role;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  period: ShiftPeriod;
  openedBy: string; // user id
  openedAt: string; // ISO string
  cashStart: number;
  mpStart: number;
  status: 'open' | 'closed';
  closedAt?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  shiftId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  sourceContainer?: ContainerKey;
  destContainer?: ContainerKey;
  description: string;
  createdBy: string; // user id
  createdAt: string; // ISO string
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  categoryId: string | null;
  category?: Category | null;
  isActive: boolean;
}

export interface ProductBatch {
  id: string;
  productId: string;
  costPrice: number;
  initialQuantity: number;
  currentQuantity: number;
  provider?: string | null;
  createdAt: string;
}

export interface Container {
  key: ContainerKey;
  balance: number;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'transaction' | 'shift' | 'user' | 'container';
  entityId: string;
  before: object | null;
  after: object;
  timestamp: string;
}

export interface AppState {
  users: User[];
  shifts: Shift[];
  transactions: Transaction[];
  containers: Record<ContainerKey, number>;
  auditLogs: AuditLog[];
}
