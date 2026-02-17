import { BatchImportRequest, BatchImportProgress } from './batchImport';
import { ReImportRequest } from './reImport';

export type ImportQueueRequest =
  | { batchImport: BatchImportRequest }
  | { reImport: ReImportRequest }
  // Backward compatibility for any older serialized payloads.
  | BatchImportRequest
  | ReImportRequest;

export interface ImportQueueTask {
  id: string;
  description: string;
  request: ImportQueueRequest;
  status: ImportQueueTaskStatus;
  progress?: BatchImportProgress;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  estimatedTimeRemaining?: number;
}

export enum ImportQueueTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ImportQueueStatus {
  tasks: ImportQueueTask[];
  currentTaskId?: string;
  isProcessing: boolean;
  totalPending: number;
  totalCompleted: number;
  totalFailed: number;
}

export interface QueueProgressUpdate {
  taskId: string;
  progress: BatchImportProgress;
}

// Configuration for queue behavior
export interface ImportQueueConfig {
  maxQueueSize: number;
  autoStart: boolean;
  persistQueue: boolean;
}

export const DEFAULT_IMPORT_QUEUE_CONFIG: ImportQueueConfig = {
  maxQueueSize: 10,
  autoStart: true,
  persistQueue: true,
};
