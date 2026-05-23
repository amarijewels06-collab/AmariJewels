"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, LogIn } from "lucide-react";
import { Button } from "../ui/button";
import { FieldWrap, Input } from "../ui/field";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ password, username }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Invalid username or password");
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-zinc-100 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-white text-zinc-950">
            <Gem className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold">Amari Jewels</p>
            <p className="text-sm text-zinc-300">Jewelry operations</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-4xl font-semibold leading-tight tracking-normal">Focused tools for stock, designs, customers, and suppliers.</p>
          <p className="mt-5 text-base leading-7 text-zinc-300">
            Built for daily counter and back-office work, with the master data ready for sales and reporting later.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <form
          className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-zinc-950 text-white">
              <Gem className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-zinc-950">Amari Jewels</p>
              <p className="text-sm text-zinc-500">Operations MVP</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-950">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-500">Use your Amari Jewels account to continue.</p>

          <div className="mt-6 grid gap-4">
            <FieldWrap label="Username">
              <Input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Password">
              <Input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </FieldWrap>
            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <Button className="w-full" isLoading={loading} type="submit">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
