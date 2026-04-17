import type { Metadata } from "next"
import { Playfair_Display, DM_Sans, Bree_Serif, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme/theme-provider"

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-playfair" })
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans" })
const breeSerif = Bree_Serif({ subsets: ["latin"], weight: ["400"], variable: "--font-bree-serif" })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono" })

export const metadata: Metadata = {
  title: "Newsreel Contributor",
  description: "A place for trusted voices to find new audiences",
  icons: {
    icon: "/logo/newsreel-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.className} ${playfair.variable} ${breeSerif.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
