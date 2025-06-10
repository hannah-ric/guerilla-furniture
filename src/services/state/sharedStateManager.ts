// services/state/sharedStateManager.ts
// Shared state management with React integration

import React from 'react';
import { EventEmitter } from 'events';
import { 
  SharedState,
  FurnitureDesign,
  DesignConstraints,
  ValidationResult,
  AgentDecision,
  StateChange,
  DimensionalConstraints,
  MaterialConstraints,
  StructuralConstraints,
  AestheticConstraints,
  BudgetConstraints
} from '@/lib/types';

interface Lock {
  id: string;
  agent: string;
  properties: Set<string>;
  acquiredAt: Date;
  expiresAt: Date;
}

interface StateSnapshot {
  version: number;
  timestamp: Date;
  state: SharedState;
  hash: string;
}

interface StateSubscriber {
  id: string;
  callback: (state: SharedState, changes: StateChange[]) => void;
  filter?: (change: StateChange) => boolean;
}

/**
 * Centralized state management for furniture design
 * Ensures consistency across all agents with React integration
 */
export class SharedStateManager extends EventEmitter {
  private state: SharedState;
  private locks: Map<string, Lock> = new Map();
  private history: StateSnapshot[] = [];
  private subscribers: Map<string, StateSubscriber> = new Map();
  private pendingChanges: StateChange[] = [];
  
  // Configuration
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds
  private readonly BATCH_UPDATE_DELAY = 50; // 50ms
  
  // React integration
  private reactUpdateCallback?: (state: SharedState) => void;
  private batchUpdateTimer?: NodeJS.Timeout;
  
  constructor() {
    super();
    this.state = this.initializeState();
    this.saveSnapshot();
  }

  /**
   * Initialize empty state
   */
  private initializeState(): SharedState {
    return {
      version: 0,
      design: {},
      constraints: {
        dimensional: {},
        material: {},
        structural: {
          min_load_capacity: 50,
          min_safety_factor: 2,
          stability_requirement: 'standard'
        },
        aesthetic: {},
        budget: {}
      },
      validation_results: new Map(),
      agent_decisions: new Map(),
      locked_properties: new Set(),
      history: []
    };
  }

