const mockGetDocumentAsync = jest.fn();
const mockText = jest.fn();
jest.mock("expo-document-picker", () => ({ getDocumentAsync: (...a: unknown[]) => mockGetDocumentAsync(...a) }));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ text: mockText })) }));

import { pickStatement } from "./pick-statement";

beforeEach(() => { mockGetDocumentAsync.mockReset(); mockText.mockReset(); });

it("returns null when the user cancels", async () => {
  mockGetDocumentAsync.mockResolvedValue({ canceled: true });
  expect(await pickStatement()).toBeNull();
});

it("returns the file name + text when a file is picked", async () => {
  mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.ofx", name: "x.ofx" }] });
  mockText.mockResolvedValue("<OFX>...</OFX>");
  const res = await pickStatement();
  expect(res).toEqual({ name: "x.ofx", content: "<OFX>...</OFX>" });
});
