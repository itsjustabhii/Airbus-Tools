import { type IPaymentDocument } from '../models/Payment';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
import { PaymentStatus } from '@airbus-tools/shared';
export declare class PaymentRepository extends BaseRepository<IPaymentDocument> {
    constructor();
    findByPaymentNumber(paymentNumber: string): Promise<IPaymentDocument | null>;
    findByOrder(orderId: string): Promise<IPaymentDocument[]>;
    findByPayer(payerId: string, options?: PaginationOptions): Promise<PaginatedResult<IPaymentDocument>>;
    findByPayee(payeeId: string, options?: PaginationOptions): Promise<PaginatedResult<IPaymentDocument>>;
    updateStatus(id: string, status: PaymentStatus, details?: {
        transactionReference?: string;
        gatewayResponse?: Record<string, unknown>;
        failureReason?: string;
        paidAt?: Date;
        refundedAt?: Date;
    }): Promise<IPaymentDocument | null>;
    findPendingPayments(options?: PaginationOptions): Promise<PaginatedResult<IPaymentDocument>>;
}
export declare const paymentRepository: PaymentRepository;
//# sourceMappingURL=PaymentRepository.d.ts.map