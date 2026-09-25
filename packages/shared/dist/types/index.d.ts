export declare enum UserRole {
    ADMIN = "ADMIN",
    BUYER = "BUYER",
    SELLER = "SELLER",
    MODERATOR = "MODERATOR",
    AIRLINE = "AIRLINE",
    SUPPLIER = "SUPPLIER"
}
export declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
}
export declare enum ProductCategory {
    FASTENERS = "FASTENERS",
    AVIONICS = "AVIONICS",
    AIRFRAME = "AIRFRAME",
    PROPULSION = "PROPULSION",
    CABIN_INTERIORS = "CABIN_INTERIORS",
    TOOLING_AND_EQUIPMENT = "TOOLING_AND_EQUIPMENT",
    RAW_MATERIALS = "RAW_MATERIALS",
    HYDRAULICS = "HYDRAULICS",
    MAINTENANCE_SERVICES = "MAINTENANCE_SERVICES",
    OTHER = "OTHER"
}
export declare enum ProductCondition {
    NEW = "NEW",
    OVERHAULED = "OVERHAULED",
    SERVICEABLE = "SERVICEABLE",
    AS_REMOVED = "AS_REMOVED",
    MODIFIED = "MODIFIED"
}
export declare enum ProductStatus {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    ARCHIVED = "ARCHIVED"
}
export declare enum OrderStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    PAYMENT_PENDING = "PAYMENT_PENDING",
    PAID = "PAID",
    COMPLETED = "COMPLETED"
}
export declare enum PaymentMethod {
    CREDIT_CARD = "CREDIT_CARD",
    BANK_TRANSFER = "BANK_TRANSFER",
    ESCROW = "ESCROW",
    LETTER_OF_CREDIT = "LETTER_OF_CREDIT"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    AUTHORIZED = "AUTHORIZED",
    CAPTURED = "CAPTURED",
    REFUNDED = "REFUNDED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum ConversationType {
    DIRECT = "DIRECT",
    ORDER_INQUIRY = "ORDER_INQUIRY",
    PRODUCT_INQUIRY = "PRODUCT_INQUIRY",
    SUPPORT = "SUPPORT"
}
export declare enum MessageType {
    TEXT = "TEXT",
    ATTACHMENT = "ATTACHMENT",
    SYSTEM = "SYSTEM",
    OFFER = "OFFER"
}
export declare enum InteractionType {
    VIEW = "VIEW",
    SEARCH = "SEARCH",
    INQUIRY = "INQUIRY",
    FAVORITE = "FAVORITE",
    RFQ = "RFQ",
    DOWNLOAD_SPEC = "DOWNLOAD_SPEC"
}
export declare enum NotificationType {
    ORDER_UPDATE = "ORDER_UPDATE",
    PAYMENT_UPDATE = "PAYMENT_UPDATE",
    MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
    SYSTEM_ALERT = "SYSTEM_ALERT",
    PRODUCT_STATUS = "PRODUCT_STATUS"
}
export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface User extends BaseEntity {
    name?: string;
    email: string;
    firstName: string;
    lastName: string;
    bio?: string;
    company?: string;
    role: UserRole;
    status: UserStatus;
    organizationId?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    profilePicture?: string;
    lastLoginAt?: Date;
}
export interface Organization extends BaseEntity {
    name: string;
    domain?: string;
    isVerified: boolean;
}
export interface ProductDimensions {
    length: number;
    width: number;
    height: number;
    unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}
export interface Product extends BaseEntity {
    sellerId: string;
    title: string;
    partNumber: string;
    oemPartNumber?: string;
    description: string;
    category: ProductCategory;
    condition: ProductCondition;
    status: ProductStatus;
    price: number;
    currency: string;
    quantityAvailable: number;
    minimumOrderQuantity: number;
    estimatedDeliveryDays?: number;
    certifications: string[];
    tags: string[];
    dimensions?: ProductDimensions;
    weightKg?: number;
    mediaUrls: string[];
}
export interface CursorPageMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface CursorPage<T> {
    items: T[];
    meta: CursorPageMeta;
}
export interface OrderItem {
    productId: string;
    partNumber: string;
    title: string;
    /** Price snapshotted at order creation time — immutable after PENDING */
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    /** Currency snapshotted at order creation time */
    currency: string;
}
export interface OrderShippingAddress {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
}
export interface Order extends BaseEntity {
    orderNumber: string;
    buyerId: string;
    sellerId: string;
    status: OrderStatus;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shippingFee: number;
    totalAmount: number;
    currency: string;
    shippingAddress: OrderShippingAddress;
    notes?: string;
    /** Populated by supplier when rejecting */
    rejectionReason?: string;
    placedAt?: Date;
    acceptedAt?: Date;
    rejectedAt?: Date;
    paidAt?: Date;
    completedAt?: Date;
}
export interface ConversationParticipant {
    userId: string;
    lastReadAt?: Date;
}
export interface Conversation extends BaseEntity {
    participants: ConversationParticipant[];
    type: ConversationType;
    productId?: string;
    orderId?: string;
    lastMessageAt?: Date;
    lastMessageSnippet?: string;
    title?: string;
}
export interface MessageAttachment {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}
export interface Message extends BaseEntity {
    conversationId: string;
    senderId: string;
    type: MessageType;
    content: string;
    attachments?: MessageAttachment[];
    isReadBy: string[];
}
export interface Payment extends BaseEntity {
    paymentNumber: string;
    orderId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    /** Opaque ID assigned by the payment provider (e.g. Stripe PaymentIntent ID). */
    providerPaymentId?: string;
    transactionReference?: string;
    gatewayResponse?: Record<string, unknown>;
    failureReason?: string;
    idempotencyKey?: string;
    paidAt?: Date;
    refundedAt?: Date;
}
export interface Interaction extends BaseEntity {
    userId?: string;
    anonymousId?: string;
    type: InteractionType;
    entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}
export interface Notification extends BaseEntity {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    readAt?: Date;
    referenceEntityType?: 'ORDER' | 'PAYMENT' | 'MESSAGE' | 'PRODUCT';
    referenceEntityId?: string;
    metadata?: Record<string, unknown>;
}
export interface ApiResponse<T = unknown> {
    success: true;
    data: T;
    meta?: ApiMeta;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export interface ApiMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    nextCursor?: string;
    prevCursor?: string;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
}
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;
//# sourceMappingURL=index.d.ts.map