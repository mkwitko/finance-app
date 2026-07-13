module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // jest-expo ignores node_modules by default; nativewind + react-native-css
  // ship untranspiled and must be transformed. `\.pnpm` is whitelisted here
  // (matching jest-expo's own default) because pnpm's virtual store nests a
  // second node_modules/<pkg> segment under node_modules/.pnpm/<pkg>@<ver>/;
  // without it, the outer node_modules/.pnpm/... segment never matches any
  // of the real package names below and everything gets ignored.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css))",
  ],
};
