// Shared types between client and server

export interface Company {
  id: string;
  name: string;
  mode: "full" | "dds_only";
  onboardingDone: boolean;
  createdAt: string;
}

export interface OnboardingStatus {
  hasEntities: boolean;
  hasAccounts: boolean;
  hasExpenseTypes: boolean;
  done: boolean;
}

export interface InviteInfo {
  id: string;
  token: string;
  expiresAt: string;
  used: boolean;
  usedByName?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  language: string;
  theme: string;
  role: string;
  companyId: string | null;
  company: Company | null;
  disabledBanks: string[];
  avatar: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  language?: "ru" | "en";
  theme?: "dark" | "light";
}

export interface RegisterInvitePayload {
  email: string;
  password: string;
  name: string;
  token: string;
}

export interface ApiError {
  message: string;
  errors?: { field: string; message: string }[];
}

// === Entities ===

export interface Entity {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { accounts: number };
}

// === Accounts ===

export type AccountType = "checking" | "card" | "cash" | "deposit" | "wallet";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank: string | null;
  accountNumber: string | null;
  contractNumber: string | null;
  enabled: boolean;
  initialBalance: string | null;
  initialBalanceDate: string | null;
  entityId: string;
  createdAt: string;
}

// === Expense Types & Articles ===

export interface ExpenseArticle {
  id: string;
  name: string;
  expenseTypeId: string;
  sortOrder: number;
}

export interface ExpenseType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  createdAt: string;
  articles: ExpenseArticle[];
}

// === Income Types & Articles ===

export interface IncomeArticle {
  id: string;
  name: string;
  incomeTypeId: string;
  sortOrder: number;
}

export interface IncomeType {
  id: string;
  name: string;
  entityId: string;
  sortOrder: number;
  createdAt: string;
  articles: IncomeArticle[];
}

// === Custom Fields ===

export interface CustomField {
  id: string;
  companyId: string;
  name: string;
  fieldType: "select" | "text" | "number";
  options: string[] | null;
  showWhen: { operationType?: string; expenseTypeId?: string; expenseArticleId?: string } | null;
  required: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  customFieldId: string;
  ddsOperationId: string;
  value: string;
  customField: { name: string; fieldType: string };
}

// === DDS ===

export type OperationType = "income" | "expense" | "transfer";

export interface DdsOperation {
  id: string;
  operationType: OperationType;
  amount: string; // Decimal comes as string
  fromAccountId: string | null;
  fromAccount: { name: string; type: string } | null;
  toAccountId: string | null;
  toAccount: { name: string; type: string } | null;
  expenseTypeId: string | null;
  expenseType: { name: string } | null;
  expenseArticleId: string | null;
  expenseArticle: { name: string } | null;
  incomeTypeId: string | null;
  incomeType: { name: string } | null;
  incomeArticleId: string | null;
  incomeArticle: { name: string } | null;
  orderNumber: string | null;
  comment: string | null;
  entityId: string;
  entity: { name: string };
  userId: string;
  user: { name: string };
  customFieldValues?: CustomFieldValue[];
  linkedBankTxId?: string | null;
  createdAt: string;
}

export interface DdsTemplate {
  id: string;
  name: string;
  operationType: OperationType;
  entityId: string;
  entity?: { name: string };
  fromAccountId: string | null;
  toAccountId: string | null;
  expenseTypeId: string | null;
  expenseType?: { name: string } | null;
  expenseArticleId: string | null;
  expenseArticle?: { name: string } | null;
  incomeTypeId: string | null;
  incomeType?: { name: string } | null;
  incomeArticleId: string | null;
  incomeArticle?: { name: string } | null;
  userId: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// === Employees ===

export interface EmployeePermissions {
  dds: boolean;
  pdfUpload: boolean;
  analytics: boolean;
  export: boolean;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  permissions: EmployeePermissions | null;
  entities: { id: string; name: string }[];
}

export interface InviteEmployeePayload {
  email: string;
  password: string;
  name: string;
  entityIds: string[];
  permissions: EmployeePermissions;
}

export interface UpdateEmployeePayload {
  name?: string;
  entityIds?: string[];
  permissions?: EmployeePermissions;
}

// === Notifications ===

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// === Bank Connections ===

export type BankCode = "tbank" | "modulbank" | "tochka";

export interface BankConnection {
  id: string;
  entityId: string;
  bankCode: BankCode;
  label: string | null;
  tokenMasked: string; // last 4 chars only
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface BankRemoteAccount {
  accountNumber: string;
  name: string;
  bic?: string;
}

export interface SyncResult {
  accountsSynced: number;
  transactionsSaved: number;
  transactionsSkipped: number;
  errors: string[];
}
