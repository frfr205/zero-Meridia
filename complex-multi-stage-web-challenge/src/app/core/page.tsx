import type { Metadata } from "next";
import { CoreExperience } from "@/components/core-experience";

export const metadata: Metadata = { title: "The Core — Zero Meridian" };

export default function CorePage() {
  return <CoreExperience />;
}
