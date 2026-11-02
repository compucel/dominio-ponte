import { createRequire } from "node:module";

export interface ConfigBanco {
  /** Nome do DSN ODBC configurado no Windows (usuário e senha ficam no DSN). */
  dsn: string;
  /** Alternativa ao DSN. Evite: a senha fica em texto na configuração. */
  connectionString?: string;
  limiteLinhas: number;
  tempoMaxSegundos: number;
}

export interface ResultadoConsulta {
  colunas: string[];
  linhas: unknown[][];
  total_linhas: number;
  cortado: boolean;
  tempo_ms: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let odbcMod: any;
function odbc(): any {
  if (!odbcMod) {
    const require = createRequire(import.meta.url);
    try {
      odbcMod = require("odbc");
    } catch (e) {
      throw new Error(
        "Driver ODBC do Node não instalado. Rode a instalação de novo ou veja o README (requisitos: Windows, driver SQL Anywhere).",
      );
    }
  }
  return odbcMod;
}

const normalizar = (v: unknown): unknown => {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return `<binário ${v.length} bytes>`;
  return v;
};

export function stringConexao(cfg: ConfigBanco): string {
  return cfg.connectionString || `DSN=${cfg.dsn};CharSet=UTF-8`;
}

/** Executa um SQL já verificado pela guarda. Lê no máximo limiteLinhas e corta o resto. */
export async function executar(sql: string, cfg: ConfigBanco): Promise<ResultadoConsulta> {
  const inicio = Date.now();
  const conexao = await odbc().connect({ connectionString: stringConexao(cfg), connectionTimeout: 15, loginTimeout: 15 });
  try {
    await conexao.setIsolationLevel?.(odbc().SQL_TXN_READ_COMMITTED).catch(() => undefined);
    const cursor = await conexao.query(sql, { cursor: true, fetchSize: 500, timeout: cfg.tempoMaxSegundos });
    const linhas: unknown[][] = [];
    let colunas: string[] = [];
    let cortado = false;
    try {
      while (!cursor.noData) {
        const lote = await cursor.fetch();
        if (!colunas.length && lote.columns) colunas = lote.columns.map((c: any) => c.name);
        for (const linha of lote as any[]) {
          if (linhas.length >= cfg.limiteLinhas) {
            cortado = true;
            break;
          }
          if (!colunas.length) colunas = Object.keys(linha);
          linhas.push(colunas.map((c) => normalizar(linha[c])));
        }
        if (cortado || lote.length === 0) break;
      }
    } finally {
      await cursor.close().catch(() => undefined);
    }
    return { colunas, linhas, total_linhas: linhas.length, cortado, tempo_ms: Date.now() - inicio };
  } finally {
    await conexao.close().catch(() => undefined);
  }
}

export async function status(cfg: ConfigBanco): Promise<{ conectado: boolean; usuario?: string; banco?: string; agora?: string; erro?: string }> {
  try {
    const r = await executar("SELECT CURRENT USER AS usuario, DB_NAME() AS banco, NOW() AS agora", { ...cfg, limiteLinhas: 1 });
    const [usuario, banco, agora] = r.linhas[0] as string[];
    return { conectado: true, usuario, banco, agora: String(agora) };
  } catch (e) {
    // nunca devolve a connection string
    return { conectado: false, erro: (e as Error).message.replace(/PWD=[^;]*/gi, "PWD=***") };
  }
}
