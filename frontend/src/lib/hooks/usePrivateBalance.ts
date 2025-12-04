import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import {
  getMyUtxos,
  groupUtxosByMint,
} from "@/lib/sdk/utils/getMyUtxos";
import { publicKeyToFieldElement } from "@/lib/sdk/utils/tokenInfo";
import BN from "bn.js";
import { TokenInfo } from "./useTokens";



export function usePrivateBalance(
  hasher: LightWasm | null,
  selectedToken: string,
  availableTokens: TokenInfo[]
): UseQueryResult<number, Error> {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["privateBalance", publicKey?.toString(), connected, selectedToken, hasher ? "hasher" : null],
    queryFn: async (): Promise<number> => {
      if (!publicKey || !connected || !hasher) {
        return 0;
      }

      try {
        const signed = await getAccountSign();
        if (!signed) {
          return 0;
        }

        const myUtxos = await getMyUtxos(signed, connection, () => { }, hasher);
        console.log("myUtxos:", myUtxos);
        const tokenMintField = publicKeyToFieldElement(selectedToken);
        const balancesByMint = groupUtxosByMint(myUtxos);
        const tokenBalance = balancesByMint.get(tokenMintField) || new BN(0);

        // Get token decimals from available tokens
        const tokenInfo = availableTokens.find(
          (t) => t.mint === selectedToken
        );
        const decimals = tokenInfo?.decimals || 9;
        const divisor = new BN(10).pow(new BN(decimals));
        const balanceInTokens =
          tokenBalance.div(divisor).toNumber() +
          tokenBalance.mod(divisor).toNumber() / divisor.toNumber();
        return balanceInTokens;

      } catch (err) {
        console.error("Error fetching private balance:", err);
        throw err;
      }
    },
    enabled: !!publicKey && connected && !!hasher,
  });
}

