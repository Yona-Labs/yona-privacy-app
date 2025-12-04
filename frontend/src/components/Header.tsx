import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { WalletButton } from "@/components/wallet";
import { NavLink } from "@/components/NavLink";
import {
  SwapIcon,
  ShieldIcon,
  UnshieldIcon,
  PortfolioIcon,
  BridgeIcon,
} from "@/components/icons";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1030);
    };

    // Check on mount
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="relative px-5">
      {/* Desktop Header */}
      <div className={`flex items-center gap-y-4 py-4 lg:px-8 ${isMobile ? 'flex-col' : 'flex-row justify-between px-4'}`}>
        <div className={`flex justify-between items-center ${isMobile ? 'w-full' : 'w-fit'}`}>
          <h1 className={`flex gap-2 items-end lg:flex-1 shrink-0 text-primary-text h-full ${isMobile ? 'justify-center' : 'justify-start'}`}>
            <img src="icons/logo.svg" alt="Yona Zert Logo" className="h-8" />
          </h1>
          
          {/* Hamburger Menu Button - Mobile Only */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg hover:bg-primary-border/30 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-primary-text" />
            ) : (
              <Menu className="h-6 w-6 text-primary-text" />
            )}
          </button>
        </div>

        {/* Desktop Navigation */}
        <nav className={`lg:flex mx-4 w-fit ${isMobile ? 'hidden' : 'block'}`}>
          <ul className="flex justify-center gap-2">
            <NavLink to="/shield" name="Shield" icon={ShieldIcon} />
            <NavLink to="/unshield" name="Unshield" icon={UnshieldIcon} />
            <NavLink to="/swap" name="Swap" icon={SwapIcon} />
            <NavLink to="/bridge" name="Bridge" icon={BridgeIcon} />
            <NavLink to="/portfolio" name="Portfolio" icon={PortfolioIcon} />
          </ul>
        </nav>

        <div className={`gap-4 items-center lg:flex w-fit ${isMobile ? 'hidden' : 'flex justify-end'}`}>
          <WalletButton />
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className={`absolute w-fit top-full right-0 bg-secondary-bg shadow-lg z-50 rounded-xl ${isMobile ? 'block' : 'hidden'}`}>
          <nav className="p-4 flex flex-col justify-end items-center">
            <ul className="space-y-2">
              <li onClick={closeMobileMenu}>
                <NavLink to="/shield" name="Shield" icon={ShieldIcon} />
              </li>
              <li onClick={closeMobileMenu}>
                <NavLink to="/unshield" name="Unshield" icon={UnshieldIcon} />
              </li>
              <li onClick={closeMobileMenu}>
                <NavLink to="/swap" name="Swap" icon={SwapIcon} />
              </li>
              <li onClick={closeMobileMenu}>
                <NavLink to="/bridge" name="Bridge" icon={BridgeIcon} />
              </li>
              <li onClick={closeMobileMenu}>
                <NavLink to="/portfolio" name="Portfolio" icon={PortfolioIcon} />
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-primary-border">
              <WalletButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
