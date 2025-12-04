# Zert Protocol

**Zero-Knowledge Privacy Layer for Solana**

Zert is a privacy-preserving protocol built on Solana that enables confidential token transactions using zero-knowledge proofs (zk-SNARKs). Users can shield tokens, perform anonymous swaps, and withdraw to any address without revealing transaction histories or linkages.

---

## Overview

Zert implements a UTXO-based privacy model with Groth16 zk-SNARKs to provide strong anonymity guarantees while maintaining full on-chain verifiability. The protocol integrates with Jupiter aggregator for private token swaps at market rates.

**Key Features:**
- **Shield Tokens**: Deposit SPL tokens into a private pool
- **Private Swaps**: Exchange tokens anonymously via Jupiter integration
- **Anonymous Withdrawals**: Unshield tokens to any address, breaking on-chain linkages
- **High Throughput**: Leverages Solana's performance for 2000+ TPS

**Deployed Program:** `6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx`

---

## Architecture

The protocol consists of four main components:

### 1. Smart Contract (Solana Program)
Location: `/program/`

The on-chain program manages:
- Merkle tree with 67M commitment capacity (height 26)
- Nullifier registry for double-spend prevention
- Token reserves for supported SPL tokens
- Groth16 proof verification using Light Protocol

**Supported Instructions:**
- `initialize`: Bootstrap Merkle tree
- `deposit`: Shield tokens into private pool
- `withdraw`: Unshield tokens to public address
- `swap`: Exchange tokens privately via Jupiter

### 2. Zero-Knowledge Circuits
Location: `/circuits/`

Built with Circom 2.0, the circuit validates:
- Merkle inclusion proofs for input UTXOs
- Correct nullifier derivation
- Balance equations
- Ownership verification via private keys

**Parameters:**
- Tree height: 26 levels
- Inputs per transaction: 2
- Outputs per transaction: 2
- Proof system: Groth16 on BN254 curve

### 3. Indexer Service
Location: `/indexer/`

Backend service that:
- Monitors Solana blockchain for Zert transactions
- Maintains merkle tree state
- Stores encrypted UTXO data
- Provides REST API for wallet reconstruction
- Optional relayer functionality for gasless withdrawals

### 4. Frontend Application
Location: `/frontend/`

React-based web interface with:
- Wallet connection (Phantom, Solflare, etc.)
- Token shielding interface
- Private swap panel
- Portfolio management
- Withdrawal interface

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

## Usage Examples

### Shielding Tokens (Deposit)

```typescript
import { deposit } from './lib/sdk/deposit';

// Shield 1 USDC
const result = await deposit({
  amount: 1_000_000, // 1 USDC (6 decimals)
  mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  wallet: walletAdapter,
});

console.log('Transaction:', result.signature);
console.log('New UTXOs created');
```

### Private Swap

```typescript
import { swap } from './lib/sdk/swap';

// Swap USDC for SOL privately
const result = await swap({
  inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  outputMint: 'So11111111111111111111111111111111111111112',  // wSOL
  inputAmount: 10_000_000, // 10 USDC
  wallet: walletAdapter,
});
```

### Unshielding Tokens (Withdrawal)

```typescript
import { withdraw } from './lib/sdk/withdraw';

// Withdraw to any address
const result = await withdraw({
  amount: 5_000_000, // 5 USDC
  recipient: new PublicKey('...'),
  mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  wallet: walletAdapter,
});
```

---

## Supported Tokens

Currently supported SPL tokens:
- **SOL** (wrapped): `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **ZEC**: `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS`

Additional tokens can be added by creating reserve accounts in the program.

---

## API Documentation

### Indexer REST API

**Base URL:** `http://localhost:3000`

#### Health Check
```
GET /health
```

#### Get Merkle Root
```
GET /root
Response: { "root": "...", "timestamp": "..." }
```

#### Get All Commitments
```
GET /commitments
Response: { "commitments": [...], "count": N }
```

#### Get Specific Commitment
```
GET /commitments/:index
Response: { "commitment": "...", "index": N, ... }
```

#### Get Merkle Proof
```
GET /proof/:commitment
Response: { "pathElements": [...], "pathIndices": [...] }
```

#### Get Tree Info
```
GET /tree/info
Response: { "root": "...", "height": 26, "currentSize": N }
```

### Relayer Endpoints (if enabled)

#### Submit Withdrawal
```
POST /relayer/withdraw
Body: { proof, extDataMinified, encryptedOutput1, encryptedOutput2, recipient, ... }
Response: { "jobId": "...", "statusUrl": "/relayer/status/..." }
```

#### Check Job Status
```
GET /relayer/status/:jobId
Response: { "status": "completed|pending|failed", "result": {...} }
```

#### Queue Statistics
```
GET /relayer/queue/stats
Response: { "total": N, "pending": M, ... }
```

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

### Circuit Tests

