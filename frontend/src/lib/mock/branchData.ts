export const BRANCH_MOCK_DATA = {
    metrics: {
        todayRevenue: "UGX 12,450",
        openRequisitions: "8",
        lowStockAlerts: "14",
        staffOnDuty: "12",
        revenueTrend: { value: 4.5, isPositive: true },
        reqTrend: { value: 2, isPositive: false },
        stockTrend: { value: 3.1, isPositive: false },
        staffTrend: { value: 0, isPositive: true },
    },
    departmentBreakdown: [
        { name: "Kitchen", revenue: 5200, status: "Busy" },
        { name: "Bar", revenue: 3800, status: "Normal" },
        { name: "Housekeeping", revenue: 1200, status: "Low" },
        { name: "Front Office", revenue: 2250, status: "Normal" },
    ],
    inventorySnapshot: [
        { category: "Produce", level: 85, color: "#10b981" },
        { category: "Beverage", level: 62, color: "#2C6BED" },
        { category: "Bakery", level: 25, color: "#f43f5e" },
        { category: "Meat", level: 45, color: "#f59e0b" },
    ],
    procurementActivity: [
        { id: "PO-001", vendor: "Local Market", amount: 1200, status: "Delivered", date: "Today" },
        { id: "PO-002", vendor: "HUGAMARA Central", amount: 4500, status: "In Transit", date: "Today" },
        { id: "PO-003", vendor: "Beverage Co", amount: 800, status: "Pending", date: "Yesterday" },
    ],
    aiInsights: [
        "Peak hours expected between 6 PM - 9 PM based on booking data.",
        "Bakery stock is critically low; procurement recommended by 4 PM.",
        "Kitchen efficiency increased by 15% after inventory reorganization.",
    ],
};
