import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ChatBot from './components/ChatBot'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dentons People Search',
  description: 'Search and discover Dentons professionals',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <ChatBot />
      </body>
    </html>
  )
}
