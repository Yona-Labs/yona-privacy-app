# Zkcash Backend Service

A Fastify backend service for monitoring Zkcash program events on Solana, maintaining a merkle tree, providing API endpoints, and optionally acting as a relayer for withdrawal transactions.

## Features

- Listens to Solana blockchain for Zkcash program transactions via WebSocket
- Decodes and extracts commitments from `CommitmentData` events
- Maintains a merkle tree of all commitments using Poseidon hash
- Provides REST API to query commitments and merkle root
- Automatically syncs historical transactions on startup
- Real-time updates as new transactions are confirmed
- **Optional Relayer**: Process withdrawal transactions on behalf of users (gasless withdrawals)

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file in the backend directory:

```bash
cp example.env .env
```

Edit `.env` with your settings:

```bash
SOLANA_RPC_URL=http://127.0.0.1:8899
PROGRAM_ID=your_zkcash_program_id
PORT=3000
MERKLE_TREE_HEIGHT=26

# Optional: Enable relayer functionality
RELAYER_ENABLED=true
RELAYER_PRIVATE_KEY=[123,45,67,...]  # Your relayer wallet private key
ALT_ADDRESS=your_alt_address_here     # Optional: Address Lookup Table
MIN_FEE_LAMPORTS=5000
MAX_COMPUTE_UNITS=1000000
```

### Configuration Options

**Indexer Settings:**
- `SOLANA_RPC_URL`: Solana RPC endpoint (localnet, devnet, or mainnet)
- `PROGRAM_ID`: Your deployed Zkcash program ID
- `PORT`: HTTP server port (default: 3000)
- `MERKLE_TREE_HEIGHT`: Height of the merkle tree (default: 26, capacity: 67M commitments)

**Relayer Settings (Optional):**
- `RELAYER_ENABLED`: Set to `true` to enable relayer functionality (default: false)
- `RELAYER_PRIVATE_KEY`: JSON array of your relayer wallet private key
- `ALT_ADDRESS`: Address Lookup Table address (optional, improves transaction efficiency)
- `MIN_FEE_LAMPORTS`: Minimum fee required for processing withdrawals (default: 5000)
- `MAX_COMPUTE_UNITS`: Maximum compute units per transaction (default: 1000000)

### Getting Relayer Private Key

```bash
# Create a new wallet for relayer
solana-keygen new --outfile ~/.config/solana/relayer.json

```

## Usage

### Quick Start

