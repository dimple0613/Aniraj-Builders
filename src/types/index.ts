/**
 * Core type definitions for the multi-company system
 * Enterprise-grade TypeScript interfaces with proper null safety and documentation
 */

// ==================== Base Types ====================

export type ID = string;
export type Timestamp = Date;

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CompanyEntity extends BaseEntity {
  company_id: ID;
}

// ==================== User & Auth Types ====================

export type UserRole = 'SuperAdmin' | 'Admin' | 'Accountant' | 'DataEntry' | 'Supervisor';

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  company_id: ID | null;
  password: string; // Only in database context
  avatar_url?: string | null;
  last_login?: Timestamp | null;
  is_active: boolean;
  email_verified: boolean;
}

// Omit sensitive fields for client-side usage
export type SafeUser = Omit<User, 'password'>;

export interface AuthUser extends SafeUser {
  // Additional auth-specific fields
}

export interface SessionUser {
  id: ID;
  email: string;
  name: string;
  role: UserRole;
  company_id: ID | null;
}

// ==================== Company Types ====================

export type CompanyPlan = 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM';
export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface Company extends BaseEntity {
  company_name: string;
  slug: string;
  subdomain?: string | null;
  custom_domain?: string | null;
  logo?: string | null;
  plan: CompanyPlan;
  status: CompanyStatus;
  max_users?: number | null;
  settings?: Record<string, any> | null;
  // Basic Info
  address?: string | null;
  gstin_uin?: string | null;
  state_name?: string | null;
  state_code?: string | null;
  contact?: string | null;
  hsn_sac?: string | null;
  // Buyer (Bill To)
  bill_to?: string | null;
  buyer_name?: string | null;
  buyer_address?: string | null;
  buyer_gstin_uin?: string | null;
  buyer_state_name?: string | null;
  buyer_state_code?: string | null;
  // Tax Rates
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  income_tax_rate?: number | null;
  labour_cess_rate?: number | null;
  cgst_tds_rate?: number | null;
  sgst_tds_rate?: number | null;
  additional_deposit?: number | null;
  // Bank Details
  bank_name?: string | null;
  branch_ifsc?: string | null;
  swift_code?: string | null;
  account_no?: string | null;
  // Module Access
  module_access?: string[] | null;
}

export interface CompanyWithStats extends Company {
  _count: {
    users: number;
    projects: number;
  };
}

// ==================== Master Data Types ====================

export interface Item extends CompanyEntity {
  name: string;
  description?: string | null;
  category?: string | null;
  unit_id?: ID | null;
  rate?: number | null;
  code?: string | null;
  is_active: boolean;
}

export interface Zone extends CompanyEntity {
  name: string;
  code?: string | null;
  count?: number | null;
  amount?: number | null;
  description?: string | null;
  is_active: boolean;
}

export interface Unit extends CompanyEntity {
  name: string;
  abbreviation: string;
  description?: string | null;
  is_active: boolean;
}

export interface AY extends CompanyEntity {
  name: string;
  year: number;
  start_date: Date;
  end_date: Date;
  is_current: boolean;
  is_active: boolean;
}

// ==================== Form Types ====================

export interface CreateCompanyRequest {
  company_name: string;
  slug: string;
  plan?: CompanyPlan;
  subdomain?: string;
  customDomain?: string;
  logo?: string;
}

export interface UpdateCompanyRequest extends Partial<CreateCompanyRequest> {
  status?: CompanyStatus;
  max_users?: number;
  settings?: Record<string, any>;
}

export interface CreateItemRequest {
  name: string;
  description?: string;
  category?: string;
  unit_id?: ID;
  rate?: number;
  code?: string;
}

export interface UpdateItemRequest extends Partial<CreateItemRequest> {
  is_active?: boolean;
}

export interface CreateZoneRequest {
  name: string;
  code?: string;
  count?: number;
  amount?: number;
  description?: string;
}

export interface UpdateZoneRequest extends Partial<CreateZoneRequest> {
  is_active?: boolean;
}

export interface CreateUnitRequest {
  name: string;
  abbreviation: string;
  description?: string;
}

export interface UpdateUnitRequest extends Partial<CreateUnitRequest> {
  is_active?: boolean;
}

export interface CreateAYRequest {
  name: string;
  year: number;
  start_date: Date;
  end_date: Date;
  is_current?: boolean;
}

export interface UpdateAYRequest extends Partial<CreateAYRequest> {
  is_active?: boolean;
}

// ==================== API Request/Response Types ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationResponse;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationResponse;
}

// ==================== Filter and Search Types ====================

export interface SearchFilters {
  search?: string;
  status?: string;
  category?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ColumnSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface TableState<T = any> {
  data: T[];
  loading: boolean;
  pagination: PaginationResponse;
  filters: SearchFilters;
  sort: ColumnSort | null;
}

// ==================== Component Props Types ====================

export interface CrudActions<T = any> {
  onCreate?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}

// ==================== Context Types ====================

export interface CompanyStore {
  company_id: string;
  zone_id?: string | null;
  isSuperAdmin: boolean;
}

export interface CompanyContextState {
  currentCompany: Company | null;
  companies: Company[];
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export interface CompanyContextActions {
  setCurrentCompany: (company: Company | null) => void;
  switchCompany: (companyId: ID) => void;
  fetchCompanies: () => Promise<void>;
  refreshCurrentCompany: () => Promise<void>;
}

export interface CompanyContextType extends CompanyContextState, CompanyContextActions {}

// ==================== Validation Types ====================

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface FormState<T = any> {
  values: T;
  errors: ValidationErrors;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ==================== Utility Types ====================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// For create operations - generate required fields based on entity
export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'company_id'> & {
  company_id?: ID;
};

// For update operations - all fields optional
export type UpdateEntity<T> = Partial<CreateEntity<T>>;

// ==================== Export All ====================