import { Resend } from "resend";

type SendOrderConfirmationInput = {
  toEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: Date;
  planName: string;
  includedItems: string[];
  amountTotal?: number | null;
  currency?: string | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
};

type SendOrderReceiptInput = {
  toEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: Date;
  planName: string;
  amountTotal?: number | null;
  currency?: string | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
};

const PACKAGE_INFO: Record<string, { name: string; items: string[] }> = {
  plan299: {
    name: "Personal Agency Service",
    items: [
      "Personal ITIN application support",
      "One-on-one guidance",
      "Document prep and submission assistance",
    ],
  },
  plan466: {
    name: "Full Agency Service",
    items: [
      "Personal ITIN application support",
      "Full company registration support",
      "Stripe account onboarding assistance",
      "Compliance consulting",
    ],
  },
  plan1599: {
    name: "Website Agency Service",
    items: [
      "Includes all Full Agency Service benefits",
      "High-conversion website setup",
      "E-commerce platform onboarding support",
    ],
  },
  "personal-agent": {
    name: "Personal Agency Service",
    items: [
      "Personal ITIN application support",
      "One-on-one guidance",
      "Document prep and submission assistance",
    ],
  },
  "full-agent": {
    name: "Full Agency Service",
    items: [
      "Personal ITIN application support",
      "Full company registration support",
      "Stripe account onboarding assistance",
      "Compliance consulting",
    ],
  },
  "website-agent": {
    name: "Website Agency Service",
    items: [
      "Includes all Full Agency Service benefits",
      "High-conversion website setup",
      "E-commerce platform onboarding support",
    ],
  },
  pro: {
    name: "Pro Plan",
    items: ["Unlimited applications", "Saved jobs", "Profile boost", "Application analytics"],
  },
  premium: {
    name: "Premium Plan",
    items: ["Everything in Pro", "AI resume review", "Skill-gap analysis", "Salary insights"],
  },
  starter: {
    name: "Starter Plan",
    items: ["Basic hiring workflow", "Candidate view support", "Basic analytics"],
  },
  business: {
    name: "Business Plan",
    items: ["Advanced hiring workflow", "Featured postings", "Priority support"],
  },
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOrderNumber(sessionId: string, createdAtMs: number) {
  let hash = 0;
  const seed = `${sessionId}:${createdAtMs}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000000;
  }
  const num = String(Math.abs(hash)).padStart(6, "0");
  return `YHN-${num}`;
}

export function getPackageNameByPlanId(planId?: string | null) {
  if (!planId) return null;
  return PACKAGE_INFO[planId]?.name ?? null;
}

export function getPackageItems(planId?: string | null) {
  if (!planId) return ["Final service scope will be confirmed by our team."];
  return PACKAGE_INFO[planId]?.items ?? ["Final service scope will be confirmed by our team."];
}

function formatOrderDate(orderDate: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(orderDate);
}

function formatAmount(amountTotal?: number | null, currency?: string | null) {
  if (typeof amountTotal !== "number") return "-";
  const amount = amountTotal / 100;
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function getResendSendConfig() {
  const resend = new Resend(process.env.RESEND_API_KEY || "");
  const from = process.env.RESEND_FROM_EMAIL || "YINHNG <onboarding@resend.dev>";
  const bcc = process.env.ORDER_CONFIRMATION_BCC_EMAIL
    ? process.env.ORDER_CONFIRMATION_BCC_EMAIL.split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
  return { resend, from, bcc };
}

async function downloadPdfAsBase64(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("pdf")) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString("base64");
  } catch (error) {
    console.warn("[order-receipt-email] Failed to download PDF attachment", error);
    return null;
  }
}

function buildReceiptSvgBase64(input: SendOrderReceiptInput) {
  const orderDate = formatOrderDate(input.orderDate);
  const amount = formatAmount(input.amountTotal, input.currency);
  const safeName = escapeHtml(input.customerName);
  const safeOrder = escapeHtml(input.orderNumber);
  const safePlan = escapeHtml(input.planName);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1320" viewBox="0 0 960 1320">
  <rect width="960" height="1320" fill="#f3f6fb"/>
  <rect x="70" y="70" width="820" height="1180" rx="26" fill="#ffffff" stroke="#dbe2ea"/>
  <rect x="70" y="70" width="820" height="170" rx="26" fill="#1f3b74"/>
  <text x="110" y="145" font-size="40" font-family="Arial, sans-serif" fill="#ffffff" font-weight="700">YINHNG Receipt</text>
  <text x="110" y="195" font-size="24" font-family="Arial, sans-serif" fill="#d7e4ff">Order #${safeOrder}</text>

  <text x="110" y="300" font-size="30" font-family="Arial, sans-serif" fill="#1f2937" font-weight="700">Customer</text>
  <text x="110" y="345" font-size="28" font-family="Arial, sans-serif" fill="#111827">${safeName}</text>

  <text x="110" y="430" font-size="30" font-family="Arial, sans-serif" fill="#1f2937" font-weight="700">Service Package</text>
  <text x="110" y="475" font-size="28" font-family="Arial, sans-serif" fill="#111827">${safePlan}</text>

  <text x="110" y="560" font-size="30" font-family="Arial, sans-serif" fill="#1f2937" font-weight="700">Order Date</text>
  <text x="110" y="605" font-size="28" font-family="Arial, sans-serif" fill="#111827">${orderDate}</text>

  <rect x="110" y="680" width="740" height="170" rx="18" fill="#ecfdf5" stroke="#a7f3d0"/>
  <text x="145" y="750" font-size="28" font-family="Arial, sans-serif" fill="#065f46" font-weight="700">Amount Paid</text>
  <text x="145" y="810" font-size="56" font-family="Arial, sans-serif" fill="#047857" font-weight="700">${amount}</text>

  <text x="110" y="950" font-size="24" font-family="Arial, sans-serif" fill="#4b5563">This receipt image is generated automatically by YINHNG.</text>
  <text x="110" y="995" font-size="24" font-family="Arial, sans-serif" fill="#4b5563">For official Stripe invoice, please use the PDF attachment.</text>

  <text x="110" y="1120" font-size="24" font-family="Arial, sans-serif" fill="#6b7280">YINHNG Team</text>
</svg>
  `.trim();

  return Buffer.from(svg, "utf8").toString("base64");
}

export async function sendOrderConfirmationEmail(input: SendOrderConfirmationInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[order-confirmation-email] RESEND_API_KEY is missing, skip sending.");
    return { success: false as const, messageId: undefined };
  }

  const { resend, from, bcc } = getResendSendConfig();
  const subject = "Welcome to YINHNG | Your service order has been confirmed";

  const itemsHtml = input.includedItems
    .map((item) => `<li style="margin: 4px 0;">${escapeHtml(item)}</li>`)
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.65; color: #111827; max-width: 680px; margin: 0 auto;">
      <p>Dear ${escapeHtml(input.customerName)},</p>
      <p>Thank you for choosing YINHNG.</p>
      <p>We have successfully received your payment. We are honored to support your global business journey.</p>
      <p>Our team has started the initial onboarding and compliance preparation for your selected service package.</p>
      <p>Please keep this message as your official purchase confirmation.</p>

      <h3 style="margin: 20px 0 8px; font-size: 18px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
        <tbody>
          <tr><td style="padding: 10px 12px; font-weight: 600; width: 170px;">Order Number</td><td style="padding: 10px 12px;">#${escapeHtml(input.orderNumber)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Order Date</td><td style="padding: 10px 12px;">${formatOrderDate(input.orderDate)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Service Package</td><td style="padding: 10px 12px;">${escapeHtml(input.planName)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Total Paid</td><td style="padding: 10px 12px;">${formatAmount(input.amountTotal, input.currency)}</td></tr>
        </tbody>
      </table>

      <div style="margin-top: 14px;">
        <div style="font-weight: 600; margin-bottom: 6px;">Included Items</div>
        <ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul>
      </div>

      <p style="margin-top: 22px; color: #374151;">If you need to update your information, simply reply to this email and our team will assist you.</p>
      <p style="margin-top: 18px;">Best regards,<br/>YINHNG Team</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [input.toEmail],
    bcc,
    subject,
    html,
  });

  if (error) {
    console.error("[order-confirmation-email] resend error:", error);
    return { success: false as const, messageId: undefined };
  }

  return { success: true as const, messageId: data?.id };
}

