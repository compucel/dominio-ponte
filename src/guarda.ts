/**
 * Travas de SQL da ponte. Todo SQL recebido é tratado como não confiável:
 * ele passa pelo modelo antes de chegar aqui.
 *
 * A trava principal continua sendo o usuário de banco somente leitura (EXTERNO).
 * Estas regras são redundância: um comando, só SELECT/WITH, sem palavras perigosas,
 * só tabelas qualificadas com bethadba. ou sys. (ou CTEs declaradas na própria consulta).
 */

export type ResultadoGuarda = { ok: true; sql: string } | { ok: false; motivo: string };

const ESQUEMAS_PERMITIDOS = new Set(["bethadba", "sys"]);

const PROIBIDAS = [
  "INSERT", "UPDATE", "DELETE", "MERGE", "UPSERT", "CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME",
  "GRANT", "REVOKE", "CALL", "EXEC", "EXECUTE", "LOAD", "UNLOAD", "OUTPUT", "INTO", "COMMIT",
  "ROLLBACK", "SAVEPOINT", "SET", "BACKUP", "RESTORE", "CHECKPOINT", "OPENSTRING", "TRIGGER",
  "MESSAGE", "WAITFOR", "STOP", "START", "INSTALL", "REMOVE", "VALIDATE", "LOCK", "UNLOCK",
];

const FIM_DE_FROM = new Set(["WHERE", "GROUP", "ORDER", "HAVING", "UNION", "EXCEPT", "INTERSECT", "WINDOW", "FOR", "OPTION"]);

/** Troca comentários por espaço e o conteúdo de literais por 'x', preservando posições. */
export function mascarar(sql: string): { texto: string; erro?: string } {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === "-" && d === "-") {
      while (i < sql.length && sql[i] !== "\n") (out += " "), i++;
    } else if (c === "/" && d === "/") {
      while (i < sql.length && sql[i] !== "\n") (out += " "), i++;
    } else if (c === "/" && d === "*") {
      const fim = sql.indexOf("*/", i + 2);
      if (fim < 0) return { texto: out, erro: "comentário /* sem fechamento" };
      out += " ".repeat(fim + 2 - i);
      i = fim + 2;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) break;
        else j++;
      }
      if (j >= sql.length) return { texto: out, erro: "texto entre aspas sem fechamento" };
      // literal de texto vira 'x…x'; identificador entre aspas duplas vira "x…x"
      out += c + "x".repeat(j - i - 1) + c;
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return { texto: out };
}

interface Token {
  t: string; // texto em maiúsculas
  bruto: string;
}

