export type BankGuide = {
  id: string;
  label: string;
  emoji: string;
  ofxSteps: string[];
  csvSteps: string[];
};

export const BANK_GUIDES: BankGuide[] = [
  {
    id: "nubank",
    label: "Nubank",
    emoji: "🟣",
    ofxSteps: ["Abra o app do Nubank", "Toque em Conta → Histórico", 'Toque em "Exportar extrato"', "Escolha o formato OFX e o período", "Salve o arquivo e volte aqui"],
    csvSteps: ["Abra o app do Nubank", "Conta → Histórico", 'Toque em "Exportar extrato"', "Escolha CSV e o período", "Salve e volte aqui"],
  },
  {
    id: "itau",
    label: "Itaú",
    emoji: "🟠",
    ofxSteps: ["Acesse o Itaú no navegador ou app", "Vá em Conta corrente → Extrato", "Selecione o período", 'Exporte em OFX (Money/OFX)', "Salve e volte aqui"],
    csvSteps: ["Acesse o Itaú", "Conta corrente → Extrato", "Selecione o período", "Exporte em CSV/Excel", "Salve e volte aqui"],
  },
  {
    id: "bradesco",
    label: "Bradesco",
    emoji: "🔴",
    ofxSteps: ["Acesse o Bradesco", "Conta → Extrato", "Escolha o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o Bradesco", "Conta → Extrato", "Escolha o período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "inter",
    label: "Inter",
    emoji: "🟧",
    ofxSteps: ["Abra o app do Inter", "Extrato → filtro de período", "Toque no ícone de exportar", "Escolha OFX", "Salve e volte aqui"],
    csvSteps: ["Abra o app do Inter", "Extrato → período", "Exportar → CSV", "Salve e volte aqui"],
  },
  {
    id: "c6",
    label: "C6 Bank",
    emoji: "⚫",
    ofxSteps: ["Abra o app do C6", "Extrato → período", "Exportar extrato → OFX", "Salve e volte aqui"],
    csvSteps: ["Abra o app do C6", "Extrato → período", "Exportar → CSV", "Salve e volte aqui"],
  },
  {
    id: "bb",
    label: "Banco do Brasil",
    emoji: "🟡",
    ofxSteps: ["Acesse o BB (app ou site)", "Conta → Extrato", "Selecione o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o BB", "Conta → Extrato", "Período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "caixa",
    label: "Caixa",
    emoji: "🔵",
    ofxSteps: ["Acesse o Caixa (app ou internet banking)", "Conta → Extrato", "Selecione o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o Caixa", "Conta → Extrato", "Período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "generic",
    label: "Outro banco",
    emoji: "🏦",
    ofxSteps: ["Acesse seu banco (app ou site)", "Encontre a tela de Extrato", "Selecione o período desejado", "Procure a opção Exportar/Baixar em OFX", "Salve o arquivo e volte aqui"],
    csvSteps: ["Acesse seu banco", "Tela de Extrato", "Selecione o período", "Exporte/baixe em CSV", "Salve o arquivo e volte aqui"],
  },
];

export function getBankGuide(id: string): BankGuide {
  return BANK_GUIDES.find((g) => g.id === id) ?? BANK_GUIDES.find((g) => g.id === "generic")!;
}
