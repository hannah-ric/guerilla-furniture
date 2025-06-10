// services/communication/agentCommunicationBus.ts
// Complete implementation of inter-agent communication system

import { EventEmitter } from 'events';
import { 
  AgentMessage, 
  MessageType,
  ValidationResult,
  FurnitureDesign,
  SharedState,
  AgentDecision
} from '@/lib/types';

interface Agent {
  name: string;
  process: (input: string, context: any) => Promise<any>;
  handleMessage?: (message: AgentMessage) => Promise<any>;
  interestedEvents?: string[];
}

interface MessageQueueItem {
  message: AgentMessage;
  priority: number;
  timestamp: Date;
  retries: number;
  deferred?: Promise<any>;
}

interface QueryCache {
  key: string;
  result: any;
  timestamp: Date;
  ttl: number;
}

interface PerformanceMetrics {
  agent: string;
  totalQueries: number;
  totalTime: number;
  avgResponseTime: number;
  successRate: number;
  lastUpdated: Date;
}

/**
 * Central communication hub for all agents
 * Handles message routing, caching, and conflict resolution
 */
export class AgentCommunicationBus extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private messageQueue: MessageQueueItem[] = [];
  private queryCache: Map<string, QueryCache> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private isProcessing = false;
  
  // Configuration
  private readonly MAX_RETRIES = 3;
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_QUEUE_SIZE = 1000;
  
  constructor() {
    super();
    this.startQueueProcessor();
    this.startCacheCleanup();
  }

  /**
   * Register an agent with the communication bus
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent ${agent.name} is already registered`);
    }
    
    this.agents.set(agent.name, agent);
    
    // Initialize performance metrics
    this.performanceMetrics.set(agent.name, {
      agent: agent.name,
      totalQueries: 0,
      totalTime: 0,
      avgResponseTime: 0,
      successRate: 1.0,
      lastUpdated: new Date()
    });
    
    // Set up event listeners if agent is interested
    if (agent.interestedEvents) {
      for (const eventType of agent.interestedEvents) {
        this.on(eventType, async (data) => {
          await this.handleEventForAgent(agent, eventType, data);
        });
      }
    }
    
    // Provide query interface to agent
    this.provideQueryInterface(agent);
    
    console.log(`Agent ${agent.name} registered successfully`);
  }

  /**
   * Send a query from one agent to another
   */
  async query(
    fromAgent: string, 
    toAgent: string, 
    query: any,
    options: { timeout?: number; priority?: number } = {}
  ): Promise<any> {
    // Check cache first
    const cacheKey = this.getCacheKey(fromAgent, toAgent, query);
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // Create message
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from_agent: fromAgent,
      to_agent: toAgent,
      type: 'query',
      payload: query,
      timestamp: new Date(),
      requires_response: true,
      timeout_ms: options.timeout || this.DEFAULT_TIMEOUT
    };
    
    // Add to queue with promise
    const deferred = this.createDeferredPromise();
    this.addToQueue(message, options.priority || 1, deferred);
    
    // Track performance
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        deferred.promise,
        this.createTimeoutPromise(message.timeout_ms!)
      ]);
      
      // Update metrics
      this.updateMetrics(toAgent, true, Date.now() - startTime);
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      // Update metrics
      this.updateMetrics(toAgent, false, Date.now() - startTime);
      
      // Try fallback
      return this.handleQueryError(fromAgent, toAgent, query, error);
    }
  }

  /**
   * Broadcast a message to all interested agents
   */
  async broadcast(
    fromAgent: string,
    eventType: string,
    data: any
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from_agent: fromAgent,
      to_agent: '*', // Broadcast
      type: 'broadcast',
      payload: { eventType, data },
      timestamp: new Date(),
      requires_response: false
    };
    
    // Emit event for interested agents
    this.emit(eventType, { from: fromAgent, data, message });
    
    // Log broadcast
    console.log(`Broadcast from ${fromAgent}: ${eventType}`);
  }

  /**
   * Send a validation request to multiple agents
   */
  async requestValidation(
    design: Partial<FurnitureDesign>,
    validators: string[] = ['dimension_agent', 'material_agent', 'joinery_agent', 'validation_agent']
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    // Send validation requests in parallel
    const validationPromises = validators.map(async (agentName) => {
      try {
        const agent = this.agents.get(agentName);
        if (!agent) return null;
        
        const result = await this.query(
          'orchestrator',
          agentName,
          { type: 'validate', design },
          { priority: 2 } // Higher priority for validation
        );
        
        return { agent: agentName, result };
      } catch (error) {
        console.error(`Validation failed for ${agentName}:`, error);
        return {
          agent: agentName,
          result: {
            valid: false,
            score: 0,
            issues: [{
              type: 'validation_error',
              severity: 'high',
              message: `Validation failed: ${error.message}`,
              affected_component: agentName,
              fix_available: false
            }],
            warnings: [],
            suggestions: []
          }
        };
      }
    });
    
    const validationResults = await Promise.all(validationPromises);
    
    // Compile results
    for (const result of validationResults) {
      if (result) {
        results.set(result.agent, result.result);
      }
    }
    
    return results;
  }

  /**
   * Coordinate agents to resolve conflicts
   */
  async resolveConflict(
    conflict: {
      type: string;
      agents: string[];
      issue: string;
      proposals: Map<string, any>;
    }
  ): Promise<any> {
    console.log(`Resolving conflict: ${conflict.type}`);
    
    // Strategy 1: Voting system
    if (conflict.agents.length > 2) {
      return this.resolveByVoting(conflict);
    }
    
    // Strategy 2: Priority-based resolution
    const priorities = {
      'validation_agent': 3,  // Safety first
      'material_agent': 2,    // Material constraints
      'dimension_agent': 2,   // Size constraints
      'joinery_agent': 1,     // Can adapt
      'style_agent': 0        // Aesthetic last
    };
    
    let bestProposal = null;
    let highestPriority = -1;
    
    for (const [agent, proposal] of conflict.proposals) {
      const priority = priorities[agent] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        bestProposal = proposal;
      }
    }
    
    // Notify all agents of resolution
    await this.broadcast('conflict_resolver', 'conflict_resolved', {
      conflict: conflict.type,
      resolution: bestProposal,
      reason: 'priority_based'
    });
    
    return bestProposal;
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    agents: string[];
    queueSize: number;
    cacheSize: number;
    metrics: Map<string, PerformanceMetrics>;
  } {
    return {
      agents: Array.from(this.agents.keys()),
      queueSize: this.messageQueue.length,
      cacheSize: this.queryCache.size,
      metrics: this.performanceMetrics
    };
  }

  // ========== Private Methods ==========

  /**
   * Provide query interface to agents
   */
  private provideQueryInterface(agent: Agent): void {
    // Inject query method into agent context
    const bus = this;
    
    // Add query method
    (agent as any).query = async function(targetAgent: string, query: any, options?: any) {
      return bus.query(agent.name, targetAgent, query, options);
    };
    
    // Add broadcast method
    (agent as any).broadcast = async function(eventType: string, data: any) {
      return bus.broadcast(agent.name, eventType, data);
    };
    
    // Add validation request method
    (agent as any).requestValidation = async function(design: Partial<FurnitureDesign>) {
      return bus.requestValidation(design);
    };
  }

  /**
   * Process message queue
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.messageQueue.length === 0) return;
      
      this.isProcessing = true;
      
      try {
        // Sort by priority and timestamp
        this.messageQueue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
          }
          return a.timestamp.getTime() - b.timestamp.getTime(); // Older first
        });
        
        // Process messages
        const toProcess = this.messageQueue.splice(0, 10); // Process up to 10 at a time
        
        for (const item of toProcess) {
          await this.processMessage(item);
        }
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Check every 100ms
  }

  /**
   * Process a single message
   */
  private async processMessage(item: MessageQueueItem): Promise<void> {
    const { message, deferred, retries } = item;
    
    try {
      const targetAgent = this.agents.get(message.to_agent);
      if (!targetAgent) {
        throw new Error(`Agent ${message.to_agent} not found`);
      }
      
      let result;
      
      if (message.type === 'query' && targetAgent.handleMessage) {
        // Use agent's message handler if available
        result = await targetAgent.handleMessage(message);
      } else if (message.type === 'query') {
        // Fall back to process method
        result = await targetAgent.process(
          JSON.stringify(message.payload),
          { fromAgent: message.from_agent }
        );
      }
      
      // Resolve deferred promise
      if (deferred) {
        deferred.resolve(result);
      }
      
      // Send response if required
      if (message.requires_response) {
        const response: AgentMessage = {
          id: this.generateMessageId(),
          from_agent: message.to_agent,
          to_agent: message.from_agent,
          type: 'response',
          payload: result,
          timestamp: new Date(),
          requires_response: false
        };
        
        this.emit('response', response);
      }
    } catch (error) {
      // Retry logic
      if (retries < this.MAX_RETRIES) {
        item.retries++;
        this.messageQueue.push(item); // Re-queue
      } else {
        // Max retries reached
        if (deferred) {
          deferred.reject(error);
        }
        console.error(`Failed to process message after ${this.MAX_RETRIES} retries:`, error);
      }
    }
  }

  /**
   * Handle event for a specific agent
   */
  private async handleEventForAgent(
    agent: Agent,
    eventType: string,
    data: any
  ): Promise<void> {
    try {
      if (agent.handleMessage) {
        const message: AgentMessage = {
          id: this.generateMessageId(),
          from_agent: data.from || 'system',
          to_agent: agent.name,
          type: 'broadcast',
          payload: data,
          timestamp: new Date(),
          requires_response: false
        };
        
        await agent.handleMessage(message);
      }
    } catch (error) {
      console.error(`Error handling event ${eventType} for agent ${agent.name}:`, error);
    }
  }

  /**
   * Resolve conflict by voting
   */
  private async resolveByVoting(conflict: any): Promise<any> {
    const votes = new Map<string, number>();
    
    // Each proposal gets voted on
    for (const [proposer, proposal] of conflict.proposals) {
      votes.set(JSON.stringify(proposal), 0);
      
      // Ask each agent to vote
      for (const agentName of conflict.agents) {
        if (agentName === proposer) continue; // Can't vote for own proposal
        
        try {
          const vote = await this.query(
            'conflict_resolver',
            agentName,
            {
              type: 'vote',
              proposals: Array.from(conflict.proposals.values()),
              context: conflict.issue
            },
            { timeout: 2000 } // Quick timeout for voting
          );
          
          if (vote && vote.choice !== undefined) {
            const key = JSON.stringify(conflict.proposals.get(vote.choice));
            votes.set(key, (votes.get(key) || 0) + 1);
          }
        } catch (error) {
          // Skip if agent doesn't respond
        }
      }
    }
    
    // Find winner
    let maxVotes = 0;
    let winner = null;
    
    for (const [proposal, voteCount] of votes) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winner = JSON.parse(proposal);
      }
    }
    
    return winner || conflict.proposals.values().next().value; // Default to first
  }

  /**
   * Handle query errors with fallback
   */
  private async handleQueryError(
    fromAgent: string,
    toAgent: string,
    query: any,
    error: any
  ): Promise<any> {
    console.error(`Query failed from ${fromAgent} to ${toAgent}:`, error);
    
    // Try fallback strategies
    if (toAgent === 'material_agent') {
      // Fallback to default material
      return {
        material: 'pine',
        reason: 'fallback_default',
        properties: { cost: 'low', workability: 'easy' }
      };
    } else if (toAgent === 'dimension_agent') {
      // Fallback to standard dimensions
      return {
        dimensions: { width: 24, height: 30, depth: 18 },
        reason: 'fallback_standard'
      };
    }
    
    // Generic fallback
    return {
      success: false,
      error: error.message,
      fallback: true
    };
  }

  // ========== Utility Methods ==========

  private addToQueue(
    message: AgentMessage,
    priority: number,
    deferred?: any
  ): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error('Message queue is full');
    }
    
    this.messageQueue.push({
      message,
      priority,
      timestamp: new Date(),
      retries: 0,
      deferred
    });
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(fromAgent: string, toAgent: string, query: any): string {
    return `${fromAgent}->${toAgent}:${JSON.stringify(query)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.result;
  }

  private addToCache(key: string, result: any): void {
    this.queryCache.set(key, {
      key,
      result,
      timestamp: new Date(),
      ttl: this.CACHE_TTL
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cache] of this.queryCache) {
        if (now - cache.timestamp.getTime() > cache.ttl) {
          this.queryCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  private createDeferredPromise(): any {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), ms);
    });
  }

  private updateMetrics(agent: string, success: boolean, responseTime: number): void {
    const metrics = this.performanceMetrics.get(agent);
    if (!metrics) return;
    
    metrics.totalQueries++;
    metrics.totalTime += responseTime;
    metrics.avgResponseTime = metrics.totalTime / metrics.totalQueries;
    metrics.successRate = success 
      ? (metrics.successRate * (metrics.totalQueries - 1) + 1) / metrics.totalQueries
      : (metrics.successRate * (metrics.totalQueries - 1)) / metrics.totalQueries;
    metrics.lastUpdated = new Date();
  }
}

// Export singleton instance
export const communicationBus = new AgentCommunicationBus();