"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Sparkles, Mail } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { sendWelcomeEmailDirect } from "@/lib/email-utils";
import { handleFirstLogin } from "@/lib/automated-email-service";
import { AnimatedCharacters } from "@/components/ui/animated-characters";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { toPublicProfile } from "@/lib/public-profile";
import { LanguageToggle } from "@/components/language-toggle";
import { getAdminEmails } from "./actions";

const PRIMARY_ADMIN_EMAIL = "mike@yinhng.com";

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function isPrimaryAdminEmail(email?: string | null) {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

async function bootstrapProfileOnServer(user: User, userData: Record<string, any>) {
  const token = await user.getIdToken(true);
  const response = await fetch("/api/auth/bootstrap-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const fallbackError = await response.text().catch(() => "");
    throw new Error(fallbackError || `Bootstrap failed with ${response.status}`);
  }
}

function buildFallbackUserData(user: User, emailHint?: string | null) {
  const resolvedEmail = user.email || emailHint || "";
  const displayName =
    user.displayName ||
    resolvedEmail.split("@")[0] ||
    "User";

  return {
    uid: user.uid,
    displayName,
    email: resolvedEmail,
    role: isPrimaryAdminEmail(resolvedEmail) ? "admin" : "employee",
    firstName: displayName,
    lastName: "",
    photoURL: user.photoURL || "",
  };
}

function isFirestorePermissionError(error: unknown) {
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? String((error as { message?: string }).message)
      : "";

  return code.includes("permission-denied") || /insufficient permissions/i.test(message);
}

function redirectByRole(router: ReturnType<typeof useRouter>, role?: string | null) {
  if (role === "admin") {
    router.push("/admin");
    return;
  }
  if (role === "employer") {
    router.push("/employer/dashboard");
    return;
  }
  router.push("/dashboard");
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const email = form.watch("email");
  const password = form.watch("password");

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      form.setValue("email", emailFromQuery);
    }
  }, [form, searchParams]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );
      const user = userCredential.user;
      const userDocRef = doc(db, "users", user.uid);
      const fallbackData = buildFallbackUserData(user, values.email);
      let userData: Record<string, any> = fallbackData;
      let hasStoredProfile = false;

      try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          hasStoredProfile = true;
          userData = {
            ...fallbackData,
            ...userDocSnap.data(),
          };
        }
      } catch (profileError) {
        console.error("Profile read failed during login, continuing with fallback profile:", profileError);
      }

      if (isPrimaryAdminEmail(user.email) && userData.role !== "admin") {
        userData = { ...userData, role: "admin" };
      }

      try {
        await bootstrapProfileOnServer(user, { uid: user.uid, ...userData });
      } catch {
        try {
          await setDoc(
            doc(db, "publicProfiles", user.uid),
            toPublicProfile({ uid: user.uid, ...userData }),
            { merge: true },
          );
        } catch (syncError) {
          console.error("Failed to sync user profile on login:", syncError);
        }
      }

      if (hasStoredProfile) {
        try {
          await handleFirstLogin(
            user.uid,
            user.email || fallbackData.email,
            userData?.displayName || user.email || fallbackData.email,
          );
        } catch (automationError) {
          console.error("First-login automation failed:", automationError);
        }
      }

      redirectByRole(router, userData?.role);
    } catch (err: any) {
      const authenticatedUser = auth.currentUser;
      if (
        authenticatedUser &&
        normalizeEmail(authenticatedUser.email) === normalizeEmail(values.email) &&
        isFirestorePermissionError(err)
      ) {
        console.warn(
          "Login succeeded but profile sync hit a permission error; continuing with fallback profile.",
          err,
        );
        const fallbackData = buildFallbackUserData(authenticatedUser, values.email);
        redirectByRole(router, fallbackData.role);
        return;
      }

      const code = err?.code as string | undefined;
      const message =
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
          ? "Email or password is incorrect. Please try again."
          : code === "auth/invalid-email"
            ? "Invalid email format. Please check and try again."
            : err?.message || "Invalid email or password. Please try again.";
      setError(message);
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      let userDocData: Record<string, any> | null = null;

      try {
        const userDocSnap = await getDoc(userDocRef);
        userDocData = userDocSnap.exists() ? userDocSnap.data() : null;
      } catch (profileError) {
        console.error("Profile read failed during Google sign-in, continuing with fallback profile:", profileError);
      }

      if (!userDocData) {
        // New user logic
        let adminEmails: string[] = [];
        try {
          adminEmails = await getAdminEmails();
        } catch (adminEmailError) {
          console.error("Failed to load admin email list during Google sign-in:", adminEmailError);
        }
        const normalizedEmail = normalizeEmail(user.email);
        const isAdmin = isPrimaryAdminEmail(user.email) || adminEmails.includes(normalizedEmail);

        const emailDomain = user.email?.split("@")[1];
        const role = isAdmin ? "admin" : (emailDomain === "gmail.com" ? "employee" : "employer");

        const nameParts = user.displayName?.split(" ") || [];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const userData = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          role: role,
          photoURL: user.photoURL,
          firstName: firstName,
          lastName: lastName,
          ...(role === "employer" && { companyName: user.displayName }),
        };

        try {
          await bootstrapProfileOnServer(user, userData);
        } catch {
          try {
            await setDoc(userDocRef, userData, { merge: true });
            await setDoc(
              doc(db, "publicProfiles", user.uid),
              toPublicProfile(userData as any),
              { merge: true },
            );
          } catch (syncError) {
            console.error("Failed to persist Google sign-in fallback profile:", syncError);
          }
        }

        try {
          await sendWelcomeEmailDirect(
            user.email!,
            user.displayName!,
          );
        } catch (welcomeError) {
          console.error("Failed to send Google welcome email:", welcomeError);
        }

        // Handle first login for new Google users
        try {
          await handleFirstLogin(user.uid, user.email!, user.displayName!);
        } catch (automationError) {
          console.error("Google first-login automation failed:", automationError);
        }

        toast({
          title: "Account Created",
          description: "Welcome! Your account has been set up.",
        });

        redirectByRole(router, role);
      } else {
        // Existing user logic
        const userData = { ...userDocData };
        if (isPrimaryAdminEmail(user.email) && userData.role !== "admin") {
          userData.role = "admin";
        }

        try {
          await bootstrapProfileOnServer(user, { uid: user.uid, ...userData });
        } catch {
          try {
            await setDoc(
              doc(db, "publicProfiles", user.uid),
              toPublicProfile({ uid: user.uid, ...userData }),
              { merge: true },
            );
          } catch (syncError) {
            console.error("Failed to sync public profile for existing user:", syncError);
          }
        }
        redirectByRole(router, userData.role);
      }
    } catch (err: any) {
      const authenticatedUser = auth.currentUser;
      if (authenticatedUser && isFirestorePermissionError(err)) {
        console.warn(
          "Google sign-in succeeded but profile sync hit a permission error; continuing with fallback profile.",
          err,
        );
        const fallbackData = buildFallbackUserData(authenticatedUser, authenticatedUser.email);
        redirectByRole(router, fallbackData.role);
        return;
      }

      toast({
        title: "Google Sign-In Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-30">
        <LanguageToggle />
      </div>
      {/* Left Content Section with Animated Characters */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-white/90 dark:via-white/80 dark:to-white/70 p-12 text-white dark:text-gray-900">
        <div className="relative z-20">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <span className="text-2xl font-extrabold tracking-[0.25em] uppercase text-foreground drop-shadow-sm">
              YINHNG
            </span>
          </Link>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <AnimatedCharacters
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={password.length}
          />
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-gray-600 dark:text-gray-700">
          <a
            href="/privacy-policy"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Terms of Service
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-gray-400/20 dark:bg-gray-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-gray-300/20 dark:bg-gray-200/20 rounded-full blur-3xl" />
      </div>

      {/* Right Login Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <span className="text-2xl font-extrabold tracking-[0.25em] uppercase text-foreground drop-shadow-sm">
              YINHNG
            </span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome back!
            </h1>
            <p className="text-muted-foreground text-sm">
              Please enter your details
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="off"
                {...form.register("email")}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                className="h-12 bg-background border-border/60 focus:border-primary"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...form.register("password")}
                  className="h-12 pr-10 bg-background border-border/60 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                >
                  Remember for 30 days
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg">
                {error}
              </div>
            )}

            <InteractiveHoverButton
              type="submit"
              text={isLoading ? "Signing in..." : "Log in"}
              className="w-full h-12 text-base font-medium"
              disabled={isLoading}
            />
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <InteractiveHoverButton
              type="button"
              text="Log in with Google"
              className="w-full h-12 border-border/60"
              onClick={handleGoogleSignIn}
              icon={
                <svg
                  className="h-5 w-5"
                  aria-hidden="true"
                  focusable="false"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 488 512"
                >
                  <path
                    fill="currentColor"
                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 76.2C322.3 113.2 289.4 96 248 96c-88.8 0-160.1 71.9-160.1 160.1s71.3 160.1 160.1 160.1c98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"
                  ></path>
                </svg>
              }
            />
          </div>

          {/* Sign Up Link */}
          <div className="text-center text-sm text-muted-foreground mt-8">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-foreground font-medium hover:underline"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
