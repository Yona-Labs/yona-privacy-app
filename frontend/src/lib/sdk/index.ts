import { getProgram } from "./program";
import { getMyUtxos, isUtxoSpent } from "./utils/getMyUtxos";
import {
  findMerkleTreePDA,
  findTreeTokenAccountPDA,
  findGlobalConfigPDA,
  findNullifierPDAs,
} from "./utils/derive";
import { Program } from "@coral-xyz/anchor";
import { Zert } from "./idl/zert";
import { ExtData, ProofInput, ProofToSubmit, SwapData } from "./utils/types";
import {
  buildWithdrawInstruction,
  buildSwapInstruction,
} from "./transactions/instructions";
import IDL from "./idl/zert.json";
import {
  LSK_ENCRYPTED_OUTPUTS,
  LSK_FETCH_OFFSET,
  PROGRAM_ID,
} from "./utils/constants";
import { swap, swapWithRelayer } from "./transactions";

export type { Zert, ExtData, ProofInput, ProofToSubmit, SwapData };
export {
  getProgram,
  getMyUtxos,
  isUtxoSpent,
  findMerkleTreePDA,
  findTreeTokenAccountPDA,
  findGlobalConfigPDA,
  findNullifierPDAs,
  Program,
  buildWithdrawInstruction,
  buildSwapInstruction,
  LSK_ENCRYPTED_OUTPUTS,
  LSK_FETCH_OFFSET,
  PROGRAM_ID,
  IDL,
  swap,
  swapWithRelayer,
};
