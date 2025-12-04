# Zert Protocol

**Zero-Knowledge Privacy Layer for Solana**

Zert is a Solana-based protocol for private DeFi using zero-knowledge proofs. It enables confidential deposits, swaps, and withdrawals of SOL and any SPL tokens while maintaining full verifiability on-chain.

Built on a sparse Merkle tree for UTXO commitments and Groth16 ZKPs for transaction validity, Zert ensures privacy without compromising security or scalability.

---

## Key Features

### Shield (Deposit)
Deposit any SPL token into the private pool with hidden amounts. Each UTXO internally tracks its mint, allowing you to hold multiple token types in a unified privacy set.

**Technology:**
- Modified Circom circuits based on Tornado Nova
- Multi-token balance changes in a single proof
- All UTXOs for all tokens stored together in one pool

### Private Swaps
Exchange any tokens atomically through Jupiter aggregator integration, including launchpad tokens. All swaps happen in a single instruction with full privacy.

**How it works:**
- Program authority (PDA) acts as the public buyer for all operations
- No copy-trading: external observers only see the program's PDA trading
- Ability to privately hold LST tokens, enabling private yield strategies
- Grows the anonymity set over time

### Unshield (Withdrawal)
Withdraw tokens to any address through a relayer, breaking on-chain linkages between deposits and withdrawals.

**Security:**
- All withdrawals processed through relayer
- Additional signature verification of withdrawal data in the smart contract
- No direct link between depositor and recipient

**Deployed Program:** `6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx`

---

## Architecture

### Smart Contract (Solana Program)
Location: `/program/`

**Core Components:**
- Sparse Merkle tree with 67M commitment capacity (height 26)
- Unified UTXO pool for all SPL tokens (SOL, USDC, USDT, LSTs, launchpad tokens)
- Nullifier registry for double-spend prevention
- Groth16 proof verification via Light Protocol
- Jupiter CPI integration for atomic swaps

**Instructions:**
- `deposit`: Shield any SPL token into private pool
- `withdraw`: Unshield tokens via relayer with signature verification
- `swap`: Private atomic swaps through Jupiter aggregator

**Technical Innovation:**
- Each UTXO internally tracks its mint type
- Multi-token support in single proof (modified Tornado Nova circuits)
- Program PDA acts as public trader, preventing copy-trading
- Single-instruction atomic swaps with full privacy

### Zero-Knowledge Circuits
Location: `/circuits/`

Modified Circom circuits based on Tornado Nova architecture.

**Key Modifications:**
- Multi-token balance validation in single proof
- Support for token type changes (swaps)
- Maintains privacy across different SPL mints

**Parameters:**
- Merkle tree height: 26 levels
- Inputs per transaction: 2 UTXOs
- Outputs per transaction: 2 UTXOs
- Proof system: Groth16 on BN254 curve

### Indexer & Relayer
Location: `/indexer/`

**Indexer Functions:**
- Monitors blockchain for commitment events
- Maintains synchronized Merkle tree state
- Stores encrypted UTXO metadata
- Provides REST API for proof generation

**Relayer Functions:**
- Processes withdrawal requests with signature verification
- Submits transactions on behalf of users
- Breaks on-chain linkage between deposits and withdrawals
- Enforces additional security checks in smart contract

### Frontend
Location: `/frontend/`

React application with private DeFi interface:
- Shield: Deposit any SPL token
- Swap: Private trading via Jupiter
- Unshield: Withdraw to any address
- Portfolio: View private balances across all tokens

---

## Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- Rust 1.75+ and Cargo
- Solana CLI 1.18+
- Anchor CLI 0.30+
- Circom 2.0+

### 1. Clone Repository

```bash
git clone https://github.com/your-org/zert.git
cd zert
```

### 2. Setup Solana Program

```bash
cd program

# Install dependencies
yarn install

# Build the program
anchor build

# Deploy to devnet
solana program deploy \
  target/deploy/zkcash.so \
  -k keys/owner.json \
  --program-id program.json \
  -u devnet

# Initialize program state
yarn cli:init

# Create token mints (if needed for testing)
yarn cli:mints

# Setup Address Lookup Table
yarn cli:create-alt

# Check status
yarn cli:status
```

### 3. Build Circuits

```bash
cd circuits

# Build circuits and generate proving/verifying keys
./build.sh

# This generates:
# - transaction2.wasm (witness generator)
# - transaction2.zkey (proving key)
# - verifyingkey2.json (on-chain verification key)
```

