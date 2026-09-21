# Design System — Humana AI

Identidade visual oficial da **Humana Artificial Intelligence**.

Referência visual completa: [`reference/brand-identity-sheet.png`](./reference/brand-identity-sheet.png)

Tokens CSS: [`tokens.css`](./tokens.css) · Inventário de arquivos: [`ASSETS.md`](./ASSETS.md)

---

## 1. Marca

| Elemento | Uso |
| --- | --- |
| **Logotipo** (`humana` + `ARTIFICIAL INTELLIGENCE`) | Header, rodapé, capas, PDFs, e-mails |
| **Símbolo “h”** | Favicon, avatar, ícone de app, espaços apertados |

### Variantes

| Variante | Quando usar | Arquivos |
| --- | --- | --- |
| **Positiva (preto)** | Fundos claros (`#ffffff`, `#f1f1f1`, `#cccccc`) | `logos/Logo preto Humana.png`, `icons/Símbolo preto Humana.png` |
| **Negativa (branco)** | Fundos escuros (`#000000`, `#151515`, `#1c2331`) | `logos/LogobrancoHumana.png` / `.svg`, `icons/icone_branco-Humana.png` |

### Regras de logo

- Não distorcer, não rotacionar, não recolorir fora das variantes oficiais.
- Manter área de respiro mínima ≈ altura do “h” do símbolo em todos os lados.
- Em fundo intermediário (foto/gradiente), preferir a variante com **maior contraste**; se ambíguo, usar negativo sobre overlay escuro.
- Não colocar o símbolo “h” e o wordmark completo lado a lado como se fossem duas marcas.

### Caminhos no site (produção)

Os assets canônicos em runtime ficam em `/public`. Esta pasta é a **fonte de regras + cópia de referência**.

| Asset | Path público |
| --- | --- |
| Logo branca | `/LogobrancoHumana.png` · `/LogobrancoHumana.svg` |
| Logo preta | `/Logo preto Humana.png` |
| Wordmark | `/humana-logo-wordmark.png` |
| Ícone branco | `/icone_branco-Humana.png` |
| Símbolo preto | `/Símbolo preto Humana.png` |
| Favicon | `/favicon/favicon.svg` |

---

## 2. Tipografia

| Papel | Fonte | Uso |
| --- | --- | --- |
| **Títulos e destaques** | **Poppins** | H1–H3, CTAs, labels de destaque, nav |
| **Textos / corpo** | **Montserrat** | Parágrafos, listas, formulários, legendas |

### Pesos sugeridos

- Poppins: `400` (regular), `500` (medium), `600` (semibold), `700` (bold)
- Montserrat: `400` (corpo), `500` (ênfase leve), `600` (subtítulos curtos)

### Hierarquia

1. Um título dominante por seção (Poppins).
2. Uma frase de apoio curta (Montserrat).
3. Corpo em Montserrat com entrelinha confortável (~1.5–1.65).

### Nota de implementação (site atual)

O site Next.js carrega **Poppins** globalmente (`--font-poppins` em `src/app/[locale]/layout.tsx`). Montserrat ainda não está wired como fonte de corpo. Em trabalho novo de UI, preferir alinhar ao brand sheet: Poppins nos títulos, Montserrat no corpo (via `next/font` + `--humana-font-body` em `tokens.css`).

---

## 3. Paleta de cores

| Token | Hex | Papel |
| --- | --- | --- |
| `--humana-black` | `#000000` | Fundo dark, texto em light |
| `--humana-ink` | `#151515` | Superfície escura / texto forte |
| `--humana-white` | `#ffffff` | Fundo light, texto em dark |
| `--humana-surface` | `#f1f1f1` | Fundo suave / cards leves |
| `--humana-silver` | `#cccccc` | Bordas, divisores, disabled |
| `--humana-gray` | `#5f5f5f` | Texto secundário |
| `--humana-blue` | `#6074c8` | **Cor primária de marca** (CTAs, links, acentos) |
| `--humana-blue-soft` | `#8E9BD6` | Hover suave, chips, destaques secundários |
| `--humana-navy` | `#1C2331` | Blocos navy, contraste alto, fundos institucionais |

### Regras de cor

- Primário de ação = `#6074c8`. Não substituir por roxo genérico ou gradients “AI default”.
- Em UI escura: texto `#ffffff` / `#f1f1f1`; acento `#6074c8` ou `#8E9BD6`.
- Em UI clara: texto `#000000` / `#151515`; texto muted `#5f5f5f`.
- `#1C2331` para blocos densos (não usar como texto pequeno sobre preto).

Exemplo Tailwind ad-hoc (já comum no código): `text-[#6074c8]`, `bg-[#1C2331]`. Preferir migrar gradualmente para `tokens.css`.

---

## 4. Tom visual (UI)

- Profissional, tech, enterprise — sem hype visual (glows excessivos, pills neon, purple-on-white).
- Preferir composição limpa: marca forte, um headline, um apoio, um CTA.
- Ícones de conteúdo (home, camadas, etc.) não fazem parte deste núcleo de marca; ficam em `/public` por feature.
- Alinhar copy e vocabulário com `.cursor/rules/humana-localization.mdc` e `humana-glossary.mdc`.

---

## 5. Checklist rápido

Antes de publicar uma tela/componente:

- [ ] Logo na variante correta para o fundo
- [ ] Títulos em Poppins; corpo em Montserrat (quando disponível)
- [ ] Acento principal `#6074c8`
- [ ] Sem recoloração arbitrária do “h”
- [ ] Tokens/hex alinhados a `tokens.css`
