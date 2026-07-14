import { ApiError } from "@/api/client";

const MESSAGES: Record<string, string> = {
  "INV-T0001": "Convite inválido.",
  "INV-T0002": "Este convite expirou ou foi revogado.",
  "INV-T0003": "Você já faz parte deste contexto.",
  "INV-T0004": "Você não pode conceder um papel acima do seu.",
  "HH-T0005": "O contexto precisa de pelo menos um dono.",
  "HH-T0002": "Você não é membro deste contexto.",
  "HH-T0003": "Seu papel não permite esta ação.",
  "HH-T0006": "Este membro não pode receber a propriedade do contexto.",
  "SUB-T0001": "Plano indisponível no momento.",
  "SUB-T0002": "Pagamentos indisponíveis no momento.",
  "SUB-T0003": "Este contexto já possui uma assinatura ativa.",
  "SUB-T0004": "Nenhuma assinatura ativa encontrada.",
  "SUB-T0005": "Falha no pagamento. Tente novamente.",
  "SUB-T0006": "O contexto não possui um dono para a cobrança.",
  "SUB-T0007": "O e-mail deste membro já está em uso por outra assinatura.",
};

export function contextErrorMessage(err: unknown): string {
  if (err instanceof ApiError && MESSAGES[err.code]) return MESSAGES[err.code];
  return "Algo deu errado. Tente novamente.";
}