```bash
./start.sh
```

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Indexer Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "relayer": {
    "enabled": true,
    "address": "...",
    "balance": 2.5
  }
}
```

### GET /root

Get the current merkle root.

**Response:**
```json
{
  "root": "123456789abcdef...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /commitments

Get all commitments tracked by the service.

**Response:**
```json
{
  "commitments": [
    {
      "commitment": "a1b2c3d4...",
      "index": 0,
      "slot": 12345,
      "signature": "5x6y7z...",
      "encryptedOutput": "e1f2g3..."
    }
  ],
  "count": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /commitments/:index

Get a specific commitment by index.

**Parameters:**
- `index`: Commitment index in the merkle tree

**Response:**
```json
{
  "commitment": "a1b2c3d4...",
  "index": 0,
  "slot": 12345,
  "signature": "5x6y7z...",
  "encryptedOutput": "e1f2g3..."
}
```

**Error (404):**
```json
{
  "error": "Commitment not found",
  "index": 999
}
```

### GET /tree/info

Get information about the merkle tree.

**Response:**
```json
{
  "root": "123456789abcdef...",
  "height": 26,
  "capacity": 67108864,
  "currentSize": 100,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /proof/:commitment

Get Merkle proof for a specific commitment.

**Parameters:**
- `commitment`: The commitment value as a numeric string

**Response:**
```json
{
  "commitment": "123456789...",
  "pathElements": ["elem1", "elem2", ...],
  "pathIndices": [0, 1, ...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Relayer Endpoints (if enabled)

### GET /relayer/info

Get relayer information and configuration.

**Response:**
```json
{
  "relayerAddress": "...",
  "balance": 2.5,
  "minFee": 5000,
  "programId": "..."
}
```

### POST /relayer/withdraw

Submit a withdrawal transaction for asynchronous processing by the relayer. The request is queued and processed in the background to avoid HTTP timeouts for long-running transactions.

**Important:** This endpoint returns immediately with a `jobId`. Use the `/relayer/status/:jobId` endpoint to check the processing status and get the final result.

**Duplicate Detection:** The system automatically detects duplicate requests based on the proof data. If the same proof is submitted while a previous request is still pending or processing, the original `jobId` will be returned.

**Request Body:**
```json
{
  "proof": {
    "proofA": [/* 64 bytes */],
    "proofB": [/* 128 bytes */],
    "proofC": [/* 64 bytes */],
    "root": [/* 32 bytes */],
    "publicAmount0": [/* 32 bytes */],
    "publicAmount1": [/* 32 bytes */],
    "extDataHash": [/* 32 bytes */],
    "inputNullifiers": [[/* 32 bytes */], [/* 32 bytes */]],
    "outputCommitments": [[/* 32 bytes */], [/* 32 bytes */]]
  },
  "extDataMinified": {
    "extAmount": "-1000000000",
    "fee": "5000"
  },
  "encryptedOutput1": [/* bytes */],
  "encryptedOutput2": [/* bytes */],
  "recipient": "PublicKey",
  "feeRecipient": "PublicKey",
  "inputMint": "PublicKey"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123def456",
  "message": "Withdrawal request accepted and queued for processing",
  "statusUrl": "/relayer/status/job_1234567890_abc123def456"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Missing required fields: proof or extDataMinified"
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

### GET /relayer/status/:jobId

Check the status of a withdrawal job submitted via `/relayer/withdraw`.

**URL Parameters:**
- `jobId` - The job ID returned by the `/relayer/withdraw` endpoint

**Response (Job Pending/Processing):**
```json
{
  "jobId": "job_1234567890_abc123def456",
  "status": "pending",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

**Response (Job Completed - Success):**
```json
{
  "jobId": "job_1234567890_abc123def456",
  "status": "completed",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:15.000Z",
  "result": {
    "success": true,
    "signature": "transaction_signature_here",
    "message": "Withdrawal processed successfully"
  }
}
```

**Response (Job Failed):**
```json
{
  "jobId": "job_1234567890_abc123def456",
  "status": "failed",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:10.000Z",
  "result": {
    "success": false,
    "error": "Transaction failed: insufficient funds"
  },
  "error": "Transaction failed: insufficient funds"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Job not found"
}
```

**Job Status Values:**
- `pending` - Job is in queue, waiting to be processed
- `processing` - Job is currently being processed
- `completed` - Job completed successfully
- `failed` - Job failed with an error

---

### GET /relayer/queue/stats

Get statistics about the job queue.

**Response:**
```json
{
  "total": 42,
  "pending": 5,
  "processing": 1,
  "completed": 30,
  "failed": 6,
  "queueSize": 5
}
```

## How It Works

1. **Initialization**: 
   - Connects to Solana RPC endpoint
   - Initializes Poseidon hasher (Light Protocol WASM)
   - Creates empty merkle tree

2. **Historical Sync**: 
   - Fetches up to 1000 historical transactions from the program
   - Parses `CommitmentData` events from transaction logs
   - Rebuilds merkle tree with historical commitments

3. **Real-time Monitoring**: 
   - Subscribes to program logs via WebSocket
   - Listens for new transactions
   - Processes new `CommitmentData` events as they arrive

4. **Event Processing**: 
   - Uses Anchor's `EventParser` to decode events
   - Extracts commitment bytes and encrypted output
   - Converts to hex strings for storage and API responses

5. **Tree Updates**: 
   - Inserts new commitments into merkle tree
   - Recalculates root using Poseidon hash
   - Maintains order and indices

6. **API Access**: 
   - Exposes REST endpoints for querying state
   - Returns commitments with metadata
   - Provides current merkle root

## Architecture

```
backend/
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # Fastify server setup and routes
│   ├── config.ts          # Configuration loader
│   ├── merkle-tree.ts     # Merkle tree implementation
│   ├── event-listener.ts  # Solana event listener
│   ├── utils.ts           # Utility functions
│   └── zkcash.json        # Program IDL for event parsing
├── package.json
├── tsconfig.json
├── start.sh               # Startup script
├── example.env            # Example configuration
└── README.md
```

## Event Structure

The service listens for `CommitmentData` events from the Zkcash program:

```rust
pub struct CommitmentData {
    pub index: u64,
    pub commitment: [u8; 32],
    pub encrypted_output: Vec<u8>,
}
```

Each event contains:
- `index`: Position in the program's commitment array
- `commitment`: 32-byte commitment hash
- `encrypted_output`: Encrypted UTXO data for the recipient

## Merkle Tree

- Uses Poseidon hash function (ZK-friendly)
- Configurable height (default: 26 levels)
- Binary tree structure
- Zero-hash padding for incomplete branches
- Efficient insertion and root recalculation

## Notes

- The service stores all data in memory
- Historical sync is limited to last 1000 transactions
- For production, consider adding:
  - Database persistence
  - Pagination for API endpoints
  - Authentication and rate limiting
  - Error recovery and retry logic
  - Metrics and monitoring
- The merkle tree must match the on-chain state
- Commitments are stored in insertion order

## Troubleshooting

### "PROGRAM_ID is not configured"
Make sure you've created a `.env` file with a valid program ID.

### "Failed to connect to Solana"
Check that your `SOLANA_RPC_URL` is correct and the node is running.

### "No commitments found"
If no historical transactions are found:
- Verify the program ID is correct
- Ensure transactions have been sent to the program
- Check that the RPC endpoint has transaction history

### "Failed to parse event"
Ensure the `zkcash.json` IDL file matches your deployed program version.

## Development

### Type Checking

```bash
npm run type-check
```

### Testing with Local Validator

1. Start local Solana validator:
```bash
solana-test-validator
```

2. Deploy your Zkcash program

3. Update `.env` with your program ID

4. Start the backend:
```bash
npm run dev
```

5. Run your deposit/swap/withdraw tests

6. Check the API:
```bash
curl http://localhost:3000/commitments
curl http://localhost:3000/root
curl http://localhost:3000/tree/info
```

## License

MIT

