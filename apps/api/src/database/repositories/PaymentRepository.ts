import { PaymentStatus } from '@airbus-tools/shared';
import type { FilterQuery } from 'mongoose';

import { PaymentModel, type IPaymentDocument } from '../models/Payment';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export class PaymentRepository extends BaseRepository<IPaymentDocument> {
  constructor() {
    super(PaymentModel);
  }

  public async findByPaymentNumber(paymentNumber: string): Promise<IPaymentDocument | null> {
    return this.findOne({ paymentNumber: paymentNumber.toUpperCase().trim() });
  }

  public async findByProviderPaymentId(providerPaymentId: string): Promise<IPaymentDocument | null> {
    return this.findOne({ providerPaymentId });
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<IPaymentDocument | null> {
    return this.findOne({ idempotencyKey });
  }

  public async findByOrderId(orderId: string): Promise<IPaymentDocument | null> {
    return this.findOne({ orderId });
  }

  public async findByOrder(orderId: string): Promise<IPaymentDocument[]> {
    return this.find({ orderId });
  }

  public async findByPayer(
    payerId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IPaymentDocument>> {
    return this.findPaginated({ payerId }, options);
  }

  public async findByPayee(
    payeeId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IPaymentDocument>> {
    return this.findPaginated({ payeeId }, options);
  }

  public async updateStatus(
    id: string,
    status: PaymentStatus,
    details?: {
      transactionReference?: string;
      gatewayResponse?: Record<string, unknown>;
      failureReason?: string;
      paidAt?: Date;
      refundedAt?: Date;
    },
  ): Promise<IPaymentDocument | null> {
    const update: Record<string, unknown> = { status };
    if (details) {
      Object.assign(update, details);
    }
    return this.updateById(id, update);
  }

  public async findPendingPayments(options?: PaginationOptions): Promise<PaginatedResult<IPaymentDocument>> {
    const filter: FilterQuery<IPaymentDocument> = { status: PaymentStatus.PENDING };
    return this.findPaginated(filter, { sort: { createdAt: 1 }, ...options });
  }
}

export const paymentRepository = new PaymentRepository();
