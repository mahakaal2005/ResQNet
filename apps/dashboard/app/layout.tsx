import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "ResQNet Command", description: "Disaster response command dashboard" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
