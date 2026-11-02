import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Registro local de execuções: data, trecho do SQL, linhas e tempo. Nunca grava resultados. */
export function caminhoRegistro(): string {
  return process.env.DOMINIO_PONTE_LOG || join(homedir(), ".dominio-ponte", "consultas.log");
}

export async function registrar(evento: { sql: string; resultado: string; linhas?: number; tempo_ms?: number }) {
  try {
    const arq = caminhoRegistro();
    await mkdir(dirname(arq), { recursive: true });
    const linha = {
      em: new Date().toISOString(),
      sql_hash: createHash("sha256").update(evento.sql).digest("hex").slice(0, 16),
      sql_inicio: evento.sql.replace(/\s+/g, " ").slice(0, 160),
      resultado: evento.resultado,
      linhas: evento.linhas,
      tempo_ms: evento.tempo_ms,
    };
    await appendFile(arq, JSON.stringify(linha) + "\n", "utf8");
  } catch {
    /* registro é melhor esforço */
  }
}
