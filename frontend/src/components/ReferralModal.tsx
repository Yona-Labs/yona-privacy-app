import { FC, useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

interface ReferralModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReferralModal: FC<ReferralModalProps> = ({ isOpen, onClose }) => {
    const { publicKey } = useWallet();
    const [copied, setCopied] = useState(false);

    // Generate referral link based on wallet address
    const referralLink = publicKey
        ? `${window.location.origin}/?ref=${publicKey.toBase58()}`
        : "";

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onClose]);

    // Reset copied state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        if (!referralLink) return;

        try {
            await navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-md mx-4 bg-secondary-bg border border-primary-border/20 rounded-2xl shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 px-5 border-b border-primary-border/50">
                    <h2 className="text-xl font-bold text-primary-text">Referral Link</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-primary-bg rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5 text-primary-text" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-primary-text text-sm leading-relaxed">
                        You will receive 10% of referred users' fees and they will receive a 10% discount.{" "}
                        <a
                            href="https://docs.yona.cash"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-button-bg hover:underline"
                        >
                            See the Docs
                        </a>{" "}
                        for more.
                    </p>

                    {/* Referral Link Input */}
                    <div className="relative">
                        <input
                            type="text"
                            readOnly
                            value={referralLink}
                            className="w-full pr-12 pl-4 py-3 bg-primary-bg border border-primary-border/20 rounded-xl text-primary-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder={!publicKey ? "Connect wallet to generate referral link" : ""}
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={!referralLink}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-secondary-bg rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title={copied ? "Copied!" : "Copy to clipboard"}
                        >
                            {copied ? (
                                <Check className="h-5 w-5 text-green-500" />
                            ) : (
                                <Copy className="h-5 w-5 text-primary-text" />
                            )}
                        </button>
                    </div>

                    {copied && (
                        <p className="text-green-500 text-sm text-center animate-fade-in">
                            Copied to clipboard!
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
};

