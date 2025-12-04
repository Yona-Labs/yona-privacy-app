import { INDEXER_API_URL } from "./constants";

/**
 * Query remote tree state from indexer API
 * Returns the current Merkle root and next index
 */
export async function queryRemoteTreeState(): Promise<{
  root: string;
  nextIndex: number;
}> {
  try {
    console.log("Fetching Merkle root and nextIndex from API...");
    const response = await fetch(`${INDEXER_API_URL}/root`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Merkle root and nextIndex: ${response.status} ${response.statusText}`
      );
    }
    const data = (await response.json()) as { root: string; nextIndex: number };
    console.log(`Fetched root from API: ${data.root}`);
    console.log(`Fetched nextIndex from API: ${data.nextIndex}`);
    return data;
  } catch (error) {
    console.error("Failed to fetch root and nextIndex from API:", error);
    throw error;
  }
}

/**
 * Fetch Merkle proof from API for a given commitment
 * Returns the path elements and path indices for the proof
 */
export async function fetchMerkleProof(
  commitment: string
): Promise<{ pathElements: string[]; pathIndices: number[] }> {
  try {
    console.log(`Fetching Merkle proof for commitment: ${commitment}`);
    const response = await fetch(`${INDEXER_API_URL}/proof/${commitment}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Merkle proof: ${response.status} ${response.statusText}`
      );
    }
    const data = (await response.json()) as {
      pathElements: string[];
      pathIndices: number[];
    };
    console.log(
      `✓ Fetched Merkle proof with ${data.pathElements.length} elements`
    );
    return data;
  } catch (error) {
    console.error(
      `Failed to fetch Merkle proof for commitment ${commitment}:`,
      error
    );
    throw error;
  }
}

