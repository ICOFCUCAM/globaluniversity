'use client';

// The complete Futureeducation student information system, mounted inside the
// university site at /portal. Provider stack mirrors the original App.tsx
// (the router is unnecessary here — Next.js owns the URL).
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import AppLayout from '@/components/AppLayout';

const queryClient = new QueryClient();

export default function PortalApp() {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppProvider>
              <div className="bg-background font-sans text-foreground">
                <AppLayout />
              </div>
            </AppProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
