# Zert Program

A zero-knowledge privacy protocol for Solana, enabling private deposits, withdrawals, and token swaps using zk-SNARKs (Groth16) and Merkle tree commitments.

## Overview

zert is a Solana program (smart contract) that provides privacy-preserving transactions through zero-knowledge proofs. Users can:

- **Deposit** tokens privately into the protocol
- **Withdraw** tokens without revealing transaction history
- **Swap** tokens privately using Jupiter aggregator integration
- **Maintain** complete privacy through cryptographic commitments

### Key Features

- **Zero-Knowledge Proofs**: Uses Groth16 verification for transaction privacy
- **Merkle Tree Commitments**: Stores commitments in an on-chain Merkle tree
- **Multi-Token Support**: Works with any SPL token
- **Jupiter Integration**: Private swaps through Jupiter aggregator
- **Fee Management**: Configurable deposit and withdrawal fees
- **Relayer Support**: Optional relayer for gasless transactions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    zert Program                        │
│  Program ID: 6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ Merkle  │      │ Global  │      │  Tree   │
   │  Tree   │      │ Config  │      │  Token  │
   │ Account │      │ Account │      │ Account │
   └─────────┘      └─────────┘      └─────────┘
        │
        ├── Stores commitments
        ├── Tracks spent nullifiers
        └── Maintains tree structure
```

### Core Components

1. **Groth16 Verifier** (`groth16.rs`)
   - Verifies zero-knowledge proofs on-chain
   - Validates transaction authenticity without revealing details

2. **Merkle Tree** (`merkle_tree.rs`)
   - Height: 20 (supports 1,048,576 commitments)
   - Stores UTXO commitments
   - Prevents double-spending via nullifier tracking

3. **Instructions**
   - `initialize`: Setup program accounts
   - `deposit`: Private token deposits
   - `withdraw`: Private token withdrawals
   - `swap`: Private token swaps via Jupiter
   - `update_deposit_limit`: Admin function
   - `update_global_config`: Admin function

## Program Structure

```
program/
├── programs/zert/src/
│   ├── lib.rs                    # Program entry point
│   ├── groth16.rs               # ZK proof verification
│   ├── merkle_tree.rs           # Merkle tree implementation
│   ├── state.rs                 # Account structures
│   ├── types.rs                 # Type definitions
│   ├── errors.rs                # Custom errors
│   ├── utils.rs                 # Helper functions
│   └── instructions/
│       ├── initialize.rs        # Program initialization
│       ├── deposit.rs           # Private deposits
│       ├── withdraw.rs          # Private withdrawals
│       ├── swap.rs              # Private swaps
│       ├── update_deposit_limit.rs
│       └── update_global_config.rs
├── tests/                       # Integration tests
│   ├── bankrun.ts              # BankRun tests (fast)
│   ├── localnet.ts             # Local validator tests
│   └── lib/                    # Test utilities
├── scripts/                     # Deployment & management scripts
│   ├── init.ts                 # Initialize contract
│   ├── create-mints.ts         # Create test tokens
│   ├── create-alt.ts           # Create Address Lookup Table
│   ├── status.ts               # Check contract status
│   └── README.md               # Script documentation
└── idls/                        # Interface definitions
    └── jupiter_aggregator.json  # Jupiter CPI interface
```

## Instructions

### 1. Initialize

Sets up the program with required accounts.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()>
```

Creates:
- Merkle tree account (PDA: `merkle_tree`)
- Tree token account (PDA: `tree_token`)
- Global config account (PDA: `global_config`)

### 2. Deposit

Privately deposit tokens into the protocol.

```rust
pub fn deposit(
    ctx: Context<Transact>,
    proof: Proof,
    ext_data_minified: ExtDataMinified,
    encrypted_output: Vec<u8>,
) -> Result<()>
```

Process:
1. Verify ZK proof
2. Transfer tokens to program
3. Add commitment to Merkle tree
4. Store encrypted output for indexer

