import { useState } from "react";
import type { PraxisPlan } from "@/lib/praxis-types";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ReviewControls } from "./ReviewControls";

export function MaterialsTable({ materials, reviewMode }: { materials: PraxisPlan["materials"]; reviewMode: boolean }) {
  const [q, setQ] = useState("");
  const filtered = materials.filter((m) =>
    [m.name, m.category, m.supplier, m.catalog].some((v) => v.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search materials, suppliers, catalog #..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated/50 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Catalog #</th>
              <th className="text-right px-4 py-3 font-medium">Qty</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((m, i) => (
              <tr key={i} className="hover:bg-surface-elevated/30 transition">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-surface">{m.category}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.supplier}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{m.catalog}</td>
                <td className="px-4 py-3 text-right font-mono">{m.quantity} {m.unit}</td>
                <td className="px-4 py-3 text-right font-mono">${m.cost.toFixed(2)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs italic text-muted-foreground">
        Catalog numbers are AI-estimated. Verify before ordering.
      </p>
      {reviewMode && <ReviewControls sectionKey="materials" />}
    </div>
  );
}
