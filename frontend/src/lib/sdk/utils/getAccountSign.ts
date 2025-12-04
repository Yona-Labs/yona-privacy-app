
import type { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { getWalletSignature } from '@/lib/wallet-storage';

const wallets = [
    { name: 'Phantom', check: (p: any) => p?.isPhantom },
    { name: 'Backpack', check: (p: any) => p?.isBackpack },
    { name: 'Solflare', check: (p: any) => p?.isSolflare },
    { name: 'Glow', check: (p: any) => p?.isGlow },
];

export type Signed = {
    publicKey: PublicKey,
    signature: Uint8Array
}

export async function getAccountSign(): Promise<Signed | undefined> {
    if (!('solana' in window)) {
        throw new Error('Solana wallet not found. Please install a Solana wallet extension.')
    }
    
    const anyWindow = window as any;
    let selectedProvider: any = null;
    
    for (const wallet of wallets) {
        if (wallet.check(anyWindow.solana)) {
            selectedProvider = anyWindow.solana;
            break;
        }

        if (wallet.name === 'Backpack' && anyWindow.backpack?.solana?.isBackpack) {
            selectedProvider = anyWindow.backpack.solana;
            break;
        }

        if (wallet.name === 'Solflare' && anyWindow.solflare?.isSolflare) {
            selectedProvider = anyWindow.solflare;
            break;
        }

        if (wallet.name === 'Glow' && anyWindow.glow?.solana?.isGlow) {
            selectedProvider = anyWindow.glow.solana;
            break;
        }
    }
    
    if (!selectedProvider) {
        throw new Error('No connected wallet provider found')
    }

    if (!selectedProvider.publicKey) {
        throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    const walletAddress = selectedProvider.publicKey.toBase58();

    // Get signature from localStorage (saved during wallet connection in wallet-button.tsx)
    const cachedSignatureBase58 = getWalletSignature(walletAddress);

    if (!cachedSignatureBase58) {
        throw new Error('Wallet signature not found. Please reconnect your wallet.');
    }

    try {
        const signature = bs58.decode(cachedSignatureBase58);
        
        if (!(signature instanceof Uint8Array)) {
            throw new Error('Invalid signature format');
        }

        return { 
            signature, 
            publicKey: selectedProvider.publicKey 
        };
    } catch (err) {
        console.error('Failed to decode wallet signature:', err);
        throw new Error('Invalid signature in storage. Please reconnect your wallet.');
    }
}
