import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { QUEUE_NAMES, QueueKey } from './jobs.constants';

type EnqueueResult = { queued: boolean; queue: string; jobName: string; jobId?: string; reason?: string };

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly queues = new Map<QueueKey, Queue>();

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL is not configured. Background jobs will be skipped.');
      return;
    }

    const connection = this.connectionOptions(redisUrl);

    (Object.keys(QUEUE_NAMES) as QueueKey[]).forEach((key) => {
      this.queues.set(key, new Queue(QUEUE_NAMES[key], {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }));
    });
  }

  async add(queueKey: QueueKey, jobName: string, payload: Record<string, unknown>, options?: JobsOptions): Promise<EnqueueResult> {
    const queue = this.queues.get(queueKey);
    const queueName = QUEUE_NAMES[queueKey];
    if (!queue) return { queued: false, queue: queueName, jobName, reason: 'REDIS_URL is not configured' };

    try {
      const job = await queue.add(jobName, payload, options);
      return { queued: true, queue: queueName, jobName, jobId: job.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unable to enqueue job';
      this.logger.warn(`Failed to enqueue ${jobName} on ${queueName}: ${reason}`);
      return { queued: false, queue: queueName, jobName, reason };
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  connectionOptions(redisUrl: string) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }
}
