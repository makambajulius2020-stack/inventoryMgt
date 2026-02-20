/**
 * ENTERPRISE SPECIFICATION MOCK DATABASE (ERD-COMPLIANT)
 * This file serves as the single source of truth for the mocked backend.
 * All IDs are UUID-like strings.
 * Relational integrity is maintained through cross-referencing.
 */

// --- ENUMS & TYPES ---

export type EntityStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type LifecycleStatus = "PENDING" | "APPROVED" | "REJECTED" | "ISSUED" | "RECEIVED" | "CANCELLED" | "PAID";

export type RequisitionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LPOStatus = "DRAFT" | "ISSUED" | "RECEIVED" | "CLOSED" | "CANCELLED";
export type GRNStatus = "DRAFT" | "PENDING" | "RECEIVED" | "REJECTED";
export type InvoiceStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type PaymentRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

const makeId = (prefix: string, suffix: string) => `${prefix}_${suffix}`;

// --- CORE ENTITIES ---

export interface Company {
    id: string;
    name: string;
    taxId: string;
    baseCurrency: string;
}

export interface Location {
    id: string;
    companyId: string;
    name: string;
    code: string;
    type: "BRANCH" | "WAREHOUSE" | "HQ";
    address: string;
    status: EntityStatus;
}

export interface Department {
    id: string;
    locationId: string;
    name: string;
    code: string;
    status: EntityStatus;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    status: EntityStatus;
    locationId?: string;
    departmentId?: string;
}

export interface Role {
    id: string;
    name: string;
    scope: "GLOBAL" | "LOCATION" | "DEPARTMENT";
    permissions: string[];
}

// --- INVENTORY ENTITIES ---

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    uom: string; // Unit of Measure
    basePrice: number;
}

export interface LocationStock {
    id: string;
    locationId: string;
    itemId: string;
    onHandQuantity: number;
    reservedQuantity: number;
    reorderLevel: number;
}

export interface DepartmentStock {
    id: string;
    departmentId: string;
    itemId: string;
    currentQuantity: number;
}

export interface StockTransfer {
    id: string;
    sourceLocationId: string;
    destinationLocationId: string;
    itemId: string;
    quantity: number;
    status: LifecycleStatus;
    requestedAt: string;
    completedAt?: string;
}

// --- PROCUREMENT ENTITIES ---

export interface VendorCategory {
    id: string;
    name: string;
}

export interface Vendor {
    id: string;
    name: string;
    categoryId: string;
    rating: number;
    contactEmail: string;
}

export interface VendorItem {
    vendorId: string;
    itemId: string;
    price: number;
    lastUpdated: string;
}

export interface Requisition {
    id: string;
    locationId: string;
    departmentId?: string;
    requestedById: string;
    totalAmount: number;
    status: RequisitionStatus;
    createdAt: string;
}

export interface RequisitionItem {
    id: string;
    requisitionId: string;
    itemId: string;
    quantity: number;
    estimatedPrice: number;
}

export interface LPO {
    id: string;
    locationId: string;
    requisitionId: string;
    vendorId: string;
    totalAmount: number;
    status: LPOStatus;
    issuedAt: string;
    expectedDelivery: string;
}

export interface GRN {
    id: string;
    lpoId: string;
    locationId: string;
    receivedById: string;
    totalAmount: number;
    status: GRNStatus;
    receivedAt: string;
}

export interface VendorInvoice {
    id: string;
    grnId: string;
    vendorId: string;
    locationId: string;
    amount: number;
    dueDate: string;
    status: InvoiceStatus;
}

export interface PaymentRequest {
    id: string;
    invoiceId: string;
    locationId: string;
    requestedById: string;
    amount: number;
    status: PaymentRequestStatus;
    createdAt: string;
}

// --- FINANCIAL ENTITIES ---

export interface PaymentMethod {
    id: string;
    name: string;
    type: "CASH" | "BANK" | "MOBILE_MONEY" | "CARD" | "OTHER";
}

export interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    paymentMethodId: string;
    paidAt: string;
    reference: string;
}

export interface Expense {
    id: string;
    locationId: string;
    departmentId?: string;
    categoryId: string;
    amount: number;
    description: string;
    date: string;
    status?: "UNPAID" | "PAID";
    paidAt?: string;
    paymentId?: string;
}

export interface ExpensePayment {
    id: string;
    expenseId: string;
    locationId?: string;
    amount: number;
    paymentMethodId: string;
    paidAt: string;
    reference: string;
}

export interface FinancialEntry {
    id: string;
    locationId: string;
    accountCode: string;
    debit: number;
    credit: number;
    referenceType: "INVOICE" | "PAYMENT" | "EXPENSE" | "EXPENSE_PAYMENT" | "SALE" | "REVERSAL";
    referenceId: string;
    createdAt: string;
}

// --- SALES ENTITIES ---

export interface Sale {
    id: string;
    locationId: string;
    totalAmount: number;
    taxAmount: number;
    netAmount: number;
    paymentMethodId: string;
    soldAt: string;
}

