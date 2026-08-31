import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { UserProvider } from '@/lib/user-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AnirajBilders - Construction Management',
    description: 'A full-featured construction management application',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    <SessionProvider>
                        <UserProvider>
                            {children}
                        </UserProvider>
                    </SessionProvider>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                        }}
                    />
                </ThemeProvider>
            </body>
        </html>
    );
}
