"use client";

import { makePage } from "@keystatic/next/ui/app";
import keystaticConfig from "../../../keystatic.config";
import { LogoutButton } from "@/components/LogoutButton";

const KeystaticPage = makePage(keystaticConfig);

export default function Page() {
  return (
    <>
      <KeystaticPage />
      <LogoutButton />
    </>
  );
}
