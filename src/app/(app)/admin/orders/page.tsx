"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Receipt,
  RefreshCw,
  Search,
} from "lucide-react";

type AdminOrderRecord = {
  orderId: string;
  orderNumber?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  customerName?: string | null;
  planId?: string | null;
  planName?: string | null;
  frequency?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  stripeSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
  confirmationEmailSentAt?: string | null;
  receiptEmailSentAt?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
  updatedAt?: string | null;
};

type ResendType = "confirmation" | "receipt";

function formatMoney(amountTotal?: number | null, currency?: string | null) {
  if (typeof amountTotal !== "number") return "-";
  const value = amountTotal / 100;
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN");
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { locale } = useLanguage();

  const t = locale === "zh"
    ? {
        back: "返回管理后台",
        title: "客户订单总览",
        subtitle: "查看全部客户订单、金额、收据链接和邮件发送状态",
        exportCsv: "导出 CSV",
        refresh: "刷新",
        cardsTotal: "筛选后订单数",
        cardsPaid: "已支付",
        cardsCustomers: "客户数",
        cardsRevenue: "筛选后收入",
        searchPlaceholder: "搜索邮箱 / 订单号 / 套餐 / Session ID",
        allStatus: "全部状态",
        paidStatus: "已支付",
        openStatus: "未完成",
        count: "共",
        countUnit: "条",
        loadFailed: "加载失败",
        noOrders: "暂无符合条件的订单",
        orderNo: "订单号",
        customer: "客户",
        orderTime: "下单时间",
        packageAmount: "套餐 / 金额",
        confirmSent: "确认已发送",
        receiptSent: "收据已发送",
        resendConfirm: "重发确认",
        resendReceipt: "重发收据",
        receipt: "收据",
        pdf: "PDF",
        resentConfirmOk: "确认邮件已重发",
        resentReceiptOk: "收据邮件已重发",
      }
    : {
        back: "Back to Admin",
        title: "Customer Orders Overview",
        subtitle: "View all customer orders, amount, receipt links, and email delivery status",
        exportCsv: "Export CSV",
        refresh: "Refresh",
        cardsTotal: "Filtered Orders",
        cardsPaid: "Paid",
        cardsCustomers: "Customers",
        cardsRevenue: "Filtered Revenue",
        searchPlaceholder: "Search email / order / package / session ID",
        allStatus: "All Status",
        paidStatus: "Paid",
        openStatus: "Open",
        count: "Total",
        countUnit: "",
        loadFailed: "Load failed",
        noOrders: "No matching orders",
        orderNo: "Order",
        customer: "Customer",
        orderTime: "Order Time",
        packageAmount: "Package / Amount",
        confirmSent: "Confirm Sent",
        receiptSent: "Receipt Sent",
        resendConfirm: "Resend Confirm",
        resendReceipt: "Resend Receipt",
        receipt: "Receipt",
        pdf: "PDF",
        resentConfirmOk: "Confirmation email resent.",
        resentReceiptOk: "Receipt email resent.",
      };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "open">("all");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
  });
  const [toDate, setToDate] = useState(() => toDateInputValue(new Date()));
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (userProfile?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    void loadOrders();
  }, [authLoading, user, userProfile, router]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/orders");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch orders");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

    return orders.filter((order) => {
      const rawStatus = (order.paymentStatus || order.status || "").toLowerCase();
      const normalizedStatus = rawStatus === "paid" ? "paid" : "open";
      if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false;

      const createdMs = order.createdAtMs ?? Date.parse(order.createdAt || "");
      if (Number.isFinite(createdMs) && (createdMs < fromMs || createdMs > toMs)) return false;

      if (!q) return true;
      const haystack = [
        order.orderNumber,
        order.orderId,
        order.userEmail,
        order.customerName,
        order.planName,
        order.planId,
        order.stripeSessionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, query, statusFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const paidOrders = filteredOrders.filter((o) => (o.paymentStatus || o.status) === "paid");
    const totalRevenueCents = paidOrders.reduce((sum, o) => sum + (o.amountTotal || 0), 0);
    return {
      totalOrders: filteredOrders.length,
      paidOrders: paidOrders.length,
      totalRevenueCents,
      customers: new Set(filteredOrders.map((o) => o.userEmail).filter(Boolean)).size,
    };
  }, [filteredOrders]);

  const downloadCsv = () => {
    const header = [
      "orderId",
      "orderNumber",
      "customerName",
      "userEmail",
      "planName",
      "amount",
      "currency",
      "status",
      "createdAt",
      "confirmationEmailSentAt",
      "receiptEmailSentAt",
      "stripeSessionId",
      "stripeReceiptUrl",
      "stripeInvoiceUrl",
      "stripeInvoicePdfUrl",
    ];
    const rows = filteredOrders.map((o) => [
      o.orderId,
      o.orderNumber || "",
      o.customerName || "",
      o.userEmail || "",
      o.planName || o.planId || "",
      typeof o.amountTotal === "number" ? (o.amountTotal / 100).toFixed(2) : "",
      (o.currency || "usd").toUpperCase(),
      o.paymentStatus || o.status || "",
      o.createdAt || "",
      o.confirmationEmailSentAt || "",
      o.receiptEmailSentAt || "",
      o.stripeSessionId || "",
      o.stripeReceiptUrl || "",
      o.stripeInvoiceUrl || "",
      o.stripeInvoicePdfUrl || "",
    ]);

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resendEmail = async (orderId: string, type: ResendType) => {
    setResendingOrderId(orderId);
    try {
      const response = await fetch("/api/admin/orders/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Resend failed");
      }
      await loadOrders();
      alert(type === "confirmation" ? t.resentConfirmOk : t.resentReceiptOk);
    } catch (err: any) {
      alert(err?.message || "Failed to resend email.");
    } finally {
      setResendingOrderId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadCsv} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t.exportCsv}
          </Button>
          <Button onClick={loadOrders} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.refresh}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t.cardsTotal}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.totalOrders}</CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t.cardsPaid}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.paidOrders}</CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t.cardsCustomers}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.customers}</CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t.cardsRevenue}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatMoney(stats.totalRevenueCents, "usd")}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="pl-9"
              />
            </div>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "paid" | "open")}
              className="h-10 rounded-full border border-input bg-background px-4 text-sm"
            >
              <option value="all">{t.allStatus}</option>
              <option value="paid">{t.paidStatus}</option>
              <option value="open">{t.openStatus}</option>
            </select>
            <div className="text-sm text-muted-foreground flex items-center px-2">
              {t.count} {filteredOrders.length} {t.countUnit}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="rounded-3xl">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-destructive">{t.loadFailed}: {error}</p>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-10 text-center text-muted-foreground">
            {t.noOrders}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isPaid = (order.paymentStatus || order.status) === "paid";
            const isResending = resendingOrderId === order.orderId;
            return (
              <Card key={order.orderId} className="rounded-3xl border-border/60">
                <CardContent className="pt-6">
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_1.3fr_1fr_1.1fr]">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t.orderNo}</p>
                      <p className="font-semibold">{order.orderNumber || order.orderId}</p>
                      <p className="text-xs text-muted-foreground break-all">
                        Session: {order.stripeSessionId || "-"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t.customer}</p>
                      <p className="font-medium">{order.customerName || order.userEmail || "-"}</p>
                      <p className="text-xs text-muted-foreground break-all">{order.userEmail || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.orderTime}: {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t.packageAmount}</p>
                      <p className="font-medium">{order.planName || order.planId || "-"}</p>
                      <p className="text-lg font-bold">{formatMoney(order.amountTotal, order.currency)}</p>
                      <div className="flex gap-2">
                        <Badge variant={isPaid ? "default" : "secondary"}>
                          {isPaid ? t.paidStatus : order.paymentStatus || order.status || t.openStatus}
                        </Badge>
                        {order.confirmationEmailSentAt ? (
                          <Badge variant="outline" className="gap-1">
                            <Mail className="h-3 w-3" />
                            {t.confirmSent}
                          </Badge>
                        ) : null}
                        {order.receiptEmailSentAt ? (
                          <Badge variant="outline" className="gap-1">
                            <Receipt className="h-3 w-3" />
                            {t.receiptSent}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:items-end">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResending}
                          onClick={() => resendEmail(order.orderId, "confirmation")}
                        >
                          {t.resendConfirm}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResending}
                          onClick={() => resendEmail(order.orderId, "receipt")}
                        >
                          {t.resendReceipt}
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        {order.stripeReceiptUrl ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={order.stripeReceiptUrl} target="_blank" rel="noopener noreferrer">
                              {t.receipt} <ExternalLink className="ml-1 h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                        {order.stripeInvoicePdfUrl ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={order.stripeInvoicePdfUrl} target="_blank" rel="noopener noreferrer">
                              {t.pdf} <ExternalLink className="ml-1 h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
