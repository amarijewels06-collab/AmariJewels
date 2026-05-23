"use client";

import { AppDataProvider } from "@/lib/app-data-context";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Gem,
  Home,
  LogOut,
  Menu,
  Package,
  PaintBucket,
  ReceiptText,
  Settings,
  Truck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "../ui/button";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/stock", icon: Package, label: "Stock" },
  { href: "/designs", icon: PaintBucket, label: "Designs" },
  { href: "/sales", icon: ReceiptText, label: "Sales" },
  { href: "/accounts", icon: BookOpen, label: "Account" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/profile", icon: UserCircle, label: "Profile" },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { credentials: "include", method: "POST" }).catch(() => null);
    router.push("/login");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-5">
        <Link className="flex items-center gap-3" href="/dashboard" onClick={onNavigate}>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-zinc-950 text-white">
            <Gem className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-zinc-950">Amari Jewels</span>
            <span className="block text-xs text-zinc-500">Operations MVP</span>
          </span>
        </Link>
      </div>

      <nav className="grid gap-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              className={[
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                active ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
              ].join(" ")}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-200 p-3">
        <Button className="w-full justify-start" onClick={logout} variant="ghost">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AppDataProvider>
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white lg:block">
        <NavContent />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <Link className="flex items-center gap-2 font-semibold text-zinc-950" href="/dashboard">
            <Gem className="h-5 w-5" />
            Amari
          </Link>
          <Button aria-label="Open navigation" onClick={() => setOpen(true)} size="icon" variant="ghost">
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {open ? (
          <div className="fixed inset-0 z-40 bg-zinc-950/30 lg:hidden">
            <aside className="h-full w-80 max-w-[86vw] bg-white shadow-2xl">
              <div className="flex justify-end p-2">
                <Button aria-label="Close navigation" onClick={() => setOpen(false)} size="icon" variant="ghost">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <NavContent onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main>{children}</main>
      </div>
    </div>
    </AppDataProvider>
  );
}
