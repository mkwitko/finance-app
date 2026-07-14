import { render, screen } from "@testing-library/react-native";
import SettingsHub from "@/app/(tabs)/settings/index";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("SettingsHub", () => {
  it("lists the settings entries incl. Plano", async () => {
    await render(<SettingsHub />);
    expect(screen.getByText("Plano")).toBeTruthy();
    expect(screen.getByText("Membros")).toBeTruthy();
    expect(screen.getByText("Tema")).toBeTruthy();
  });
});
