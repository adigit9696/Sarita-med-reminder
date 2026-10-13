export const BRAND = {
  name: "Sarita Pharmacy Med Reminder",
  shortName: "Sarita Med",
  tagline: "Powered by Oasis MedTeck",
  pharmacy: {
    name: "Sarita Pharmacy",
    address: "5/1/1 Madhokunj, Katra, Prayagraj - 211002",
    phones: ["9569400673", "7800002026"],
    email: "rahulrai1101@rediffmail.com",
  },
  colors: {
    primary: "#0d9488", // Teal 600 (Clinical Core)
    primaryDark: "#0f766e", // Teal 700
    primaryLight: "#14b8a6", // Teal 500
    primarySurface: "#f0fdfa", // Teal 50 (Calm Surface)
    accent: "#0284c7", // Sky 600
    warning: "#d97706", // Amber 600 (WCAG AA Compliant)
    danger: "#dc2626", // Red 600 (WCAG AA Compliant)
    success: "#059669", // Emerald 600 (WCAG AA Compliant)
  },
  defaults: {
    refillCycleDays: 30,
    alertDaysBefore: 5,
    pinLength: 4,
    autoLockMinutes: 10,
    enableAudioAlerts: true,
  },
  version: "2.0.0",
} as const;

export type BrandConfig = typeof BRAND;
