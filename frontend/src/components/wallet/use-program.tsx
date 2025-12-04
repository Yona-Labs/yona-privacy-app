import { useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/sdk/utils/constants";

export interface ProgramAccounts {
  treeAccount: PublicKey;
  treeTokenAccount: PublicKey;
  globalConfigAccount: PublicKey;
}

export const useProgram = () => {
  const programAccounts = useMemo<ProgramAccounts>(() => {
    const [treeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("merkle_tree")],
      PROGRAM_ID
    );

    const [treeTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("tree_token_account")],
      PROGRAM_ID
    );

    const [globalConfigAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      PROGRAM_ID
    );

    return {
      treeAccount,
      treeTokenAccount,
      globalConfigAccount,
    };
  }, []);

  return {
    programId: PROGRAM_ID,
    programAccounts,
  };
};
