const mockCreateMutate = jest.fn();
const mockRevokeMutate = jest.fn();
const mockShare = jest.fn();

jest.mock("@/api/generated", () => ({
  useCreateInvitation: () => ({ mutate: mockCreateMutate, isPending: false }),
  useRevokeInvitation: () => ({ mutate: mockRevokeMutate, isPending: false }),
  useListInvitations: (householdId: unknown, options: unknown) => ({
    data: { invitations: [{ id: "inv1", code: "ABC1234567", role: "adult", url: "financeapp://join/ABC1234567", expiresAt: "2026-07-20T00:00:00Z" }] },
    refetch: jest.fn(),
  }),
}));

jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));

import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import * as RN from "react-native";
import { InviteManager } from "./invite-manager";

jest.spyOn(RN.Share, "share").mockImplementation(mockShare);

beforeEach(() => {
  mockCreateMutate.mockClear();
  mockRevokeMutate.mockClear();
  mockShare.mockClear();
});

it("generates an invite for the active household with role + expiry", async () => {
  const { getByText } = await render(<InviteManager />);
  await act(async () => fireEvent.press(getByText("Adolescente")));
  await act(async () => fireEvent.press(getByText("30 dias")));
  await act(async () => fireEvent.press(getByText("Gerar convite")));
  expect(mockCreateMutate).toHaveBeenCalledWith(
    { id: "h1", data: { role: "teen", expiresInHours: 720 } },
    expect.any(Object),
  );
});

it("lists active invitations and revokes one", async () => {
  const { getByText } = await render(<InviteManager />);
  expect(getByText("ABC1234567")).toBeTruthy();
  await act(async () => fireEvent.press(getByText("Revogar")));
  expect(mockRevokeMutate).toHaveBeenCalledWith({ id: "h1", invId: "inv1" }, expect.any(Object));
});
