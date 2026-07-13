import { ApiError } from "@/api/client";

const MESSAGES: Record<string, string> = {
  "INV-T0001": "Convite inválido.",
  "INV-T0002": "Este convite expirou ou foi revogado.",
  "INV-T0003": "Você já faz parte deste contexto.",
  "INV-T0004": "Você não pode conceder um papel acima do seu.",
  "HH-T0005": "O contexto precisa de pelo menos um dono.",
  "HH-T0002": "Você não é membro deste contexto.",
  "HH-T0003": "Seu papel não permite esta ação.",
};

export function contextErrorMessage(err: unknown): string {
  if (err instanceof ApiError && MESSAGES[err.code]) return MESSAGES[err.code];
  return "Algo deu errado. Tente novamente.";
}