  /**
   * Connect to React component for automatic updates
   */
  connectToReact(updateCallback: (state: SharedState) => void): () => void {
    this.reactUpdateCallback = updateCallback;
    
    // Send initial state
    updateCallback(this.getState());
    
    // Return disconnect function
    return () => {
      this.reactUpdateCallback = undefined;
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(
    id: string,
    callback: (state: SharedState, changes: StateChange[]) => void,
    filter?: (change: StateChange) => boolean
  ): () => void {
    const subscriber: StateSubscriber = { id, callback, filter };
    this.subscribers.set(id, subscriber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): SharedState {
    return this.deepClone(this.state);
  }

  /**
   * Get specific part of state
   */
  getDesign(): Partial<FurnitureDesign> {
    return this.deepClone(this.state.design);
  }

  getConstraints(): DesignConstraints {
    return this.deepClone(this.state.constraints);
  }

  getValidationResults(): Map<string, ValidationResult> {
    return new Map(this.state.validation_results);
  }

  /**
   * Update state with optimistic locking
   */
  async updateState(
    agentName: string,
    updates: Partial<{
      design: Partial<FurnitureDesign>;
      constraints: Partial<DesignConstraints>;
      validation: { agent: string; result: ValidationResult };
      decision: AgentDecision;
    }>,
    expectedVersion?: number
  ): Promise<{ success: boolean; newVersion: number; conflicts?: string[] }> {
    // Check version for optimistic locking
    if (expectedVersion !== undefined && expectedVersion !== this.state.version) {
      return {
        success: false,
        newVersion: this.state.version,
        conflicts: ['Version mismatch - state has been updated by another agent']
      };
    }
    
    // Check for locks
    const lockedProperties = this.getLockedProperties(updates);
    if (lockedProperties.length > 0) {
      return {
        success: false,
        newVersion: this.state.version,
        conflicts: lockedProperties.map(p => `Property ${p} is locked`)
      };
    }
    
    // Apply updates
    const changes: StateChange[] = [];
    
    try {
      // Update design
      if (updates.design) {
        for (const [key, value] of Object.entries(updates.design)) {
          const oldValue = this.state.design[key];
          this.state.design[key] = value;
          
          changes.push({
            agent: agentName,
            timestamp: new Date(),
            previous_value: oldValue,
            new_value: value,
            property_path: `design.${key}`,
            reason: `Updated by ${agentName}`
          });
        }
      }
      
      // Update constraints
      if (updates.constraints) {
        this.updateConstraints(updates.constraints, agentName, changes);
      }
      
      // Update validation results
      if (updates.validation) {
        this.state.validation_results.set(
          updates.validation.agent,
          updates.validation.result
        );
        
        changes.push({
          agent: agentName,
          timestamp: new Date(),
          previous_value: null,
          new_value: updates.validation.result,
          property_path: `validation.${updates.validation.agent}`,
          reason: 'Validation completed'
        });
      }
      
      // Record agent decision
      if (updates.decision) {
        const key = `${agentName}_${updates.decision.decision_type}`;
        this.state.agent_decisions.set(key, updates.decision);
        
        changes.push({
          agent: agentName,
          timestamp: new Date(),
          previous_value: null,
          new_value: updates.decision,
          property_path: `decisions.${key}`,
          reason: updates.decision.reasoning
        });
      }
      
      // Update version and history
      this.state.version++;
      this.state.history.push(...changes);
      
      // Keep history size limited
      if (this.state.history.length > this.MAX_HISTORY_SIZE) {
        this.state.history = this.state.history.slice(-this.MAX_HISTORY_SIZE);
      }
      
      // Save snapshot periodically
      if (this.state.version % 10 === 0) {
        this.saveSnapshot();
      }
      
      // Batch changes for notification
      this.pendingChanges.push(...changes);
      this.scheduleBatchUpdate();
      
      return {
        success: true,
        newVersion: this.state.version
      };
      
    } catch (error) {
      console.error('State update failed:', error);
      
      // Rollback changes
      this.rollbackChanges(changes);
      
      return {
        success: false,
        newVersion: this.state.version,
        conflicts: [`Update failed: ${error.message}`]
      };
    }
  }

  /**
   * Acquire lock on properties
   */
  async acquireLock(
    agentName: string,
    properties: string[]
  ): Promise<{ success: boolean; lockId?: string; conflicts?: string[] }> {
    // Check if any properties are already locked
    const conflicts: string[] = [];
    
    for (const prop of properties) {
      for (const lock of this.locks.values()) {
        if (lock.properties.has(prop) && lock.agent !== agentName) {
          if (new Date() < lock.expiresAt) {
            conflicts.push(`${prop} locked by ${lock.agent}`);
          }
        }
      }
    }
    
    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }
    
    // Create lock
    const lockId = this.generateLockId();
    const lock: Lock = {
      id: lockId,
      agent: agentName,
      properties: new Set(properties),
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + this.LOCK_TIMEOUT)
    };
    
    this.locks.set(lockId, lock);
    
    // Update locked properties in state
    for (const prop of properties) {
      this.state.locked_properties.add(prop);
    }
    
    // Auto-release after timeout
    setTimeout(() => {
      this.releaseLock(lockId);
    }, this.LOCK_TIMEOUT);
    
    return { success: true, lockId };
  }

  /**
   * Release lock
   */
  releaseLock(lockId: string): boolean {
    const lock = this.locks.get(lockId);
    if (!lock) return false;
    
    // Remove from locked properties
    for (const prop of lock.properties) {
      this.state.locked_properties.delete(prop);
    }
    
    this.locks.delete(lockId);
    return true;
  }

  /**
   * Get agents that have made decisions
   */
  getAgentDecisions(): Map<string, AgentDecision> {
    return new Map(this.state.agent_decisions);
  }

  /**
   * Get decision history for an agent
   */
  getAgentHistory(agentName: string): StateChange[] {
    return this.state.history.filter(change => change.agent === agentName);
  }

  /**
   * Rollback to previous version
   */
  async rollbackToVersion(version: number): Promise<boolean> {
    const snapshot = this.history.find(s => s.version === version);
    if (!snapshot) return false;
    
    // Clear locks
    this.locks.clear();
    this.state.locked_properties.clear();
    
    // Restore state
    this.state = this.deepClone(snapshot.state);
    
    // Notify all subscribers
    this.notifySubscribers([{
      agent: 'system',
      timestamp: new Date(),
      previous_value: null,
      new_value: null,
      property_path: 'rollback',
      reason: `Rolled back to version ${version}`
    }]);
    
    return true;
  }

  /**
   * Export state for persistence
   */
  exportState(): string {
    return JSON.stringify({
      state: this.state,
      version: this.state.version,
      timestamp: new Date().toISOString()
    }, this.replacer);
  }

  /**
   * Import state from export
   */
  importState(exportedState: string): boolean {
    try {
      const imported = JSON.parse(exportedState, this.reviver);
      this.state = imported.state;
      this.saveSnapshot();
      
      // Notify subscribers
      this.notifySubscribers([{
        agent: 'system',
        timestamp: new Date(),
        previous_value: null,
        new_value: null,
        property_path: 'import',
        reason: 'State imported'
      }]);
      
      return true;
    } catch (error) {
      console.error('Failed to import state:', error);
      return false;
    }
  }

  // ========== Private Methods ==========

  /**
   * Update constraints with proper nesting
   */
  private updateConstraints(
    updates: Partial<DesignConstraints>,
    agentName: string,
    changes: StateChange[]
  ): void {
    if (updates.dimensional) {
      Object.assign(this.state.constraints.dimensional, updates.dimensional);
      changes.push(this.createChange(agentName, 'constraints.dimensional', updates.dimensional));
    }
    
    if (updates.material) {
      Object.assign(this.state.constraints.material, updates.material);
      changes.push(this.createChange(agentName, 'constraints.material', updates.material));
    }
    
    if (updates.structural) {
      Object.assign(this.state.constraints.structural, updates.structural);
      changes.push(this.createChange(agentName, 'constraints.structural', updates.structural));
    }
    
    if (updates.aesthetic) {
      Object.assign(this.state.constraints.aesthetic, updates.aesthetic);
      changes.push(this.createChange(agentName, 'constraints.aesthetic', updates.aesthetic));
    }
    
    if (updates.budget) {
      Object.assign(this.state.constraints.budget, updates.budget);
      changes.push(this.createChange(agentName, 'constraints.budget', updates.budget));
    }
  }

  /**
   * Check if properties are locked
   */
  private getLockedProperties(updates: any): string[] {
    const locked: string[] = [];
    
    const checkPath = (obj: any, path: string) => {
      if (this.state.locked_properties.has(path)) {
        locked.push(path);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          checkPath(value, `${path}.${key}`);
        }
      }
    };
    
    for (const [key, value] of Object.entries(updates)) {
      checkPath(value, key);
    }
    
    return locked;
  }

