import type { Metadata } from "next";
import { AtlasExperience } from "@/components/atlas-experience";

export const metadata: Metadata = { title: "The Atlas — Zero Meridian" };

export default function AtlasPage() {
  return <AtlasExperience />;
}
