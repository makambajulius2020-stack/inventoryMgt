export const FINANCE_MOCK_DATA = {
    metrics: {
        totalRevenue: "UGX 1,240,500",
        totalExpenses: "UGX 850,200",
        netProfit: "UGX 390,300",
        cashOnHand: "UGX 2,100,000",
        revenueTrend: { value: 12.5, isPositive: true },
        expenseTrend: { value: 4.2, isPositive: false },
        profitTrend: { value: 8.1, isPositive: true },
        cashTrend: { value: 2.3, isPositive: true },
    },
    revenueByBranch: [
        { name: "Patiobela", value: 450000, color: "#2C6BED" },
        { name: "Maze Bistro", value: 320000, color: "#102B52" },
        { name: "Maze Forest", value: 180000, color: "#6366F1" },
        { name: "Eateroo", value: 160000, color: "#8B5CF6" },
        { name: "Rosa Dames", value: 130500, color: "#EC4899" },
    ],
    monthlyPerformance: [
        { month: "Jan", revenue: 100000, expenses: 80000 },
        { month: "Feb", revenue: 120000, expenses: 85000 },
        { month: "Mar", revenue: 115000, expenses: 90000 },
        { month: "Apr", revenue: 140000, expenses: 95000 },
        { month: "May", revenue: 135000, expenses: 88000 },
        { month: "Jun", revenue: 150000, expenses: 92000 },
    ],
    apAging: [
        { range: "0-30 Days", amount: 125000, status: "Current" },
        { range: "31-60 Days", amount: 45000, status: "Warning" },
        { range: "61-90 Days", amount: 25000, status: "Overdue" },
        { range: "90+ Days", amount: 12000, status: "Critical" },
    ],
    aiInsights: [
        "Revenue from Patiobela branch increased by 15% due to seasonal demand.",
        "Projected expenses for next month are 5% lower based on procurement optimization.",
        "AP Aging in the 31-60 days segment has decreased by UGX 10k compared to last week.",
    ],
};