export interface SaleItem {
    id: string;
    saleId: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

// --- MENU ENTITIES ---

export interface MenuCategory {
    id: string;
    locationId: string;
    name: string;
    status: EntityStatus;
}

export interface Menu {
    id: string;
    locationId: string;
    categoryId: string;
    name: string;
    price: number;
    status: EntityStatus;
}

// --- AUXILIARY ENTITIES ---

export interface AuditLog {
    id: string;
    userId: string;
    actorRole?: string;
    actorLocationId?: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: string; // JSON string
    referenceChainId?: string;
    metadata?: Record<string, unknown>;
    beforeState?: unknown;
    afterState?: unknown;
    locationId?: string;
    timestamp: string;
}

// --- ADDITIONAL ENTITIES ---

export interface Category {
    id: string;
    name: string;
    description: string;
    locationId: string;
}

export interface GRNItem {
    id: string;
    grnId: string;
    itemId: string;
    quantity: number;
    vendorPrice: number;
}

export interface PaymentTerm {
    id: string;
    name: string;
    description: string;
    daysUntilDue: number;
}

export interface StockTransferItem {
    id: string;
    stockTransferId: string;
    itemId: string;
    quantity: number;
}

export interface StockMovement {
    id: string;
    locationId: string;
    departmentId?: string;
    inventoryItemId: string;
    type:
        | "OPENING_BALANCE"
        | "PURCHASE_RECEIPT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "DEPARTMENT_ISSUE"
        | "ADJUSTMENT";
    quantity: number;
    unitCost: number;
    referenceType?: string;
    referenceId?: string;
    createdAt: string;
    createdBy: string;
}

// --- DATABASE SEED DATA ---

const COMPANY: Company = {
    id: makeId("cmp", "8c0b2d6c-9fef-4e8b-a1d9-0c9d3f0b9a01"),
    name: "Enterprise Global Group",
    taxId: "TX-99887766",
    baseCurrency: "UGX",
};

const LOCATIONS: Location[] = [
    { id: makeId("loc", "7c3c6d46-0dc1-4d7f-a2f1-1c0a9aa8b101"), companyId: COMPANY.id, name: "The Patiobela", code: "PB01", type: "BRANCH", address: "Entebbe Rd", status: "ACTIVE" },
    { id: makeId("loc", "5f3c5c1c-72ed-4ce0-bd5f-402ec946f102"), companyId: COMPANY.id, name: "The Maze Kololo", code: "MK01", type: "BRANCH", address: "Kololo Hill Dr", status: "ACTIVE" },
    { id: makeId("loc", "b32c3e4e-5cb0-4d7e-9a39-1b24f16d2103"), companyId: COMPANY.id, name: "Central Warehouse", code: "WH01", type: "WAREHOUSE", address: "Industrial Area", status: "ACTIVE" },
];

const DEPARTMENTS: Department[] = [
    { id: makeId("dep", "8e6d0fbb-6a59-4d4b-89a1-4e49a1f00001"), locationId: LOCATIONS[0].id, name: "Kitchen", code: "KIT", status: "ACTIVE" },
    { id: makeId("dep", "8e6d0fbb-6a59-4d4b-89a1-4e49a1f00002"), locationId: LOCATIONS[0].id, name: "Bar", code: "BAR", status: "ACTIVE" },
    { id: makeId("dep", "8e6d0fbb-6a59-4d4b-89a1-4e49a1f00003"), locationId: LOCATIONS[0].id, name: "Front of House", code: "FOH", status: "ACTIVE" },
    { id: makeId("dep", "8e6d0fbb-6a59-4d4b-89a1-4e49a1f00004"), locationId: LOCATIONS[1].id, name: "Kitchen", code: "KIT", status: "ACTIVE" },
    { id: makeId("dep", "8e6d0fbb-6a59-4d4b-89a1-4e49a1f00005"), locationId: LOCATIONS[1].id, name: "Bar", code: "BAR", status: "ACTIVE" },
];

const CATEGORIES: Category[] = [
    { id: makeId("cat", "beverage"), name: "Beverages", description: "Coffee, tea, juices", locationId: LOCATIONS[0].id },
    { id: makeId("cat", "dairy"), name: "Dairy", description: "Milk, cheese, cream", locationId: LOCATIONS[0].id },
    { id: makeId("cat", "meat"), name: "Meat & Poultry", description: "Beef, chicken, pork", locationId: LOCATIONS[0].id },
    { id: makeId("cat", "produce"), name: "Fresh Produce", description: "Vegetables, fruits", locationId: LOCATIONS[0].id },
    { id: makeId("cat", "spirits"), name: "Spirits & Alcohol", description: "Wine, beer, spirits", locationId: LOCATIONS[0].id },
    { id: makeId("cat", "cleaning"), name: "Cleaning Supplies", description: "Detergents, sanitizers", locationId: LOCATIONS[0].id },
];

const USERS: User[] = [
    // Global roles
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00001"), name: "CEO User", email: "ceo@company.com", role: "CEO", status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00002"), name: "System Auditor", email: "auditor@company.com", role: "SYSTEM_AUDITOR", status: "ACTIVE" },
    // Patiobela staff
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00003"), name: "GM Patiobela", email: "gm.pb@company.com", role: "GENERAL_MANAGER", locationId: LOCATIONS[0].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00004"), name: "DH Kitchen PB", email: "dh.kitchen.pb@company.com", role: "DEPARTMENT_HEAD", locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00005"), name: "Proc Officer PB", email: "proc.pb@company.com", role: "PROCUREMENT_OFFICER", locationId: LOCATIONS[0].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00006"), name: "Store Manager PB", email: "store.pb@company.com", role: "STORE_MANAGER", locationId: LOCATIONS[0].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00007"), name: "Finance Manager PB", email: "finance.pb@company.com", role: "FINANCE_MANAGER", locationId: LOCATIONS[0].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00011"), name: "DH Bar PB", email: "dh.bar.pb@company.com", role: "DEPARTMENT_HEAD", locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[1].id, status: "ACTIVE" },
    // Maze Kololo staff
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00012"), name: "GM Maze Kololo", email: "gm.mk@company.com", role: "GENERAL_MANAGER", locationId: LOCATIONS[1].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00013"), name: "Finance Manager MK", email: "finance.mk@company.com", role: "FINANCE_MANAGER", locationId: LOCATIONS[1].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00014"), name: "Store Manager MK", email: "store.mk@company.com", role: "STORE_MANAGER", locationId: LOCATIONS[1].id, status: "ACTIVE" },
    { id: makeId("usr", "dbe0a1fb-2a42-4a6e-b008-2eeab0c00015"), name: "Proc Officer MK", email: "proc.mk@company.com", role: "PROCUREMENT_OFFICER", locationId: LOCATIONS[1].id, status: "ACTIVE" },
];

