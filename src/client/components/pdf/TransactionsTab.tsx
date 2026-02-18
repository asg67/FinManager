import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { entitiesApi } from "../../api/entities.js";
import { accountsApi } from "../../api/accounts.js";
import { pdfApi, type BankTransaction, type TransactionFilters } from "../../api/pdf.js";
import { Select, Table } from "../ui/index.js";
import type { Entity, Account, PaginatedResponse } from "@shared/types.js";

export default function TransactionsTab() {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [data, setData] = useState<PaginatedResponse<BankTransaction>>({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entitiesApi.list().then(setEntities);
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      accountsApi.list(selectedEntity).then(setAccounts);
    } else {
      setAccounts([]);
    }
  }, [selectedEntity]);

  const loadData = useCallback(async (f: TransactionFilters) => {
    setLoading(true);
    try {
      const result = await pdfApi.listTransactions(f);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  function handlePage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function formatAmount(amount: string, direction: string) {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
    return direction === "income" ? `+${formatted}` : `-${formatted}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const columns = [
    {
      key: "date",
      header: t("dds.date"),
      render: (r: BankTransaction) => formatDate(r.date) + (r.time ? ` ${r.time}` : ""),
    },
    {
      key: "account",
      header: t("pdf.account"),
      render: (r: BankTransaction) => r.account.name,
    },
    {
      key: "amount",
      header: t("dds.amount"),
      className: "table-amount",
      render: (r: BankTransaction) => (
        <span className={`amount amount--${r.direction}`}>
          {formatAmount(r.amount, r.direction)}
        </span>
      ),
    },
    {
      key: "counterparty",
      header: t("pdf.counterparty"),
      render: (r: BankTransaction) => r.counterparty ?? "—",
    },
    {
      key: "purpose",
      header: t("pdf.purpose"),
      render: (r: BankTransaction) => r.purpose ?? "—",
    },
    {
      key: "balance",
      header: t("pdf.balance"),
      render: (r: BankTransaction) =>
        r.balance ? parseFloat(r.balance).toLocaleString("ru-RU", { minimumFractionDigits: 2 }) : "—",
    },
  ];

  return (
    <div>
      <div className="dds-filters">
        <Select
          options={[{ value: "", label: t("dds.allEntities") }, ...entities.map((e) => ({ value: e.id, label: e.name }))]}
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
        />
        {accounts.length > 0 && (
          <Select
            options={[{ value: "", label: t("dds.allAccounts") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
            value={filters.accountId ?? ""}
            onChange={(e) => handleFilterChange("accountId", e.target.value)}
          />
        )}
        <Select
          options={[
            { value: "", label: t("pdf.allDirections") },
            { value: "income", label: t("dds.income") },
            { value: "expense", label: t("dds.expense") },
          ]}
          value={filters.direction ?? ""}
          onChange={(e) => handleFilterChange("direction", e.target.value)}
        />
      </div>

      {loading ? (
        <div className="tab-loading">{t("common.loading")}</div>
      ) : (
        <>
          <Table
            columns={columns}
            data={data.data}
            rowKey={(r) => r.id}
            emptyMessage={t("pdf.noTransactions")}
          />

          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="pagination__btn"
                disabled={data.page <= 1}
                onClick={() => handlePage(data.page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination__info">
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                className="pagination__btn"
                disabled={data.page >= data.totalPages}
                onClick={() => handlePage(data.page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
