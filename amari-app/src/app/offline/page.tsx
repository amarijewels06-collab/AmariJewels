import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Offline | Amari Jewels",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-6 py-12 text-[#211c18]">
      <section className="w-full max-w-md rounded-lg border border-[#ded6cc] bg-white p-8 shadow-[0_18px_50px_rgba(33,28,24,0.08)]">
        <Image src="/icons/icon.svg" alt="" width={56} height={56} className="mb-6" />
        <h1 className="text-4xl font-semibold leading-tight">You are offline</h1>
        <p className="mt-4 text-base leading-7 text-[#6d6258]">
          Amari Jewels needs a connection for live business records. Reconnect and try again.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-[#8a5a2b] px-5 font-semibold text-white"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
