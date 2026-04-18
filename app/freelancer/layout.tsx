import { SessionGuard } from "@/components/layout/SessionGuard";
import { RoleSetupBanner } from "@/components/layout/RoleSetupBanner";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { Sidebar } from "@/components/layout/Sidebar";

interface FreelancerLayoutProps {
  children: React.ReactNode;
}

export default function FreelancerLayout({ children }: FreelancerLayoutProps) {
  return (
    <SessionGuard>
      <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
        <aside className="border-r bg-background p-4 md:p-6">
          <Sidebar role="freelancer" />
          <div className="mt-4 space-y-3">
            <RoleSwitcher />
            <RoleSetupBanner />
          </div>
        </aside>

        <div className="bg-muted/20">{children}</div>
      </div>
    </SessionGuard>
  );
}
