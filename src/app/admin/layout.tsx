import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ChefHat } from "lucide-react";
import { LoginForm } from "@/app/kitchen/login-form";
import { isKitchenAuthed, isKitchenConfigured } from "@/lib/kitchen-auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/slots", label: "Slots" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/kitchen", label: "Kitchen" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isKitchenConfigured()) {
    return (
      <Centered>
        <p className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Set <code className="mx-1 font-mono">KITCHEN_PASSWORD</code> (at least
          8 characters) in <code className="mx-1 font-mono">.env.local</code> and
          restart the server.
        </p>
      </Centered>
    );
  }

  if (!(await isKitchenAuthed())) {
    return (
      <Centered>
        <h1 className="mb-6 flex items-center gap-2 font-display text-xl font-bold">
          <ChefHat className="size-5 text-primary" aria-hidden />
          Joy&rsquo;s Food admin
        </h1>
        <LoginForm next="/admin/menu" />
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          <Link
            href="/admin/menu"
            className="flex items-center gap-2 font-display text-lg font-bold"
          >
            <ChefHat className="size-5 text-primary" aria-hidden />
            Admin
          </Link>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-text"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="ml-auto text-sm text-muted hover:text-primary"
          >
            View storefront ↗
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1140px] px-4 py-8">{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      {children}
    </div>
  );
}
