# GitHub como fonte

O repositório do lançamento open source entra como **projeto e fonte próprios**. Ele não é gravado na property do site (GA4, Clarity, Vercel). O nome do repositório vem só de `GITHUB_REPO`. O código não fixa um repositório.

A aba **GitHub** na coluna Analytics mostra apenas snapshots gravados. Sem token, sem permissão ou sem coleta, a tela fica desconectada e mostra o erro real (por exemplo `GitHub 403: Must have push access to repository`). Não há números de exemplo.

## Variáveis

| Variável | Obrigatória | Função |
| --- | --- | --- |
| `GITHUB_TOKEN` | sim | Token da API REST. Fica só no servidor. |
| `GITHUB_REPO` | sim | `owner/name`. Vários repositórios: separe por vírgula ou espaço (`owner/a, owner/b`). Cada um vira um projeto `github-owner-name`. |
| `CRON_SECRET` | sim na Vercel | A Vercel envia `Authorization: Bearer $CRON_SECRET` no cron. |
| `GITHUB_CRON_SECRET` | não | Alias aceito na mesma rota, para um curl manual. Na Vercel use `CRON_SECRET`. |

Aplicar a migração antes da primeira coleta:

```bash
pnpm db:analytics:migrate
```

Isso cria `analytics.github_traffic_days` e `analytics.github_repo_days` e adiciona `github` ao enum de fontes.

## Escopo mínimo do token

A API de tráfego exige push/admin no repositório. Um token sem esse acesso recebe 403 e a UI mostra essa mensagem.

Fine-grained (recomendado), com acesso só ao repositório do lançamento:

- **Administration: Read** — views, clones, referrers e paths
- **Contents: Read** — releases e `download_count` dos assets
- **Metadata: Read** — já vem no token; estrelas, forks e watchers (`subscribers_count`)

Classic: escopo **`repo`**. Para repositório privado isso também cobre conteúdo e releases.

Não grave o token no repositório. Na Vercel: Project → Settings → Environment Variables.

## O que é coletado

| Métrica | Origem | Como entra no histórico |
| --- | --- | --- |
| Views e clones, totais e únicos, por dia | `GET /repos/{owner}/{repo}/traffic/views` e `/traffic/clones` | Uma linha por repositório e dia UTC. Coletar de novo no mesmo dia atualiza a linha. |
| Únicos em 14 dias | Campos `count` e `uniques` desses endpoints | Gravados no snapshot do dia. **Não são a soma dos únicos diários.** |
| Referrers e paths | `/traffic/popular/referrers` e `/traffic/popular/paths` | Janela móvel de 14 dias, gravada junto com o dia da coleta. |
| Estrelas, forks, watchers | `GET /repos/{owner}/{repo}` | Contador do dia. Watchers = `subscribers_count`. `watchers_count` repete estrelas e é ignorado. |
| Downloads | `download_count` de cada asset em `GET /repos/{owner}/{repo}/releases` | Contador do dia, por asset e somado. |

Não gravamos login de quem deu estrela, fez fork ou baixou. Referrer é o nome do site que o GitHub devolve (por exemplo Google), não uma pessoa.

O GitHub **não publica** a contagem do botão "Download ZIP" do código-fonte. Clones medem `git clone`. Downloads medem assets de release. Não há outra fonte oficial de downloads do repositório que valha a pena somar aqui.

## Limite de 14 dias

Views, clones, referrers e paths saem da API só para os **últimos 14 dias**, e a rota de tráfego exige permissão de push/admin. Por isso o cron grava um snapshot por dia. O histórico além de 14 dias existe só para os dias em que a coleta rodou. Um dia sem snapshot não é preenchido com zero.

Estrelas, forks, watchers e downloads são contadores atuais. Cada coleta grava o valor daquele dia para montar a série.

## Cron e coleta manual

`vercel.json` agenda `GET /api/github/collect` **de hora em hora**, no minuto 15 (`15 * * * *`). O GitHub libera clones e views com atraso (de horas a 1–2 dias); a coleta horária grava esses dias assim que aparecem na API. Cada coleta faz poucas chamadas e sobrescreve o snapshot do dia, sem duplicar linhas.

Na Vercel:

1. Defina `CRON_SECRET` (a plataforma manda esse valor no header; sem ele o cron leva 401).
2. O cron só dispara em produção, no plano que inclui Cron Jobs.
3. Confira em Project → Settings → Cron Jobs se a rota aparece.

Disparo manual, com o mesmo secret:

```bash
curl -sS -X POST "$APP_URL/api/github/collect" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Quem está logado no app também pode usar **Coletar agora** na aba GitHub ou **Collect snapshot** em Data Sources. Sem secret e sem sessão a rota responde 401.

## Chat

As ferramentas `get_github_overview`, `get_github_traffic`, `get_github_referrers` e `get_github_downloads` leem os mesmos snapshots. Na ponte do Analytics Bot, o POST da pergunta inclui o objeto `github` com esses agregados, ou `connected: false` e o erro, sem números inventados.
