"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/hooks/useSession";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

function getErrorMessage(errorPayload: unknown): string {
  if (typeof errorPayload === "string") {
    return errorPayload;
  }

  if (Array.isArray(errorPayload) && errorPayload.length > 0) {
    const firstError = errorPayload[0];
    if (typeof firstError === "object" && firstError !== null && "message" in firstError) {
      const message = firstError.message;
      if (typeof message === "string") {
        return message;
      }
    }
  }

  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isHydrated } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace("/client");
    }
  }, [isAuthenticated, isHydrated, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? getErrorMessage(payload.error)
            : "Unable to log in.";
        toast.error(message);
        return;
      }

      const userId =
        typeof payload === "object" && payload !== null && "user_id" in payload
          ? payload.user_id
          : null;

      if (typeof userId !== "number" && typeof userId !== "string") {
        toast.error("Invalid login response.");
        return;
      }

      login(userId);
      toast.success("Logged in successfully.");
      router.replace("/client");
    } catch {
      toast.error("Network error while logging in.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Access your WorkIt account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-foreground underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
