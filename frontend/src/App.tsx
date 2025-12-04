import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletContextProvider } from "@/components/wallet";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import Shield from "@/pages/Shield";
import Unshield from "@/pages/Unshield";
import Swap from "@/pages/Swap";
import Portfolio from "@/pages/Portfolio";
import Bridge from "./pages/Bridge";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WalletContextProvider>
          <div className="flex flex-col min-h-dvh max-w-fhd-screen mx-auto">
            <Header />

            {/* Background Blur */}
            <div className="absolute top-[39%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[249px] h-[249px] bg-primary rounded-full blur-[90px] -z-1" />

            <div className="flex-1 flex-col flex pb-[4vh] pt-[2vh] md:pt-[4vh] lg:pt-[12vh]">
              <main className="flex flex-col gap-4 mx-auto w-full px-2 xs:px-8 md:px-0 md:w-[560px] min-h-[480px]">
                <Routes>
                  <Route path="/shield" element={<Shield />} />
                  <Route path="/unshield" element={<Unshield />} />
                  <Route path="/swap" element={<Swap />} />
                  <Route path="/bridge" element={<Bridge />} />
                  <Route path="/portfolio" element={<Portfolio />} />

                  <Route path="*" element={<Navigate to="/shield" replace />} />
                </Routes>
              </main>
            </div>
          </div>
          <Toaster />
        </WalletContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
