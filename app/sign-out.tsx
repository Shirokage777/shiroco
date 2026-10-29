"use client";

import { useRouter } from "next/navigation";

export default function SignOut() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }
  return <button onClick={signOut}>Sign out</button>;
}