const ITEMS: InventoryItem[] = [
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0001"), sku: "SKU-CB-001", name: "Coffee Beans Arabica", description: "Premium Arabica beans", categoryId: CATEGORIES[0].id, uom: "KG", basePrice: 45000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0002"), sku: "SKU-MK-001", name: "Fresh Milk", description: "1L Fresh Milk cartons", categoryId: CATEGORIES[1].id, uom: "LTR", basePrice: 3500 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0003"), sku: "SKU-BF-001", name: "Beef Fillet", description: "Prime beef cuts", categoryId: CATEGORIES[2].id, uom: "KG", basePrice: 32000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0004"), sku: "SKU-CK-001", name: "Chicken Breast", description: "Boneless chicken breast", categoryId: CATEGORIES[2].id, uom: "KG", basePrice: 18000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0005"), sku: "SKU-TM-001", name: "Tomatoes", description: "Fresh vine tomatoes", categoryId: CATEGORIES[3].id, uom: "KG", basePrice: 5000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0006"), sku: "SKU-ON-001", name: "Onions", description: "Red onions", categoryId: CATEGORIES[3].id, uom: "KG", basePrice: 4000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0007"), sku: "SKU-WN-001", name: "Red Wine", description: "House red wine 750ml", categoryId: CATEGORIES[4].id, uom: "BTL", basePrice: 35000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0008"), sku: "SKU-BR-001", name: "Tusker Lager", description: "500ml bottle", categoryId: CATEGORIES[4].id, uom: "BTL", basePrice: 5500 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0009"), sku: "SKU-DT-001", name: "Dish Detergent", description: "5L industrial detergent", categoryId: CATEGORIES[5].id, uom: "LTR", basePrice: 25000 },
    { id: makeId("itm", "33b56a9b-8b05-4d24-bf66-8b321f0f0010"), sku: "SKU-CH-001", name: "Cheddar Cheese", description: "Aged cheddar block 1kg", categoryId: CATEGORIES[1].id, uom: "KG", basePrice: 28000 },
];

const STOCK_LEVELS: LocationStock[] = [
    // Patiobela stock
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000001"), locationId: LOCATIONS[0].id, itemId: ITEMS[0].id, onHandQuantity: 45, reservedQuantity: 5, reorderLevel: 10 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000002"), locationId: LOCATIONS[0].id, itemId: ITEMS[1].id, onHandQuantity: 120, reservedQuantity: 0, reorderLevel: 20 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000003"), locationId: LOCATIONS[0].id, itemId: ITEMS[2].id, onHandQuantity: 8, reservedQuantity: 2, reorderLevel: 15 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000004"), locationId: LOCATIONS[0].id, itemId: ITEMS[3].id, onHandQuantity: 25, reservedQuantity: 0, reorderLevel: 10 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000005"), locationId: LOCATIONS[0].id, itemId: ITEMS[4].id, onHandQuantity: 60, reservedQuantity: 0, reorderLevel: 20 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000006"), locationId: LOCATIONS[0].id, itemId: ITEMS[5].id, onHandQuantity: 40, reservedQuantity: 0, reorderLevel: 15 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000007"), locationId: LOCATIONS[0].id, itemId: ITEMS[6].id, onHandQuantity: 30, reservedQuantity: 0, reorderLevel: 10 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000008"), locationId: LOCATIONS[0].id, itemId: ITEMS[7].id, onHandQuantity: 200, reservedQuantity: 0, reorderLevel: 50 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000009"), locationId: LOCATIONS[0].id, itemId: ITEMS[8].id, onHandQuantity: 5, reservedQuantity: 0, reorderLevel: 3 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000010"), locationId: LOCATIONS[0].id, itemId: ITEMS[9].id, onHandQuantity: 12, reservedQuantity: 0, reorderLevel: 5 },
    // Maze Kololo stock
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000011"), locationId: LOCATIONS[1].id, itemId: ITEMS[0].id, onHandQuantity: 30, reservedQuantity: 0, reorderLevel: 10 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000012"), locationId: LOCATIONS[1].id, itemId: ITEMS[1].id, onHandQuantity: 80, reservedQuantity: 0, reorderLevel: 20 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000013"), locationId: LOCATIONS[1].id, itemId: ITEMS[2].id, onHandQuantity: 5, reservedQuantity: 0, reorderLevel: 15 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000014"), locationId: LOCATIONS[1].id, itemId: ITEMS[7].id, onHandQuantity: 150, reservedQuantity: 0, reorderLevel: 50 },
    // Warehouse stock
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000015"), locationId: LOCATIONS[2].id, itemId: ITEMS[0].id, onHandQuantity: 500, reservedQuantity: 0, reorderLevel: 50 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000016"), locationId: LOCATIONS[2].id, itemId: ITEMS[1].id, onHandQuantity: 800, reservedQuantity: 0, reorderLevel: 100 },
    { id: makeId("lst", "b9c0b2f1-6b8a-4b5a-94f6-0b2b0d000017"), locationId: LOCATIONS[2].id, itemId: ITEMS[2].id, onHandQuantity: 200, reservedQuantity: 0, reorderLevel: 30 },
];

const DEPARTMENT_STOCK: DepartmentStock[] = [
    { id: makeId("dst", "001"), departmentId: DEPARTMENTS[0].id, itemId: ITEMS[0].id, currentQuantity: 10 },
    { id: makeId("dst", "002"), departmentId: DEPARTMENTS[0].id, itemId: ITEMS[1].id, currentQuantity: 25 },
    { id: makeId("dst", "003"), departmentId: DEPARTMENTS[0].id, itemId: ITEMS[2].id, currentQuantity: 4 },
    { id: makeId("dst", "004"), departmentId: DEPARTMENTS[0].id, itemId: ITEMS[3].id, currentQuantity: 8 },
    { id: makeId("dst", "005"), departmentId: DEPARTMENTS[0].id, itemId: ITEMS[4].id, currentQuantity: 15 },
    { id: makeId("dst", "006"), departmentId: DEPARTMENTS[1].id, itemId: ITEMS[0].id, currentQuantity: 5 },
    { id: makeId("dst", "007"), departmentId: DEPARTMENTS[1].id, itemId: ITEMS[6].id, currentQuantity: 12 },
    { id: makeId("dst", "008"), departmentId: DEPARTMENTS[1].id, itemId: ITEMS[7].id, currentQuantity: 48 },
    { id: makeId("dst", "009"), departmentId: DEPARTMENTS[3].id, itemId: ITEMS[0].id, currentQuantity: 8 },
    { id: makeId("dst", "010"), departmentId: DEPARTMENTS[3].id, itemId: ITEMS[2].id, currentQuantity: 3 },
];

