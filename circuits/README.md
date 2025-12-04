# Zert Circuits

**Note**: Circuit source files (*.circom) and build artifacts are temporarily hidden from the repository due to ongoing security audit. They will be made public after the audit is completed. Dm if you need them.

This directory contains zero-knowledge circuits for privacy-preserving transactions on Solana using Groth16 proofs.

## Overview

The circuits implement a UTXO-based privacy protocol that enables:
- Private transfers with hidden amounts and recipients
- Multi-asset support (SOL and SPL tokens)
- JoinSplit transactions with multiple inputs and outputs
- Merkle tree-based commitment verification
- Nullifier generation to prevent double-spending

## Architecture

### UTXO Model

Each UTXO (Unspent Transaction Output) contains:
- `amount`: The token amount
- `pubkey`: Recipient's public key
- `blinding`: Random value for privacy
- `mintAddress`: Token mint address (SOL or SPL token)

### Core Cryptographic Primitives

**Commitment**: 
```
commitment = Poseidon(amount, pubKey, blinding, mintAddress)
```

**Nullifier**: 
```
nullifier = Poseidon(commitment, merklePath, signature(privKey, commitment, merklePath))
```

### Circuit Components

- **Transaction Circuit**: Main JoinSplit circuit with configurable inputs/outputs
  - Merkle proof verification for input commitments
  - Nullifier computation and uniqueness checking
  - Output commitment generation
  - Amount invariant verification per token
  - Multi-asset support with dual mint addresses

- **Keypair Circuit**: EdDSA keypair derivation and signature verification

- **Merkle Proof Circuit**: Poseidon-based Merkle tree membership proofs

## Build Process

The `build.sh` script generates all necessary artifacts:

1. **Compilation**: Compiles circom circuits to R1CS constraints
2. **Setup**: Generates proving and verification keys using Powers of Tau
3. **Witness Generator**: Creates WASM and C++ witness calculators
4. **Verification Key**: Exports key for on-chain verification

### Generated Artifacts

- `*.r1cs`: Rank-1 Constraint System
- `*.wasm`: WebAssembly witness generator
- `*.sym`: Symbol table for debugging
- `*.zkey`: Proving key
- `verifyingkey2.json`: Verification key for Solana program
- `*_js/`: JavaScript witness calculator
- `*_cpp/`: C++ witness calculator

## Security Features

- **Zero-knowledge privacy**: Transaction details remain hidden
- **Double-spend prevention**: Nullifier uniqueness enforced
- **Amount conservation**: Input/output sums verified per token
- **Merkle authentication**: Only valid commitments can be spent
- **Signature verification**: Only key owners can spend UTXOs

## References

Based on proven designs:
- [Groth16 Solana](https://github.com/Lightprotocol/groth16-solana) - On-chain verification
- [Tornado Nova](https://github.com/tornadocash/tornado-nova) - Multi-asset privacy pools

---

