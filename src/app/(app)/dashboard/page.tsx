"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Check, CircleDollarSign, Clock3, Crown, Package, ShoppingCart, Star, UserCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type UserProfile = {
  displayName?: string;
  firstName?: string;
  email?: string;
  plan?: string;
  uid?: string;
};

type OrderRecord = {
  id: string;
  userId?: string;
  itemName?: string;
  planName?: string;
  planId?: string;
  price?: string;
  amountTotal?: number;
  currency?: string;
  date?: string;
  createdAt?: string;
  status?: string;
  paymentStatus?: string;
};

type ServicePlan = {
  id: string;
  trackingPlanId: string;
  amountCents: number;
  name: string;
  priceLabel: string;
  badge?: string;
  benefits: string[];
  ctaLabel: string;
};

const copy = {
  zh: {
    loading: "加载中...",
    welcomeBack: "欢迎回来",
    loggedInUser: "已登录用户",
    currentPlan: "当前套餐",
    serviceOrders: "服务订单",
    units: "笔",
    plansAndPricing: "套餐与价格",
    planTip: "点击任意卡片即可选中，右侧按钮会跟随切换。",
    fullPricing: "查看完整定价",
    selectedPlan: "已选套餐",
    paySelected: "去支付此套餐",
    contactConsultant: "咨询顾问",
    myOrders: "我的服务订单",
    browseServices: "浏览服务",
    noOrders: "你还没有服务订单",
    noOrdersDesc: "购买任意套餐后，订单状态、时间和服务内容会显示在这里。",
    serviceName: "服务名称",
    amount: "金额",
    orderTime: "下单时间",
    processing: "处理中",
    unknown: "待确认",
    defaultMember: "会员",
    defaultServicePlan: "服务套餐",
    hot: "热门",
    buyNow: "立即购买",
    personalAgent: "个人代理服务",
    fullAgent: "全能代理服务",
    websiteAgent: "建站代理服务",
    personalBenefit1: "赠手册全部内容",
    personalBenefit2: "个人 ITIN 代办",
    personalBenefit3: "一对一指导（银行卡/信用卡答疑）",
    fullBenefit1: "包含个人代理服务内容",
    fullBenefit2: "全程公司注册代理",
    fullBenefit3: "Stripe 账户开通协助",
    fullBenefit4: "合规咨询",
    siteBenefit1: "包含全能代理服务所有权益",
    siteBenefit2: "高转化率独立站搭建",
    siteBenefit3: "电商平台入驻协助",
    planUnknown: "未开通",
    planFree: "免费版",
    planStarter: "基础版",
    planPro: "专业版",
    planPremium: "高级版",
    planBusiness: "企业版",
  },
  en: {
    loading: "Loading...",
    welcomeBack: "Welcome back",
    loggedInUser: "Signed-in user",
    currentPlan: "Current Plan",
    serviceOrders: "Service Orders",
    units: "records",
    plansAndPricing: "Packages & Pricing",
    planTip: "Click any card to select a package, and the action follows your selection.",
    fullPricing: "View Full Pricing",
    selectedPlan: "Selected Plan",
    paySelected: "Pay For Selected Plan",
    contactConsultant: "Contact Consultant",
    myOrders: "My Service Orders",
    browseServices: "Browse Services",
    noOrders: "No service orders yet",
    noOrdersDesc: "After purchasing any package, order status and details will appear here.",
    serviceName: "Service Name",
    amount: "Amount",
    orderTime: "Order Time",
    processing: "Processing",
    unknown: "Pending confirmation",
    defaultMember: "Member",
    defaultServicePlan: "Service Package",
    hot: "Popular",
    buyNow: "Buy Now",
    personalAgent: "Personal Agency Service",
    fullAgent: "Full Agency Service",
    websiteAgent: "Website Agency Service",
    personalBenefit1: "Full handbook included",
    personalBenefit2: "Personal ITIN support",
    personalBenefit3: "1-on-1 guidance (bank account/card Q&A)",
    fullBenefit1: "Includes personal agency service",
    fullBenefit2: "Full company registration support",
    fullBenefit3: "Stripe account onboarding help",
    fullBenefit4: "Compliance consulting",
    siteBenefit1: "Includes all Full Agency benefits",
    siteBenefit2: "High-conversion website setup",
    siteBenefit3: "E-commerce platform onboarding support",
    planUnknown: "Not Activated",
    planFree: "Free",
    planStarter: "Starter",
    planPro: "Pro",
    planPremium: "Premium",
    planBusiness: "Business",
  },
} as const;

