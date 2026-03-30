"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type PlanId = "plan299" | "plan466" | "plan1599" | "plan4999";

const copy = {
  zh: {
    menu: "菜单",
    close: "关闭",
    login: "会员登录",
    buyNow: "立即购买",
    loading: "加载中...",
    nav: [
      { id: "hero", label: "首页" },
      { id: "about", label: "关于" },
      { id: "services", label: "服务" },
      { id: "pricing", label: "套餐" },
      { id: "faq", label: "FAQ" },
      { id: "contact", label: "联系" },
    ],
    heroTitle: "智能服务终端",
    heroDesc:
      "提供专业 ITIN 代办、公司注册、建站与 Stripe 收款服务，流程透明、交付清晰、结果可追踪。",
    viewPlans: "查看套餐",
    contactUs: "联系我们",
    scrollDown: "向下查看",
    aboutTitle: "关于我们",
    aboutDesc:
      "我们为个人和中小企业提供 ITIN、公司注册、合规咨询、网站搭建与收款对接服务。",
    aboutLeft:
      "从资料准备、流程梳理到提交跟进，我们给你清晰的执行路径和可落地的建议。",
    aboutBullets: ["ITIN 材料审核与流程协助", "一对一咨询与答疑", "交付节点清晰、过程透明"],
    aboutRight:
      "无论你是刚开始出海，还是要升级现有业务流程，我们都可以按你的阶段给出最合适方案。",
    servicesTitle: "服务内容",
    servicesDesc: "可按套餐直接购买，也可联系我们做定制化组合。",
    services: [
      { title: "ITIN 服务", desc: "资料整理、递交指导与过程跟进，降低返工概率。" },
      { title: "注册与合规", desc: "公司注册落地、基础合规建议与后续运营支持。" },
      { title: "建站与收款", desc: "独立站搭建、Stripe 对接与转化体验优化。" },
    ],
    pricingTitle: "套餐与价格",
    pricingDesc: "选择适合你的套餐，支持直接支付，不强制注册。",
    popular: "热门",
    plans: [
      {
        id: "plan299" as PlanId,
        name: "个人代理服务",
        price: "$299",
        recommended: false,
        features: ["赠送手册全部内容", "个人 ITIN 代办", "一对一指导（银行卡/信用卡答疑）"],
      },
      {
        id: "plan466" as PlanId,
        name: "全能代理服务",
        price: "$466",
        features: ["包含个人代理服务内容", "全程公司注册代理", "Stripe 账户开通协助", "合规咨询"],
        recommended: true,
      },
      {
        id: "plan1599" as PlanId,
        name: "建站代理服务",
        price: "$1599",
        recommended: false,
        features: ["包含全能代理服务所有权益", "高转化率独立站搭建", "电商平台入驻协助"],
      },
      {
        id: "plan4999" as PlanId,
        name: "咨询服务",
        price: "$49.99",
        recommended: false,
        features: ["30 分钟 1 对 1 咨询", "现状与风险点快速评估", "可执行下一步清单"],
      },
    ],
    faqTitle: "常见问题",
    faqDesc: "如需人工支持，请发送邮件至 Mike@yinhng.com，我们会尽快回复。",
    faq1Q: "付款后多久开始服务？",
    faq1A: "付款成功后，我们会在 24 小时内通过你下单邮箱联系你并确认资料清单。",
    faq2Q: "购买前需要注册账号吗？",
    faq2A: "不需要。可直接输入邮箱付款；如果想查看订单和留言回复，建议登录账号后操作。",
    footer: "专业、透明、可交付的一站式 ITIN / 注册 / 建站与收款支持。",
    emailModalTitle: "请输入您的邮箱",
    emailModalDesc: "用于接收付款结果、订单通知和收据信息。",
    goPay: "继续前往支付",
    redirecting: "正在安全跳转...",
    invalidEmail: "请输入有效邮箱地址。",
    checkoutFailed: "创建支付失败，请稍后重试。",
    mobileQuickBuy: "购买套餐",
  },
  en: {
    menu: "Menu",
    close: "Close",
    login: "Member Login",
    buyNow: "Buy Now",
    loading: "Loading...",
    nav: [
      { id: "hero", label: "Home" },
      { id: "about", label: "About" },
      { id: "services", label: "Services" },
      { id: "pricing", label: "Plans" },
      { id: "faq", label: "FAQ" },
      { id: "contact", label: "Contact" },
    ],
    heroTitle: "Intelligent Service Portal",
    heroDesc:
      "Professional ITIN support, company registration, website setup, and Stripe payment integration with transparent delivery.",
    viewPlans: "View Plans",
    contactUs: "Contact Us",
    scrollDown: "Scroll Down",
    aboutTitle: "About Us",
    aboutDesc:
      "We help individuals and small businesses with ITIN processing, company registration, compliance, website setup, and payment integration.",
    aboutLeft:
      "From document prep to submission and follow-up, we provide clear execution steps you can actually use.",
    aboutBullets: [
      "ITIN document review and guidance",
      "1-on-1 consulting and Q&A",
      "Transparent milestones and delivery",
    ],
    aboutRight:
      "Whether you are just starting global operations or upgrading your current workflow, we provide the right package at your stage.",
    servicesTitle: "Services",
    servicesDesc: "Purchase directly by package, or contact us for a custom service bundle.",
    services: [
      { title: "ITIN Service", desc: "Document review, submission guidance, and status follow-up to reduce rework." },
      { title: "Registration & Compliance", desc: "Company registration support and practical compliance consulting." },
      { title: "Website & Payments", desc: "Website setup, Stripe integration, and conversion optimization." },
    ],
    pricingTitle: "Packages & Pricing",
    pricingDesc: "Choose your package and pay directly. Account registration is optional.",
    popular: "Popular",
    plans: [
      {
        id: "plan299" as PlanId,
        name: "Personal Agency Service",
        price: "$299",
        recommended: false,
        features: ["Full handbook included", "Personal ITIN support", "1-on-1 guidance (bank account/credit card Q&A)"],
      },
      {
        id: "plan466" as PlanId,
        name: "Full Agency Service",
        price: "$466",
        features: [
          "Includes personal agency service",
          "Full company registration support",
          "Stripe account onboarding help",
          "Compliance consulting",
        ],
        recommended: true,
      },
      {
        id: "plan1599" as PlanId,
        name: "Website Agency Service",
        price: "$1599",
        recommended: false,
        features: [
          "Includes all Full Agency benefits",
          "High-conversion website setup",
          "E-commerce platform onboarding support",
        ],
      },
      {
        id: "plan4999" as PlanId,
        name: "Consulting Service",
        price: "$49.99",
        recommended: false,
        features: [
          "30-minute 1-on-1 consultation",
          "Current setup and risk review",
          "Actionable next-step checklist",
        ],
      },
    ],
    faqTitle: "FAQ",
    faqDesc: "Need manual support? Email Mike@yinhng.com and we will reply quickly.",
    faq1Q: "How soon does service start after payment?",
    faq1A: "We contact you within 24 hours through your checkout email to confirm document requirements and next steps.",
    faq2Q: "Do I need an account before purchasing?",
    faq2A: "No. You can pay with email directly. If you want order history and message replies, sign in first.",
    footer: "Professional, transparent, and deliverable ITIN / registration / website & payments support.",
    emailModalTitle: "Enter Your Email",
    emailModalDesc: "Used for payment status, order updates, and receipt delivery.",
    goPay: "Continue to Payment",
    redirecting: "Redirecting securely...",
    invalidEmail: "Please enter a valid email address.",
    checkoutFailed: "Failed to create checkout. Please try again.",
    mobileQuickBuy: "Buy Plans",
  },
} as const;

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const { locale } = useLanguage();
  const t = copy[locale];

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [purchaseEmail, setPurchaseEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [heroOffset, setHeroOffset] = useState({ x: 50, y: 50 });
  const [isScrolled, setIsScrolled] = useState(false);
  const [activePlanCard, setActivePlanCard] = useState<PlanId>("plan466");

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "employer") {
      router.replace("/employer/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, role, router, user]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen || modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, modalOpen]);

  const navLinks = useMemo(() => t.nav, [t.nav]);
  const selectedPlanInfo = useMemo(() => t.plans.find((plan) => plan.id === selectedPlan) || null, [selectedPlan, t.plans]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">{t.loading}</div>;
  }

  if (user) return null;

  const handleBuy = (planId: PlanId) => {
    setSelectedPlan(planId);
    setPurchaseEmail("");
    setModalError("");
    setSubmitting(false);
    setModalOpen(true);
  };

  const handlePurchase = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlan) return;

    const email = purchaseEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setModalError(t.invalidEmail);
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const response = await fetch("/api/checkout/public-service", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: selectedPlan,
          customerEmail: email,
        }),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(t.checkoutFailed);
      }

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || t.checkoutFailed);
      }

      window.location.href = data.url;
    } catch (error: any) {
      setModalError(error?.message || t.checkoutFailed);
      setSubmitting(false);
    }
  };

  const handleHeroMouseMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setHeroOffset({ x: 50 + (x - 50) * 0.08, y: 50 + (y - 50) * 0.08 });
  };

  const goSection = (id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#f4f6f8] text-slate-900 dark:bg-slate-950 dark:text-slate-100 scroll-smooth">
      <header
        className={`fixed top-0 z-40 w-full border-b transition-all duration-300 ${
          isScrolled
            ? "border-white/20 bg-slate-950/74 shadow-[0_14px_40px_rgba(2,6,23,0.62)] backdrop-blur-2xl"
            : "border-white/15 bg-slate-950/56 shadow-[0_10px_35px_rgba(2,6,23,0.46)] backdrop-blur-xl"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button type="button" onClick={() => goSection("hero")} className="text-2xl font-extrabold tracking-[0.25em] text-white">
            YINHNG
          </button>

          <nav className="hidden md:block">
            <ul className="flex items-center gap-7 rounded-full border border-white/20 px-5 py-2 backdrop-blur-xl">
              {navLinks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => goSection(item.id)}
                    className="text-sm font-medium text-white/95 transition hover:text-emerald-300"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/login" className="rounded-full border border-white/45 bg-black/25 px-4 py-2 text-sm font-medium text-white backdrop-blur-md hover:bg-white/15">
              {t.login}
            </Link>
            <button
              type="button"
              onClick={() => goSection("pricing")}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.38)] hover:bg-emerald-600"
            >
              {t.buyNow}
            </button>
          </div>

          <button
            className="md:hidden inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-2 text-white"
            onClick={() => setMenuOpen(true)}
            type="button"
            aria-label={t.menu}
          >
            <Menu className="h-4 w-4" />
            {t.menu}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm border-l border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="text-xl font-extrabold tracking-[0.2em] text-white">YINHNG</p>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-full border border-white/20 p-2 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <LanguageToggle className="flex-1 justify-center" />
              <ThemeToggle />
            </div>

            <ul className="mt-6 space-y-2">
              {navLinks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => goSection(item.id)}
                    className="w-full rounded-xl border border-white/10 px-4 py-3 text-left text-white hover:bg-white/10"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-2">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold text-white">
                {t.login}
              </Link>
              <button
                type="button"
                onClick={() => goSection("pricing")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white"
              >
                {t.buyNow}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main>
        <section
          id="hero"
          className="relative min-h-screen bg-cover bg-no-repeat transition-[background-position] duration-300"
          style={{
            backgroundImage: "url('/assets/img/hero-bg.jpg')",
            backgroundPosition: `${heroOffset.x}% ${heroOffset.y}%`,
            backgroundColor: "rgba(2, 6, 23, 0.44)",
            backgroundBlendMode: "multiply",
          }}
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={() => setHeroOffset({ x: 50, y: 50 })}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/84 via-slate-900/62 to-slate-950/86" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_45%,rgba(20,184,166,0.05),transparent_42%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.04),transparent_35%)]" />

          <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-4 py-28 text-white md:py-36">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">YINHNG LLC</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">{t.heroTitle}</h1>
            <p className="mt-6 max-w-2xl text-base text-white/90 md:text-lg">{t.heroDesc}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => goSection("pricing")} className="rounded-full bg-emerald-500 px-6 py-3 font-semibold hover:bg-emerald-600">
                {t.viewPlans}
              </button>
              <button type="button" onClick={() => goSection("contact")} className="rounded-full border border-white/40 px-6 py-3 hover:bg-white/10">
                {t.contactUs}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => goSection("about")}
            className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/85 hover:text-white animate-bounce"
          >
            {t.scrollDown}
          </button>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-bold">{t.aboutTitle}</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{t.aboutDesc}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p>{t.aboutLeft}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {t.aboutBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p>{t.aboutRight}</p>
              <button type="button" onClick={() => goSection("pricing")} className="mt-4 inline-flex items-center text-emerald-700 hover:underline">
                {t.viewPlans}
              </button>
            </div>
          </div>
        </section>

        <section id="services" className="bg-white py-16 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-3xl font-bold">{t.servicesTitle}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">{t.servicesDesc}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {t.services.map((service) => (
                <div key={service.title} className="rounded-2xl border p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-xl font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-bold">{t.pricingTitle}</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{t.pricingDesc}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {t.plans.map((plan) => {
              const isActive = activePlanCard === plan.id;
              return (
                <article
                  key={plan.id}
                  className={`group rounded-3xl border bg-white p-6 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
                    isActive
                      ? "border-emerald-400 shadow-[0_14px_28px_rgba(16,185,129,0.20)] ring-1 ring-emerald-300/70"
                      : "border-slate-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
                  }`}
                  onMouseEnter={() => setActivePlanCard(plan.id)}
                  onFocus={() => setActivePlanCard(plan.id)}
                  onClick={() => setActivePlanCard(plan.id)}
                  tabIndex={0}
                >
                  {plan.recommended || isActive ? (
                    <span className="mb-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {t.popular}
                    </span>
                  ) : null}

                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-3 text-5xl font-extrabold text-emerald-600">{plan.price}</p>

                  <ul className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleBuy(plan.id)}
                    onMouseEnter={() => setActivePlanCard(plan.id)}
                    className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {t.buyNow}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section id="faq" className="bg-white py-16 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">{t.faqTitle}</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">{t.faqDesc}</p>
            </div>
            <div className="space-y-3">
              <details open className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer font-semibold">{t.faq1Q}</summary>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.faq1A}</p>
              </details>
              <details className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer font-semibold">{t.faq2Q}</summary>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.faq2A}</p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-slate-900 py-10 text-white pb-24 md:pb-10">
        <div className="mx-auto max-w-7xl px-4">
          <h3 className="text-2xl font-extrabold tracking-[0.25em]">YINHNG</h3>
          <p className="mt-3 text-sm text-white/80">{t.footer}</p>
          <p className="mt-4 text-xs text-white/60">Copyright YINHNG LLC All Rights Reserved</p>
        </div>
      </footer>

      <div className="fixed bottom-4 left-3 right-3 z-40 md:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/20 bg-slate-950/86 p-2 backdrop-blur-xl">
          <Link href="/login" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white">
            {t.login}
          </Link>
          <button
            type="button"
            onClick={() => goSection("pricing")}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
          >
            {t.mobileQuickBuy}
          </button>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:bg-zinc-900">
            <div className="grid md:grid-cols-[1.05fr_1.35fr]">
              <div className="relative hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-7 text-white md:block">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.26),transparent_42%),radial-gradient(circle_at_82%_0%,rgba(56,189,248,0.2),transparent_36%)]" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">YINHNG</p>
                  <h4 className="mt-3 text-2xl font-extrabold">{locale === "zh" ? "安全支付通道" : "Secure Checkout"}</h4>
                  <p className="mt-3 text-sm text-white/80">
                    {locale === "zh"
                      ? "我们仅使用该邮箱发送订单状态和收据，不会用于骚扰营销。"
                      : "This email is only used for order status and receipt delivery."}
                  </p>
                  <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs text-white/70">{locale === "zh" ? "已选套餐" : "Selected Package"}</p>
                    <p className="mt-1 text-lg font-bold">{selectedPlanInfo?.name || "--"}</p>
                    <p className="mt-1 text-3xl font-extrabold text-emerald-300">{selectedPlanInfo?.price || "--"}</p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm text-white/85">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    SSL / Stripe secure session
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{t.emailModalTitle}</h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{t.emailModalDesc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {t.close}
                  </button>
                </div>

                <form onSubmit={handlePurchase} className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200">
                    Email
                    <div className="relative mt-2">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={purchaseEmail}
                        onChange={(e) => {
                          setPurchaseEmail(e.target.value);
                          if (modalError) setModalError("");
                        }}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </label>

                  {modalError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {modalError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      t.redirecting
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {t.goPay}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
