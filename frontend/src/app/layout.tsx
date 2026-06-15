import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartReach AI CRM | Intelligent Shopper Engagement",
  description: "AI-Native CRM platform for brands to identify customer segments, generate personalized campaigns, and analyze performance with AI.",
  keywords: "CRM, AI, marketing, customer segmentation, campaign management",
  openGraph: {
    title: "SmartReach AI CRM",
    description: "AI-Native CRM for intelligent shopper engagement",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'hsl(222 47% 9%)',
              color: 'hsl(213 31% 91%)',
              border: '1px solid hsl(222 47% 20%)',
              borderRadius: '10px',
            },
            success: {
              iconTheme: {
                primary: 'hsl(217 91% 60%)',
                secondary: 'hsl(222 47% 9%)',
              },
            },
            error: {
              iconTheme: {
                primary: 'hsl(0 72% 51%)',
                secondary: 'hsl(222 47% 9%)',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
