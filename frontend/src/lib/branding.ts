export const BRANDING = {
    company: {
        name: "HUGAMARA",
        logo: "/Hugamara-Logo.jpeg",
    },

    branches: {
        "BR-001": {
            name: "Patiobela",
            location: "Entebbe Rd",
            logo: "/background1.jpeg",
        },
        "BR-002": {
            name: "Eateroo",
            location: "Kiwatule",
            logo: "/background2.jpeg",
        },
        "BR-003": {
            name: "Villa",
            location: "—",
            logo: "/background3%20copy.jpeg",
        },
    },
};

export type BranchCode = keyof typeof BRANDING.branches;
