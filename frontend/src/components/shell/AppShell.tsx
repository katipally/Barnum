"use client";

import type { ReactNode } from "react";
import { AskCmoProvider } from "@/components/chat/AskCmoContext";
import { AskDrawer } from "@/components/chat/AskDrawer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useDefaultCompany } from "./useDefaultCompany";

// Frame for every page: sidebar (top nav under 900px), top bar, content column and the Ask the CMO drawer.
export function AppShell({ children }: { children: ReactNode }) {
  const ready = useDefaultCompany();
  return (
    <AskCmoProvider>
      <div className="min-h-screen bg-bg text-ink">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col min-[900px]:pl-64">
          <TopBar />
          <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-10">
            {ready ? children : <div aria-busy className="min-h-[50vh]" />}
          </main>
        </div>
        <AskDrawer />
      </div>
    </AskCmoProvider>
  );
}
