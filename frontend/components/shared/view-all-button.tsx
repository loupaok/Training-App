import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function ViewAllButton({ children = "Προβολή όλων", onClick }: { children?: ReactNode; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="mt-5 h-11 w-full font-semibold hover:border-red-200 hover:text-red-600"
    >
      {children}
    </Button>
  );
}
