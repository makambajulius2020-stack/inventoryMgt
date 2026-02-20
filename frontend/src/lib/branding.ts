export const BRANDING = {
    company: {
        name: "HUGAMARA",
        logo: "/Hugamara-Logo.jpeg",
    },

    branches: {
        "BR-001": {
            name: "The Patiobela",
            location: "Entebbe Rd",
            logo: "/pb-logo.png",
        },
        "BR-002": {
            name: "The Maze Bistro",
            location: "Kololo",
            logo: "/mb-logo.png",
        },
        "BR-003": {
            name: "Eateroo",
            location: "Kiwatule",
            logo: "/er-logo.png",
        },
    },
};

export type BranchCode = keyof typeof BRANDING.branches;
