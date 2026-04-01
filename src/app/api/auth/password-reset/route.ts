import { NextRequest, NextResponse } from "next/server";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:9002"
  );
}

function getFirebaseWebApiKey() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_WEB_API_KEY ||
    ""
  );
}

function genericSuccess() {
  return NextResponse.json({
    success: true,
    message:
      "If this email is registered, a password reset message has been sent.",
  });
}

async function requestFirebasePasswordReset(
  email: string,
  includeContinueUrl: boolean,
) {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error("Missing Firebase Web API key");
  }

  const payload: Record<string, string> = {
    requestType: "PASSWORD_RESET",
    email,
  };

  if (includeContinueUrl) {
    payload.continueUrl = `${getAppBaseUrl()}/login`;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "UNKNOWN_ERROR";
    throw new Error(message);
  }

  return data;
}

export async function POST(request: NextRequest) {
  let body: { email?: string } = {};
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!getFirebaseWebApiKey()) {
    return NextResponse.json(
      { error: "Password reset service unavailable: missing Firebase API key" },
      { status: 503 },
    );
  }

  try {
    try {
      await requestFirebasePasswordReset(email, true);
    } catch (error: any) {
      const message = String(error?.message || "");
      const shouldRetryWithoutContinueUrl =
        message.includes("INVALID_CONTINUE_URI") ||
        message.includes("UNAUTHORIZED_DOMAIN") ||
        message.includes("MISSING_CONTINUE_URI") ||
        message.includes("INVALID_DYNAMIC_LINK_DOMAIN");

      if (shouldRetryWithoutContinueUrl) {
        await requestFirebasePasswordReset(email, false);
      } else {
        throw error;
      }
    }

    return genericSuccess();
  } catch (error: any) {
    // Do not reveal whether account exists.
    const message = String(error?.message || "");
    if (
      message.includes("EMAIL_NOT_FOUND") ||
      message.includes("USER_NOT_FOUND")
    ) {
      return genericSuccess();
    }
    console.error("Password reset request failed:", error);
    return NextResponse.json({ error: "Failed to process password reset" }, { status: 500 });
  }
}
