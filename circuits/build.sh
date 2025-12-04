#!/bin/bash

# Build script for transaction2 circuit
# This script compiles the circuit and generates all necessary keys and artifacts

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting circuit build process...${NC}"

# Define paths
CIRCUIT_NAME="transaction2"
CIRCUIT_FILE="${CIRCUIT_NAME}.circom"
PTAU_FILE="powersOfTau28_hez_final_18.ptau"
BUILD_DIR="./artifacts"

# Create artifacts directory if it doesn't exist
echo -e "${BLUE}Creating artifacts directory...${NC}"
mkdir -p "$BUILD_DIR"

# Check if circuit file exists
if [ ! -f "$CIRCUIT_FILE" ]; then
    echo -e "${RED}Error: $CIRCUIT_FILE not found!${NC}"
    exit 1
fi



# Step 1: Compile the circuit
echo -e "${GREEN}[1/6] Compiling circuit...${NC}"
circom "$CIRCUIT_FILE" --r1cs --wasm --sym --c -o "$BUILD_DIR"

# Step 2: Get circuit info
echo -e "${GREEN}[2/6] Getting circuit info...${NC}"
npx snarkjs r1cs info "$BUILD_DIR/${CIRCUIT_NAME}.r1cs"

# Step 3: Generate witness calculator
echo -e "${GREEN}[3/6] Witness calculator already generated in ${CIRCUIT_NAME}_js/${NC}"

# Step 4: Start a new zkey (First contribution)
echo -e "${GREEN}[4/6] Generating zkey (setup phase 1)...${NC}"
npx snarkjs groth16 setup "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" "$PTAU_FILE" "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"

# Step 5: Contribute to the ceremony (Phase 2)
# Using fixed entropy for deterministic builds in development
# For production, use random entropy or beacon-based finalization
echo -e "${GREEN}[5/6] Contributing to ceremony (phase 2)...${NC}"
echo "privacy-cash-deterministic-dev-entropy-v1" | npx snarkjs zkey contribute "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey" "$BUILD_DIR/${CIRCUIT_NAME}.zkey" --name="1st Contributor" -v

# Step 6: Export the verification key
echo -e "${GREEN}[6/6] Exporting verification key...${NC}"
npx snarkjs zkey export verificationkey "$BUILD_DIR/${CIRCUIT_NAME}.zkey" "$BUILD_DIR/verifyingkey2.json"

# Clean up intermediate files
echo -e "${BLUE}Cleaning up intermediate files...${NC}"
rm -f "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"

# Copy files to project artifacts directory for use by tests and Solana program
DEST_DIR="../artifacts/circuits"
echo -e "${BLUE}Copying artifacts to ${DEST_DIR}...${NC}"
mkdir -p "$DEST_DIR"
cp "$BUILD_DIR/${CIRCUIT_NAME}.zkey" "$DEST_DIR/${CIRCUIT_NAME}.zkey"
cp "$BUILD_DIR/verifyingkey2.json" "$DEST_DIR/verifyingkey2.json"
cp -r "$BUILD_DIR/${CIRCUIT_NAME}_js" "$DEST_DIR/"

# Display summary
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Generated files in ${BUILD_DIR}:"
echo -e "  - ${CIRCUIT_NAME}.r1cs           (Rank-1 Constraint System)"
echo -e "  - ${CIRCUIT_NAME}.wasm           (WebAssembly witness generator)"
echo -e "  - ${CIRCUIT_NAME}.sym            (Symbols file)"
echo -e "  - ${CIRCUIT_NAME}_js/            (JavaScript witness calculator)"
echo -e "  - ${CIRCUIT_NAME}_cpp/           (C++ witness calculator)"
echo -e "  - ${CIRCUIT_NAME}.zkey           (Proving key)"
echo -e "  - verifyingkey2.json             (Verification key)"
echo -e ""
echo -e "Copied to ${DEST_DIR}:"
echo -e "  - ${CIRCUIT_NAME}.zkey"
echo -e "  - verifyingkey2.json"
echo -e "  - ${CIRCUIT_NAME}_js/"
echo -e "${GREEN}================================${NC}"

