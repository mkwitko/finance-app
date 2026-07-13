jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {},
}));

const mockUpdateMutate = jest.fn();
const mockRemoveMutate = jest.fn();
jest.mock("@/api/generated", () => ({
  useUpdateMemberRole: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useRemoveMember: () => ({ mutate: mockRemoveMutate, isPending: false }),
  useListMembers: () => ({
    data: {
      members: [
        { userId: "u1", name: "Alice", role: "owner", joinedAt: "2026-07-01T00:00:00Z" },
        { userId: "u2", name: "Bob", role: "adult", joinedAt: "2026-07-02T00:00:00Z" },
      ],
    },
    refetch: jest.fn(),
  }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ApiError } from "@/api/client";
import { MemberList } from "./member-list";

it("lists members with roles", async () => {
  const { getByText } = await render(<MemberList canManage />);
  expect(getByText("Alice")).toBeTruthy();
  expect(getByText("Bob")).toBeTruthy();
});

it("removes another member when managing (self is not removable via the row action)", async () => {
  // selfUserId = u1 (Alice/owner) → only Bob (u2) gets a row "Remover" action.
  const { getAllByText } = await render(<MemberList canManage selfUserId="u1" />);
  const removeButtons = getAllByText("Remover");
  expect(removeButtons).toHaveLength(1);
  fireEvent.press(removeButtons[0]);
  expect(mockRemoveMutate).toHaveBeenCalledWith({ id: "h1", userId: "u2" }, expect.any(Object));
});

it("surfaces the mapped error message when removing a member fails", async () => {
  mockRemoveMutate.mockImplementation((_vars, opts) => opts.onError(new ApiError(409, "HH-T0005")));
  const { getAllByText, getByText } = await render(<MemberList canManage selfUserId="u1" />);
  fireEvent.press(getAllByText("Remover")[0]);
  await waitFor(() => {
    expect(getByText("O contexto precisa de pelo menos um dono.")).toBeTruthy();
  });
});