function statusStyle(status?: string) {
  const value = (status || "pending").toLowerCase();
  if (["paid", "completed", "active", "delivered", "success"].includes(value)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["failed", "cancelled", "canceled", "refunded"].includes(value)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function formatMoney(order: OrderRecord) {
  if (order.price) return order.price;
  if (typeof order.amountTotal === "number") {
    const value = order.amountTotal / 100;
    const code = (order.currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  }
  return "--";
}

function inferPlanIdByAmount(amountTotal?: number) {
  if (amountTotal === 29900) return "plan299";
  if (amountTotal === 46600) return "plan466";
  if (amountTotal === 159900) return "plan1599";
  return null;
}

export default function DashboardPage() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const servicePlans: ServicePlan[] = useMemo(
    () => [
      {
        id: "personal-agent",
        trackingPlanId: "plan299",
        amountCents: 29900,
        name: t.personalAgent,
        priceLabel: "$299",
        benefits: [t.personalBenefit1, t.personalBenefit2, t.personalBenefit3],
        ctaLabel: t.buyNow,
      },
      {
        id: "full-agent",
        trackingPlanId: "plan466",
        amountCents: 46600,
        name: t.fullAgent,
        priceLabel: "$466",
        badge: t.hot,
        benefits: [t.fullBenefit1, t.fullBenefit2, t.fullBenefit3, t.fullBenefit4],
        ctaLabel: t.buyNow,
      },
      {
        id: "website-agent",
        trackingPlanId: "plan1599",
        amountCents: 159900,
        name: t.websiteAgent,
        priceLabel: "$1599",
        benefits: [t.siteBenefit1, t.siteBenefit2, t.siteBenefit3],
        ctaLabel: t.buyNow,
      },
    ],
    [t]
  );

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("full-agent");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUserProfile(null);
        setOrders([]);
        setCurrentUserId("");
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, "publicProfiles", currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data() as UserProfile);
        } else {
          setUserProfile({
            displayName: currentUser.displayName || "YINHNG Member",
            email: currentUser.email || undefined,
            plan: "free",
          });
        }
        setCurrentUserId(currentUser.uid);

        const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const fetchedOrders: OrderRecord[] = querySnapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<OrderRecord, "id">),
        }));
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const displayName = useMemo(
    () => userProfile?.displayName || userProfile?.firstName || t.defaultMember,
    [userProfile, t.defaultMember]
  );

  const selectedPlan = useMemo(
    () => servicePlans.find((plan) => plan.id === selectedPlanId) || servicePlans[0],
    [selectedPlanId, servicePlans]
  );

  const startCheckout = async (trackingPlanId: string) => {
    if (!currentUserId) {
      window.alert("Please sign in before purchasing.");
      return;
    }
    if (checkoutPlanId) return;

    setCheckoutPlanId(trackingPlanId);
    try {
      const response = await fetch("/api/checkout/service", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: trackingPlanId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout URL is missing");
    } catch (error: any) {
      console.error("Service checkout failed:", error);
      window.alert(error?.message || "Checkout failed. Please try again.");
      setCheckoutPlanId(null);
    }
  };

  const planNameMap: Record<string, string> = {
    free: t.planFree,
    starter: t.planStarter,
    pro: t.planPro,
    premium: t.planPremium,
    business: t.planBusiness,
  };

  const orderPlanNameMap: Record<string, string> = {
    plan299: t.personalAgent,
    plan466: t.fullAgent,
    plan1599: t.websiteAgent,
    "personal-agent": t.personalAgent,
    "full-agent": t.fullAgent,
    "website-agent": t.websiteAgent,
  };

  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-gray-500">{t.loading}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 text-gray-900">
      <section className="rounded-3xl border border-gray-200 bg-gradient-to-r from-white via-white to-emerald-50 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <UserCircle size={54} className="text-gray-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.welcomeBack}, {displayName}</h1>
              <p className="mt-1 text-sm text-gray-500">{userProfile?.email || t.loggedInUser}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-auto">
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{t.currentPlan}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{planNameMap[userProfile?.plan || ""] || t.planUnknown}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{t.serviceOrders}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{orders.length} {t.units}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t.plansAndPricing}</h2>
            <p className="mt-2 text-sm text-gray-500">{t.planTip}</p>
          </div>
          <Link href="#packages" className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-600 px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            {t.fullPricing}
          </Link>
        </div>

        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700">{t.selectedPlan}</p>
              <p className="text-lg font-bold text-emerald-900">{selectedPlan.name} - {selectedPlan.priceLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => startCheckout(selectedPlan.trackingPlanId)}
              disabled={Boolean(checkoutPlanId)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {checkoutPlanId === selectedPlan.trackingPlanId ? `${t.paySelected}...` : t.paySelected}
            </button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {servicePlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <article
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPlanId(plan.id);
                  }
                }}
                className={[
                  "rounded-3xl border p-6 transition duration-200 cursor-pointer",
                  isSelected ? "border-emerald-400 bg-emerald-50/60 shadow-md ring-2 ring-emerald-100" : "border-gray-200 bg-white hover:border-emerald-200 hover:shadow-sm",
                ].join(" ")}
              >
                <div className="mb-5 flex min-h-8 items-center justify-between">
                  <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
                  {plan.badge ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <Star className="mr-1 h-3.5 w-3.5" />
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mb-5 flex items-end gap-2 text-4xl font-bold text-emerald-700">
                  <CircleDollarSign className="mb-1 h-6 w-6" />
                  {plan.priceLabel}
                </p>
                <ul className="space-y-3 text-sm text-gray-700">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void startCheckout(plan.trackingPlanId);
                    }}
                    disabled={Boolean(checkoutPlanId)}
                    className={[
                      "inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
                      isSelected ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50",
                    ].join(" ")}
                  >
                    {checkoutPlanId === plan.trackingPlanId ? `${plan.ctaLabel}...` : plan.ctaLabel}
                  </button>
                  <Link href="/inbox" onClick={(event) => event.stopPropagation()} className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                    {t.contactConsultant}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">{t.myOrders}</h2>
          <Link href="#packages" className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">
            <Package className="h-4 w-4" />
            {t.browseServices}
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 py-14 text-center">
            <ShoppingCart className="mx-auto h-14 w-14 text-gray-300" />
            <h3 className="mt-5 text-2xl font-bold text-gray-900">{t.noOrders}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{t.noOrdersDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const createdLabel = order.date || order.createdAt || t.unknown;
              const statusText = order.status || order.paymentStatus || t.processing;
              const inferredPlanId = inferPlanIdByAmount(order.amountTotal);
              const serviceName =
                (order.planId && orderPlanNameMap[order.planId]) ||
                (inferredPlanId ? orderPlanNameMap[inferredPlanId] : undefined) ||
                order.planName ||
                order.itemName ||
                t.defaultServicePlan;
              return (
                <article key={order.id} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-4 md:items-center">
                    <div>
                      <p className="text-xs text-gray-500">{t.serviceName}</p>
                      <p className="mt-1 font-semibold text-gray-900">{serviceName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t.amount}</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatMoney(order)}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t.orderTime}</p>
                        <p className="mt-1 font-semibold text-gray-900">{createdLabel}</p>
                      </div>
                    </div>
                    <div className="md:text-right">
                      <span className={["inline-flex rounded-full border px-3 py-1 text-xs font-semibold", statusStyle(statusText)].join(" ")}>
                        <Crown className="mr-1 h-3.5 w-3.5" />
                        {statusText}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
