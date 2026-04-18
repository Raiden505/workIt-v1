"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks/useSession";

export default function HomePage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useSession();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (isAuthenticated) {
      router.replace("/client");
      return;
    }

    router.replace("/auth/login");
  }, [isAuthenticated, isHydrated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Redirecting...
    </div>
  );
}