  /**
   * Schedule batch update notification
   */
  private scheduleBatchUpdate(): void {
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    this.batchUpdateTimer = setTimeout(() => {
      this.processBatchUpdate();
    }, this.BATCH_UPDATE_DELAY);
  }

  /**
   * Process batch update
   */
  private processBatchUpdate(): void {
    if (this.pendingChanges.length === 0) return;
    
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    
    // Notify subscribers
    this.notifySubscribers(changes);
    
    // Update React if connected
    if (this.reactUpdateCallback) {
      this.reactUpdateCallback(this.getState());
    }
    
    // Emit event
    this.emit('stateChanged', {
      state: this.getState(),
      changes,
      version: this.state.version
    });
  }

  /**
   * Notify subscribers of changes
   */
  private notifySubscribers(changes: StateChange[]): void {
    for (const subscriber of this.subscribers.values()) {
      // Apply filter if provided
      const relevantChanges = subscriber.filter
        ? changes.filter(subscriber.filter)
        : changes;
      
      if (relevantChanges.length > 0) {
        try {
          subscriber.callback(this.getState(), relevantChanges);
        } catch (error) {
          console.error(`Subscriber ${subscriber.id} error:`, error);
        }
      }
    }
  }

  /**
   * Save state snapshot
   */
  private saveSnapshot(): void {
    const snapshot: StateSnapshot = {
      version: this.state.version,
      timestamp: new Date(),
      state: this.deepClone(this.state),
      hash: this.calculateHash(this.state)
    };
    
    this.history.push(snapshot);
    
    // Limit history size
    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Rollback changes
   */
  private rollbackChanges(changes: StateChange[]): void {
    // Apply changes in reverse order
    for (const change of changes.reverse()) {
      const pathParts = change.property_path.split('.');
      let obj: any = this.state;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        obj = obj[pathParts[i]];
      }
      
      const lastKey = pathParts[pathParts.length - 1];
      obj[lastKey] = change.previous_value;
    }
  }

  /**
   * Create state change record
   */
  private createChange(
    agent: string,
    path: string,
    value: any
  ): StateChange {
    return {
      agent,
      timestamp: new Date(),
      previous_value: this.getValueAtPath(path),
      new_value: value,
      property_path: path,
      reason: `Updated by ${agent}`
    };
  }

  /**
   * Get value at path
   */
  private getValueAtPath(path: string): any {
    const parts = path.split('.');
    let value: any = this.state;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  // ========== Utility Methods ==========

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, this.replacer), this.reviver);
  }

  private calculateHash(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // JSON serialization helpers for Maps
  private replacer(key: string, value: any): any {
    if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries())
      };
    } else if (value instanceof Set) {
      return {
        dataType: 'Set',
        value: Array.from(value)
      };
    }
    return value;
  }

  private reviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') {
        return new Map(value.value);
      } else if (value.dataType === 'Set') {
        return new Set(value.value);
      }
    }
    return value;
  }
}

// Export singleton instance
export const sharedStateManager = new SharedStateManager();

// ========== React Hook ==========

/**
 * React hook for using shared state
 */
export function useSharedState() {
  const [state, setState] = React.useState<SharedState>(sharedStateManager.getState());
  
  React.useEffect(() => {
    // Connect to state manager
    const disconnect = sharedStateManager.connectToReact(setState);
    
    // Subscribe to specific changes if needed
    const unsubscribe = sharedStateManager.subscribe(
      'react-hook',
      (newState) => {
        setState(newState);
      }
    );
    
    return () => {
      disconnect();
      unsubscribe();
    };
  }, []);
  
  const updateDesign = React.useCallback(
    async (updates: Partial<FurnitureDesign>) => {
      return sharedStateManager.updateState('user', { design: updates });
    },
    []
  );
  
  const updateConstraints = React.useCallback(
    async (updates: Partial<DesignConstraints>) => {
      return sharedStateManager.updateState('user', { constraints: updates });
    },
    []
  );
  
  return {
    state,
    design: state.design,
    constraints: state.constraints,
    validationResults: state.validation_results,
    updateDesign,
    updateConstraints,
    getAgentDecisions: () => sharedStateManager.getAgentDecisions(),
    rollback: (version: number) => sharedStateManager.rollbackToVersion(version)
  };
}