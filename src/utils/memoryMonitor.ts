import { logger } from './logger';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100; // Keep last 100 snapshots
  private monitoringInterval: NodeJS.Timeout | null = null;
  private warningThreshold = 90; // Percentage
  private leakDetectionThreshold = 50; // MB increase over 10 snapshots

  /**
   * Start monitoring memory usage at specified intervals
   */
  startMonitoring(intervalMs: number = 60000): void { // Default: 1 minute
    if (this.monitoringInterval) {
      logger.warn('Memory monitoring is already running');
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
      this.analyzeMemoryTrends();
    }, intervalMs);

    logger.info(`Memory monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Memory monitoring stopped');
    }
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    };

    this.snapshots.push(snapshot);

    // Keep only the last N snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Analyze memory trends and detect potential leaks
   */
  private analyzeMemoryTrends(): void {
    if (this.snapshots.length < 2) return;

    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    const memoryPercentage = (latest.heapUsed / latest.heapTotal) * 100;

    // Check for high memory usage
    if (memoryPercentage > this.warningThreshold) {
      logger.warn(`High memory usage: ${memoryPercentage.toFixed(1)}% (${this.formatBytes(latest.heapUsed)}/${this.formatBytes(latest.heapTotal)})`);
    }

    // Check for potential memory leaks (consistent growth over time)
    if (this.snapshots.length >= 10) {
      const tenSnapshotsAgo = this.snapshots[this.snapshots.length - 10];
      if (tenSnapshotsAgo) {
        const heapGrowth = latest.heapUsed - tenSnapshotsAgo.heapUsed;
        const heapGrowthMB = heapGrowth / (1024 * 1024);

        if (heapGrowthMB > this.leakDetectionThreshold) {
          logger.error(`Potential memory leak detected: Heap grew by ${heapGrowthMB.toFixed(1)}MB over last 10 snapshots`);
          this.logMemoryTrend();
        }
      }
    }
  }

  /**
   * Log recent memory trends
   */
  private logMemoryTrend(): void {
    if (this.snapshots.length < 5) return;

    const recent = this.snapshots.slice(-5);
    logger.info('Recent memory trend:');
    recent.forEach((snapshot, index) => {
      const percentage = (snapshot.heapUsed / snapshot.heapTotal) * 100;
      const time = new Date(snapshot.timestamp).toISOString();
      logger.info(`  ${index + 1}. ${time}: ${this.formatBytes(snapshot.heapUsed)}/${this.formatBytes(snapshot.heapTotal)} (${percentage.toFixed(1)}%)`);
    });
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): {
    current: MemorySnapshot;
    trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    averageGrowthRate: number; // MB per snapshot
  } {
    const current = this.takeSnapshot();
    
    if (this.snapshots.length < 5) {
      return {
        current,
        trend: 'unknown',
        averageGrowthRate: 0
      };
    }

    // Calculate trend over last 5 snapshots
    const recent = this.snapshots.slice(-5);
    const growthRates: number[] = [];
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i-1];
      if (current && previous) {
        const growth = (current.heapUsed - previous.heapUsed) / (1024 * 1024);
        growthRates.push(growth);
      }
    }

    const averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (averageGrowthRate > 5) { // More than 5MB growth per snapshot
      trend = 'increasing';
    } else if (averageGrowthRate < -5) { // More than 5MB decrease per snapshot
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      current,
      trend,
      averageGrowthRate
    };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
    logger.info('Memory snapshots cleared');
  }

  /**
   * Get all snapshots (for debugging)
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }
}

// Export singleton instance
export const memoryMonitor = new MemoryMonitor();