const mockPreviewMutate = jest.fn();
const mockCommitMutate = jest.fn();
const mockPickStatement = jest.fn();
jest.mock("@/api/generated", () => ({
  useListAccounts: () => ({ data: { accounts: [{ id: "a1", name: "Nubank", kind: "checking" }] } }),
  useListCategories: () => ({ data: { categories: [{ id: "c1", name: "Alimentação", kind: "expense" }] } }),
  usePreviewImport: () => ({ mutate: mockPreviewMutate, isPending: false }),
  useCommitImport: () => ({ mutate: mockCommitMutate, isPending: false }),
}));
jest.mock("@/lib/pick-statement", () => ({ pickStatement: () => mockPickStatement() }));

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ImportWizard } from "./import-wizard";

beforeEach(() => {
  mockPreviewMutate.mockReset();
  mockCommitMutate.mockReset();
  mockPickStatement.mockReset();
});

it("walks account → source → file → preview → review → commit", async () => {
  mockPickStatement.mockResolvedValue({ name: "x.ofx", content: "<OFX/>" });
  mockPreviewMutate.mockImplementation((_v, opts) =>
    opts.onSuccess({ rows: [
      { amountCents: 4590, direction: "out", occurredAt: "2026-07-15T00:00:00.000Z", description: "iFood", rawRef: "TX1", suggestedCategory: "Alimentação", confidence: 90, duplicate: false },
      { amountCents: 1850, direction: "out", occurredAt: "2026-07-16T00:00:00.000Z", description: "Uber", rawRef: "TX2", suggestedCategory: null, confidence: 0, duplicate: true },
    ] }),
  );
  mockCommitMutate.mockImplementation((_v, opts) => opts.onSuccess({ importId: "imp1", imported: 1, skipped: 1 }));
  const onDone = jest.fn();

  const { getByText } = await render(<ImportWizard onDone={onDone} />);
  await act(() => fireEvent.press(getByText("Nubank")));          // pick account
  await act(() => fireEvent.press(getByText("Continuar")));
  await waitFor(() => expect(getByText("Escolher arquivo")).toBeTruthy());
  await act(() => fireEvent.press(getByText("Escolher arquivo"))); // source step → pick file
  await waitFor(() => expect(getByText("Analisar extrato")).toBeTruthy());
  await act(() => fireEvent.press(getByText("Analisar extrato"))); // → preview
  await waitFor(() => expect(getByText("iFood")).toBeTruthy());
  // Uber is a duplicate → pre-excluded, so only 1 included → "Importar 1"
  await act(() => fireEvent.press(getByText("Importar 1")));
  expect(mockCommitMutate).toHaveBeenCalledWith(
    { data: expect.objectContaining({ accountId: "a1", source: "ofx", rows: expect.any(Array) }) },
    expect.any(Object),
  );
  const committedRows = (mockCommitMutate.mock.calls[0][0] as { data: { rows: unknown[] } }).data.rows;
  expect(committedRows).toHaveLength(1); // duplicate excluded
  await waitFor(() => expect(getByText(/1 importada/i)).toBeTruthy());
});
