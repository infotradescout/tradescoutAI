import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ExpenseEntry {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface ExpensesResponse {
  expenses: ExpenseEntry[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    pageCount: number;
  };
}

export default function FinancesExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [expenseProjectTitle, setExpenseProjectTitle] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseTotal, setExpenseTotal] = useState("");

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ["/api/accounting/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/expenses", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load expenses (${res.status})`);
      }
      return (await res.json()) as ExpensesResponse;
    },
  });

  const createExpense = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(expenseTotal || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid expense total greater than zero.");
      }
      const res = await fetch("/api/accounting/standalone-expense", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: expenseProjectTitle || "Manual expense",
          vendorName: expenseVendor || undefined,
          category: expenseCategory || undefined,
          notes: expenseNotes || undefined,
          total: numericTotal,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create expense (${res.status})`);
      }
      return (await res.json()) as { document: ExpenseEntry };
    },
    onSuccess: () => {
      toast({
        title: "Expense recorded",
        description: "This cost now rolls into your finances dashboard.",
      });
      setExpenseProjectTitle("");
      setExpenseVendor("");
      setExpenseCategory("");
      setExpenseNotes("");
      setExpenseTotal("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not record expense",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const expenses = data?.expenses ?? [];

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  useEffect(() => {
    document.title = "Expenses • Finances | TradeScout";
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Expenses</h1>
          <p className="text-sm text-slate-400">
            Track money going out so you can see true job profitability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
            onClick={() => navigate("/finances")}
          >
            Back to dashboard
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">Record an expense</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Log material, labor, and other costs tied to your jobs and business.
            </CardDescription>
          </div>
          <div className="text-[11px] text-slate-400">
            {expenses.length.toLocaleString()} recorded expense{expenses.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Project or job name"
                value={expenseProjectTitle}
                onChange={(e) => setExpenseProjectTitle(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-white text-sm"
              />
              <Input
                placeholder="Vendor (optional)"
                value={expenseVendor}
                onChange={(e) => setExpenseVendor(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-white text-sm"
              />
              <Input
                placeholder="Category (optional)"
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-white text-sm"
              />
              <Input
                placeholder="Total amount"
                value={expenseTotal}
                onChange={(e) => setExpenseTotal(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-white text-sm"
              />
            </div>
            <Input
              placeholder="Notes (what this expense was for)"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              className="bg-slate-900/60 border-slate-700 text-white text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => createExpense.mutate()}
                disabled={createExpense.isPending}
              >
                {createExpense.isPending ? "Recording..." : "Record expense"}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-[11px] text-slate-400 py-4">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Once you start recording expenses, you'll see a simple ledger here alongside your invoices.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="w-[20%] text-slate-400">Date</TableHead>
                    <TableHead className="w-[28%] text-slate-400">Project</TableHead>
                    <TableHead className="w-[22%] text-slate-400">Vendor</TableHead>
                    <TableHead className="w-[15%] text-slate-400">Category</TableHead>
                    <TableHead className="w-[15%] text-right text-slate-400">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp) => {
                    const payload = exp.payload || {};
                    const title: string = payload.projectTitle || `Expense ${exp.id.slice(0, 8)}`;
                    const vendor: string | null = payload.vendorName || null;
                    const category: string | null = payload.category || null;
                    const totalVal: number | null =
                      typeof payload.total === "number" ? payload.total : null;
                    const createdLabel = new Date(exp.created_at).toLocaleDateString();

                    return (
                      <TableRow
                        key={exp.id}
                        className="border-slate-800 hover:bg-slate-900/70"
                      >
                        <TableCell className="py-2 text-[11px] text-slate-200">
                          {createdLabel}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] text-slate-100 truncate max-w-[220px]">
                          {title}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] text-slate-200 truncate max-w-[180px]">
                          {vendor || "—"}
                        </TableCell>
                        <TableCell className="py-2 text-[11px] text-slate-200 truncate max-w-[160px]">
                          {category || "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-slate-100">
                          {totalVal !== null
                            ? formatCurrency(totalVal)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
