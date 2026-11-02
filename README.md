# dominio-ponte

Servidor MCP **local** e **somente leitura** que liga o Claude (Claude Code ou app desktop) ao banco do ERP Domínio (SQL Anywhere) do próprio escritório, pelo ODBC.

A ponte não sabe nada do Domínio e não faz nenhuma chamada de rede: recebe um SQL, confere as travas, executa no seu banco e devolve as linhas só para o Claude. O conhecimento das tabelas e as consultas prontas vêm do **Conector Domínio** da Cabeda; a forma de trabalhar vem da skill do plugin [`dominio-plugin`](https://github.com/compucel/dominio-plugin).

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `executar_consulta` | Executa um SELECT verificado e devolve colunas, linhas, total, se foi cortado e o tempo |
| `status_conexao` | Diz se o banco responde, com usuário, banco e horário |

As duas têm `readOnlyHint: true`.

## Travas

1. **Usuário de banco somente leitura** no DSN (ex.: `EXTERNO`). É a proteção principal.
2. Um comando por chamada; `;` só no final.
3. Só `SELECT` ou `WITH … SELECT`. Recusa `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `CREATE`, `ALTER`, `DROP`, `INTO`, `SET`, `CALL`, `EXECUTE`, `LOAD`, `UNLOAD`, `OUTPUT`, `OPENSTRING` e procedimentos `xp_`, `sa_`, `sp_`.
4. Só tabelas qualificadas `bethadba.<tabela>` ou `sys.<tabela>`, ou CTEs declaradas na consulta. Funções no `FROM` são recusadas.
5. No máximo 5.000 linhas (o resto é cortado e informado) e 60 s por consulta.
6. Sem rede: a ponte só fala com o ODBC local e com o Claude.

Os testes da guarda estão em `src/guarda.test.ts` (`npm test`).

## Requisitos

- Windows com o driver ODBC do SQL Anywhere e um DSN configurado (por padrão `Contabil`), com usuário e senha salvos no próprio DSN.
- Node.js 20 ou superior.

## Configuração

Normalmente instalada pelo plugin. Para usar sozinha no Claude Code:

```bash
claude mcp add dominio-ponte -e DOMINIO_DSN=Contabil -- npx -y @cabeda/dominio-ponte
```

| Variável | Padrão | Uso |
|---|---|---|
| `DOMINIO_DSN` | `Contabil` | DSN ODBC do Domínio |
| `DOMINIO_ODBC` | — | Connection string completa (evite: expõe a senha na configuração) |
| `DOMINIO_LIMITE_LINHAS` | 5000 | Máximo de linhas devolvidas (teto 5000) |
| `DOMINIO_TEMPO_MAX` | 60 | Tempo máximo por consulta, em segundos (teto 120) |
| `DOMINIO_PONTE_LOG` | `~/.dominio-ponte/consultas.log` | Registro local de execuções |

O registro local guarda data, início do SQL, resultado, quantidade de linhas e tempo. **Nunca guarda o conteúdo das linhas.**

## Política de privacidade

Ver [PRIVACIDADE.md](PRIVACIDADE.md). Em resumo: a ponte não coleta, não envia e não armazena dados do banco fora da sua máquina; os resultados vão apenas para o Claude, que os processa conforme os termos da Anthropic.

## Desenvolvimento

```bash
npm ci --ignore-scripts   # o driver odbc só é necessário para executar de verdade
npm test
npm run build
```

Publicação: `npm version patch && git push --follow-tags` dispara o workflow que publica no npm.
