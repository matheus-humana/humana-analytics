# SEO e GEO como fonte

A aba **SEO** mostra notas do PageSpeed Insights e os achados da varredura do HTML. A aba **GEO** mostra o checklist de 0 a 10 e o tráfego de IA vindo do GA4. A coluna **Ações** lista esses achados. Sem `SITE_URL`, sem coleta ou sem resposta da API, a tela fica desconectada e mostra o erro real. Não há nota de exemplo.

O projeto medido é o site da Humana (`humana-website`). A URL não está no código: ela vem de `SITE_URL`.

## Variáveis

| Variável | Obrigatória | Função |
| --- | --- | --- |
| `SITE_URL` | sim | URL pública do site, com `http` ou `https`. Exemplo: `https://www.humana.ai`. |
| `PAGESPEED_API_KEY` | não | Chave da PageSpeed Insights API. Sem ela a chamada usa a cota anônima, que é baixa e pode responder 429. |
| `SEO_PAGES` | não | Páginas extras do PageSpeed, separadas por vírgula. Caminhos no mesmo host (`/en,/pt`) ou URLs absolutas desse host. A home é sempre `SITE_URL`. |
| `SEO_PAGESPEED_MAX` | não | Teto de chamadas PageSpeed por cadeia. Padrão `16`. Cada página gasta 2 (mobile e desktop). |
| `SEO_MAX_PAGES` | não | Teto de páginas HTML na varredura. Padrão `30`, entre 1 e 80. |
| `SEO_CONCURRENCY` | não | Buscas paralelas da varredura. Padrão `4`, entre 1 e 6. |
| `SEO_LINK_CHECKS` | não | Links internos fora da amostra que ainda são checados. Padrão `40`. |
| `AI_TRAFFIC_SOURCES` | não | Hosts de origem do GA4. Se vazio, a lista padrão é `chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`, `chat.mistral.ai`, `poe.com`, `you.com`, `phind.com`, `meta.ai`. |
| `CRON_SECRET` | sim na Vercel | A Vercel envia `Authorization: Bearer $CRON_SECRET`. |

Aplicar a migração antes da primeira coleta:

```bash
pnpm db:analytics:migrate
```

Isso cria `analytics.pagespeed_snapshots`, `analytics.crawl_snapshots`, `analytics.crawl_pages`, `analytics.site_findings` e `analytics.seo_runs`, e adiciona `pagespeed` e `crawl` ao enum de fontes.

## PageSpeed

Cada chamada pede Performance, Acessibilidade, Boas práticas e SEO, numa estratégia (mobile ou desktop).

| Métrica | Como entra |
| --- | --- |
| Notas 0–100 | `lighthouseResult.categories`. Categoria ausente fica nula, não vira 0. |
| LCP, CLS, INP | CrUX da URL (`field-url`) quando a API manda. Se `origin_fallback` ou só a origem tiver o vital, `field-origin`. Senão, laboratório do Lighthouse (`lab`). |
| CLS de campo | O percentil do CrUX vem multiplicado por 100 (0,10 chega como 10). A tela mostra o valor real. |
| Série | Uma linha por projeto, página, estratégia e dia UTC. Coletar de novo no mesmo dia atualiza a linha. |

A rota processa **uma página e uma estratégia por invocação** e dispara a próxima. O timeout da função é 60 segundos; a chamada do PageSpeed espera no máximo 50. Uma cota estourada (HTTP 429) interrompe a cadeia.

`SEO_PAGESPEED_MAX` limita quantas chamadas a cadeia faz. Com o padrão, são no máximo 8 páginas × 2 estratégias, cortadas em 16.

## Varredura

A varredura lê `robots.txt`, `sitemap.xml` (inclusive os `Sitemap:` do robots e índices, até 3 níveis) e `/llms.txt`. Depois busca a home, as páginas de `SEO_PAGES` e as URLs do sitemap, até `SEO_MAX_PAGES`, com a concorrência configurada. Ela lê o HTML da resposta e não executa JavaScript: um H1 que só aparece depois da hidratação conta como ausente. Se a home redireciona, o checklist de títulos e legibilidade usa o HTML final, e duas URLs que caem no mesmo endereço viram uma página só. A legibilidade usa `<main>`, senão `<article>`, senão `<body>`. O `<title>` não entra nessa conta. O orçamento da função é cerca de 45 segundos. Se o tempo acabar antes, o snapshot fica marcado como parcial e achados de páginas não visitadas **não** são resolvidos.

Cada achado tem gravidade, página e uma correção curta:

