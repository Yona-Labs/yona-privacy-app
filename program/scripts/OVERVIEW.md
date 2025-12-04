# ZKCash Program CLI Tools

Complete CLI toolkit for initializing and managing the ZKCash program.

## What's Included

This CLI provides everything you need to:
- Initialize the ZKCash contract on any Solana cluster
- Create test tokens for development
- Check contract status and configuration
- Automate the complete setup process

## Files Created

```
program/
├── scripts/
│   ├── init.ts              # Initialize contract
│   ├── create-mints.ts      # Create test tokens
│   ├── setup-all.ts         # Complete setup
│   ├── status.ts            # Check status
│   ├── demo.sh              # Demo script
│   └── README.md            # Detailed docs
├── CLI.md                   # Quick start guide
└── test-mints.json          # Generated mint addresses
```

## Quick Start

### 1. Install & Setup

```bash
cd program
yarn install

# Create wallet if needed
solana-keygen new --outfile owner.json
```

### 2. Start Local Validator

```bash
solana-test-validator
```

### 3. Run Setup

```bash
# One command does everything!
yarn cli:setup
```

This will:
- Initialize the ZKCash contract
- Create 3 test tokens (A, B, C)
- Mint 1M tokens to your wallet
- Save addresses to `test-mints.json`

### 4. Check Status

```bash
yarn cli:status
```

Output shows:
- Contract initialization status
- Program ID and PDAs
- Global configuration (fees, limits)
- Merkle tree info
- Test token addresses
- Wallet balance

### 5. Run Tests

```bash
yarn test:localnet
```

## Available Commands

### Setup Commands

```bash
# Complete setup (recommended)
yarn cli:setup [cluster]

# Initialize contract only
yarn cli:init [cluster]

# Create test tokens only
yarn cli:mints [cluster]
```

### Info Commands

```bash
# Check status
yarn cli:status [cluster]
```

### Cluster Options

```bash
localnet  # Default - local validator
devnet    # Solana devnet
mainnet   # Solana mainnet (use with caution!)
```

## Example: Complete Workflow

```bash
# Terminal 1: Start validator
solana-test-validator

# Terminal 2: Setup
cd program

# Initialize everything
yarn cli:setup

# View what was created
yarn cli:status

# Output:
# ✅ Contract Status: INITIALIZED
# 
# 📋 Program Information
#   Program ID: 6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx
#   Cluster: localnet
# 
# ⚙️ Global Configuration
#   Deposit Fee: 0%
#   Withdrawal Fee: 0.25%
# 
# 🌳 Merkle Tree
#   Height: 20
#   Max Deposit: 1000.00 SOL
# 
# 🪙 Test Mints
#   Token A (6 decimals): ABC123...
#   Token B (9 decimals): DEF456...
#   Token C (9 decimals): GHI789...

# Check test-mints.json
cat test-mints.json

# Run tests
yarn test:localnet
```

## Example: Devnet Deployment

```bash
# Make sure you have SOL
solana balance --keypair owner.json --url devnet

# If needed, get airdrop
solana airdrop 2 --keypair owner.json --url devnet

# Setup on devnet
yarn cli:setup devnet

# Check status
yarn cli:status devnet

# Now you can use devnet for testing!
```

## Generated Files

### test-mints.json

After running `yarn cli:mints`, this file contains:

```json
{
  "mintA": "TokenA_PublicKey",
  "mintB": "TokenB_PublicKey", 
  "mintC": "TokenC_PublicKey",
  "tokenAccountA": "ATA_A_Address",
  "tokenAccountB": "ATA_B_Address",
  "tokenAccountC": "ATA_C_Address",
  "cluster": "localnet",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Use these addresses in your tests and frontend!

## Script Details

### init.ts - Initialize Contract

Creates:
- Merkle tree account (PDA: `merkle_tree`)
- Tree token account (PDA: `tree_token`)
- Global config account (PDA: `global_config`)

Sets:
- Deposit fee: 0%
- Withdrawal fee: 0.25%
- Fee error margin: 5%
- Max deposit: 1000 SOL

### create-mints.ts - Create Test Tokens

Creates:
- **Token A**: 6 decimals (USDC-like)
  - For stablecoin testing
  - 1M tokens minted

- **Token B**: 9 decimals (SOL-like)
  - For native token testing
  - 1M tokens minted

- **Token C**: 9 decimals (custom)
  - For custom token testing
  - 1M tokens minted

### setup-all.ts - Complete Setup

Runs both init and create-mints in sequence.
Handles errors gracefully.

### status.ts - Check Status

Displays:
- Initialization status
- Program info
- Configuration
- Merkle tree state
- Test mints (if created) 
- Wallet balance

## Troubleshooting

### "Wallet file not found"

```bash
solana-keygen new --outfile owner.json
```

### "Connection refused"

Start validator:
```bash
solana-test-validator
```

### "Insufficient balance" (localnet)

Auto-airdrop will happen. If it fails:
```bash
solana airdrop 5 --keypair owner.json --url localhost
```

### "Insufficient balance" (devnet)

```bash
solana airdrop 2 --keypair owner.json --url devnet
```

### "Contract already initialized"

This is normal! Contract can only be initialized once per deployment.
Use `yarn cli:status` to check current state.

### "Account not found" errors

Make sure:
1. Validator is running
2. Contract is initialized: `yarn cli:init`
3. Using correct cluster

## Advanced Usage

### Using in Tests

```typescript
import fs from 'fs';

// Load test mints
const mints = JSON.parse(
  fs.readFileSync('test-mints.json', 'utf-8')
);

const mintA = new PublicKey(mints.mintA);
const mintB = new PublicKey(mints.mintB);
// Use in your tests...
```

### Custom RPC

Edit scripts to use custom RPC:

```typescript
const rpcUrl = "https://your-custom-rpc.com";
```

### Multiple Test Environments

Create multiple mint files:

```bash
# Localnet mints
yarn cli:mints localnet
mv test-mints.json test-mints-local.json

# Devnet mints  
yarn cli:mints devnet
mv test-mints.json test-mints-devnet.json
```

## Documentation

- `CLI.md` - Quick start guide
- `scripts/README.md` - Detailed script documentation
- `scripts/demo.sh` - Interactive demo

## Integration with Frontend

After setup, use the addresses in your frontend:

```typescript
// frontend/lib/sdk/constants.ts
export const PROGRAM_ID = new PublicKey(
  "6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx"
);

// Load from test-mints.json or environment
export const TEST_MINT_A = new PublicKey("...");
export const TEST_MINT_B = new PublicKey("...");
```

## Support

For issues or questions:
1. Check `scripts/README.md` for detailed docs
2. Run `yarn cli:status` to debug
3. Check Solana logs: `solana logs` (in validator terminal)

## Summary

This CLI provides a complete toolkit for:
- ✅ One-command contract initialization
- ✅ Automatic test token creation
- ✅ Status checking and monitoring
- ✅ Multi-cluster support (localnet/devnet/mainnet)
- ✅ Error handling and helpful messages
- ✅ Integration with tests and frontend

**Quick start:** `yarn cli:setup` and you're ready to go!

