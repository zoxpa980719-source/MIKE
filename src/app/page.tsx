"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { CHECKOUT_LINKS } from "@/lib/checkout-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

type PlanId = "plan299" | "plan466" | "plan1599";

const STRIPE_LINKS: Record<PlanId, string> = {
  plan299: CHECKOUT_LINKS.price299,
  plan466: CHECKOUT_LINKS.price466,
  plan1599: CHECKOUT_LINKS.price1599,
};

const copy = {
  zh: {
    menu: "菜单",
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
      "提供专业的 ITIN 代办、公司注册、建站与 Stripe 收款服务，流程透明、交付清晰、结果可追踪。",
    viewPlans: "查看套餐",
    contactUs: "联系我们",
    scrollDown: "向下查看",
    aboutTitle: "关于我们",
    aboutDesc:
      "我们为中小型公司与个人提供 ITIN 办理、公司注册、合规咨询、建站与收款对接服务。",
    aboutLeft:
      "我们提供从资料准备、提交到跟进的全流程服务，并根据你的情况给出合规建议。",
    aboutBullets: ["ITIN 申请材料整理与审核", "一对一咨询与问题解答", "支付与交付流程清晰，服务透明"],
    aboutRight:
      "如你需要办理个人 ITIN、公司注册/合规咨询、Stripe 开通协助，以及建站与收款对接，我们可提供一站式支持。",
    servicesTitle: "服务内容",
    servicesDesc: "根据你的需求选择合适的套餐，或联系我们做定制方案。",
    services: [
      { title: "ITIN 代办", desc: "资料审核、递交指导、流程跟进，减少踩坑，提高通过率。" },
      { title: "公司注册与合规", desc: "公司注册代理、基础合规咨询、年度记账报税支持（按套餐）。" },
      { title: "建站与收款", desc: "独立站搭建、Stripe 对接、转化优化，让你可以直接收款。" },
    ],
    pricingTitle: "套餐与价格",
    pricingDesc: "选择适合你的套餐，无需注册账号，直接付款购买。",
    popular: "热门",
    plans: [
      {
        id: "plan299" as PlanId,
        name: "个人代理服务",
        price: "$299",
        recommended: false,
        features: ["赠手册全部内容", "个人 ITIN 代办", "一对一指导（银行账户/信用卡答疑）"],
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
    ],
    faqTitle: "常见问题",
    faqDesc: "这里可以放你真实的 FAQ，比如办理时间、材料清单、付款后流程等。",
    faq1Q: "付款后怎么开始服务？",
    faq1A: "付款成功后，你可以通过“联系”提交信息，我们会按套餐内容开始对接与材料确认。",
    faq2Q: "购买需要注册账号吗？",
    faq2A: "不需要注册。点击购买时填写常用邮箱即可。",
    footer: "专业、透明、可交付的 ITIN / 注册 / 建站与收款支持。",
    emailModalTitle: "请输入您的邮箱",
    emailModalDesc: "为了方便付款后与您联系并确认服务细节，请提供常用邮箱。",
    close: "关闭",
    goPay: "前往付款",
    redirecting: "正在安全跳转...",
    invalidEmail: "请输入有效的邮箱地址。",
  },
  en: {
    menu: "Menu",
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
      "Professional ITIN support, company registration, website setup and Stripe payment integration with transparent delivery.",
    viewPlans: "View Plans",
    contactUs: "Contact Us",
    scrollDown: "Scroll Down",
    aboutTitle: "About Us",
    aboutDesc:
      "We help individuals and small businesses with ITIN processing, company registration, compliance, website setup and payment integration.",
    aboutLeft:
      "We provide end-to-end support from documentation prep to submission and follow-up, with clear compliance guidance.",
    aboutBullets: [
      "ITIN document organization and review",
      "1-on-1 consulting and Q&A",
      "Transparent payment and delivery process",
    ],
    aboutRight:
      "If you need ITIN services, company setup/compliance support, Stripe onboarding, and website + payment integration, we provide one-stop support.",
    servicesTitle: "Services",
    servicesDesc: "Choose the package that fits your goals, or contact us for a custom solution.",
    services: [
      { title: "ITIN Service", desc: "Document review, submission guidance, and process follow-up to reduce mistakes." },
      { title: "Registration & Compliance", desc: "Company registration support and core compliance consulting." },
      { title: "Website & Payments", desc: "Build your site, connect Stripe, and optimize conversion for direct payments." },
    ],
    pricingTitle: "Packages & Pricing",
    pricingDesc: "Choose a package and pay directly without creating an account.",
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
    ],
    faqTitle: "FAQ",
    faqDesc: "You can put your real FAQ here, such as timeline, required documents, and post-payment process.",
    faq1Q: "How does service start after payment?",
    faq1A: "After successful payment, submit your details through Contact and we will start onboarding based on your package.",
    faq2Q: "Do I need to register before purchase?",
    faq2A: "No. Just provide your active email when purchasing.",
    footer: "Professional, transparent, and deliverable support for ITIN / registration / website & payments.",
    emailModalTitle: "Enter Your Email",
    emailModalDesc: "To confirm service details after payment, please provide your frequently used email address.",
    close: "Close",
    goPay: "Proceed to Payment",
    redirecting: "Redirecting securely...",
    invalidEmail: "Please enter a valid email address.",
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
  const [heroOffset, setHeroOffset] = useState({ x: 50, y: 50 });
  const [isScrolled, setIsScrolled] = useState(false);
  const [activePlanCard, setActivePlanCard] = useState<PlanId>("plan466");

  useEffect(() => {
    if (loading || !user) return;
    if (role === "employer") {
      router.replace("/employer/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = useMemo(() => t.nav, [t.nav]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        {t.loading}
      </div>
    );
  }

  if (user) return null;

  const handleBuy = (planId: PlanId) => {
    setSelectedPlan(planId);
    setModalOpen(true);
  };

  const handlePurchase = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPlan) return;
    const email = purchaseEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      window.alert(t.invalidEmail);
      return;
    }
    setSubmitting(true);
    window.location.href = `${STRIPE_LINKS[selectedPlan]}?prefilled_email=${encodeURIComponent(email)}`;
  };

  const handleHeroMouseMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const targetX = 50 + (x - 50) * 0.08;
    const targetY = 50 + (y - 50) * 0.08;
    setHeroOffset({ x: targetX, y: targetY });
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
          <a href="#hero" className="text-2xl font-extrabold tracking-[0.25em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            YINHNG
          </a>

          <button
            className="md:hidden rounded-md border border-white/40 bg-black/25 px-3 py-1 text-white backdrop-blur-md"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            {t.menu}
          </button>

          <nav
            className={`${menuOpen ? "block" : "hidden"} absolute left-2 right-2 top-[calc(100%+0.5rem)] rounded-2xl border border-white/15 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl md:static md:left-auto md:right-auto md:top-auto md:block md:w-auto md:rounded-full md:border-white/20 md:px-5 md:py-2 md:shadow-none ${isScrolled ? "md:bg-black/62 md:backdrop-blur-2xl" : "md:bg-black/45 md:backdrop-blur-xl"}`}
          >
            <ul className="flex flex-col gap-4 md:flex-row md:items-center md:gap-7">
              {navLinks.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-sm font-medium text-white/95 transition hover:text-emerald-300">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageToggle />
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full border border-white/45 bg-black/25 px-4 py-2 text-sm font-medium text-white backdrop-blur-md hover:bg-white/15"
            >
              {t.login}
            </Link>
            <a
              href="#pricing"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.38)] hover:bg-emerald-600"
            >
              {t.buyNow}
            </a>
          </div>
        </div>
      </header>

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
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">YINHNG LLC</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-base text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] md:text-lg">{t.heroDesc}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#pricing" className="rounded-full bg-emerald-500 px-6 py-3 font-semibold hover:bg-emerald-600">
                {t.viewPlans}
              </a>
              <a href="#contact" className="rounded-full border border-white/40 px-6 py-3 hover:bg-white/10">
                {t.contactUs}
              </a>
            </div>
          </div>
          <a
            href="#about"
            className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/85 hover:text-white animate-bounce"
          >
            {t.scrollDown}
          </a>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-bold">{t.aboutTitle}</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{t.aboutDesc}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p>{t.aboutLeft}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {t.aboutBullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p>{t.aboutRight}</p>
              <a href="#pricing" className="mt-4 inline-flex items-center text-emerald-700 hover:underline">
                {t.viewPlans}
              </a>
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
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {t.plans.map((plan) => (
              <article
                key={plan.id}
                className={`group rounded-3xl border bg-white p-6 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
                  activePlanCard === plan.id
                    ? "border-emerald-400 shadow-[0_14px_28px_rgba(16,185,129,0.20)] ring-1 ring-emerald-300/70"
                    : "border-slate-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
                }`}
                onMouseEnter={() => setActivePlanCard(plan.id)}
                onFocus={() => setActivePlanCard(plan.id)}
                tabIndex={0}
              >
                {plan.recommended || activePlanCard === plan.id ? (
                  <span className="mb-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {t.popular}
                  </span>
                ) : null}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="mt-3 text-5xl font-extrabold text-emerald-600">{plan.price}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {plan.features.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleBuy(plan.id)}
                  onMouseEnter={() => setActivePlanCard(plan.id)}
                  className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                    activePlanCard === plan.id
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {t.buyNow}
                </button>
              </article>
            ))}
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

      <footer id="contact" className="bg-slate-900 py-10 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h3 className="text-2xl font-extrabold tracking-[0.25em]">YINHNG</h3>
          <p className="mt-3 text-sm text-white/80">{t.footer}</p>
          <p className="mt-4 text-xs text-white/60">Copyright YINHNG LLC All Rights Reserved</p>
        </div>
      </footer>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{t.emailModalTitle}</h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {t.close}
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-zinc-300">{t.emailModalDesc}</p>
            <form onSubmit={handlePurchase} className="space-y-3">
              <input
                type="email"
                required
                value={purchaseEmail}
                onChange={(e) => setPurchaseEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-lg border px-3 py-2 outline-none ring-emerald-300 focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
              >
                {submitting ? t.redirecting : t.goPay}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
