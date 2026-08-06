const logger = require('./logger');

const AsyncQueue = require('async');

class ProcessingQueue {
    constructor() {
        this.queue = AsyncQueue.queue(async (task, callback) => {
            try {
                await this.processWithRetry(task);
                callback();
            } catch (error) {
                logger.error('Queue processing error:', error);
                callback(error);
            }
        }, 1); // Process one task at a time
    }

    async processWithRetry(task, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`Processing attempt ${attempt}/${maxRetries} for task:`, task.id);
                await task.process();
                logger.info(`✅ Task ${task.id} completed successfully on attempt ${attempt}`);
                return;
            } catch (error) {
                lastError = error;
                logger.error(`❌ Attempt ${attempt}/${maxRetries} failed for task ${task.id}:`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    logger.info(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // If we get here, all retries failed
        throw new Error(`Task ${task.id} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }

    addTask(taskData) {
        return new Promise((resolve, reject) => {
            const task = {
                id: `LOAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                data: taskData,
                process: async () => {
                    try {
                        await taskData.processor(taskData.data);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            };

            this.queue.push(task);
            logger.info(`Task ${task.id} added to queue. Current queue length: ${this.queue.length()}`);
        });
    }

    getQueueLength() {
        return this.queue.length();
    }
}

// Singleton instance
const loanProcessingQueue = new ProcessingQueue();

module.exports = {
    loanProcessingQueue
};