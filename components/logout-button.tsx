"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <Button
      variant="outline"
      className="rounded-full border-[#140a2e]/20 bg-white/60 text-[#140a2e] hover:bg-white hover:text-[#140a2e] dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white"
      onClick={logout}
    >
      Logout
    </Button>
  );
}
