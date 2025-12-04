import { createHash } from 'crypto';
import { WithdrawRequest, WithdrawResponse, SwapRequest, SwapResponse } from './relayer';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobType = 'withdraw' | 'swap';

export type JobRequest = WithdrawRequest | SwapRequest;
export type JobResponse = WithdrawResponse | SwapResponse;

export interface Job<T extends JobRequest = JobRequest, R extends JobResponse = JobResponse> {
  id: string;
  type: JobType;
  status: JobStatus;
  request: T;
  result?: R;
  createdAt: number;
  updatedAt: number;
  error?: string;
  proofHash: string; // Hash of proof to detect duplicates
}

export type WithdrawJob = Job<WithdrawRequest, WithdrawResponse>;
export type SwapJob = Job<SwapRequest, SwapResponse>;

/**
 * Simple in-memory job queue for processing withdrawal and swap requests
 * In production, consider using Redis or a proper message queue
 */
export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private proofHashToJobId: Map<string, string> = new Map();
  private queue: string[] = [];
  private processing: boolean = false;
  private maxJobAge: number = 3600000; // 1 hour

  constructor(
    private processWithdrawJob: (request: WithdrawRequest) => Promise<WithdrawResponse>,
    private processSwapJob?: (request: SwapRequest) => Promise<SwapResponse>
  ) {
    // Clean up old jobs every 5 minutes
    setInterval(() => this.cleanupOldJobs(), 300000);
  }

  /**
   * Generate a unique hash from proof data to detect duplicate requests
   */
  private generateProofHash(proof: JobRequest['proof']): string {
    const data = JSON.stringify({
      proofA: proof.proofA,
      proofB: proof.proofB,
      proofC: proof.proofC,
      inputNullifiers: proof.inputNullifiers,
    });
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Add a new withdraw job to the queue
   * Returns existing job ID if the same proof was already submitted
   */
  addJob(request: WithdrawRequest): string {
    return this.addJobInternal(request, 'withdraw');
  }

  /**
   * Add a new swap job to the queue
   * Returns existing job ID if the same proof was already submitted
   */
  addSwapJob(request: SwapRequest): string {
    if (!this.processSwapJob) {
      throw new Error('Swap job processor not configured');
    }
    return this.addJobInternal(request, 'swap');
  }

  /**
   * Internal method to add any job type
   */
  private addJobInternal(request: JobRequest, type: JobType): string {
    const proofHash = this.generateProofHash(request.proof);

    // Check if we already have a job with this proof
    const existingJobId = this.proofHashToJobId.get(proofHash);
    if (existingJobId) {
      const existingJob = this.jobs.get(existingJobId);
      if (existingJob && (existingJob.status === 'pending' || existingJob.status === 'processing')) {
        console.log(`Duplicate proof detected, returning existing job: ${existingJobId}`);
        return existingJobId;
      }
      // If old job completed/failed, allow creating a new one
      this.proofHashToJobId.delete(proofHash);
    }

    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      type,
      status: 'pending',
      request,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      proofHash,
    };

    this.jobs.set(jobId, job);
    this.proofHashToJobId.set(proofHash, jobId);
    this.queue.push(jobId);

    console.log(`Job ${jobId} (${type}) added to queue. Queue size: ${this.queue.length}`);

    // Start processing if not already running
    this.processQueue();

    return jobId;
  }

  /**
   * Get job status and result
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs (for debugging/monitoring)
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      queueSize: this.queue.length,
      byType: {
        withdraw: jobs.filter(j => j.type === 'withdraw').length,
        swap: jobs.filter(j => j.type === 'swap').length,
      },
    };
  }

  /**
   * Process jobs from the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return; // Already processing
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job) {
        console.warn(`Job ${jobId} not found in jobs map`);
        continue;
      }

      if (job.status !== 'pending') {
        console.warn(`Job ${jobId} status is ${job.status}, skipping`);
        continue;
      }

      console.log(`Processing job ${jobId} (${job.type})...`);

      // Update status to processing
      job.status = 'processing';
      job.updatedAt = Date.now();

      try {
        let result: JobResponse;

        // Process based on job type
        if (job.type === 'withdraw') {
          result = await this.processWithdrawJob(job.request as WithdrawRequest);
        } else if (job.type === 'swap') {
          if (!this.processSwapJob) {
            throw new Error('Swap job processor not configured');
          }
          result = await this.processSwapJob(job.request as SwapRequest);
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }

        // Update job with result
        job.status = result.success ? 'completed' : 'failed';
        job.result = result;
        job.updatedAt = Date.now();

        if (!result.success) {
          job.error = result.error;
        }

        console.log(`Job ${jobId} ${job.status}:`, result);
      } catch (error: any) {
        console.error(`Error processing job ${jobId}:`, error);
        
        // Update job with error
        job.status = 'failed';
        job.error = error.message || 'Unknown error occurred';
        job.result = {
          success: false,
          error: job.error,
        };
        job.updatedAt = Date.now();
      }
    }

    this.processing = false;
  }

  /**
   * Clean up old completed/failed jobs
   */
  private cleanupOldJobs(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      // Only clean up completed or failed jobs older than maxJobAge
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        now - job.updatedAt > this.maxJobAge
      ) {
        this.jobs.delete(jobId);
        this.proofHashToJobId.delete(job.proofHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old jobs`);
    }
  }
}
