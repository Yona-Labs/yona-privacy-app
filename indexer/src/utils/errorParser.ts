/**
 * Error parser for Anchor program errors
 * Converts raw error objects to human-readable messages
 */

interface ProgramError {
  code: number;
  name: string;
  msg: string;
}

// Zkcash program errors from IDL
const PROGRAM_ERRORS: ProgramError[] = [
  {
    code: 6000,
    name: "Unauthorized",
    msg: "Not authorized to perform this action"
  },
  {
    code: 6001,
    name: "ExtDataHashMismatch",
    msg: "External data hash does not match the one in the proof"
  },
  {
    code: 6002,
    name: "UnknownRoot",
    msg: "Root is not known in the tree"
  },
  {
    code: 6003,
    name: "InvalidPublicAmountData",
    msg: "Public amount is invalid"
  },
  {
    code: 6004,
    name: "InsufficientFundsForWithdrawal",
    msg: "Insufficient funds for withdrawal"
  },
  {
    code: 6005,
    name: "InsufficientFundsForFee",
    msg: "Insufficient funds for fee"
  },
  {
    code: 6006,
    name: "InvalidProof",
    msg: "Proof is invalid"
  },
  {
    code: 6007,
    name: "InvalidFee",
    msg: "Invalid fee: fee must be less than MAX_ALLOWED_VAL (2^248)."
  },
  {
    code: 6008,
    name: "InvalidExtAmount",
    msg: "Invalid ext amount: absolute ext_amount must be less than MAX_ALLOWED_VAL (2^248)."
  },
  {
    code: 6009,
    name: "PublicAmountCalculationError",
    msg: "Public amount calculation resulted in an overflow/underflow."
  },
  {
    code: 6010,
    name: "ArithmeticOverflow",
    msg: "Arithmetic overflow/underflow occurred"
  },
  {
    code: 6011,
    name: "DepositLimitExceeded",
    msg: "Deposit limit exceeded"
  },
  {
    code: 6012,
    name: "InvalidFeeRate",
    msg: "Invalid fee rate: must be between 0 and 10000 basis points"
  },
  {
    code: 6013,
    name: "InvalidFeeRecipient",
    msg: "Fee recipient does not match global configuration"
  },
  {
    code: 6014,
    name: "InvalidFeeAmount",
    msg: "Fee amount is below minimum required (must be at least (1 - fee_error_margin) * expected_fee)"
  },
  {
    code: 6015,
    name: "RecipientMismatch",
    msg: "Recipient account does not match the ExtData recipient"
  },
  {
    code: 6016,
    name: "MerkleTreeFull",
    msg: "Merkle tree is full: cannot add more leaves"
  },
  {
    code: 6017,
    name: "UnsupportedMintAddress",
    msg: "Unsupported mint address"
  },
  {
    code: 6018,
    name: "DualTokenNotSupported",
    msg: "Dual-token transactions are not yet supported"
  },
  {
    code: 6019,
    name: "InvalidJupiterSwapData",
    msg: "Invalid Jupiter swap data"
  },
  {
    code: 6020,
    name: "MathOverflow",
    msg: "Math overflow or underflow occurred"
  },
  {
    code: 6021,
    name: "InsufficientSwapOutput",
    msg: "Insufficient swap output: received amount is less than minimum required"
  }
];

/**
 * Parse transaction error and return human-readable message
 * @param error Raw error object from Solana transaction
 * @returns Human-readable error message
 */
export function parseTransactionError(error: any): string {
  if (!error) {
    return "Unknown error occurred";
  }

  // Handle InstructionError format: {"InstructionError":[index,{"Custom":code}]}
  if (error.InstructionError && Array.isArray(error.InstructionError)) {
    const [instructionIndex, errorDetail] = error.InstructionError;
    
    if (errorDetail && typeof errorDetail === 'object' && 'Custom' in errorDetail) {
      const errorCode = errorDetail.Custom;
      const programError = PROGRAM_ERRORS.find(e => e.code === errorCode);
      
      if (programError) {
        return programError.msg;
      }
      
      return `Program error (code ${errorCode})`;
    }
  }

  // Handle other error formats
  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  // Fallback to JSON string
  return JSON.stringify(error);
}

/**
 * Get error code from transaction error
 * @param error Raw error object from Solana transaction
 * @returns Error code or null if not found
 */
export function getErrorCode(error: any): number | null {
  if (!error) {
    return null;
  }

  if (error.InstructionError && Array.isArray(error.InstructionError)) {
    const [, errorDetail] = error.InstructionError;
    
    if (errorDetail && typeof errorDetail === 'object' && 'Custom' in errorDetail) {
      return errorDetail.Custom;
    }
  }

  return null;
}
