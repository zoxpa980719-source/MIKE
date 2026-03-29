"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CreditCard, Package, ReceiptText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OrderRecord = {
  orderId: string;
  orderNumber?: string | null;
  userEmail?: string | null;
  planName?: string | null;
  planId?: string | null;
  frequency?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  stripeSessionId?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
};

const copy = {
  zh: {
    back: "返回仪表盘",
    title: "我的订单",
    subtitle: "查看你在登录状态下的购买记录与支付状态",
    empty: "暂无订单",
    emptyDesc: "你完成购买后，订单会显示在这里。",
    plan: "套餐",
    frequency: "周期",
    amount: "金额",
    createdAt: "下单时间",
    status: "状态",
    session: "会话号",
    loading: "正在加载订单...",
    failed: "订单加载失败",
    retry: "重试",
    monthly: "月付",
    yearly: "年付",
    paid: "已支付",
    viewDetails: "查看详情",
    detailsTitle: "订单详情",
    detailsDesc: "以下是本次购买的完整信息。",
    close: "关闭",
    orderId: "订单号",
    downloadInvoice: "下载发票 (PDF)",
    invoiceTitle: "YINHNG 发票",
  },
  en: {
    back: "Back to Dashboard",
    title: "My Orders",
    subtitle: "View purchases and payment status made while signed in",
    empty: "No orders yet",
    emptyDesc: "Your completed purchases will appear here.",
    plan: "Plan",
    frequency: "Billing",
    amount: "Amount",
    createdAt: "Created",
    status: "Status",
    session: "Session",
    loading: "Loading orders...",
    failed: "Failed to load orders",
    retry: "Retry",
    monthly: "Monthly",
    yearly: "Yearly",
    paid: "Paid",
    viewDetails: "View Details",
    detailsTitle: "Order Details",
    detailsDesc: "Full purchase info for this order.",
    close: "Close",
    orderId: "Order ID",
    downloadInvoice: "Download Invoice (PDF)",
    invoiceTitle: "YINHNG Invoice",
  },
} as const;

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

export default function OrdersPage() {
  const { locale } = useLanguage();
  const { role } = useAuth();
  const t = copy[locale];

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  const dashboardHref = useMemo(() => {
    if (role === "employer") return "/employer/dashboard";
    if (role === "admin") return "/admin";
    return "/dashboard";
  }, [role]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/orders");
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

  useEffect(() => {
    loadOrders();
  }, []);

  const handleDownloadInvoice = async () => {
    if (!selectedOrder) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const invoiceId = selectedOrder.orderNumber || selectedOrder.orderId;
    const created = selectedOrder.createdAt
      ? new Date(selectedOrder.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
      : "-";
    const billing =
      selectedOrder.frequency === "yearly"
        ? t.yearly
        : selectedOrder.frequency === "monthly"
          ? t.monthly
          : selectedOrder.frequency || "-";
    const status = selectedOrder.paymentStatus || selectedOrder.status || "-";
    const amount = formatMoney(selectedOrder.amountTotal, selectedOrder.currency);
    const plan = selectedOrder.planName || selectedOrder.planId || "-";
    const customerEmail = selectedOrder.userEmail || "-";

    doc.setFontSize(20);
    doc.text(t.invoiceTitle, 14, 20);
    doc.setFontSize(11);
    doc.text(`Invoice #: ${invoiceId}`, 14, 32);
    doc.text(`Date: ${created}`, 14, 39);
    doc.text(`Status: ${status}`, 14, 46);

    doc.setFontSize(13);
    doc.text("Customer", 14, 60);
    doc.setFontSize(11);
    doc.text(customerEmail, 14, 68);

    doc.setFontSize(13);
    doc.text("Order Summary", 14, 84);
    doc.setFontSize(11);
    doc.text(`Plan: ${plan}`, 14, 92);
    doc.text(`Billing: ${billing}`, 14, 99);
    doc.text(`Total Paid: ${amount}`, 14, 106);
    doc.text(`Stripe Session: ${selectedOrder.stripeSessionId || "-"}`, 14, 113);
    doc.text("Issued by YINHNG. Generated electronically.", 14, 130);

    doc.save(`invoice-${invoiceId}.pdf`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href={dashboardHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t.loading}</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-destructive">{t.failed}: {error}</p>
            <Button onClick={loadOrders} variant="outline">
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-12 text-center">
            <p className="text-lg font-semibold">{t.empty}</p>
            <p className="text-sm text-muted-foreground">{t.emptyDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => {
            const createdLabel = order.createdAt
              ? new Date(order.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
              : "-";
            const frequencyLabel =
              order.frequency === "yearly"
                ? t.yearly
                : order.frequency === "monthly"
                  ? t.monthly
                  : order.frequency || "-";
            const statusLabel =
              order.paymentStatus === "paid" || order.status === "paid"
                ? t.paid
                : order.paymentStatus || order.status || "-";

            return (
              <Card key={order.orderId} className="rounded-3xl">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{order.planName || order.planId || "-"}</CardTitle>
                    <Badge variant="secondary">{statusLabel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{order.orderNumber || order.orderId}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.plan}:</span>
                    <span>{order.planName || order.planId || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.frequency}:</span>
                    <span>{frequencyLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.amount}:</span>
                    <span>{formatMoney(order.amountTotal, order.currency)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.createdAt}:</span>
                    <span>{createdLabel}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                    {t.viewDetails}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t.detailsTitle}</DialogTitle>
            <DialogDescription>{t.detailsDesc}</DialogDescription>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.orderId}</span>
                <span className="break-all">{selectedOrder.orderNumber || selectedOrder.orderId}</span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.plan}</span>
                <span>{selectedOrder.planName || selectedOrder.planId || "-"}</span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.frequency}</span>
                <span>
                  {selectedOrder.frequency === "yearly"
                    ? t.yearly
                    : selectedOrder.frequency === "monthly"
                      ? t.monthly
                      : selectedOrder.frequency || "-"}
                </span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.amount}</span>
                <span>{formatMoney(selectedOrder.amountTotal, selectedOrder.currency)}</span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.status}</span>
                <span>{selectedOrder.paymentStatus || selectedOrder.status || "-"}</span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.createdAt}</span>
                <span>
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
                    : "-"}
                </span>
              </div>
              <div className="grid grid-cols-[84px_1fr] gap-2">
                <span className="text-muted-foreground">{t.session}</span>
                <span className="break-all">{selectedOrder.stripeSessionId || "-"}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={handleDownloadInvoice}>{t.downloadInvoice}</Button>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

