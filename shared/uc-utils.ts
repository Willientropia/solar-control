/**
 * Utilitários para normalização e formatação de Unidades Consumidoras (UCs).
 *
 * Contexto: em 2026 a Equatorial mudou o formato da UC de "10023560892" (11 dígitos)
 * para "3.480.146.012-52" (12 dígitos formatados). Internamente armazenamos apenas
 * dígitos sem zeros à esquerda, para permitir matching entre planilhas (que usam
 * 15 dígitos padded) e PDFs (que usam 12 dígitos formatados).
 */

/** Remove pontos, traços, espaços e zeros à esquerda. Retorna null se vazio. */
export function normalizeUC(uc: string | null | undefined): string | null {
  if (!uc) return null;
  const digits = String(uc).replace(/\D/g, "").replace(/^0+/, "");
  return digits || null;
}

/**
 * Formata UC nova para exibição: "348014601252" → "3.480.146.012-52".
 * Se UC tiver formato inesperado, retorna string original.
 */
export function formatUCNova(uc: string | null | undefined): string {
  if (!uc) return "";
  const digits = String(uc).replace(/\D/g, "");
  // Padrão esperado: 12 dígitos → X.XXX.XXX.XXX-XX
  if (digits.length === 12) {
    return `${digits[0]}.${digits.slice(1, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}-${digits.slice(10, 12)}`;
  }
  // 15 dígitos (Excel): remove leading zeros e tenta formatar os 12 restantes
  if (digits.length === 15) {
    const trimmed = digits.replace(/^0+/, "");
    if (trimmed.length === 12) {
      return `${trimmed[0]}.${trimmed.slice(1, 4)}.${trimmed.slice(4, 7)}.${trimmed.slice(7, 10)}-${trimmed.slice(10, 12)}`;
    }
  }
  return String(uc);
}
