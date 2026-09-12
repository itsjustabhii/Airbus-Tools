/**
 * InteractionService
 *
 * Records airline-relevant interactions with products/suppliers:
 *   - viewed       → InteractionType.VIEW
 *   - contacted    → InteractionType.INQUIRY
 *   - requested    → InteractionType.RFQ
 *   - ordered      → mapped to entityType ORDER
 *
 * The service wraps InteractionRepository so callers use domain verbs
 * rather than raw enum values.
 */

import { InteractionType } from '@airbus-tools/shared';

import { interactionRepository } from '../database/repositories/InteractionRepository';
import type { IInteractionDocument } from '../database/models/Interaction';

export interface RecordInteractionOptions {
  userId?: string;
  anonymousId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class InteractionService {
  /** Record that a user viewed a product listing. */
  async recordViewed(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      userId: opts.userId,
      anonymousId: opts.anonymousId,
      type: InteractionType.VIEW,
      entityType: 'PRODUCT',
      entityId: productId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      metadata: opts.metadata,
    });
  }

  /** Record that a user sent a direct inquiry to a supplier about a product. */
  async recordContacted(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      userId: opts.userId,
      anonymousId: opts.anonymousId,
      type: InteractionType.INQUIRY,
      entityType: 'PRODUCT',
      entityId: productId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      metadata: opts.metadata,
    });
  }

  /** Record that a user submitted an RFQ (Request For Quotation) for a product. */
  async recordRequested(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      userId: opts.userId,
      anonymousId: opts.anonymousId,
      type: InteractionType.RFQ,
      entityType: 'PRODUCT',
      entityId: productId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      metadata: opts.metadata,
    });
  }

  /** Record that a user placed an order (entityType = ORDER, entityId = orderId). */
  async recordOrdered(orderId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      userId: opts.userId,
      anonymousId: opts.anonymousId,
      type: InteractionType.RFQ,
      entityType: 'ORDER',
      entityId: orderId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      metadata: opts.metadata,
    });
  }

  /**
   * Return the set of product IDs with which this user has *any* interaction.
   * Used by the recommendation engine to drive $nin exclusion.
   */
  async getInteractedProductIds(userId: string): Promise<string[]> {
    const docs = await interactionRepository.find({
      userId,
      entityType: 'PRODUCT',
    });
    return [...new Set(docs.map((d) => d.entityId).filter((id): id is string => id != null))];
  }
}

export const interactionService = new InteractionService();