| Código | Gravidade | Regra |
| --- | --- | --- |
| `http_error` | crítico | Status fora de 2xx/3xx, ou falha de rede. |
| `missing_title`, `h1_missing`, `noindex` | crítico | Title vazio, nenhum H1, ou `noindex`. |
| `broken_internal_link` | crítico | Link interno com status 4xx/5xx. No máximo 25 por varredura. |
| `h1_multiple` | aviso | Mais de um H1. |
| `title_length` | aviso | Fora de 30–60 caracteres. |
| `missing_description`, `description_length` | aviso | Ausente, ou fora de 50–160 caracteres. |
| `duplicate_title`, `duplicate_description` | aviso | O mesmo texto em duas páginas desta varredura. Numa varredura parcial esses dois não são auto-resolvidos. |
| `missing_canonical`, `canonical_mismatch` | aviso | Sem canonical, ou canonical diferente da URL (barra final é ignorada). |
| `missing_hreflang`, `hreflang_invalid` | aviso | Sem alternate, ou alternate sem href. |
| `image_missing_alt` | aviso | `<img>` sem `alt` ou com `alt` vazio. |

## Checklist GEO

A nota é a soma dos pontos, dividida por 100, numa escala de 0 a 10. Os pesos somam 1000 pontos (10,0). A tela mostra peso, pontos ganhos e o motivo.

| Regra | Peso | Passa quando |
| --- | --- | --- |
| `/llms.txt` existe | 1,0 | HTTP 200, corpo não vazio e não é HTML. |
| `/llms.txt` válido | 1,0 | Além disso, pelo menos 40 caracteres e um título markdown (`# `) ou uma URL `http`. |
| Robôs de IA | 2,0 | Fração dos 7 robôs não bloqueados: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot. Sem `robots.txt`, nenhum está bloqueado. `Disallow:` vazio não bloqueia. O caminho mais longo vence; empate fica com `Allow`. |
| JSON-LD Organization | 0,75 | Alguma página varrida tem `@type` Organization. |
| JSON-LD WebSite | 0,75 | Idem, WebSite. |
| JSON-LD Product ou SoftwareApplication | 0,75 | Um dos dois tipos. |
| JSON-LD FAQPage | 0,75 | Tipo FAQPage. |
| Estrutura de títulos | 1,5 | Na home: 0,75 por um único H1 e 0,75 se não houver salto de nível (H2 para H4). |
| Legibilidade | 1,5 | No texto de `<main>` (ou `<article>`): 0,5 por pelo menos 120 palavras, 0,5 por pelo menos 2 frases, 0,5 se a média ficar entre 8 e 32 palavras. |

Uma regra que não ganha o peso inteiro vira um item na coluna Ações, com fonte GEO. Bloquear todos os robôs listados é crítico. O resto é aviso.

## Tráfego de IA

O card consulta o GA4 já conectado, no período selecionado (o mesmo `?period=` das outras abas, terminando ontem, exceto 24h). O total de `activeUsers` e `sessions` usa o filtro de origem, então o total de usuários não é a soma das linhas. Cada linha é o `sessionSource` que o GA4 devolveu. GA4 desconectado mostra o erro, sem zero inventado.

## Ações

O fingerprint é `fonte:código:página:qualificador`. A mesma coleta no mesmo dia não duplica a linha. Se a varredura seguinte olhou a página e o problema sumiu, `status` passa a `resolved` e `resolved_on` guarda o dia. Uma página que não entrou na amostra continua aberta.

Não há ação escrita por LLM.

## Cron e coleta manual

`vercel.json` agenda:

| Rota | Horário UTC | O que faz |
| --- | --- | --- |
| `GET /api/seo/crawl` | 08:20 | Varredura do dia. |
| `GET /api/seo/pagespeed` | 08:40 | Primeira página/estratégia que ainda não tem snapshot hoje, e encadeia o resto. |

`POST /api/seo/collect` grava a varredura e inicia o PageSpeed do zero (atualiza o dia). Quem está logado usa **Coletar agora** na aba SEO, na aba GEO ou em Data Sources. Sem secret e sem sessão a rota responde 401.

```bash
curl -sS -X POST "$APP_URL/api/seo/crawl" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -sS -X POST "$APP_URL/api/seo/pagespeed" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Na Vercel, defina `CRON_SECRET` e `SITE_URL`. A chave do PageSpeed fica em Project → Settings → Environment Variables. O cron só dispara em produção.

## Search Console

Fora desta etapa. A aba SEO deixa um card vazio, sem número.

## Chat

As ferramentas `get_seo_overview` e `get_geo_overview` leem os mesmos snapshots. O tráfego de IA da segunda ferramenta é a consulta ao GA4. Na ponte do Analytics Bot, o POST da pergunta inclui o objeto `seo` com notas, contagem de achados, nota GEO e tráfego de IA, ou `connected: false` e o erro.
