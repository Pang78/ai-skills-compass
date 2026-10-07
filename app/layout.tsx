import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AI Skills Compass — Find your next move", description: "A thoughtfully curated guide to AI courses. Find practical skills for your work, compare courses, and explore your learning pathway.", icons: {icon:"/favicon.svg"} };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>}
