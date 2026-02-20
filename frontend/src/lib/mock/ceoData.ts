export const CEO_MOCK_DATA = {
    metrics: {
        totalRevenue: "UGX 4,850,200",
        activeBranches: "5",
        totalEmployees: "248",
        systemHealth: "99.9%",
        revenueTrend: { value: 5.2, isPositive: true },
        branchTrend: { value: 0, isPositive: true },
        employeeTrend: { value: 1.5, isPositive: true },
        healthTrend: { value: 0.1, isPositive: true },
    },
    branchPerformance: [
        { name: "Patiobela", revenue: 1450000, efficiency: 94 },
        { name: "Maze Bistro", revenue: 980000, efficiency: 88 },
        { name: "Maze Forest", revenue: 860000, efficiency: 91 },
        { name: "Eateroo", revenue: 790000, efficiency: 85 },
        { name: "Rosa Dames", revenue: 770200, efficiency: 89 },
    ],
    revenueByDepartment: [
        { name: "Kitchen", value: 45 },
        { name: "Bar", value: 25 },
        { name: "Front Office", value: 15 },
        { name: "Housekeeping", value: 10 },
        { name: "Maintenance", value: 5 },
    ],
    aiInsights: [
        "Overall profitability is up 8% YoY across the entire group.",
        "Eateroo shows 12% growth after rebranding efforts.",

        "Procurement costs reduced by UGX 45k due to bulk negotiation across all branches.",
    ],
};