```bash
cd circuits

# Generate test witness
node artifacts/transaction2_js/generate_witness.js \
  artifacts/transaction2_js/transaction2.wasm \
  input.json \
  witness.wtns

# Generate and verify proof
snarkjs groth16 prove \
  artifacts/transaction2.zkey \
  witness.wtns \
  proof.json \
  public.json
```

### Integration Testing

See `/program/tests/` for comprehensive test suites covering:
- Deposits and withdrawals
- Private swaps with Jupiter
- Merkle tree updates
- Nullifier verification
- Edge cases and error conditions

---

## Security

### Cryptographic Primitives

- **Groth16 zk-SNARKs**: 256-byte proofs on BN254 curve
- **Poseidon Hash**: Circuit-optimized hash function
- **Merkle Tree**: Sparse binary tree with 26 levels

### Privacy Guarantees

**Protected Against:**
- Transaction graph analysis
- Balance enumeration
- Front-running
- MEV extraction

**Known Limitations:**
- Small anonymity set initially (grows with usage)
- Timing correlation attacks
- Relayer knows recipient addresses
- Deposit/withdrawal amount correlation

### Security Assumptions

1. Trusted setup integrity (Groth16 ceremony)
2. BN254 discrete log hardness
3. Poseidon collision resistance
4. Circuit correctness
5. Solana network liveness

---

## Performance

### Compute Efficiency

**Per Transaction:**
- Groth16 verification: ~280k compute units
- UTXO updates: ~70k compute units
- Jupiter CPI: ~50k compute units
- **Total: ~400k compute units** (well within 1.4M limit)

### Comparison with Alternatives

| Protocol | Cost per TX | Blockchain | Throughput |
|----------|-------------|------------|------------|
| Zert | ~$0.01 | Solana | 2000+ TPS |
| Tornado Cash | $50+ | Ethereum | ~15 TPS |
| Aztec | $10+ | Ethereum | ~10 TPS |
| Railgun | $20+ | Ethereum | ~15 TPS |

---

## Development

### Project Structure

```
zert/
├── circuits/          # Circom circuits and artifacts
├── frontend/           # React web application
├── indexer/            # Backend service and relayer
├── program/            # Solana program (Rust/Anchor)
├── relayer/            # Relayer service configuration
├── README.md           # This file
└── WHITEPAPER.md       # Technical whitepaper
```

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

### Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Roadmap

### Phase 1: Launch (Current)
- Core deposit/withdraw functionality
- Private swaps via Jupiter
- Basic frontend and relayer

### Phase 2: Enhanced Privacy (Q1 2026)
- Decentralized relayer network
- Tor integration
- Mobile wallet support

### Phase 3: Advanced Features (Q2 2026)
- Private lending protocols
- Shielded staking
- Privacy-preserving governance

### Phase 4: Ecosystem (Q3 2026)
- Developer SDK
- Multi-chain expansion
- Compliance tools

---

## Resources

### Documentation
- [Whitepaper](./WHITEPAPER.md) - Detailed technical specification
- [Program README](./program/README.md) - Smart contract documentation
- [Indexer README](./indexer/README.md) - Backend service guide
- [Circuits README](./circuits/README.md) - ZK circuit documentation

### External Resources
- [Light Protocol](https://github.com/Lightprotocol/groth16-solana) - Groth16 verifier
- [Jupiter Aggregator](https://jup.ag) - Swap integration
- [Circom](https://docs.circom.io) - Circuit language
- [Anchor Framework](https://www.anchor-lang.com) - Solana development

### Papers & References
1. "On the Size of Pairing-based Non-interactive Arguments" - Jens Groth, 2016
2. "Poseidon: A New Hash Function for Zero-Knowledge Proof Systems" - Grassi et al., 2019
3. "Zcash Protocol Specification" - Hopwood et al.

---

## Troubleshooting

### Common Issues

**"Program ID not found"**
- Deploy the program first: `anchor deploy`
- Update program ID in `Anchor.toml` and frontend config

**"Insufficient compute units"**
- Increase compute budget in transaction
- Check for account size limits

**"Merkle root mismatch"**
- Ensure indexer is synced with on-chain state
- Restart indexer to rebuild tree

**"Proof verification failed"**
- Verify circuit artifacts match deployed verifying key
- Check input format and public signals

**"Relayer not responding"**
- Check relayer is running and funded
- Verify API endpoint configuration

### Getting Help

- Open an issue on [GitHub](https://github.com/your-org/zert/issues)
- Join our [Discord](https://discord.gg/zert) community
- Read the [FAQ](./docs/FAQ.md)

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## Disclaimer

This software is experimental and under active development. Use at your own risk. The protocol has not undergone a formal security audit. Do not use with significant funds until audited.

Privacy is not illegal, but users are responsible for compliance with local regulations and tax reporting requirements.

---



**Built with privacy in mind.**

Contract: `6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx`  
Network: Solana Mainnet