const VENDOR_CATEGORIES: VendorCategory[] = [
    { id: makeId("vcat", "aa9e8d12-7c0b-4e8e-9db7-7a0d0c000001"), name: "Fresh Produce" },
    { id: makeId("vcat", "aa9e8d12-7c0b-4e8e-9db7-7a0d0c000002"), name: "Dairy" },
    { id: makeId("vcat", "aa9e8d12-7c0b-4e8e-9db7-7a0d0c000003"), name: "Meat & Poultry" },
    { id: makeId("vcat", "aa9e8d12-7c0b-4e8e-9db7-7a0d0c000004"), name: "Beverages & Spirits" },
    { id: makeId("vcat", "aa9e8d12-7c0b-4e8e-9db7-7a0d0c000005"), name: "Cleaning & Supplies" },
];

const VENDORS: Vendor[] = [
    { id: makeId("ven", "f3d1f116-6f32-4be7-8bdf-0a0d0c000001"), name: "Global Farms", categoryId: VENDOR_CATEGORIES[0].id, rating: 4.8, contactEmail: "orders@globalfarms.com" },
    { id: makeId("ven", "f3d1f116-6f32-4be7-8bdf-0a0d0c000002"), name: "Dairies Unlimited", categoryId: VENDOR_CATEGORIES[1].id, rating: 4.5, contactEmail: "sales@dairiesun.com" },
    { id: makeId("ven", "f3d1f116-6f32-4be7-8bdf-0a0d0c000003"), name: "Prime Meats Ltd", categoryId: VENDOR_CATEGORIES[2].id, rating: 4.2, contactEmail: "supply@primemeats.co.ug" },
    { id: makeId("ven", "f3d1f116-6f32-4be7-8bdf-0a0d0c000004"), name: "Beverage Corp", categoryId: VENDOR_CATEGORIES[3].id, rating: 4.0, contactEmail: "orders@bevcorp.com" },
    { id: makeId("ven", "f3d1f116-6f32-4be7-8bdf-0a0d0c000005"), name: "CleanPro Supplies", categoryId: VENDOR_CATEGORIES[4].id, rating: 3.9, contactEmail: "info@cleanpro.co.ug" },
];

const VENDOR_ITEMS: VendorItem[] = [
    { vendorId: VENDORS[0].id, itemId: ITEMS[4].id, price: 4800, lastUpdated: "2026-02-01" },
    { vendorId: VENDORS[0].id, itemId: ITEMS[5].id, price: 3800, lastUpdated: "2026-02-01" },
    { vendorId: VENDORS[1].id, itemId: ITEMS[1].id, price: 3200, lastUpdated: "2026-01-28" },
    { vendorId: VENDORS[1].id, itemId: ITEMS[9].id, price: 26000, lastUpdated: "2026-01-28" },
    { vendorId: VENDORS[2].id, itemId: ITEMS[2].id, price: 30000, lastUpdated: "2026-02-05" },
    { vendorId: VENDORS[2].id, itemId: ITEMS[3].id, price: 17000, lastUpdated: "2026-02-05" },
    { vendorId: VENDORS[3].id, itemId: ITEMS[0].id, price: 42000, lastUpdated: "2026-02-10" },
    { vendorId: VENDORS[3].id, itemId: ITEMS[6].id, price: 33000, lastUpdated: "2026-02-10" },
    { vendorId: VENDORS[3].id, itemId: ITEMS[7].id, price: 5000, lastUpdated: "2026-02-10" },
    { vendorId: VENDORS[4].id, itemId: ITEMS[8].id, price: 23000, lastUpdated: "2026-02-12" },
];

const PAYMENT_METHODS: PaymentMethod[] = [
    { id: makeId("paym", "54a4f5c0-2bd2-44b1-8f0a-0a0d0c000001"), name: "Cash", type: "CASH" },
    { id: makeId("paym", "54a4f5c0-2bd2-44b1-8f0a-0a0d0c000002"), name: "Bank Transfer", type: "BANK" },
    { id: makeId("paym", "54a4f5c0-2bd2-44b1-8f0a-0a0d0c000003"), name: "Mobile Money", type: "MOBILE_MONEY" },
    { id: makeId("paym", "54a4f5c0-2bd2-44b1-8f0a-0a0d0c000004"), name: "Credit Card", type: "CARD" },
];

const PAYMENT_TERMS: PaymentTerm[] = [
    { id: makeId("pt", "001"), name: "Net 7", description: "Payment due in 7 days", daysUntilDue: 7 },
    { id: makeId("pt", "002"), name: "Net 30", description: "Payment due in 30 days", daysUntilDue: 30 },
    { id: makeId("pt", "003"), name: "Net 60", description: "Payment due in 60 days", daysUntilDue: 60 },
    { id: makeId("pt", "004"), name: "COD", description: "Cash on delivery", daysUntilDue: 0 },
];

// --- PROCUREMENT LIFECYCLE SEED DATA ---

