"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="fixed bottom-4 right-4 z-[100] rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-navy-700"
    >
      Αποσύνδεση
    </button>
  );
}
