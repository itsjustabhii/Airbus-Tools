// Core domain enums
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["BUYER"] = "BUYER";
    UserRole["SELLER"] = "SELLER";
    UserRole["MODERATOR"] = "MODERATOR";
    UserRole["AIRLINE"] = "AIRLINE";
    UserRole["SUPPLIER"] = "SUPPLIER";
})(UserRole || (UserRole = {}));
export var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
})(UserStatus || (UserStatus = {}));
export var ProductCategory;
(function (ProductCategory) {
    ProductCategory["FASTENERS"] = "FASTENERS";
    ProductCategory["AVIONICS"] = "AVIONICS";
    ProductCategory["AIRFRAME"] = "AIRFRAME";
    ProductCategory["PROPULSION"] = "PROPULSION";
    ProductCategory["CABIN_INTERIORS"] = "CABIN_INTERIORS";
    ProductCategory["TOOLING_AND_EQUIPMENT"] = "TOOLING_AND_EQUIPMENT";
    ProductCategory["RAW_MATERIALS"] = "RAW_MATERIALS";
    ProductCategory["HYDRAULICS"] = "HYDRAULICS";
    ProductCategory["MAINTENANCE_SERVICES"] = "MAINTENANCE_SERVICES";
    ProductCategory["OTHER"] = "OTHER";
})(ProductCategory || (ProductCategory = {}));
export var ProductCondition;
(function (ProductCondition) {
    ProductCondition["NEW"] = "NEW";
    ProductCondition["OVERHAULED"] = "OVERHAULED";
    ProductCondition["SERVICEABLE"] = "SERVICEABLE";
    ProductCondition["AS_REMOVED"] = "AS_REMOVED";
    ProductCondition["MODIFIED"] = "MODIFIED";
})(ProductCondition || (ProductCondition = {}));
export var ProductStatus;
(function (ProductStatus) {
    ProductStatus["DRAFT"] = "DRAFT";
    ProductStatus["ACTIVE"] = "ACTIVE";
    ProductStatus["INACTIVE"] = "INACTIVE";
    ProductStatus["ARCHIVED"] = "ARCHIVED";
})(ProductStatus || (ProductStatus = {}));
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["ACCEPTED"] = "ACCEPTED";
    OrderStatus["REJECTED"] = "REJECTED";
    OrderStatus["PAYMENT_PENDING"] = "PAYMENT_PENDING";
    OrderStatus["PAID"] = "PAID";
    OrderStatus["COMPLETED"] = "COMPLETED";
})(OrderStatus || (OrderStatus = {}));
export var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CREDIT_CARD"] = "CREDIT_CARD";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["ESCROW"] = "ESCROW";
    PaymentMethod["LETTER_OF_CREDIT"] = "LETTER_OF_CREDIT";
})(PaymentMethod || (PaymentMethod = {}));
export var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["AUTHORIZED"] = "AUTHORIZED";
    PaymentStatus["CAPTURED"] = "CAPTURED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
})(PaymentStatus || (PaymentStatus = {}));
export var ConversationType;
(function (ConversationType) {
    ConversationType["DIRECT"] = "DIRECT";
    ConversationType["ORDER_INQUIRY"] = "ORDER_INQUIRY";
    ConversationType["PRODUCT_INQUIRY"] = "PRODUCT_INQUIRY";
    ConversationType["SUPPORT"] = "SUPPORT";
})(ConversationType || (ConversationType = {}));
export var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "TEXT";
    MessageType["ATTACHMENT"] = "ATTACHMENT";
    MessageType["SYSTEM"] = "SYSTEM";
    MessageType["OFFER"] = "OFFER";
})(MessageType || (MessageType = {}));
export var InteractionType;
(function (InteractionType) {
    InteractionType["VIEW"] = "VIEW";
    InteractionType["SEARCH"] = "SEARCH";
    InteractionType["INQUIRY"] = "INQUIRY";
    InteractionType["FAVORITE"] = "FAVORITE";
    InteractionType["RFQ"] = "RFQ";
    InteractionType["DOWNLOAD_SPEC"] = "DOWNLOAD_SPEC";
})(InteractionType || (InteractionType = {}));
export var NotificationType;
(function (NotificationType) {
    NotificationType["ORDER_UPDATE"] = "ORDER_UPDATE";
    NotificationType["PAYMENT_UPDATE"] = "PAYMENT_UPDATE";
    NotificationType["MESSAGE_RECEIVED"] = "MESSAGE_RECEIVED";
    NotificationType["SYSTEM_ALERT"] = "SYSTEM_ALERT";
    NotificationType["PRODUCT_STATUS"] = "PRODUCT_STATUS";
})(NotificationType || (NotificationType = {}));
//# sourceMappingURL=index.js.map