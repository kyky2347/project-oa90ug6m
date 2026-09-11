import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
export const metadata: Metadata = {
  title: "PULSE — Urban Opportunity Intelligence",
  description:
    "Explore where London’s public-data signals suggest your next business location could be. Transparent scoring. Real evidence. An informed next move.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
