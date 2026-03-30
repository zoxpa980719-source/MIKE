"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Users, Receipt, Mail, DollarSign, CheckCircle2, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { AdminEmailForm } from "./AdminEmailForm";

type OrderRecord = {
  orderId?: string;
  orderNumber?: string;
  userEmail?: string | null;
  customerName?: string | null;
  planName?: string | null;
  planId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  confirmationEmailSentAt?: string | null;
  receiptEmailSentAt?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
};

const copy = {
  zh: {
    title: "管理员控制面板",
    subtitle: "服务订单、客户和邮件发送总览",
    allOrders: "查看所有客户订单",
    customerMessages: "查看客户留言",
    cards: {
      users: "总用户数",
      customers: "付费客户",
      orders: "订单总数",
      paid: "已支付订单",
      revenue: "累计收入",
      emails: "收据已发送",
    },
    recent: "最近订单",
    noRecent: "暂无订单数据",
    orderNo: "订单号",
    customer: "客户",
    package: "套餐",
    amount: "金额",
    status: "状态",
    sent: "已发送",
    notSent: "未发送",
    paid: "已支付",
    open: "未完成",
  },
  en: {
    title: "Admin Dashboard",
    subtitle: "Overview of service orders, customers, and email delivery",
    allOrders: "View All Customer Orders",
    customerMessages: "View Customer Messages",
    cards: {
      users: "Total Users",
      customers: "Paying Customers",
      orders: "Total Orders",
      paid: "Paid Orders",
      revenue: "Total Revenue",
      emails: "Receipt Emails Sent",
    },
    recent: "Recent Orders",
    noRecent: "No order data yet",
    orderNo: "Order",
    customer: "Customer",
    package: "Package",
    amount: "Amount",
    status: "Status",
    sent: "Sent",
    notSent: "Not Sent",
    paid: "Paid",
    open: "Open",
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

export default function AdminDashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { locale } = useLanguage();
  const t = copy[locale];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

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
    void fetchData();
  }, [user, userProfile, authLoading, router]);

  const fetchData = async () => {
    try {
      const token = await user?.getIdToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [overviewRes, ordersRes] = await Promise.all([
        fetch("/api/admin/overview", { headers }),
        fetch("/api/admin/orders", { headers }),
      ]);

      const overview = await overviewRes.json();
      const ordersPayload = await ordersRes.json();

      if (!overviewRes.ok) {
        throw new Error(overview?.error || "Failed to fetch admin overview");
      }
      if (!ordersRes.ok) {
        throw new Error(ordersPayload?.error || "Failed to fetch admin orders");
      }

      setTotalUsers(typeof overview.totalUsers === "number" ? overview.totalUsers : 0);
      const list = Array.isArray(ordersPayload.orders)
        ? (ordersPayload.orders as OrderRecord[])
        : [];
      setOrders(list.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)));
    } catch (err) {
      console.error("admin dashboard fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const paid = orders.filter((o) => (o.paymentStatus || o.status) === "paid");
    const revenueCents = paid.reduce((sum, o) => sum + (o.amountTotal || 0), 0);
    const payingCustomers = new Set(paid.map((o) => o.userEmail).filter(Boolean)).size;
    const receiptSent = orders.filter((o) => Boolean(o.receiptEmailSentAt)).length;
    return {
      totalOrders: orders.length,
      paidOrders: paid.length,
      revenueCents,
      payingCustomers,
      receiptSent,
    };
  }, [orders]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { label: t.cards.users, value: totalUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: t.cards.customers, value: stats.payingCustomers, icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: t.cards.orders, value: stats.totalOrders, icon: Receipt, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: t.cards.paid, value: stats.paidOrders, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    { label: t.cards.revenue, value: formatMoney(stats.revenueCents, "usd"), icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: t.cards.emails, value: stats.receiptSent, icon: Mail, color: "text-pink-500", bg: "bg-pink-500/10" },
  ];

  return (
    <div className="min-h-screen -m-4 md:-m-6 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t.allOrders}
            </Link>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              {t.customerMessages}
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-3xl border-border/50">
                  <CardContent className="pt-6">
                    <div className={`p-2 rounded-xl ${card.bg} w-fit mb-2`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Card className="rounded-3xl border-border/50 mb-8">
          <CardHeader>
            <CardTitle>{t.recent}</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noRecent}</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 8).map((order) => {
                  const isPaid = (order.paymentStatus || order.status) === "paid";
                  return (
                    <div key={order.orderId || order.orderNumber} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-2xl border border-border/60 p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">
                          {t.orderNo}: {order.orderNumber || order.orderId || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.customer}: {order.userEmail || order.customerName || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.package}: {order.planName || order.planId || "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isPaid ? "default" : "secondary"}>{isPaid ? t.paid : t.open}</Badge>
                        <Badge variant="outline">{order.receiptEmailSentAt ? t.sent : t.notSent}</Badge>
                        <span className="text-sm font-semibold">{formatMoney(order.amountTotal, order.currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <AdminEmailForm />
      </div>
    </div>
  );
}