function tokenizar(texto: string): Token[] {
  const re = /"x*"\.?[A-Za-z0-9_."]*|[A-Za-z_][A-Za-z0-9_]*(?:\s*\.\s*[A-Za-z_"][A-Za-z0-9_"]*)*|'x*'|\d+(?:\.\d+)?|[(),]|\S/g;
  return [...texto.matchAll(re)].map((m) => ({ t: m[0].replace(/\s+/g, "").toUpperCase(), bruto: m[0].replace(/\s+/g, "") }));
}

function nomesCte(tokens: Token[]): Set<string> {
  const ctes = new Set<string>();
  for (let i = 0; i < tokens.length - 2; i++) {
    const anterior = tokens[i - 1]?.t;
    if ((anterior === "WITH" || anterior === "," || anterior === "RECURSIVE") && /^[A-Z_][A-Z0-9_]*$/.test(tokens[i].t)) {
      // nome AS (   ou   nome (col, ...) AS (
      if (tokens[i + 1].t === "AS" && tokens[i + 2].t === "(") ctes.add(tokens[i].t);
      if (tokens[i + 1].t === "(") {
        let p = 0, j = i + 1;
        for (; j < tokens.length; j++) {
          if (tokens[j].t === "(") p++;
          if (tokens[j].t === ")" && --p === 0) break;
        }
        if (tokens[j + 1]?.t === "AS" && tokens[j + 2]?.t === "(") ctes.add(tokens[i].t);
      }
    }
  }
  return ctes;
}

function tabelaPermitida(nome: string, ctes: Set<string>): boolean {
  const limpo = nome.replace(/"/g, "");
  const partes = limpo.split(".");
  if (partes.length === 1) return ctes.has(partes[0]);
  if (partes.length === 2) return ESQUEMAS_PERMITIDOS.has(partes[0].toLowerCase());
  return false;
}

export function verificarSql(entrada: string): ResultadoGuarda {
  if (typeof entrada !== "string" || !entrada.trim()) return { ok: false, motivo: "SQL vazio" };
  if (entrada.length > 50_000) return { ok: false, motivo: "SQL longo demais (máx. 50 mil caracteres)" };

  const m = mascarar(entrada);
  if (m.erro) return { ok: false, motivo: m.erro };

  // um único comando: aceita ';' só no final
  let texto = m.texto.replace(/;\s*$/, "");
  let sql = entrada.slice(0, texto.length).trimEnd();
  if (texto.includes(";")) return { ok: false, motivo: "apenas um comando por chamada" };
  texto = texto.trimEnd();
  sql = sql.trimEnd();

  const tokens = tokenizar(texto);
  if (!tokens.length || (tokens[0].t !== "SELECT" && tokens[0].t !== "WITH"))
    return { ok: false, motivo: "apenas consultas SELECT (ou WITH … SELECT) são permitidas" };

  for (const tk of tokens) {
    const palavra = tk.t.split(".").pop()!;
    if (PROIBIDAS.includes(palavra) && !tk.t.includes(".")) return { ok: false, motivo: `palavra não permitida: ${palavra}` };
  }
  for (let i = 0; i < tokens.length; i++) {
    const nome = tokens[i].t.split(".").pop()!;
    if (/^(XP|SA|SP|DBO)_/.test(nome) && tokens[i + 1]?.t === "(") return { ok: false, motivo: `procedimento de sistema não permitido: ${tokens[i].bruto}` };
  }

  const ctes = nomesCte(tokens);
  let profundidade = 0;
  const pilhaFrom: number[] = []; // profundidades onde há uma lista FROM aberta
  const conferir = (i: number): ResultadoGuarda | null => {
    const tk = tokens[i];
    if (!tk) return { ok: false, motivo: "FROM/JOIN sem tabela" };
    if (tk.t === "(") return null; // subconsulta
    if (!tabelaPermitida(tk.t, ctes))
      return { ok: false, motivo: `tabela não permitida: ${tk.bruto} (use bethadba.<tabela> ou sys.<tabela>)` };
    if (tokens[i + 1]?.t === "(") return { ok: false, motivo: `função em FROM não permitida: ${tk.bruto}` };
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].t;
    if (t === "(") profundidade++;
    else if (t === ")") {
      while (pilhaFrom.length && pilhaFrom[pilhaFrom.length - 1] >= profundidade) pilhaFrom.pop();
      profundidade--;
    } else if (t === "FROM" || t === "JOIN" || t === "APPLY") {
      const r = conferir(i + 1);
      if (r) return r;
      if (t === "FROM") pilhaFrom.push(profundidade);
    } else if (t === "," && pilhaFrom.length && pilhaFrom[pilhaFrom.length - 1] === profundidade) {
      const r = conferir(i + 1);
      if (r) return r;
    } else if (FIM_DE_FROM.has(t) && pilhaFrom.length && pilhaFrom[pilhaFrom.length - 1] === profundidade) {
      pilhaFrom.pop();
    } else if (t === "SELECT" && pilhaFrom.length && pilhaFrom[pilhaFrom.length - 1] === profundidade) {
      pilhaFrom.pop();
    }
  }
  if (profundidade !== 0) return { ok: false, motivo: "parênteses desbalanceados" };

  return { ok: true, sql };
}
