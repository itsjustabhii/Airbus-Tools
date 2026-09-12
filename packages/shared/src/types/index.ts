// Core domain enums

export enum UserRole {
  ADMIN = 'ADMIN',
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  MODERATOR = 'MODERATOR',
  AIRLINE = 'AIRLINE',
  SUPPLIER = 'SUPPLIER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum ProductCategory {
  FASTENERS = 'FASTENERS',
  AVIONICS = 'AVIONICS',
  AIRFRAME = 'AIRFRAME',
  PROPULSION = 'PROPULSION',
  CABIN_INTERIORS = 'CABIN_INTERIORS',
  TOOLING_AND_EQUIPMENT = 'TOOLING_AND_EQUIPMENT',
  RAW_MATERIALS = 'RAW_MATERIALS',
  HYDRAULICS = 'HYDRAULICS',
  MAINTENANCE_SERVICES = 'MAINTENANCE_SERVICES',
  OTHER = 'OTHER',
}

export enum ProductCondition {
  NEW = 'NEW',
  OVERHAULED = 'OVERHAULED',
  SERVICEABLE = 'SERVICEABLE',
  AS_REMOVED = 'AS_REMOVED',
  MODIFIED = 'MODIFIED',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  ESCROW = 'ESCROW',
  LETTER_OF_CREDIT = 'LETTER_OF_CREDIT',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ConversationType {
  DIRECT = 'DIRECT',
  ORDER_INQUIRY = 'ORDER_INQUIRY',
  PRODUCT_INQUIRY = 'PRODUCT_INQUIRY',
  SUPPORT = 'SUPPORT',
}

export enum MessageType {
  TEXT = 'TEXT',
  ATTACHMENT = 'ATTACHMENT',
  SYSTEM = 'SYSTEM',
  OFFER = 'OFFER',
}

export enum InteractionType {
  VIEW = 'VIEW',
  SEARCH = 'SEARCH',
  INQUIRY = 'INQUIRY',
  FAVORITE = 'FAVORITE',
  RFQ = 'RFQ',
  DOWNLOAD_SPEC = 'DOWNLOAD_SPEC',
}

export enum NotificationType {
  ORDER_UPDATE = 'ORDER_UPDATE',
  PAYMENT_UPDATE = 'PAYMENT_UPDATE',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  PRODUCT_STATUS = 'PRODUCT_STATUS',
}

// Core domain interfaces

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
  certifications: string[]; // e.g. EASA Form 1, FAA 8130-3, CoC
  tags: string[];
  dimensions?: ProductDimensions;
  weightKg?: number;
  mediaUrls: string[];
}

// ── Cursor pagination ──────────────────────────────────────────────────────────

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
  unitPrice: number;
  quantity: number;
  totalPrice: number;
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
  placedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
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
  isReadBy: string[]; // array of userIds
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
  transactionReference?: string;
  gatewayResponse?: Record<string, unknown>;
  failureReason?: string;
  paidAt?: Date;
  refundedAt?: Date;
}

export interface Interaction extends BaseEntity {
  userId?: string; // Optional for anonymous visitor events
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
  // Cursor pagination
  nextCursor?: string;
  prevCursor?: string;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;
