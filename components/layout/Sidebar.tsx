"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";

type SidebarRole = "client" | "freelancer";

interface SidebarProps {
  role: SidebarRole;
}

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const navByRole: Record<SidebarRole, NavItem[]> = {
  client: [
    {
      href: "/client",
      label: "Dashboard",
      exact: true,
    },
    {
      href: "/client/jobs/new",
      label: "Post Job",
      exact: true,
    },
    {
      href: "/client/contracts",
      label: "Contracts",
      exact: true,
    },
  ],
  freelancer: [
    {
      href: "/freelancer",
      label: "Dashboard",
      exact: true,
    },
    {
      href: "/freelancer/jobs",
      label: "Browse Jobs",
      exact: true,
    },
    {
      href: "/freelancer/contracts",
      label: "Contracts",
      exact: true,
    },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useSession();
  const navItems = navByRole[role];

  const handleLogout = () => {
    logout();
    router.replace("/auth/login");
  };

  return (
    <aside className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">WorkIt</h1>
        <p className="text-sm text-muted-foreground">Signed in as {role}</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
        Logout
      </Button>
    </aside>
  );
}
