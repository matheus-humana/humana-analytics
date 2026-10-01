# Passagem do projeto para a equipe de dev

Estado em 30/09/2026, na saída do desenvolvedor anterior.

## Onde está o código

- O trabalho atual está na branch **`fixes-Matheus`**. `fixes-Matheus-visual` é a branch de trabalho do dia a dia e é mesclada em `fixes-Matheus`.
- A `main` está desatualizada e não recebeu esse trabalho. Decidam quando levar `fixes-Matheus` para a `main`.
- O repositório está em uma conta pessoal do GitHub (`matheus-humana/humana-analytics`) e deve ser transferido para a organização da empresa em Settings → General → Transfer ownership.

## Como publicar

- A Vercel (time `humanalabs-projects`, projeto `humana-analytics`) **não está ligada ao GitHub**. Um push não publica nada.
- Para publicar, rode `vercel deploy --prod` a partir da branch que deve ir ao ar, e confira se o deploy fica **Ready** em https://humana-analytics.vercel.app.
- Depois de mudar uma variável na Vercel, é preciso publicar de novo para ela valer.
- O CI do GitHub (`.github/workflows/ci.yml`) roda install, typecheck, lint e test em push e PR para `main`, `fixes-Matheus` e `fixes-Matheus-visual`.

## Banco de dados

- Local e produção usam **o mesmo banco** (`DATABASE_URL`), no schema `analytics`. Uma migração rodada localmente vale para produção.
- Não alterem os schemas `public`, `knowledge_center` e `cms_admin`. São de outros sistemas.
- Migrações ficam em `src/lib/db/migrations`. Estão aplicadas da 0000 à 0008 (`0008_chat_context`).
- Para aplicar: `pnpm db:analytics:migrate` com `DATABASE_URL` definido. Leiam o SQL antes e parem se houver `DROP`.

## Rodar localmente

```bash
pnpm install
pnpm dev        # http://localhost:3000, lê o .env.local
pnpm typecheck
pnpm lint
pnpm test
```

O `.env.example` lista todas as variáveis. O `.env.local` e a pasta `secrets/` nunca vão para o git.

## Coletas automáticas (Vercel Cron, horário UTC)

| Rota | Quando |
|---|---|
| `/api/github/collect` | A cada hora, no minuto 15 |
| `/api/seo/crawl` | Todo dia, 08:20 |
| `/api/seo/pagespeed` | Todo dia, 08:40 |

As rotas exigem `Authorization: Bearer $CRON_SECRET`.

## Credenciais em contas pessoais

Várias credenciais foram criadas nas contas pessoais do desenvolvedor anterior, a maioria em um projeto pessoal do Google Cloud. Elas funcionam hoje, mas param quando esse acesso for removido.

A lista completa, com o que quebra sem cada uma, está no topo do `.env.example`. As variáveis estão marcadas com `[PERSONAL]`. Em resumo:

- **Login com Google** (`GOOGLE_CLIENT_*`, `AUTH_GOOGLE_*`): sem elas, ninguém entra.
- **Service account do GA4** (`GOOGLE_SERVICE_ACCOUNT_JSON`): sem ela, o GA4 para de atualizar.
- **Chat** (`GEMINI_API_KEY`, `GROQ_API_KEY`): sem elas, o chat não responde.
- **GitHub** (`GITHUB_TOKEN`): sem ele, a coleta horária do GitHub falha.
- **PageSpeed** (`PAGESPEED_API_KEY`): sem ela, o PageSpeed cai na cota anônima.

Ordem segura para trocar cada uma:

1. Criar a credencial numa conta da empresa.
2. Substituir na Vercel e no `.env.local`.
3. Publicar e conferir que funciona.
4. Só então revogar a antiga.

O passo a passo para o Google Cloud está em `docs/gcp-oauth-migration.md`.

A conta Google da empresa não conseguiu criar projeto no Google Cloud (erro 403 no AI Studio). Um administrador do Workspace precisa liberar a criação de projetos, ou criar o projeto e dar acesso à equipe.

