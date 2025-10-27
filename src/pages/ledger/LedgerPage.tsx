import { useMemo, useState } from "react";
import Card from "../../ui/components/Card";
import Button from "../../ui/components/Button";
import { useSpace } from "../../contexts/SpaceContext";
import { formatDateTime } from "../../utils/format";
import type { LedgerEntry } from "../../api/types";
import "../../ui/styles/pages/ledger.css";

const PAGE_SIZE = 6;

type Filter = "all" | "earn" | "spend";

function paginate(entries: LedgerEntry[], page: number, pageSize: number) {
  const start = page * pageSize;
  return entries.slice(start, start + pageSize);
}

export default function LedgerPage() {
  const { ledger } = useSpace();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (filter === "all") return ledger;
    return ledger.filter((entry) => entry.type === filter);
  }, [ledger, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const entries = paginate(filtered, currentPage, PAGE_SIZE);

  return (
    <div className="ledger">
      <header className="ledger__header">
        <div>
          <h1>Point ledger</h1>
          <p className="ledger__subtitle">Transparent record of all point earnings and spend.</p>
        </div>
      </header>

      <Card title="Filters" padding="md">
        <div className="ledger__filters" role="group" aria-label="Ledger filter">
          {(["all", "earn", "spend"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`ledger__chip ${filter === item ? "ledger__chip--active" : ""}`}
              onClick={() => {
                setFilter(item);
                setPage(0);
              }}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </Card>

      <Card title="History" padding="lg">
        {entries.length === 0 ? (
          <p className="ledger__empty">No ledger entries yet under this filter.</p>
        ) : (
          <div className="ledger__table-wrapper">
            <table className="ledger__table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>
                      <span className={`ledger__pill ledger__pill--${entry.type}`}>{entry.type}</span>
                    </td>
                    <td>{entry.type === "earn" ? "+" : "-"}{entry.amount} pts</td>
                    <td>{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="ledger__pagination" aria-label="Pagination">
          <Button
            variant="ghost"
            disabled={currentPage === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Previous
          </Button>
          <span className="ledger__page-indicator">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
          >
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