### 4. Setup Indexer

```bash
cd indexer

# Install dependencies
yarn install

# Configure environment
cp example.env .env
# Edit .env with your settings

# Start indexer
./start.sh

# Or run in development mode
yarn dev
```

**Indexer Configuration:**
```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx
PORT=3000
MERKLE_TREE_HEIGHT=26

# Optional: Enable relayer
RELAYER_ENABLED=true
RELAYER_PRIVATE_KEY=[123,45,67,...]
MIN_FEE_LAMPORTS=5000
```

### 5. Run Frontend

```bash
cd frontend

# Install dependencies
yarn install

# Configure environment
cp example.env .env
# Add your RPC URLs and API keys

# Start development server
yarn dev

# Build for production
yarn build
```

---


## Supported Tokens

Zert supports **any SPL token** through its unified UTXO pool architecture. Each UTXO internally tracks its mint type, allowing multiple token types to share the same anonymity set.

**Pre-configured tokens:**
- **SOL** (wrapped): `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **ZEC**: `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS`

**Additional tokens** (LSTs, launchpad tokens, etc.) can be added by creating reserve accounts in the program. All tokens share the same privacy pool, maximizing anonymity set size.

---

## Technical Advantages

### Atomic Private Swaps
All swaps execute in a single instruction with full atomicity:
- Zero-knowledge proof validates input UTXOs
- Jupiter CPI executes the swap
- New UTXOs created with swapped tokens
- All in one transaction with no intermediate states

### Anti-Copy-Trading
The program's PDA acts as the public buyer for all operations:
- External observers see only the program trading
- Individual user strategies remain private
- No on-chain correlation between users
- Prevents MEV and front-running of private trades

### Private Yield Strategies
Hold LST tokens (stSOL, mSOL, jitoSOL) privately:
- Accrue staking rewards while maintaining privacy
- Swap between LSTs without revealing positions
- Time-based strategies hidden from competitors
- Grows protocol TVL and anonymity set

### Unified Privacy Pool
All tokens share the same UTXO set:
- Larger anonymity set compared to per-token pools
- Cross-token privacy protection
- More efficient capital utilization
- Better privacy guarantees as protocol grows

---

## Testing

### Program Tests

```bash
cd program

# Run tests on local validator with bankrun
yarn test:bankrun

# Run tests on localnet
yarn test:localnet
```

See `/program/tests/` for comprehensive test suites covering deposits, withdrawals, private swaps, and edge cases.

---

## Performance

**Compute Efficiency per Transaction:**
- Groth16 proof verification: ~280k compute units
- UTXO updates and Merkle tree: ~70k compute units
- Jupiter CPI (for swaps): ~50k compute units
- **Total: ~400k compute units** (well within Solana's 1.4M limit)

**Transaction Cost:**
- ~$0.01 per private transaction
- 2000+ theoretical TPS on Solana
- Sub-second confirmation times

---

## Security

**Cryptographic Primitives:**
- **Groth16 zk-SNARKs**: 256-byte proofs on BN254 curve
- **Poseidon Hash**: Circuit-optimized hash function
- **Sparse Merkle Tree**: 26 levels, 67M capacity

**Withdrawal Security:**
- All withdrawals processed through relayer to break on-chain linkages
- Additional signature verification in smart contract for withdrawal data
- Prevents unauthorized withdrawals even if relayer is compromised

**Privacy Properties:**
- Unified pool for all tokens maximizes anonymity set
- Program PDA as public trader prevents copy-trading
- No correlation between deposit and withdrawal addresses
- Private swaps hide trading strategies

**Known Limitations:**
- Anonymity set grows with protocol usage
- Relayer sees recipient addresses (but cannot link to deposits)
- Timing analysis may correlate deposits/withdrawals
- Amount correlation possible for similar values

---

## Development

### Building from Source

**Requirements:**
- Rust toolchain with BPF target
- Circom compiler
- Node.js and Yarn
- Solana toolchain

**Build Commands:**
```bash
# Build program
cd program && anchor build

# Build circuits
cd circuits && ./build.sh

# Build frontend
cd frontend && yarn build

# Build indexer
cd indexer && yarn build
```

---

## Documentation

- [Program README](./program/README.md) - Smart contract documentation
- [Indexer README](./indexer/README.md) - Backend service guide
- [Circuits README](./circuits/README.md) - ZK circuit documentation

---

**Deployed Program:** `6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx`
