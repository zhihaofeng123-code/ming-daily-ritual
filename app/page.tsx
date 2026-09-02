import { Suspense } from "react";
import { RitualApp } from "@/components/ming/ritual-app";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RitualApp />
    </Suspense>
  );
}
