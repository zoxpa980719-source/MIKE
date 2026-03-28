"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { CHECKOUT_LINKS } from "@/lib/checkout-links";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  Check,
  CircleDollarSign,
  Clock3,
  Crown,
  Package,
  ShoppingCart,
  Star,
  UserCircle,
} from "lucide-react";

type UserProfile = {
  displayName?: string;
  firstName?: string;
  email?: string;
  plan?: string;
};

type OrderRecord = {
  id: string;
  userId?: string;
  itemName?: string;
  price?: string;
  date?: string;
  status?: string;
};

type ServicePlan = {
  id: string;
  name: string;
  priceLabel: string;
  checkoutUrl: string;
  badge?: string;
  benefits: string[];
  ctaLabel: string;
};

const SERVICE_PLANS: ServicePlan[] = [
  {
    id: "personal-agent",
    name: "个人代理服务",
    priceLabel: "$299",
    checkoutUrl: CHECKOUT_LINKS.price299,
    benefits: ["赠手册全部内容", "个人 ITIN 代办", "一对一指导（银行账户/信用卡答疑）"],
    ctaLabel: "立即购买",
  },
  {
    id: "full-agent",
    name: "全能代理服务",
    priceLabel: "$466",
    checkoutUrl: CHECKOUT_LINKS.price466,
    badge: "热门",
    benefits: ["包含个人代理服务内容", "全程公司注册代理", "Stripe 账户开通协助", "合规咨询"],
    ctaLabel: "立即购买",
  },
  {
    id: "website-agent",
    name: "建站代理服务",
    priceLabel: "$1599",
    checkoutUrl: CHECKOUT_LINKS.price1599,
    benefits: ["包含全能代理服务所有权益", "高转化率独立站搭建", "电商平台入驻协助"],
    ctaLabel: "立即购买",
  },
];

function formatPlanName(plan?: string) {
  if (!plan) return "未开通";

  const planMap: Record<string, string> = {
    free: "免费版",
    starter: "基础版",
    pro: "专业版",
    premium: "高级版",
    business: "企业版",
  };

  return planMap[plan] || plan;
}

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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("full-agent");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profileRef = doc(db, "publicProfiles", currentUser.uid);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data() as UserProfile);
          } else {
            setUserProfile({
              displayName: currentUser.displayName || "YINHNG 会员",
              email: currentUser.email || undefined,
              plan: "free",
            });
          }

          const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          const fetchedOrders: OrderRecord[] = querySnapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<OrderRecord, "id">),
          }));

          setOrders(fetchedOrders);
        } catch (error) {
          console.error("获取 dashboard 数据失败:", error);
        }
      } else {
        setUserProfile(null);
        setOrders([]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const displayName = useMemo(
    () => userProfile?.displayName || userProfile?.firstName || "会员",
    [userProfile]
  );

  const selectedPlan = useMemo(
    () => SERVICE_PLANS.find((plan) => plan.id === selectedPlanId) || SERVICE_PLANS[0],
    [selectedPlanId]
  );

  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 text-gray-900">
      <section className="rounded-3xl border border-gray-200 bg-gradient-to-r from-white via-white to-emerald-50 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <UserCircle size={54} className="text-gray-300" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">欢迎回来，{displayName}</h1>
              <p className="mt-1 text-sm text-gray-500">{userProfile?.email || "已登录用户"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-auto">
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">当前套餐</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatPlanName(userProfile?.plan)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">服务订单</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{orders.length} 笔</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">套餐与价格</h2>
            <p className="mt-2 text-sm text-gray-500">点击任意卡片即可选中，右侧按钮和快捷购买会跟随切换。</p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-600 px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            查看完整定价
          </Link>
        </div>

        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700">已选套餐</p>
              <p className="text-lg font-bold text-emerald-900">
                {selectedPlan.name} · {selectedPlan.priceLabel}
              </p>
            </div>
            <Link
              href={selectedPlan.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              去支付此套餐
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {SERVICE_PLANS.map((plan) => {
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
                  isSelected
                    ? "border-emerald-400 bg-emerald-50/60 shadow-md ring-2 ring-emerald-100"
                    : "border-gray-200 bg-white hover:border-emerald-200 hover:shadow-sm",
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
                  <Link
                    href={plan.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className={[
                      "inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition",
                      isSelected
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50",
                    ].join(" ")}
                  >
                    {plan.ctaLabel}
                  </Link>
                  <Link
                    href="/inbox"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    咨询顾问
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">我的服务订单</h2>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <Package className="h-4 w-4" />
            浏览服务
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 py-14 text-center">
            <ShoppingCart className="mx-auto h-14 w-14 text-gray-300" />
            <h3 className="mt-5 text-2xl font-bold text-gray-900">你还没有服务订单</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              购买任意套餐后，订单状态、时间和服务内容会显示在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="grid gap-4 md:grid-cols-4 md:items-center">
                  <div>
                    <p className="text-xs text-gray-500">服务名称</p>
                    <p className="mt-1 font-semibold text-gray-900">{order.itemName || "服务套餐"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">金额</p>
                    <p className="mt-1 font-semibold text-gray-900">{order.price || "--"}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">下单时间</p>
                      <p className="mt-1 font-semibold text-gray-900">{order.date || "待确认"}</p>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <span
                      className={[
                        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                        statusStyle(order.status),
                      ].join(" ")}
                    >
                      <Crown className="mr-1 h-3.5 w-3.5" />
                      {order.status || "处理中"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
