// Mock native modules before any imports that depend on them
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { ApiError } from "@/api/client";
import { contextErrorMessage } from "./context-errors";

describe("contextErrorMessage", () => {
  it("maps known invitation/member codes", () => {
    expect(contextErrorMessage(new ApiError(410, "INV-T0002"))).toMatch(/expirou|inválido/i);
    expect(contextErrorMessage(new ApiError(409, "INV-T0003"))).toMatch(/já faz parte/i);
    expect(contextErrorMessage(new ApiError(409, "HH-T0005"))).toMatch(/dono/i);
    expect(contextErrorMessage(new ApiError(403, "INV-T0004"))).toMatch(/papel/i);
  });

  it("falls back for unknown errors", () => {
    expect(contextErrorMessage(new ApiError(500, "SYS-T0001"))).toMatch(/algo deu errado/i);
    expect(contextErrorMessage(new Error("boom"))).toMatch(/algo deu errado/i);
  });
});
