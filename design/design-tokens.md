# SB Notas — Design Tokens

Fonte única de verdade da identidade visual: **dark theme em tons de preto/cinza com destaque
em amarelo âmbar**. Estes tokens devem virar variáveis CSS / config do Tailwind na Fase 1.

## 1. Paleta

### Fundos e superfícies (preto → cinza)
| Token | Hex | Uso |
|---|---|---|
| `bg-base` | `#0A0A0B` | Fundo raiz do app (quase preto) |
| `bg-surface` | `#141417` | Superfície de painéis / sidebar |
| `bg-elevated` | `#1C1C21` | Cards de lembrete, modais |
| `bg-elevated-2` | `#26262E` | Hover de card, estados elevados |
| `border` | `#2E2E38` | Bordas e divisores |
| `border-strong`| `#3A3A46` | Bordas em foco/seleção |

### Texto (cinza claro)
| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#F4F4F5` | Títulos e texto principal |
| `text-secondary`| `#A1A1AA` | Texto de apoio |
| `text-muted` | `#71717A` | Placeholders, metadados |
| `text-on-accent`| `#0A0A0B` | Texto **sobre** o amarelo (preto, alto contraste) |

### Amarelo — cor de destaque (accent)
| Token | Hex | Uso |
|---|---|---|
| `accent` | `#FACC15` | Cor primária de destaque (botões, foco, marca) |
| `accent-hover` | `#EAB308` | Hover/pressed do accent |
| `accent-soft` | `#FDE047` | Realces claros, brilho de "chamativo" |
| `accent-glow` | `rgba(250,204,21,.35)` | Sombra/halo de destaque (glow do lembrete) |
| `accent-surface`| `rgba(250,204,21,.10)` | Fundo sutil amarelado (chips, badges) |

### Cores semânticas
| Token | Hex | Uso |
|---|---|---|
| `success` | `#22C55E` | Concluído |
| `warning` | `#F59E0B` | Importante (âmbar, harmoniza com o accent) |
| `danger` | `#EF4444` | Urgente / excluir |
| `info` | `#60A5FA` | Informativo |

### Cores de card para os lembretes (customização por nota)
Paleta enxuta que o usuário escolhe por lembrete — todas legíveis sobre fundo escuro:
`#FACC15` (amarelo, padrão) · `#F59E0B` (âmbar) · `#EF4444` (vermelho) · `#22C55E` (verde) ·
`#60A5FA` (azul) · `#A78BFA` (roxo) · `#F472B6` (rosa) · `#94A3B8` (cinza neutro).
Os cards usam a cor como **borda/faixa/acento**, não como fundo inteiro (mantém o tema escuro).

## 2. Tipografia
- **Fonte:** sans-serif geométrica moderna — `Inter` (recomendada) ou `Geist`. Fallback: system-ui.
- Escala (rem): `xs .75` · `sm .875` · `base 1` · `lg 1.125` · `xl 1.25` · `2xl 1.5` · `3xl 1.875` · `4xl 2.25`.
- Pesos: 400 (corpo), 500 (labels), 600 (títulos), 700 (destaques/números).
- Números de contagem/tempo podem usar `tabular-nums`.

## 3. Raio, sombra, espaçamento
- **Raio:** `sm 8px` · `md 12px` · `lg 16px` · `xl 20px` · `full 9999px`. Cards de lembrete: `lg`.
- **Sombra:** suave e escura; o **glow amarelo** (`accent-glow`) é reservado para o estado
  "chamativo/disparando".
  - `shadow-card`: `0 2px 8px rgba(0,0,0,.4)`
  - `shadow-pop`: `0 12px 40px rgba(0,0,0,.6)` (overlay de disparo)
  - `glow-alert`: `0 0 0 2px #FACC15, 0 0 32px rgba(250,204,21,.45)`
- **Espaçamento:** grade base de 4px (`1=4px … 4=16px … 6=24px … 8=32px`).

## 4. Movimento (animações "chamativas")
- **Padrão da UI:** transições 150–200ms, `ease-out`. Nada exagerado no uso normal.
- **Disparo do lembrete (o "wow"):** entrada com escala + fade (200–300ms), seguida de um
  **pulso do glow amarelo** (2–3 batidas) para chamar atenção; urgência 2 adiciona um leve
  *shake* inicial. Respeitar `prefers-reduced-motion` (versão sem pulso/shake).
- Curvas: entrada `cubic-bezier(.16,1,.3,1)`; saída `ease-in`.

## 5. Acessibilidade
- Contraste mínimo AA: texto sobre fundos escuros ≥ 4.5:1; texto preto sobre amarelo `accent`
  atende com folga.
- Nunca comunicar urgência **só** pela cor — combinar com ícone/label ("Urgente").
- Foco visível sempre (anel `accent`), navegável por teclado (desktop/web).
- Alvos de toque ≥ 44px no Android.

## 6. Exemplo — variáveis CSS
```css
:root {
  --bg-base:#0A0A0B; --bg-surface:#141417; --bg-elevated:#1C1C21; --bg-elevated-2:#26262E;
  --border:#2E2E38; --border-strong:#3A3A46;
  --text-primary:#F4F4F5; --text-secondary:#A1A1AA; --text-muted:#71717A; --text-on-accent:#0A0A0B;
  --accent:#FACC15; --accent-hover:#EAB308; --accent-soft:#FDE047;
  --accent-glow:rgba(250,204,21,.35); --accent-surface:rgba(250,204,21,.10);
  --success:#22C55E; --warning:#F59E0B; --danger:#EF4444; --info:#60A5FA;
  --radius-lg:16px; --shadow-card:0 2px 8px rgba(0,0,0,.4);
}
```
