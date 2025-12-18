import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Utxo } from '@/lib/sdk/models/utxo';
import { getTokenInfo as getTokenMetadata } from '@/lib/sdk/utils/tokenInfo';
import { formatNumber } from '@/lib/utils/formatNumber';

interface UtxoListProps {
  utxos: Utxo[];
}

export const UtxoList = ({ utxos }: UtxoListProps) => {
  if (utxos.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-primary-bg rounded-lg border border-primary-border overflow-hidden">
      <div className="p-6 border-b border-primary-border">
        <h3 className="text-lg font-semibold text-primary-text">UTXOs List</h3>
        <p className="text-sm text-secondary-text mt-1">
          Individual unspent transaction outputs
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary-bg">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Index
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Public Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Mint
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-border">
            {utxos.map((utxo, idx) => {
              // Get token metadata from mint address (which is stored as field element in UTXO)
              const tokenInfo = getTokenMetadata(utxo.mintAddress);
              const divisor = Math.pow(10, tokenInfo.decimals);
              const amount = utxo.amount.toNumber() / divisor;

              return (
                <tr key={idx} className="hover:bg-secondary-bg transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-primary to-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-text font-bold text-xs">{idx + 1}</span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-primary-text">
                          #{utxo.index}
                        </div>
                        <div className="text-xs text-secondary-text">Tree Index</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-primary-text">
                      {formatNumber(amount)} {tokenInfo.symbol}
                    </div>
                    <div className="text-xs text-secondary-text font-mono">
                      {utxo.amount.toString()} {tokenInfo.decimals === 9 ? 'lamports' : 'units'}
                    </div>
                    <div className="text-xs text-secondary-text">
                      {tokenInfo.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-text font-mono">
                      {utxo.keypair.pubkey.toString().substring(0, 8)}...
                      {utxo.keypair.pubkey.toString().substring(utxo.keypair.pubkey.toString().length - 6)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-text font-mono">
                      {utxo.mintAddress.substring(0, 4)}...{utxo.mintAddress.substring(utxo.mintAddress.length - 4)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

