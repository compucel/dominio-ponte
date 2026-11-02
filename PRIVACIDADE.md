# Política de privacidade – Ponte ODBC Domínio e Conector Domínio

> **Rascunho para revisão jurídica.** Ajuste razão social, CNPJ, encarregado (DPO) e prazos antes de publicar em https://cabeda.com.br/privacidade-conector.

**Controlador dos dados de cadastro:** Cabeda Contabilidade – CNPJ [preencher] – [endereço].
**Contato de privacidade:** privacidade@cabeda.com.br (encarregado: [nome]).
**Vigência:** [data].

## 1. O que cada parte faz

- **Ponte ODBC (instalada no seu computador):** executa consultas somente leitura no banco Domínio do seu escritório e devolve o resultado ao Claude, no mesmo computador. Não envia nada à Cabeda.
- **Conector Domínio (servidor da Cabeda):** confere seu login e sua licença e entrega o mapa de tabelas e o SQL das consultas. Não recebe dados do seu banco.

## 2. Dados coletados

| Dado | Onde | Para quê |
|---|---|---|
| Nome, e-mail, escritório, CNPJ e CRC do responsável | Cadastro no site da Cabeda | Criar a conta, emitir a licença, cobrar e dar suporte |
| Identificador do usuário, licença, ferramenta usada, assunto ou consulta pedida, parâmetros (como códigos de empresa e competência), versão e resultado (ok ou código de erro), data e hora | Conector | Controlar a licença e as cotas, detectar uso indevido, corrigir a biblioteca e dar suporte |
| Registro local (data, início do SQL, linhas, tempo) | Só no seu computador | Diagnóstico; você pode apagar quando quiser |

**Não coletamos:** o conteúdo das conversas com o Claude, os resultados das consultas, nem qualquer dado do banco Domínio do escritório.

## 3. Compartilhamento

Não vendemos nem compartilhamos dados com terceiros, exceto: provedores de infraestrutura que hospedam o conector e o banco de licenças (sob contrato e só para operar o serviço) e autoridades, quando exigido por lei.

Os resultados das consultas são processados pelo Claude, da Anthropic, conforme o contrato e a política de privacidade da Anthropic aceitos pelo próprio usuário.

## 4. Retenção

- Cadastro: enquanto houver licença e por 5 anos após o fim, para obrigações legais e fiscais.
- Registro de uso do conector: 12 meses.
- Registro local da ponte: controlado pelo usuário.

## 5. Direitos do titular (LGPD)

Você pode pedir acesso, correção, anonimização, portabilidade ou eliminação dos seus dados, e informações sobre compartilhamento, pelo e-mail de privacidade. Respondemos em até 15 dias.

## 6. Segurança

Conexões por HTTPS, login OAuth com tokens de curta duração, acesso ao banco de licenças por papel restrito, segredos fora do código e revogação imediata de usuários e licenças.

## 7. Alterações

Mudanças relevantes nesta política são avisadas por e-mail aos administradores dos escritórios com pelo menos 15 dias de antecedência.