### 3. Withdraw

Privately withdraw tokens from the protocol.

```rust
pub fn withdraw(
    ctx: Context<Withdraw>,
    proof: Proof,
    ext_data_minified: ExtDataMinified,
    encrypted_output: Vec<u8>,
) -> Result<()>
```

Process:
1. Verify ZK proof
2. Check nullifiers haven't been spent
3. Verify Merkle proof
4. Transfer tokens to recipient
5. Mark nullifiers as spent

### 4. Swap

Privately swap tokens using Jupiter aggregator.

```rust
pub fn swap(
    ctx: Context<Swap>,
    proof: Proof,
    ext_data_minified: SwapExtDataMinified,
    encrypted_output: Vec<u8>,
    jupiter_swap_data: Vec<u8>,
) -> Result<()>
```

Process:
1. Verify ZK proof
2. Perform swap via Jupiter CPI
3. Add new commitment to Merkle tree
4. Update balances privately

### 5. Admin Functions

**Update Deposit Limit**
```rust
pub fn update_deposit_limit(ctx: Context<UpdateDepositLimit>, new_limit: u64)
```

**Update Global Config**
```rust
pub fn update_global_config(
    ctx: Context<UpdateGlobalConfig>,
    deposit_fee_rate: Option<u16>,
    withdrawal_fee_rate: Option<u16>,
    fee_error_margin: Option<u16>,
)
```

## Getting Started

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.31.0
- Node.js 18+
- Yarn

### Installation

```bash
cd program
yarn install
```

### Build

```bash
# Build the program
anchor build

# Or use cargo directly
cd programs/zert
cargo build-sbf
```

### Deploy

#### Local Deployment

```bash
# Terminal 1: Start local validator
solana-test-validator

# Terminal 2: Deploy
anchor deploy

# Initialize the program
yarn cli:setup
```

#### Devnet Deployment

```bash
# Switch to devnet
solana config set --url devnet

# Deploy
anchor deploy --provider.cluster devnet

# Initialize
yarn cli:init devnet
```

### Initialize Contract

```bash
# Complete setup (recommended)
yarn cli:setup [cluster]

# Or step by step:
yarn cli:init [cluster]           # Initialize contract
yarn cli:mints [cluster]          # Create test tokens
yarn cli:create-alt [cluster]     # Create Address Lookup Table
```

### Check Status

```bash
yarn cli:status [cluster]
```

Shows:
- Contract initialization status
- Program ID and PDAs
- Global configuration
- Merkle tree state
- Test mint addresses

## Testing

### BankRun Tests (Fast)

Uses Solana BankRun for fast in-memory testing:

```bash
yarn test:bankrun
```

Tests:
- Deposit functionality
- Withdrawal functionality
- Token swaps
- Fee calculations
- Edge cases

### Localnet Tests

Full integration tests on local validator:

```bash
# Terminal 1: Start validator
solana-test-validator

# Terminal 2: Run tests
yarn test:localnet
```

Tests:
- Real validator environment
- Jupiter swap integration
- Address Lookup Tables
- Complete transaction flows

### Test Structure

```typescript
// tests/bankrun.ts
describe("ZKCash BankRun Tests", () => {
  it("Deposit", async () => { /* ... */ });
  it("Withdraw", async () => { /* ... */ });
  it("Swap", async () => { /* ... */ });
});

// tests/localnet.ts
describe("ZKCash Localnet Tests", () => {
  it("Full deposit-withdraw cycle", async () => { /* ... */ });
  it("Private swap with Jupiter", async () => { /* ... */ });
});
```

## Development Workflow

### 1. Make Changes

Edit files in `programs/zert/src/`

### 2. Build

```bash
anchor build
```

### 3. Test

```bash
# Fast tests
yarn test:bankrun

# Full integration
yarn test:localnet
```

### 4. Deploy

