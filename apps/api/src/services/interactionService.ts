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

import type { IInteractionDocument } from '../database/models/Interaction';
import { interactionRepository } from '../database/repositories/InteractionRepository';

export interface RecordInteractionOptions {
  userId?: string;
  anonymousId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class InteractionService {
  /** Build a partial options object omitting undefined-valued optional fields. */
  private static buildInteractionOpts(opts: RecordInteractionOptions) {
    return {
      ...(opts.userId      !== undefined && { userId:      opts.userId }),
      ...(opts.anonymousId !== undefined && { anonymousId: opts.anonymousId }),
      ...(opts.ipAddress   !== undefined && { ipAddress:   opts.ipAddress }),
      ...(opts.userAgent   !== undefined && { userAgent:   opts.userAgent }),
      ...(opts.metadata    !== undefined && { metadata:    opts.metadata }),
    };
  }

  /** Record that a user viewed a product listing. */
  async recordViewed(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      ...InteractionService.buildInteractionOpts(opts),
      type: InteractionType.VIEW,
      entityType: 'PRODUCT',
      entityId: productId,
    });
  }

  /** Record that a user sent a direct inquiry to a supplier about a product. */
  async recordContacted(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      ...InteractionService.buildInteractionOpts(opts),
      type: InteractionType.INQUIRY,
      entityType: 'PRODUCT',
      entityId: productId,
    });
  }

  /** Record that a user submitted an RFQ (Request For Quotation) for a product. */
  async recordRequested(productId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      ...InteractionService.buildInteractionOpts(opts),
      type: InteractionType.RFQ,
      entityType: 'PRODUCT',
      entityId: productId,
    });
  }

  /** Record that a user placed an order (entityType = ORDER, entityId = orderId). */
  async recordOrdered(orderId: string, opts: RecordInteractionOptions = {}): Promise<IInteractionDocument> {
    return interactionRepository.logInteraction({
      ...InteractionService.buildInteractionOpts(opts),
      type: InteractionType.RFQ,
      entityType: 'ORDER',
      entityId: orderId,
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
