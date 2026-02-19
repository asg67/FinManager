export interface BankAccount {
  accountNumber: string;
  name: string;
  bic?: string;
  bankAccountId?: string; // internal ID used by some banks (e.g. Modulbank)
}

export interface BankTransactionRaw {
  date: string;          // "YYYY-MM-DD"
  time: string | null;
  amount: string;        // absolute value, e.g. "15000.50"
  direction: "income" | "expense";
  counterparty: string | null;
  purpose: string | null;
  balance: string | null;
}

export interface BankAdapter {
  testConnection(token: string): Promise<boolean>;
  fetchAccounts(token: string): Promise<BankAccount[]>;
  fetchTransactions(
    token: string,
    account: BankAccount,
    from: Date,
    to: Date,
  ): Promise<BankTransactionRaw[]>;
}