export async function sendOrderReceiptEmail(input: SendOrderReceiptInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[order-receipt-email] RESEND_API_KEY is missing, skip sending.");
    return { success: false as const, messageId: undefined };
  }

  if (!input.stripeReceiptUrl && !input.stripeInvoiceUrl && !input.stripeInvoicePdfUrl) {
    return { success: false as const, messageId: undefined };
  }

  const { resend, from, bcc } = getResendSendConfig();
  const subject = `YINHNG Receipt & Invoice | Order #${input.orderNumber}`;

  const links: string[] = [];
  if (input.stripeReceiptUrl) {
    links.push(
      `<li style="margin: 6px 0;"><a href="${escapeHtml(input.stripeReceiptUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0f766e; font-weight:600; text-decoration:none;">Download receipt</a></li>`
    );
  }
  if (input.stripeInvoiceUrl) {
    links.push(
      `<li style="margin: 6px 0;"><a href="${escapeHtml(input.stripeInvoiceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0f766e; font-weight:600; text-decoration:none;">View invoice</a></li>`
    );
  }
  if (input.stripeInvoicePdfUrl) {
    links.push(
      `<li style="margin: 6px 0;"><a href="${escapeHtml(input.stripeInvoicePdfUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0f766e; font-weight:600; text-decoration:none;">Download invoice PDF</a></li>`
    );
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.65; color: #111827; max-width: 680px; margin: 0 auto;">
      <p>Dear ${escapeHtml(input.customerName)},</p>
      <p>This is your receipt/invoice email for your YINHNG order.</p>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
        <tbody>
          <tr><td style="padding: 10px 12px; font-weight: 600; width: 170px;">Order Number</td><td style="padding: 10px 12px;">#${escapeHtml(input.orderNumber)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Order Date</td><td style="padding: 10px 12px;">${formatOrderDate(input.orderDate)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Service Package</td><td style="padding: 10px 12px;">${escapeHtml(input.planName)}</td></tr>
          <tr><td style="padding: 10px 12px; font-weight: 600;">Amount Paid</td><td style="padding: 10px 12px;">${formatAmount(input.amountTotal, input.currency)}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:16px; border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 10px; padding: 12px;">
        <div style="font-weight: 600; margin-bottom: 6px; color: #065f46;">Stripe Billing Documents</div>
        <ul style="margin:0; padding-left: 18px;">${links.join("")}</ul>
      </div>
      <p style="margin-top: 18px;">Best regards,<br/>YINHNG Team</p>
    </div>
  `;

  const pdfBase64 = await downloadPdfAsBase64(input.stripeInvoicePdfUrl);
  const receiptImageBase64 = buildReceiptSvgBase64(input);
  const attachments = pdfBase64
    ? [
        {
          filename: `invoice-${input.orderNumber}.pdf`,
          content: pdfBase64,
        },
        {
          filename: `receipt-${input.orderNumber}.svg`,
          content: receiptImageBase64,
        },
      ]
    : [
        {
          filename: `receipt-${input.orderNumber}.svg`,
          content: receiptImageBase64,
        },
      ];

  const { data, error } = await resend.emails.send({
    from,
    to: [input.toEmail],
    bcc,
    subject,
    html,
    attachments,
  });

  if (error) {
    console.error("[order-receipt-email] resend error:", error);
    return { success: false as const, messageId: undefined };
  }

  return { success: true as const, messageId: data?.id };
}
