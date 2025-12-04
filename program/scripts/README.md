# ZKCash CLI Scripts

CLI tools for managing the ZKCash program.

## Available Scripts

### Setup & Initialization

#### `yarn cli:setup [cluster]`
Complete setup - initializes the contract and creates test mints in one command.

```bash
yarn cli:setup                # localnet (default)
yarn cli:setup devnet        # devnet
```

#### `yarn cli:init [cluster]`
Initialize the ZKCash contract only.

```bash
yarn cli:init                # localnet (default)
yarn cli:init devnet        # devnet
```

Creates:
- Merkle tree account
- Tree token account  
- Global config account

#### `yarn cli:mints [cluster]`
Create test mints (Token A, B, C) and mint tokens to your wallet.

```bash
yarn cli:mints               # localnet (default)
yarn cli:mints devnet       # devnet
```

Creates:
- Token A: 6 decimals (USDC-like)
- Token B: 9 decimals (SOL-wrapped)
- Token C: 9 decimals (custom)

Mints 1,000,000 of each token to your wallet.
Saves mint addresses to `test-mints.json`.

### Status & Info

#### `yarn cli:status [cluster]`
Check contract status and display configuration.

```bash
yarn cli:status              # localnet (default)
yarn cli:status devnet      # devnet
```

Shows:
- Contract initialization status
- Program ID and PDAs
- Global configuration
- Merkle tree info
- Test mint addresses
- Wallet balance

## Quick Start

### 1. First Time Setup

Make sure you have:
- Solana CLI installed
- Local validator running (for localnet)
- Wallet keypair at `owner.json`

```bash
# Start local validator
solana-test-validator

# In another terminal, setup everything
cd program
yarn cli:setup
```

### 2. Check Status

```bash
yarn cli:status
```

### 3. Run Tests

```bash
yarn test:localnet
```

## Wallet Configuration

The scripts use the wallet keypair from `owner.json` in the program directory.

To create a new wallet:
```bash
solana-keygen new --outfile owner.json
```

For localnet, the scripts will automatically airdrop SOL if needed.

## Files Generated

- `test-mints.json` - Contains mint addresses and metadata
  ```json
  {
    "mintA": "...",
    "mintB": "...",
    "mintC": "...",
    "tokenAccountA": "...",
    "tokenAccountB": "...",
    "tokenAccountC": "...",
    "cluster": "localnet",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

## Examples

### Complete Setup on Localnet

```bash
# Start validator
solana-test-validator

# Setup contract and mints
yarn cli:setup

# Check everything is working
yarn cli:status

# Run tests
yarn test:localnet
```

### Setup on Devnet

```bash
# Make sure you have SOL in your wallet
solana balance --keypair owner.json --url devnet

# Setup
yarn cli:setup devnet

# Check status
yarn cli:status devnet
```

### Create Additional Test Mints

```bash
yarn cli:mints
```

This will create 3 new mints and save them to `test-mints.json`.

## Troubleshooting

### "Wallet file not found"
```bash
solana-keygen new --outfile owner.json
```

### "Insufficient balance"
For localnet, the script will auto-airdrop.
For devnet:
```bash
solana airdrop 2 --keypair owner.json --url devnet
```

### "Contract already initialized"
This is normal. The contract can only be initialized once per deployment.
Use `yarn cli:status` to check the current state.

## Script Details

### init.ts
- Loads wallet from `owner.json`
- Derives necessary PDAs
- Initializes merkle tree and global config
- Sets default fee rates
- Displays configuration

### create-mints.ts
- Creates 3 test tokens with different decimals
- Mints 1M tokens to your wallet
- Saves mint addresses to `test-mints.json`

### setup-all.ts
- Runs init.ts
- Runs create-mints.ts
- Handles errors gracefully

### status.ts
- Checks contract initialization
- Displays all configuration
- Shows wallet balance
- Reads test-mints.json if available

