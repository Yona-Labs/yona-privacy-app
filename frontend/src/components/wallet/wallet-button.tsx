import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import bs58 from "bs58";
import { saveWalletSignature, getWalletSignature } from "@/lib/wallet-storage";
import { Copy, Power, Check } from "lucide-react";

export const WalletButton = () => {
  const { publicKey, signMessage, connected, wallet, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [hasSignedMessage, setHasSignedMessage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ensure component is mounted before accessing localStorage
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only run on client side after component is mounted
    if (!isMounted) {
      return;
    }

    const signMessageOnConnect = async () => {
      if (connected && publicKey && signMessage && !hasSignedMessage) {
        const walletAddress = publicKey.toBase58();

        // Check if signature already exists in localStorage
        const existingSignature = getWalletSignature(walletAddress);
        if (existingSignature) {
          console.log("Signature already exists for wallet:", walletAddress);
          setHasSignedMessage(true);
          return;
        }

        try {
          // Create a message to sign
          const message = `Sign this message to authenticate with Zert\n\nWallet: ${walletAddress}`;
          const encodedMessage = new TextEncoder().encode(message);

          // Request signature from wallet
          const signature = await signMessage(encodedMessage);

          // Convert signature to base58 for display/storage
          const signatureBase58 = bs58.encode(signature);

          // Save signature to localStorage with wallet address as key
          saveWalletSignature(walletAddress, signatureBase58);

          console.log("Message signed successfully");
          console.log("Signature:", signatureBase58);
          console.log("Public Key:", walletAddress);
          console.log("Saved to localStorage");

          setHasSignedMessage(true);
        } catch (error) {
          console.error("Failed to sign message:", error);
        }
      }
    };

    signMessageOnConnect();
  }, [isMounted, connected, publicKey, signMessage, hasSignedMessage]);

  // Reset the signed state when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setHasSignedMessage(false);
    }
  }, [connected]);

  const handleCopy = async () => {
    if (!publicKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex items-center gap-4">
        <div className="bg-secondary-bg rounded-lg h-10 px-4 text-sm font-medium opacity-50 flex items-center">
          Loading...
        </div>
      </div>
    );
  }

  // If not connected, show connect button
  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="bg-primary hover:opacity-90 text-primary-text rounded-lg h-10 px-4 text-sm font-medium transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }

  const walletIcon = wallet?.adapter?.icon;
  const address = publicKey.toBase58();

  return (
    <div className="flex items-center gap-2">
      {/* Main container with wallet icon, address, and copy button - entire area is clickable */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 bg-secondary-bg hover:opacity-80 rounded-lg px-3 py-2 h-10 transition-opacity cursor-pointer"
        title={copied ? "Copied!" : "Click to copy address"}
      >
        {/* Wallet Icon */}
        {walletIcon && (
          <img
            src={walletIcon}
            alt={wallet?.adapter?.name || "Wallet"}
            className="w-5 h-5 rounded shrink-0"
          />
        )}

        {/* Wallet Address */}
        <span className="text-primary-text text-sm font-medium whitespace-nowrap">
          {truncateAddress(address)}
        </span>

        {/* Copy/Check Icon */}
        {copied ? (
          <Check className="w-4 h-4 shrink-0 text-secondary-text" />
        ) : (
          <Copy className="w-4 h-4 text-secondary-text shrink-0" />
        )}
      </button>

      {/* Disconnect Button - outside the main container */}
      <button
        onClick={handleDisconnect}
        className="p-1 hover:opacity-70 rounded transition-opacity shrink-0 cursor-pointer bg-transparent"
        title="Disconnect"
      >
        <Power className="w-4 h-4 text-primary-text" />
      </button>
    </div>
  );
};