const REQUISITIONS: Requisition[] = [
    { id: makeId("req", "001"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, requestedById: USERS[7].id, totalAmount: 1250000, status: "APPROVED", createdAt: "2026-02-10T08:00:00Z" },
    { id: makeId("req", "002"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[1].id, requestedById: USERS[7].id, totalAmount: 450000, status: "SUBMITTED", createdAt: "2026-02-15T10:30:00Z" },
    { id: makeId("req", "003"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, requestedById: USERS[7].id, totalAmount: 860000, status: "APPROVED", createdAt: "2026-02-05T09:00:00Z" },
    { id: makeId("req", "004"), locationId: LOCATIONS[1].id, departmentId: DEPARTMENTS[3].id, requestedById: USERS[8].id, totalAmount: 720000, status: "APPROVED", createdAt: "2026-02-12T11:00:00Z" },
    { id: makeId("req", "005"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, requestedById: USERS[3].id, totalAmount: 2100000, status: "SUBMITTED", createdAt: "2026-02-18T14:00:00Z" },
    { id: makeId("req", "006"), locationId: LOCATIONS[1].id, departmentId: DEPARTMENTS[4].id, requestedById: USERS[8].id, totalAmount: 380000, status: "REJECTED", createdAt: "2026-02-08T16:00:00Z" },
    { id: makeId("req", "007"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[2].id, requestedById: USERS[3].id, totalAmount: 150000, status: "APPROVED", createdAt: "2026-02-17T09:30:00Z" },
];

const REQUISITION_ITEMS: RequisitionItem[] = [
    { id: makeId("ri", "001"), requisitionId: REQUISITIONS[0].id, itemId: ITEMS[2].id, quantity: 20, estimatedPrice: 640000 },
    { id: makeId("ri", "002"), requisitionId: REQUISITIONS[0].id, itemId: ITEMS[3].id, quantity: 15, estimatedPrice: 270000 },
    { id: makeId("ri", "003"), requisitionId: REQUISITIONS[0].id, itemId: ITEMS[4].id, quantity: 30, estimatedPrice: 150000 },
    { id: makeId("ri", "004"), requisitionId: REQUISITIONS[1].id, itemId: ITEMS[6].id, quantity: 10, estimatedPrice: 350000 },
    { id: makeId("ri", "005"), requisitionId: REQUISITIONS[1].id, itemId: ITEMS[7].id, quantity: 20, estimatedPrice: 100000 },
    { id: makeId("ri", "006"), requisitionId: REQUISITIONS[2].id, itemId: ITEMS[0].id, quantity: 15, estimatedPrice: 675000 },
    { id: makeId("ri", "007"), requisitionId: REQUISITIONS[2].id, itemId: ITEMS[1].id, quantity: 50, estimatedPrice: 175000 },
    { id: makeId("ri", "008"), requisitionId: REQUISITIONS[4].id, itemId: ITEMS[2].id, quantity: 40, estimatedPrice: 1280000 },
    { id: makeId("ri", "009"), requisitionId: REQUISITIONS[4].id, itemId: ITEMS[9].id, quantity: 10, estimatedPrice: 280000 },
];

const LPOS: LPO[] = [
    { id: makeId("lpo", "001"), locationId: LOCATIONS[0].id, requisitionId: REQUISITIONS[0].id, vendorId: VENDORS[2].id, totalAmount: 1250000, status: "RECEIVED", issuedAt: "2026-02-11T10:00:00Z", expectedDelivery: "2026-02-14T10:00:00Z" },
    { id: makeId("lpo", "002"), locationId: LOCATIONS[0].id, requisitionId: REQUISITIONS[2].id, vendorId: VENDORS[3].id, totalAmount: 860000, status: "ISSUED", issuedAt: "2026-02-06T11:00:00Z", expectedDelivery: "2026-02-09T11:00:00Z" },
    { id: makeId("lpo", "003"), locationId: LOCATIONS[1].id, requisitionId: REQUISITIONS[3].id, vendorId: VENDORS[2].id, totalAmount: 720000, status: "DRAFT", issuedAt: "2026-02-13T09:00:00Z", expectedDelivery: "2026-02-16T09:00:00Z" },
];

const GRNS: GRN[] = [
    { id: makeId("grn", "001"), lpoId: LPOS[0].id, locationId: LOCATIONS[0].id, receivedById: USERS[5].id, totalAmount: 1230000, status: "RECEIVED", receivedAt: "2026-02-14T14:00:00Z" },
];

const GRN_ITEMS: GRNItem[] = [
    { id: makeId("gi", "001"), grnId: GRNS[0].id, itemId: ITEMS[2].id, quantity: 19, vendorPrice: 30000 },
    { id: makeId("gi", "002"), grnId: GRNS[0].id, itemId: ITEMS[3].id, quantity: 15, vendorPrice: 17000 },
    { id: makeId("gi", "003"), grnId: GRNS[0].id, itemId: ITEMS[4].id, quantity: 30, vendorPrice: 4800 },
];

const VENDOR_INVOICES: VendorInvoice[] = [
    { id: makeId("vinv", "001"), grnId: GRNS[0].id, vendorId: VENDORS[2].id, locationId: LOCATIONS[0].id, amount: 1230000, dueDate: "2026-03-14T00:00:00Z", status: "PENDING" },
    { id: makeId("vinv", "002"), grnId: "", vendorId: VENDORS[0].id, locationId: LOCATIONS[0].id, amount: 580000, dueDate: "2026-02-28T00:00:00Z", status: "APPROVED" },
    { id: makeId("vinv", "003"), grnId: "", vendorId: VENDORS[1].id, locationId: LOCATIONS[0].id, amount: 320000, dueDate: "2026-01-20T00:00:00Z", status: "PAID" },
    { id: makeId("vinv", "004"), grnId: "", vendorId: VENDORS[3].id, locationId: LOCATIONS[1].id, amount: 890000, dueDate: "2026-03-01T00:00:00Z", status: "PENDING" },
    { id: makeId("vinv", "005"), grnId: "", vendorId: VENDORS[2].id, locationId: LOCATIONS[1].id, amount: 450000, dueDate: "2026-01-15T00:00:00Z", status: "PAID" },
    { id: makeId("vinv", "006"), grnId: "", vendorId: VENDORS[4].id, locationId: LOCATIONS[0].id, amount: 175000, dueDate: "2026-02-20T00:00:00Z", status: "PENDING" },
];

const PAYMENT_REQUESTS: PaymentRequest[] = [];

const PAYMENTS: Payment[] = [
    { id: makeId("pay", "001"), invoiceId: VENDOR_INVOICES[2].id, amount: 320000, paymentMethodId: PAYMENT_METHODS[1].id, paidAt: "2026-01-20T12:00:00Z", reference: "TXN-20260120-001" },
    { id: makeId("pay", "002"), invoiceId: VENDOR_INVOICES[4].id, amount: 450000, paymentMethodId: PAYMENT_METHODS[0].id, paidAt: "2026-01-15T10:00:00Z", reference: "TXN-20260115-001" },
];

const EXPENSE_PAYMENTS: ExpensePayment[] = [];

const FINANCIAL_ENTRIES: FinancialEntry[] = [];

const EXPENSES: Expense[] = [
    { id: makeId("exp", "001"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, categoryId: CATEGORIES[2].id, amount: 640000, description: "Weekly meat purchase", date: "2026-02-14" },
    { id: makeId("exp", "002"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[1].id, categoryId: CATEGORIES[4].id, amount: 350000, description: "Wine restock", date: "2026-02-13" },
    { id: makeId("exp", "003"), locationId: LOCATIONS[0].id, categoryId: CATEGORIES[5].id, amount: 175000, description: "Monthly cleaning supplies", date: "2026-02-10" },
    { id: makeId("exp", "004"), locationId: LOCATIONS[1].id, departmentId: DEPARTMENTS[3].id, categoryId: CATEGORIES[2].id, amount: 480000, description: "Meat order", date: "2026-02-12" },
    { id: makeId("exp", "005"), locationId: LOCATIONS[1].id, categoryId: CATEGORIES[0].id, amount: 210000, description: "Coffee beans restock", date: "2026-02-11" },
    { id: makeId("exp", "006"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, categoryId: CATEGORIES[1].id, amount: 112000, description: "Dairy supplies", date: "2026-02-16" },
    { id: makeId("exp", "007"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, categoryId: CATEGORIES[3].id, amount: 95000, description: "Fresh produce", date: "2026-02-17" },
    { id: makeId("exp", "008"), locationId: LOCATIONS[0].id, categoryId: CATEGORIES[5].id, amount: 85000, description: "Sanitizer bulk buy", date: "2026-02-18" },
];

// --- SALES SEED DATA ---

const SALES: Sale[] = [
    { id: makeId("sale", "001"), locationId: LOCATIONS[0].id, totalAmount: 156000, taxAmount: 28080, netAmount: 127920, paymentMethodId: PAYMENT_METHODS[0].id, soldAt: "2026-02-18T12:30:00Z" },
    { id: makeId("sale", "002"), locationId: LOCATIONS[0].id, totalAmount: 84000, taxAmount: 15120, netAmount: 68880, paymentMethodId: PAYMENT_METHODS[2].id, soldAt: "2026-02-18T13:15:00Z" },
    { id: makeId("sale", "003"), locationId: LOCATIONS[0].id, totalAmount: 240000, taxAmount: 43200, netAmount: 196800, paymentMethodId: PAYMENT_METHODS[3].id, soldAt: "2026-02-18T19:00:00Z" },
    { id: makeId("sale", "004"), locationId: LOCATIONS[1].id, totalAmount: 128000, taxAmount: 23040, netAmount: 104960, paymentMethodId: PAYMENT_METHODS[0].id, soldAt: "2026-02-18T12:00:00Z" },
    { id: makeId("sale", "005"), locationId: LOCATIONS[1].id, totalAmount: 196000, taxAmount: 35280, netAmount: 160720, paymentMethodId: PAYMENT_METHODS[1].id, soldAt: "2026-02-18T20:00:00Z" },
    { id: makeId("sale", "006"), locationId: LOCATIONS[0].id, totalAmount: 68000, taxAmount: 12240, netAmount: 55760, paymentMethodId: PAYMENT_METHODS[0].id, soldAt: "2026-02-17T11:00:00Z" },
    { id: makeId("sale", "007"), locationId: LOCATIONS[0].id, totalAmount: 312000, taxAmount: 56160, netAmount: 255840, paymentMethodId: PAYMENT_METHODS[3].id, soldAt: "2026-02-17T20:30:00Z" },
    { id: makeId("sale", "008"), locationId: LOCATIONS[1].id, totalAmount: 92000, taxAmount: 16560, netAmount: 75440, paymentMethodId: PAYMENT_METHODS[2].id, soldAt: "2026-02-17T14:00:00Z" },
];

const SALE_ITEMS: SaleItem[] = [
    { id: makeId("si", "001"), saleId: SALES[0].id, itemId: ITEMS[0].id, quantity: 2, unitPrice: 15000, totalPrice: 30000 },
    { id: makeId("si", "002"), saleId: SALES[0].id, itemId: ITEMS[2].id, quantity: 1, unitPrice: 45000, totalPrice: 45000 },
    { id: makeId("si", "003"), saleId: SALES[1].id, itemId: ITEMS[7].id, quantity: 4, unitPrice: 8000, totalPrice: 32000 },
    { id: makeId("si", "004"), saleId: SALES[2].id, itemId: ITEMS[6].id, quantity: 2, unitPrice: 55000, totalPrice: 110000 },
    { id: makeId("si", "005"), saleId: SALES[3].id, itemId: ITEMS[0].id, quantity: 3, unitPrice: 15000, totalPrice: 45000 },
    { id: makeId("si", "006"), saleId: SALES[4].id, itemId: ITEMS[2].id, quantity: 2, unitPrice: 48000, totalPrice: 96000 },
];

// --- STOCK TRANSFERS ---

const STOCK_TRANSFERS: StockTransfer[] = [
    { id: makeId("stx", "001"), sourceLocationId: LOCATIONS[2].id, destinationLocationId: LOCATIONS[0].id, itemId: ITEMS[0].id, quantity: 20, status: "APPROVED", requestedAt: "2026-02-16T08:00:00Z", completedAt: "2026-02-16T14:00:00Z" },
    { id: makeId("stx", "002"), sourceLocationId: LOCATIONS[2].id, destinationLocationId: LOCATIONS[1].id, itemId: ITEMS[2].id, quantity: 15, status: "PENDING", requestedAt: "2026-02-18T09:00:00Z" },
    { id: makeId("stx", "003"), sourceLocationId: LOCATIONS[0].id, destinationLocationId: LOCATIONS[1].id, itemId: ITEMS[7].id, quantity: 50, status: "APPROVED", requestedAt: "2026-02-15T10:00:00Z", completedAt: "2026-02-15T16:00:00Z" },
];

const STOCK_TRANSFER_ITEMS: StockTransferItem[] = [
    { id: makeId("sti", "001"), stockTransferId: STOCK_TRANSFERS[0].id, itemId: ITEMS[0].id, quantity: 20 },
    { id: makeId("sti", "002"), stockTransferId: STOCK_TRANSFERS[1].id, itemId: ITEMS[2].id, quantity: 15 },
    { id: makeId("sti", "003"), stockTransferId: STOCK_TRANSFERS[2].id, itemId: ITEMS[7].id, quantity: 50 },
];

const STOCK_MOVEMENTS: StockMovement[] = [
    // Opening balances (seeded) — baseline for ledger-derived stock
    { id: makeId("mov", "ob_001"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[0].id, type: "OPENING_BALANCE", quantity: 45, unitCost: ITEMS[0].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_002"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[1].id, type: "OPENING_BALANCE", quantity: 120, unitCost: ITEMS[1].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_003"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[2].id, type: "OPENING_BALANCE", quantity: 8, unitCost: ITEMS[2].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_004"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[3].id, type: "OPENING_BALANCE", quantity: 25, unitCost: ITEMS[3].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_005"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[4].id, type: "OPENING_BALANCE", quantity: 60, unitCost: ITEMS[4].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_006"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[5].id, type: "OPENING_BALANCE", quantity: 40, unitCost: ITEMS[5].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_007"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[6].id, type: "OPENING_BALANCE", quantity: 30, unitCost: ITEMS[6].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_008"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[7].id, type: "OPENING_BALANCE", quantity: 200, unitCost: ITEMS[7].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_009"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[8].id, type: "OPENING_BALANCE", quantity: 5, unitCost: ITEMS[8].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_010"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[9].id, type: "OPENING_BALANCE", quantity: 12, unitCost: ITEMS[9].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },

    { id: makeId("mov", "ob_011"), locationId: LOCATIONS[1].id, inventoryItemId: ITEMS[0].id, type: "OPENING_BALANCE", quantity: 30, unitCost: ITEMS[0].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[10].id },
    { id: makeId("mov", "ob_012"), locationId: LOCATIONS[1].id, inventoryItemId: ITEMS[1].id, type: "OPENING_BALANCE", quantity: 80, unitCost: ITEMS[1].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[10].id },
    { id: makeId("mov", "ob_013"), locationId: LOCATIONS[1].id, inventoryItemId: ITEMS[2].id, type: "OPENING_BALANCE", quantity: 5, unitCost: ITEMS[2].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[10].id },
    { id: makeId("mov", "ob_014"), locationId: LOCATIONS[1].id, inventoryItemId: ITEMS[7].id, type: "OPENING_BALANCE", quantity: 150, unitCost: ITEMS[7].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[10].id },

    { id: makeId("mov", "ob_015"), locationId: LOCATIONS[2].id, inventoryItemId: ITEMS[0].id, type: "OPENING_BALANCE", quantity: 500, unitCost: ITEMS[0].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_016"), locationId: LOCATIONS[2].id, inventoryItemId: ITEMS[1].id, type: "OPENING_BALANCE", quantity: 800, unitCost: ITEMS[1].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "ob_017"), locationId: LOCATIONS[2].id, inventoryItemId: ITEMS[2].id, type: "OPENING_BALANCE", quantity: 200, unitCost: ITEMS[2].basePrice, createdAt: "2026-02-01T00:00:00Z", createdBy: USERS[5].id },

    // Transfer double-entry
    { id: makeId("mov", "tr_001_out"), locationId: LOCATIONS[2].id, inventoryItemId: ITEMS[0].id, type: "TRANSFER_OUT", quantity: 20, unitCost: ITEMS[0].basePrice, referenceType: "STOCK_TRANSFER", referenceId: STOCK_TRANSFERS[0].id, createdAt: "2026-02-16T14:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "tr_001_in"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[0].id, type: "TRANSFER_IN", quantity: 20, unitCost: ITEMS[0].basePrice, referenceType: "STOCK_TRANSFER", referenceId: STOCK_TRANSFERS[0].id, createdAt: "2026-02-16T14:00:00Z", createdBy: USERS[5].id },

    // GRN purchase receipts
    { id: makeId("mov", "pr_001"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[2].id, type: "PURCHASE_RECEIPT", quantity: 19, unitCost: 30000, referenceType: "GRN", referenceId: GRNS[0].id, createdAt: "2026-02-14T14:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "pr_002"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[3].id, type: "PURCHASE_RECEIPT", quantity: 15, unitCost: 17000, referenceType: "GRN", referenceId: GRNS[0].id, createdAt: "2026-02-14T14:00:00Z", createdBy: USERS[5].id },

    // Department issues
    { id: makeId("mov", "di_001"), locationId: LOCATIONS[0].id, departmentId: DEPARTMENTS[0].id, inventoryItemId: ITEMS[1].id, type: "DEPARTMENT_ISSUE", quantity: 10, unitCost: ITEMS[1].basePrice, referenceType: "DEPARTMENT_ISSUE", referenceId: DEPARTMENTS[0].id, createdAt: "2026-02-17T09:00:00Z", createdBy: USERS[5].id },
    { id: makeId("mov", "di_002"), locationId: LOCATIONS[1].id, departmentId: DEPARTMENTS[3].id, inventoryItemId: ITEMS[0].id, type: "DEPARTMENT_ISSUE", quantity: 5, unitCost: ITEMS[0].basePrice, referenceType: "DEPARTMENT_ISSUE", referenceId: DEPARTMENTS[3].id, createdAt: "2026-02-17T10:00:00Z", createdBy: USERS[10].id },

    // Adjustments (signed)
    { id: makeId("mov", "adj_001"), locationId: LOCATIONS[0].id, inventoryItemId: ITEMS[2].id, type: "ADJUSTMENT", quantity: -2, unitCost: ITEMS[2].basePrice, referenceType: "MANUAL_ADJUSTMENT", referenceId: "adj_001", createdAt: "2026-02-18T08:00:00Z", createdBy: USERS[5].id },
];

const MENU_CATEGORIES: MenuCategory[] = [
    { id: makeId("mcat", "c6b8cafe-0a3c-4f2d-9b51-0a0d0c000001"), locationId: LOCATIONS[0].id, name: "Coffee", status: "ACTIVE" },
    { id: makeId("mcat", "c6b8cafe-0a3c-4f2d-9b51-0a0d0c000002"), locationId: LOCATIONS[0].id, name: "Meals", status: "ACTIVE" },
    { id: makeId("mcat", "c6b8cafe-0a3c-4f2d-9b51-0a0d0c000003"), locationId: LOCATIONS[0].id, name: "Cocktails", status: "ACTIVE" },
    { id: makeId("mcat", "c6b8cafe-0a3c-4f2d-9b51-0a0d0c000004"), locationId: LOCATIONS[1].id, name: "Coffee", status: "ACTIVE" },
    { id: makeId("mcat", "c6b8cafe-0a3c-4f2d-9b51-0a0d0c000005"), locationId: LOCATIONS[1].id, name: "Meals", status: "ACTIVE" },
];

const MENUS: Menu[] = [
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000001"), locationId: LOCATIONS[0].id, categoryId: MENU_CATEGORIES[0].id, name: "Cappuccino", price: 12000, status: "ACTIVE" },
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000002"), locationId: LOCATIONS[0].id, categoryId: MENU_CATEGORIES[1].id, name: "Beef Burger", price: 28000, status: "ACTIVE" },
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000003"), locationId: LOCATIONS[0].id, categoryId: MENU_CATEGORIES[1].id, name: "Grilled Chicken", price: 32000, status: "ACTIVE" },
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000004"), locationId: LOCATIONS[0].id, categoryId: MENU_CATEGORIES[2].id, name: "Mojito", price: 18000, status: "ACTIVE" },
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000005"), locationId: LOCATIONS[1].id, categoryId: MENU_CATEGORIES[3].id, name: "Espresso", price: 10000, status: "ACTIVE" },
    { id: makeId("men", "1e9f0a11-1b3d-4bf8-9b07-0a0d0c000006"), locationId: LOCATIONS[1].id, categoryId: MENU_CATEGORIES[4].id, name: "Fish & Chips", price: 25000, status: "ACTIVE" },
];

const AUDIT_LOGS: AuditLog[] = [
    { id: makeId("aud", "001"), userId: USERS[0].id, action: "LOGIN", entityType: "USER", entityId: USERS[0].id, changes: "{}", timestamp: "2026-02-18T08:00:00Z" },
    { id: makeId("aud", "002"), userId: USERS[7].id, action: "CREATE", entityType: "REQUISITION", entityId: REQUISITIONS[0].id, changes: JSON.stringify({ status: "PENDING" }), timestamp: "2026-02-10T08:00:00Z" },
    { id: makeId("aud", "003"), userId: USERS[3].id, action: "APPROVE", entityType: "REQUISITION", entityId: REQUISITIONS[0].id, changes: JSON.stringify({ status: "PENDING->APPROVED" }), timestamp: "2026-02-10T09:30:00Z" },
    { id: makeId("aud", "004"), userId: USERS[4].id, action: "CREATE", entityType: "LPO", entityId: LPOS[0].id, changes: JSON.stringify({ vendorId: VENDORS[2].id, amount: 1250000 }), timestamp: "2026-02-11T10:00:00Z" },
    { id: makeId("aud", "005"), userId: USERS[5].id, action: "CREATE", entityType: "GRN", entityId: GRNS[0].id, changes: JSON.stringify({ lpoId: LPOS[0].id, itemsReceived: 3 }), timestamp: "2026-02-14T14:00:00Z" },
    { id: makeId("aud", "006"), userId: USERS[4].id, action: "CREATE", entityType: "VENDOR_INVOICE", entityId: VENDOR_INVOICES[0].id, changes: JSON.stringify({ amount: 1230000 }), timestamp: "2026-02-14T15:00:00Z" },
    { id: makeId("aud", "007"), userId: USERS[6].id, action: "APPROVE", entityType: "VENDOR_INVOICE", entityId: VENDOR_INVOICES[1].id, changes: JSON.stringify({ status: "PENDING->APPROVED" }), timestamp: "2026-02-15T11:00:00Z" },
    { id: makeId("aud", "008"), userId: USERS[6].id, action: "CREATE", entityType: "PAYMENT", entityId: PAYMENTS[0].id, changes: JSON.stringify({ amount: 320000, method: "Bank Transfer" }), timestamp: "2026-01-20T12:00:00Z" },
    { id: makeId("aud", "009"), userId: USERS[5].id, action: "CREATE", entityType: "STOCK_TRANSFER", entityId: STOCK_TRANSFERS[0].id, changes: JSON.stringify({ item: "Coffee Beans", qty: 20 }), timestamp: "2026-02-16T08:00:00Z" },
    { id: makeId("aud", "010"), userId: USERS[2].id, action: "APPROVE", entityType: "STOCK_TRANSFER", entityId: STOCK_TRANSFERS[0].id, changes: JSON.stringify({ status: "PENDING->APPROVED" }), timestamp: "2026-02-16T10:00:00Z" },
    { id: makeId("aud", "011"), userId: USERS[5].id, action: "ADJUSTMENT", entityType: "LOCATION_STOCK", entityId: STOCK_LEVELS[2].id, changes: JSON.stringify({ item: "Beef Fillet", adjustment: -2, reason: "Spoilage" }), timestamp: "2026-02-18T08:00:00Z" },
    { id: makeId("aud", "012"), userId: USERS[1].id, action: "LOGIN", entityType: "USER", entityId: USERS[1].id, changes: "{}", timestamp: "2026-02-18T07:30:00Z" },
];

// --- EXPORTED DATABASE INSTANCE ---

export const mockDB = {
    company: COMPANY,
    locations: LOCATIONS,
    departments: DEPARTMENTS,
    users: USERS,
    categories: CATEGORIES,
    inventoryItems: ITEMS,
    locationStock: STOCK_LEVELS,
    departmentStock: DEPARTMENT_STOCK,
    vendors: VENDORS,
    vendorCategories: VENDOR_CATEGORIES,
    vendorItems: VENDOR_ITEMS,
    requisitions: REQUISITIONS,
    requisitionItems: REQUISITION_ITEMS,
    localPurchaseOrders: LPOS,
    goodsReceivedNotes: GRNS,
    grnItems: GRN_ITEMS,
    vendorInvoices: VENDOR_INVOICES,
    paymentRequests: PAYMENT_REQUESTS,
    payments: PAYMENTS,
    paymentMethods: PAYMENT_METHODS,
    paymentTerms: PAYMENT_TERMS,
    expenses: EXPENSES,
    expensePayments: EXPENSE_PAYMENTS,
    sales: SALES,
    saleItems: SALE_ITEMS,
    financialEntries: FINANCIAL_ENTRIES,
    stockTransfers: STOCK_TRANSFERS,
    stockTransferItems: STOCK_TRANSFER_ITEMS,
    stockMovements: STOCK_MOVEMENTS,
    menus: MENUS,
    menuCategories: MENU_CATEGORIES,
    auditLogs: AUDIT_LOGS,
};

// Typed helpers for mock database access
export type MockDB = typeof mockDB;
export const getDB = () => mockDB;
