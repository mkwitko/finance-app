// Confirm-to-transfer goes through a native Alert; auto-press the destructive
// option so tests can exercise the mutation directly (same pattern as
// plan.test.tsx's onCancel confirm).
import * as RN from "react-native";

jest.spyOn(RN.Alert, "alert").mockImplementation((_title, _message, buttons) => {
  buttons?.find((b) => b.style === "destructive")?.onPress?.();
});

// member-list.tsx -> @/lib/context-errors -> @/api/client -> @/lib/auth, which
// pulls in the native google-signin module. Mock it before any imports resolve it.
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {},
}));

const mockRemoveMutate = jest.fn();
const mockTransferMutate = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockReplace = jest.fn();
const mockSetActiveHousehold = jest.fn();

let mockMembers: { userId: string; name: string; role: string; joinedAt?: string }[] = [];

jest.mock("@/api/generated", () => ({
  listHouseholdsQueryKey: () => [{ url: "/households" }],
  useListMembers: () => ({ data: { members: mockMembers }, refetch: mockRefetch }),
  useRemoveMember: () => ({ mutate: mockRemoveMutate, isPending: false }),
  useTransferOwnership: () => ({ mutate: mockTransferMutate, isPending: false }),
}));

jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) =>
    sel({ activeHouseholdId: "h1", setActiveHousehold: mockSetActiveHousehold }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ApiError } from "@/api/client";
import { MemberList } from "./member-list";

beforeEach(() => {
  jest.clearAllMocks();
  mockMembers = [
    { userId: "u1", name: "Alice", role: "owner", joinedAt: "2026-07-01T00:00:00Z" },
    { userId: "u2", name: "Bob", role: "adult", joinedAt: "2026-07-02T00:00:00Z" },
  ];
});

it("lists members with roles", async () => {
  await render(<MemberList canManage />);
  expect(screen.getByText("Alice")).toBeTruthy();
  expect(screen.getByText("Bob")).toBeTruthy();
});

it("removes another member when managing (self is not removable via the row action)", async () => {
  // selfUserId = u1 (Alice/owner) -> only Bob (u2) gets a row "Remover" action.
  await render(<MemberList canManage selfUserId="u1" />);
  const removeButtons = screen.getAllByText("Remover");
  expect(removeButtons).toHaveLength(1);
  fireEvent.press(removeButtons[0]);
  expect(mockRemoveMutate).toHaveBeenCalledWith({ id: "h1", userId: "u2" }, expect.any(Object));
});

it("surfaces the mapped error message when removing a member fails", async () => {
  mockRemoveMutate.mockImplementation((_vars, opts) => opts.onError(new ApiError(409, "HH-T0005")));
  await render(<MemberList canManage selfUserId="u1" />);
  fireEvent.press(screen.getAllByText("Remover")[0]);
  await waitFor(() => {
    expect(screen.getByText("O contexto precisa de pelo menos um dono.")).toBeTruthy();
  });
});

describe("explicit ownership transfer", () => {
  beforeEach(() => {
    mockMembers = [
      { userId: "owner1", name: "Owner", role: "owner" },
      { userId: "adult1", name: "Ana", role: "adult" },
      { userId: "teen1", name: "Théo", role: "teen" },
    ];
  });

  it("shows Transferir propriedade only on adult rows for a manager", async () => {
    await render(<MemberList canManage selfUserId="owner1" />);
    expect(screen.getAllByText("Transferir propriedade")).toHaveLength(1);
  });

  it("confirming the transfer fires the mutation with the target's userId", async () => {
    await render(<MemberList canManage selfUserId="owner1" />);
    fireEvent.press(screen.getByText("Transferir propriedade"));
    expect(mockTransferMutate).toHaveBeenCalledWith(
      { id: "h1", data: { newOwnerUserId: "adult1" } },
      expect.any(Object),
    );
  });

  it("clears the active household and routes to the context switcher on success", async () => {
    mockTransferMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    await render(<MemberList canManage selfUserId="owner1" />);
    fireEvent.press(screen.getByText("Transferir propriedade"));
    expect(mockSetActiveHousehold).toHaveBeenCalledWith(null);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [{ url: "/households" }] });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings/contexts");
  });

  it("surfaces the mapped error message when the transfer fails", async () => {
    mockTransferMutate.mockImplementation((_vars, opts) => opts.onError(new ApiError(409, "HH-T0006")));
    await render(<MemberList canManage selfUserId="owner1" />);
    fireEvent.press(screen.getByText("Transferir propriedade"));
    await waitFor(() => {
      expect(screen.getByText("Este membro não pode receber a propriedade do contexto.")).toBeTruthy();
    });
  });
});

describe("on-leave offer", () => {
  it("last owner leaving opens an adult picker instead of removing directly", async () => {
    mockMembers = [
      { userId: "owner1", name: "Owner", role: "owner" },
      { userId: "adult1", name: "Ana", role: "adult" },
    ];
    await render(<MemberList canManage selfUserId="owner1" />);
    fireEvent.press(screen.getByText("Sair do contexto"));
    expect(mockRemoveMutate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Escolher novo dono")).toBeTruthy();
    });

    // "Ana" appears both as a member row and as the picker's option; the picker
    // option is the one rendered inside the "Escolher novo dono" sheet.
    const anaMatches = screen.getAllByText("Ana");
    fireEvent.press(anaMatches[anaMatches.length - 1]);
    expect(mockTransferMutate).toHaveBeenCalledWith(
      { id: "h1", data: { newOwnerUserId: "adult1" } },
      expect.any(Object),
    );
  });

  it("last owner with no adults sees a blocking message and no mutation fires", async () => {
    mockMembers = [
      { userId: "owner1", name: "Owner", role: "owner" },
      { userId: "teen1", name: "Théo", role: "teen" },
    ];
    await render(<MemberList canManage selfUserId="owner1" />);
    fireEvent.press(screen.getByText("Sair do contexto"));
    await waitFor(() => {
      expect(screen.getByText("Promova ou convide um adulto antes de sair.")).toBeTruthy();
    });
    expect(mockRemoveMutate).not.toHaveBeenCalled();
    expect(mockTransferMutate).not.toHaveBeenCalled();
  });

  it("non-last-owner leaving still calls the normal remove", async () => {
    mockMembers = [
      { userId: "owner1", name: "Owner", role: "owner" },
      { userId: "self1", name: "Self", role: "adult" },
    ];
    await render(<MemberList canManage={false} selfUserId="self1" />);
    fireEvent.press(screen.getByText("Sair do contexto"));
    expect(mockRemoveMutate).toHaveBeenCalledWith({ id: "h1", userId: "self1" }, expect.any(Object));
    expect(mockTransferMutate).not.toHaveBeenCalled();
  });

  it("post-success of a self-remove also clears the household and redirects", async () => {
    mockMembers = [
      { userId: "owner1", name: "Owner", role: "owner" },
      { userId: "self1", name: "Self", role: "adult" },
    ];
    mockRemoveMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    await render(<MemberList canManage={false} selfUserId="self1" />);
    fireEvent.press(screen.getByText("Sair do contexto"));
    expect(mockSetActiveHousehold).toHaveBeenCalledWith(null);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings/contexts");
  });
});
