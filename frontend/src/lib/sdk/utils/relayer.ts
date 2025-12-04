import axios, { AxiosError } from 'axios';

export const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || 'http://localhost:3001';

// Configure axios instance with timeout and retry
const axiosInstance = axios.create({
  baseURL: RELAYER_URL,
  timeout: 120000, // 120 seconds for long-running operations
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RelayerWithdrawRequest {
  proof: {
    proofA: number[];
    proofB: number[];
    proofC: number[];
    root: number[];
    publicAmount0: number[];
    publicAmount1: number[];
    extDataHash: number[];
    inputNullifiers: number[][];
    outputCommitments: number[][];
  };
  extDataMinified: {
    extAmount: string;
    fee: string;
  };
  encryptedOutput: number[];
  recipient: string;
  feeRecipient: string;
  inputMint: string;
}

export interface RelayerSwapRequest {
  proof: {
    proofA: number[];
    proofB: number[];
    proofC: number[];
    root: number[];
    publicAmount0: number[];
    publicAmount1: number[];
    extDataHash: number[];
    inputNullifiers: number[][];
    outputCommitments: number[][];
  };
  swapExtDataMinified: {
    extAmount: string;
    extMinAmountOut: string;
    fee: string;
  };
  encryptedOutput: number[];
  feeRecipient: string;
  inputMint: string;
  outputMint: string;
  jupiterSwapData: string; // base64 encoded
  jupiterRemainingAccounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  addressLookupTableAddresses: string[];
}

export interface RelayerWithdrawResponse {
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  jobId?: string;
  statusUrl?: string;
}

export interface RelayerSwapResponse {
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  jobId?: string;
  statusUrl?: string;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result?: {
    success: boolean;
    signature?: string;
    error?: string;
    message?: string;
  };
  error?: string;
}

/**
 * Send withdrawal request to relayer
 */
export async function sendWithdrawToRelayer(
  request: RelayerWithdrawRequest
): Promise<RelayerWithdrawResponse> {
  try {
    const response = await axiosInstance.post<RelayerWithdrawResponse>(
      '/relayer/withdraw',
      request
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      if (axiosError.response) {
        // Server responded with error
        return {
          success: false,
          error: axiosError.response.data?.error || 
                 axiosError.response.data?.message ||
                 `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
        };
      } else if (axiosError.code === 'ECONNABORTED') {
        // Request timeout
        return {
          success: false,
          error: 'Request timeout. The relayer might be processing your request. Try checking the job status.',
        };
      } else if (axiosError.request) {
        // Request made but no response
        return {
          success: false,
          error: 'Failed to connect to relayer. Please check if the relayer is running.',
        };
      }
    }
    
    console.error('Error sending withdrawal to relayer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Send swap request to relayer
 */
export async function sendSwapToRelayer(
  request: RelayerSwapRequest
): Promise<RelayerSwapResponse> {
  try {
    const response = await axiosInstance.post<RelayerSwapResponse>(
      '/relayer/swap',
      request
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      if (axiosError.response) {
        // Server responded with error
        return {
          success: false,
          error: axiosError.response.data?.error || 
                 axiosError.response.data?.message ||
                 `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
        };
      } else if (axiosError.code === 'ECONNABORTED') {
        // Request timeout
        return {
          success: false,
          error: 'Request timeout. The relayer might be processing your request. Try checking the job status.',
        };
      } else if (axiosError.request) {
        // Request made but no response
        return {
          success: false,
          error: 'Failed to connect to relayer. Please check if the relayer is running.',
        };
      }
    }
    
    console.error('Error sending swap to relayer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check job status on relayer
 */
export async function checkJobStatus(jobId: string): Promise<JobStatusResponse | null> {
  try {
    const response = await axiosInstance.get<JobStatusResponse>(
      `/relayer/status/${jobId}`
    );
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        console.log(`Job ${jobId} not found`);
        return null;
      }
    }
    console.error('Error checking job status:', error);
    return null;
  }
}

/**
 * Poll job status until completion or timeout
 */
export async function waitForJobCompletion(
  jobId: string,
  onStatusUpdate?: (status: JobStatus) => void,
  maxWaitTime: number = 60000, // 60 seconds default
  pollInterval: number = 2000 // 2 seconds
): Promise<JobStatusResponse | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkJobStatus(jobId);
    
    if (!status) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }
    
    onStatusUpdate?.(status.status);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.warn(`Job ${jobId} timed out after ${maxWaitTime}ms`);
  return null;
}

/**
 * Check relayer health and availability
 */
export async function checkRelayerHealth(): Promise<{
  available: boolean;
  status?: string;
  relayerAddress?: string;
  balance?: number;
}> {
  try {
    const response = await axiosInstance.get('/health', {
      timeout: 5000, // Short timeout for health check
    });
    
    const data = response.data;
    const relayerEnabled = data.relayer?.enabled === true;
    
    return {
      available: data.status === 'ok' && relayerEnabled,
      status: data.status,
      relayerAddress: data.relayer?.address,
      balance: data.relayer?.balance,
    };
  } catch (error) {
    console.error('Error checking relayer health:', error);
    return { available: false };
  }
}

/**
 * Get relayer information
 */
export async function getRelayerInfo(): Promise<{
  relayerAddress?: string;
  balance?: number;
  minFee?: number;
  programId?: string;
  error?: string;
}> {
  try {
    const response = await axiosInstance.get('/relayer/info', {
      timeout: 5000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.response
          ? `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
          : 'Failed to connect to relayer',
      };
    }
    
    console.error('Error getting relayer info:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

