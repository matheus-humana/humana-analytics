# Humana Analytics: especificação do layout de painéis (referência: Okara AI CMO)

Versão 1, 25/09/2026. Autor: Analytics Bot, a pedido do Matheus.
Escopo: tráfego, SEO e GEO. Social, conteúdo e agentes pagos do Okara ficam fora.

## 1. Objetivo

Trocar o modelo de "várias páginas" por uma tela única de trabalho, com painéis lado a lado que abrem, fecham e mudam de largura. O chat fica sempre visível. As regras da Fase A continuam valendo:
- só dados reais, sempre com fonte e período;
- só métricas agregadas, sem PII;
- bilíngue PT-BR e EN.

## 2. Estrutura da tela

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Barra superior: projeto (Humana Site) · Status Log (recolhível) · usuário │
├───────────┬──────────────────────┬──────────────────┬────────────────────┤
│ Contexto  │ Analytics            │ Ações / Feed     │ Chat               │
│ (recolhe) │ [Tráfego|SEO|GEO]    │ (recolhe)        │ (fixo, sempre      │
│           │ (recolhe)            │                  │  visível)          │
└───────────┴──────────────────────┴──────────────────┴────────────────────┘
```

### 2.1 Barra superior
- Seletor de projeto. O schema já é multi-project; o segundo produto open source entra depois.
- **Status Log**: uma linha que mostra o último evento, por exemplo "GA4 sincronizado 10:20" ou "Auditoria SEO rodou 22/09". Ao expandir, vira um terminal com o histórico (sync, erros de conexão, pergunta enviada ao Analytics Bot, resposta recebida). Serve para ver de onde veio cada dado.
- Menu do usuário (Auth.js).

### 2.2 Colunas
| Coluna | Conteúdo | Recolhível | Faixa quando recolhida |
|---|---|---|---|
| Contexto | Dados do projeto (site, idiomas, público), documentos, conexões (GA4, Clarity, Vercel, PageSpeed, Search Console) com status | Sim | Ícones: Projeto, Docs, Conexões |
| Analytics | Abas Tráfego, SEO, GEO (seção 3) | Sim | Mini indicadores: usuários 7d, nota SEO, nota GEO |
| Ações | Itens que precisam de atenção, gerados pelas auditorias (seção 4) | Sim | Contador de itens abertos |
| Chat | Chat com o Analytics Bot (ponte já em produção) | Não | (não recolhe) |

Comportamento:
- Seta `<` no cabeçalho recolhe a coluna numa faixa de ~48 px com os mini indicadores. Clicar na faixa expande de volta.
- As colunas abertas dividem o espaço que sobra. Com duas recolhidas, as outras duas ficam meio a meio.
- Divisores arrastáveis mudam a largura. Guardar larguras mínimas (sugestão: Analytics 360 px, Chat 360 px).
- Reordenar colunas arrastando o cabeçalho é opcional (Fase 2).
- Estado (abertas/fechadas, larguras, aba ativa) salvo por usuário (localStorage na Fase A; Postgres depois, se fizer falta).
- Telas abaixo de ~1024 px: uma coluna por vez, com botões no topo para trocar. O chat vira um botão flutuante.

## 3. Coluna Analytics

Regras comuns a todas as abas:
- Seletor de período: 7 dias / 30 dias (padrão 7). Comparação com o período anterior de mesmo tamanho.
- Todo card mostra no rodapé a fonte e o período exato, por exemplo "GA4 · 18–24/09/2026 · vs 11–17/09".
- **Definição fixa de métrica**: "usuários" = `activeUsers` do GA4, período terminando **ontem** (dia completo). A mesma definição vale no card e no chat, para a mesma pergunta nunca dar dois números.
- Fonte não conectada: estado vazio com o motivo e o botão de conectar. Nunca mostrar um número de exemplo.

### 3.1 Aba Tráfego (GA4, já conectado)
1. Gráfico de linha/área de usuários ativos por dia.
2. Seis cards com variação percentual: Sessões, Visitantes recorrentes, Eventos-chave, Duração média da sessão, Taxa de engajamento, Taxa de rejeição.
3. **De onde vieram**: barras por canal (Organic Search, Direct, Referral, Social, Unassigned...) mais a tabela "Principais origens" (origem, usuários ativos).
4. **Páginas de entrada**: tabela (página, usuários ativos). Separar `/pt` e `/en`, porque o site é bilíngue.
5. Opcional, com Clarity: card de "sessões com rage click / dead click" e link para o heatmap da página.
6. Opcional, com Vercel: card de Web Analytics/Speed Insights, se a API permitir.

Os eventos-chave ficam zerados até existirem os eventos Demo / Diagnóstico / Contato (pendência com o Admin do Site). O card deve dizer "sem eventos-chave configurados" em vez de só mostrar 0.

### 3.2 Aba SEO
Fontes: **PageSpeed Insights API** (gratuita, com chave de API) e um **crawler próprio** leve que lê o HTML das páginas principais.
1. **Notas Lighthouse** (mobile e desktop): Performance, Acessibilidade, Boas práticas, SEO, em anéis de 0 a 100.
2. **Core Web Vitals**: LCP, FCP, TBT, CLS, com status passa / atenção / falha e alternância desktop/mobile. Nota: "dados de laboratório; usuários reais podem variar". Se a API trouxer dados de campo (CrUX), mostrar ao lado.
3. **Saúde da página** (tabela sinal/valor): tamanho do title, tamanho da meta description, quantidade de H1, canonical, `lang`, hreflang PT/EN, viewport (mobile-friendly), dados estruturados.
4. **Problemas**: lista classificada como Crítico ou Aviso, com a página afetada e uma explicação de uma linha. Cada problema gera um item na coluna Ações.
5. "Última auditoria: data" e botão "Rodar agora". Auditoria automática semanal.
6. Search Console (Fase 2): cliques, impressões, CTR, posição média, principais consultas. Até lá, card vazio com "conectar Search Console".

### 3.3 Aba GEO (prontidão para ser citado por IAs)
Fonte: crawler próprio.
1. **Checklist com nota N/10**: Schema.org, meta description, estrutura de títulos, profundidade de conteúdo, canonical, `robots.txt`, `llms.txt`, `sitemap.xml`, atributo de idioma, legibilidade. Cada item marcado como OK ou Corrigir.
2. **Arquivos do site**: `robots.txt`, `llms.txt`, `sitemap.xml`, com tamanho e status (encontrado/ausente). Se possível, dizer se o `robots.txt` bloqueia robôs de IA (GPTBot, ClaudeBot, PerplexityBot).
3. Menções em respostas de IA e comparação com concorrentes ficam para depois. Exigem consultas pagas ou coleta própria e não entram na Fase A.

### 3.4 Fora do escopo agora
- **Links/backlinks**: exige API paga (Ahrefs, Semrush, DataForSEO). Reavaliar com orçamento.

## 4. Coluna Ações

- Lista de cards gerados pelas auditorias de SEO/GEO e por quedas fortes de tráfego (sugestão: queda acima de 20% vs período anterior).
- Cada card tem título, severidade, origem (SEO, GEO ou Tráfego), data e dois botões: "Perguntar no chat" (abre o chat com o contexto do item) e "Marcar como resolvido".
- Seções: "Precisam de atenção" e "Resolvidos".
- Sem correções automáticas no site. Correções passam pelo Admin do Site, com o OK do Matheus.

## 5. Chat e painéis juntos

- Quando a resposta do chat cita um dado, mostrar um link "ver no painel" que abre a aba e o card correspondentes.
- Um botão "perguntar sobre isto" em cada card manda para o chat a métrica, o período e a fonte daquele card.
- A resposta vem pela ponte do Analytics Bot, que já funciona em produção, ou pelo LLM interno quando configurado.

## 6. Dados e backend

| Dado | Fonte | Frequência | Onde fica |
|---|---|---|---|
| Tráfego | GA4 Data API | sob demanda com cache (~1 h) | Postgres (cache agregado) |
| Comportamento | Clarity API | diária | Postgres |
| Lighthouse / CWV | PageSpeed Insights API | semanal e botão manual | Postgres (histórico de auditorias) |
| SEO on-page / GEO | crawler próprio (fetch do HTML, robots, sitemap, llms) | semanal e manual | Postgres |
| Search Console | GSC API (Fase 2) | diária | Postgres |

Tabelas novas sugeridas: `seo_audits` (projeto, data, estratégia mobile/desktop, notas, CWV em JSON) e `site_issues` (projeto, auditoria, tipo, severidade, página, status aberto/resolvido).

## 7. Critérios de aceite (Fase A deste layout)

1. Tela única com quatro colunas. Contexto, Analytics e Ações recolhem e expandem, o chat nunca recolhe, e o estado persiste ao recarregar.
2. A aba Tráfego mostra os mesmos números que o GA4 para o mesmo período e a mesma métrica (conferência manual em 3 métricas).
3. A aba SEO mostra notas reais do PageSpeed para a URL de produção do site da Humana e a data da auditoria.
4. A aba GEO detecta corretamente a presença ou ausência de `robots.txt`, `sitemap.xml` e `llms.txt`.
5. Nenhum card mostra número sem fonte e período. Fonte desconectada mostra estado vazio.
6. Interface em PT-BR e EN.
7. Funciona em 1280 px de largura e tem modo de uma coluna abaixo de 1024 px.

## 8. Ordem sugerida
1. Layout de colunas e persistência de estado (sem dados novos, reaproveitando os cards de GA4 atuais).
2. Aba Tráfego completa, com definição fixa de métricas.
3. PageSpeed e aba SEO.
4. Crawler, aba GEO e coluna Ações.
5. Search Console.
