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
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

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

export default function SignupPage() {
  const router = useRouter();
  const { login, isAuthenticated, isHydrated } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
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
      const response = await fetch("/api/auth/signup", {
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
            : "Unable to sign up.";
        toast.error(message);
        return;
      }

      const userId =
        typeof payload === "object" && payload !== null && "user_id" in payload
          ? payload.user_id
          : null;

      if (typeof userId !== "number" && typeof userId !== "string") {
        toast.error("Invalid signup response.");
        return;
      }

      login(userId);
      toast.success("Account created successfully.");
      router.replace("/client");
    } catch {
      toast.error("Network error while signing up.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Create your WorkIt account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" autoComplete="given-name" {...form.register("firstName")} />
              {form.formState.errors.firstName?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name (optional)</Label>
              <Input id="lastName" autoComplete="family-name" {...form.register("lastName")} />
              {form.formState.errors.lastName?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
              ) : null}
            </div>

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
                autoComplete="new-password"
                {...form.register("password")}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-foreground underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