## Checklist de transferência

Acesso ao GA4 e ao Clarity serve para usar as ferramentas no navegador (analytics.google.com e clarity.microsoft.com), sem instalar nada. Esse acesso não dá controle sobre o Humana Analytics: o app lê o GA4 por uma service account, não pelo login de ninguém.

Acessos às ferramentas:

- [ ] **GA4:** equipe como Administrator no nível da conta, entrando com o mesmo e-mail que recebeu o convite.
- [ ] **Microsoft Clarity:** equipe como Admin do projeto, com o convite por e-mail aceito. O Clarity não está ligado ao app; serve só para uso direto.
- [ ] **Não remover a service account** da lista de usuários do GA4 (Admin → Gerenciamento de acesso). Sem ela, o painel e o chat param de receber dados do GA4.

Acessos ao app:

- [ ] **GitHub:** repositório do Humana Analytics e do site, de preferência já transferido para a organização da empresa.
- [ ] **Vercel:** pelo menos um membro da equipe como Owner do time `humanalabs-projects`.
- [ ] **Google Cloud:** equipe como Owner ou Editor do projeto que tem a service account e o login com Google. Sem isso, ninguém troca a chave nem ajusta o login.
- [ ] **Banco de dados:** acesso ao painel do provedor do Postgres usado em `DATABASE_URL`.
- [ ] **Segredos locais:** valores do `.env.local` e o JSON da service account entregues por um gerenciador de senhas, nunca por chat ou e-mail.

Credenciais pessoais a recriar em contas da empresa (ordem segura na seção anterior):

- [ ] `GITHUB_TOKEN`, gerado por alguém da equipe com acesso aos repositórios.
- [ ] `GEMINI_API_KEY` e `GROQ_API_KEY`.
- [ ] `TAVILY_API_KEY`.
- [ ] `PAGESPEED_API_KEY`, se usada.
- [ ] Login com Google e service account, seguindo `docs/gcp-oauth-migration.md`.

## Avaliação do chat

`pnpm eval:chat` faz 30 perguntas reais ao modelo, com as ferramentas respondendo dados fixos (`src/lib/ai/evals/`). Nenhuma chamada vai ao GA4, ao banco ou ao Tavily. Cada resposta é conferida: ferramentas e período usados, texto esperado, texto simples sem Markdown, e todo número presente nos dados.

```bash
pnpm eval:chat                      # Gemini
pnpm eval:chat --provider groq      # Groq
pnpm eval:chat --only traffic-      # só os casos que começam com "traffic-"
```

Referência em 01/10/2026: Gemini 30/30, Groq 26/30. Rodem antes e depois de mexer em prompt, ferramentas ou modelo; uma mudança só entra se não baixar a nota.

Uma rodada completa no Groq gasta quase toda a cota diária gratuita (200 mil tokens), que é a mesma chave usada como reserva do chat em produção. Usem `--only` ou rodem fora do horário de uso.

## Pontos conhecidos

- **Tráfego do GitHub:** a API entrega os dados com alguns dias de atraso. Repositórios públicos recebem clones automáticos de robôs, e "Download ZIP" não é contado.
- **Chat com Gemini 3:** as chamadas de ferramenta precisam devolver `extra_content.google.thought_signature` na rodada seguinte. Isso já está implementado em `src/lib/ai/providers.ts` e `src/lib/ai/agent.ts`, com testes em `agent.test.ts`. Não removam.
- **Busca na web no chat:** usa o Tavily (`src/lib/web/search.ts` e `src/lib/ai/tools/web-tools.ts`). Fica desligada até existir `TAVILY_API_KEY` na Vercel. A chave gratuita dá 1.000 buscas por mês e deve ser criada numa conta da empresa em https://app.tavily.com. `WEB_SEARCH_KEYLESS=true` serve só para testar localmente. O estado aparece em Configurações → Modelos de IA.
- **Login restrito:** só entram e-mails `@humana.ai` e `@humana-ai.com`, a menos que `AUTH_ALLOWED_DOMAINS` diga outra coisa.
