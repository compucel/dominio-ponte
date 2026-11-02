import { describe, expect, it } from "vitest";
import { verificarSql } from "./guarda.js";

const ok = (sql: string) => {
  const r = verificarSql(sql);
  if (!r.ok) throw new Error(`esperava aceitar: ${r.motivo}\n${sql}`);
  return r.sql;
};
const nega = (sql: string, motivo?: RegExp) => {
  const r = verificarSql(sql);
  expect(r.ok, sql).toBe(false);
  if (motivo && !r.ok) expect(r.motivo).toMatch(motivo);
};

describe("aceita", () => {
  it("SELECT simples qualificado", () => ok("SELECT TOP 10 codi_emp FROM bethadba.efsdoimp WHERE data_sim = '2026-09-01'"));
  it("catálogo sys", () => ok("SELECT table_name FROM sys.systable WHERE table_type = 'BASE'"));
  it("JOINs e vírgulas", () =>
    ok("SELECT a.x FROM bethadba.efsdoimp a, bethadba.geimposto g LEFT JOIN bethadba.geempre e ON e.codi_emp = a.codi_emp WHERE a.codi_emp = g.codi_emp"));
  it("CTEs com UNION ALL e subconsulta", () =>
    ok(`WITH mv AS (SELECT codi_acu FROM bethadba.efentradas UNION ALL SELECT codi_acu FROM bethadba.efsaidas),
        vg (acu, vig) AS (SELECT codi_acu, MAX(vigencia_acu) FROM bethadba.EFACUMULADOR_VIGENCIA GROUP BY codi_acu)
        SELECT TOP 5 * FROM mv JOIN vg ON vg.acu = mv.codi_acu WHERE mv.codi_acu IN (SELECT codi_acu FROM bethadba.EFACUMULADOR)`));
  it("palavra proibida dentro de texto ou comentário", () =>
    ok("SELECT 'DELETE FROM x; DROP' AS t FROM bethadba.efsdoimp -- UPDATE aqui\n/* INSERT */"));
  it("ponto e vírgula final e marca da licença", () => {
    expect(ok("SELECT 1 FROM bethadba.efsdoimp;")).not.toContain(";");
    ok("SELECT 1 FROM bethadba.efsdoimp\n/* lic:7Q2K9A */");
  });
  it("colunas com nomes parecidos com palavras proibidas", () =>
    ok("SELECT data_sim, codi_usu AS usuario_insert, a.SET_X FROM bethadba.efsdoimp a"));
  it("funções escalares fora do FROM", () => ok("SELECT LIST(STRING(codi_emp), ','), HASH('a','md5'), DATEADD(month,-1,'2026-09-01') FROM bethadba.efsdoimp"));
});

describe("recusa", () => {
  it("vazio", () => nega("   ", /vazio/));
  it("comandos de escrita", () => {
    nega("DELETE FROM bethadba.efsdoimp", /SELECT/);
    nega("UPDATE bethadba.efsdoimp SET sdev_sim = 0", /SELECT/);
    nega("SELECT * INTO #t FROM bethadba.efsdoimp", /INTO/);
  });
  it("dois comandos", () => nega("SELECT 1 FROM bethadba.efsdoimp; DROP TABLE bethadba.efsdoimp", /um comando/));
  it("comando escondido após comentário", () => nega("SELECT 1 FROM bethadba.efsdoimp /* x */; DELETE FROM bethadba.efsdoimp", /um comando/));
  it("procedimentos de sistema", () => {
    nega("SELECT xp_cmdshell('dir') FROM sys.dummy", /procedimento/);
    nega("SELECT * FROM sa_conn_info()", /procedimento|função/);
    nega("SELECT * FROM bethadba.efsdoimp WHERE 1 = (SELECT sp_x(1))", /procedimento/);
  });
  it("leitura de arquivo", () => nega("SELECT * FROM OPENSTRING(FILE 'c:\\x.txt') WITH (a INT) AS t", /OPENSTRING|tabela/));
  it("tabela sem esquema ou de outro esquema", () => {
    nega("SELECT * FROM efsdoimp", /tabela não permitida/);
    nega("SELECT * FROM dba.usuarios", /tabela não permitida/);
    nega("SELECT * FROM bethadba.efsdoimp a, outra b", /tabela não permitida: outra/);
    nega("SELECT * FROM bethadba.efsdoimp a JOIN segredo.x b ON 1=1", /segredo/);
  });
  it("literal ou comentário sem fechamento", () => {
    nega("SELECT 'abc FROM bethadba.efsdoimp", /aspas/);
    nega("SELECT 1 FROM bethadba.efsdoimp /* aberto", /comentário/);
  });
  it("SET, CALL e EXECUTE", () => {
    nega("SELECT 1 FROM bethadba.efsdoimp; SET OPTION x = 1", /um comando/);
    nega("CALL sa_disk_free_space()", /SELECT/);
    nega("WITH a AS (SELECT 1 FROM bethadba.efsdoimp) SELECT * FROM a WHERE EXISTS (EXECUTE IMMEDIATE 'x')", /EXECUTE/);
  });
});