```bash
# Localnet
anchor deploy

# Devnet
anchor deploy --provider.cluster devnet
```

### 5. Verify

```bash
yarn cli:status [cluster]
```

## Configuration

### Program ID

Set in `Anchor.toml`:

```toml
[programs.localnet]
zkcash = "6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx"
```

### Global Config Defaults

```rust
// Default values on initialization
deposit_fee_rate: 0,          // 0%
withdrawal_fee_rate: 25,      // 0.25%
fee_error_margin: 500,        // 5%
max_deposit: 1000000000000,   // 1000 SOL
```

### Merkle Tree

```rust
pub const MERKLE_TREE_HEIGHT: usize = 20;  // 1,048,576 commitments
```

## Integration

### Frontend Integration

```typescript
import { Program } from "@coral-xyz/anchor";
import { ZKCash } from "./idl/zkcash";

const program = new Program<ZKCash>(IDL, programId, provider);

// Deposit
await program.methods
  .deposit(proof, extData, encryptedOutput)
  .accounts({ /* ... */ })
  .rpc();

// Withdraw
await program.methods
  .withdraw(proof, extData, encryptedOutput)
  .accounts({ /* ... */ })
  .rpc();
```

### SDK

See `frontend/src/lib/sdk/` for complete SDK implementation:
- `transactions/deposit.ts`
- `transactions/withdraw.ts`
- `transactions/swap.ts`

### Indexer Integration

The indexer listens for program events to:
- Track all commitments
- Build Merkle tree locally
- Decrypt user UTXOs
- Provide proof generation data

See `indexer/` directory for details.

## Security Considerations

### Zero-Knowledge Proofs

- All proofs verified on-chain using Groth16
- Circuit prevents invalid state transitions
- Commitment scheme ensures privacy

### Nullifier Protection

- Double-spending prevented via nullifier tracking
- Nullifiers stored in Merkle tree account
- Cannot spend same UTXO twice

### Access Control

- Admin functions protected by authority check
- Only authority can update config or limits
- Authority set during initialization

### Fee Protection

- Fee error margin prevents manipulation
- Fees calculated and verified on-chain
- Configurable by admin

## Troubleshooting

### Build Errors

```bash
# Clean build
anchor clean
anchor build
```

### Test Failures

```bash
# Check validator is running
solana cluster-version

# Check program is deployed
solana program show 6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx

# Check contract is initialized
yarn cli:status
```

### Deployment Issues

```bash
# Check balance
solana balance

# Increase compute budget
solana program deploy --use-rpc \
  --max-sign-attempts 100 \
  target/deploy/zkcash.so
```

### Common Errors

**"Account not initialized"**
- Run `yarn cli:init` first

**"Insufficient balance"**
- For localnet: `solana airdrop 5`
- For devnet: `solana airdrop 2 --url devnet`

**"Invalid proof"**
- Check circuit matches program version
- Verify proof generation inputs
- Ensure nullifiers are not already spent

## Performance

### Transaction Costs

- Deposit: ~50,000 compute units
- Withdraw: ~100,000 compute units
- Swap: ~200,000 compute units (includes Jupiter CPI)

### Account Sizes

- Merkle Tree: ~8.4 MB (for height 20)
- Global Config: ~256 bytes
- Tree Token: ~128 bytes

### Throughput

- Max commitments: 1,048,576 (2^20)
- Parallel transactions: Limited by Merkle tree lock
- Can be scaled with multiple trees

## Roadmap

- [ ] Multiple Merkle trees for higher throughput
- [ ] Optimized proof verification
- [ ] Additional swap integrations
- [ ] Mobile SDK
- [ ] Mainnet deployment

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Jupiter Aggregator](https://jup.ag/)

## Support

For issues, questions, or contributions:
- Check `scripts/README.md` for CLI documentation
- Check `tests/` for integration examples
- Review `frontend/src/lib/sdk/` for SDK usage

## License

ISC

