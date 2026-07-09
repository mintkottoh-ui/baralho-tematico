# 🃏 Baralho de Interesses

PWA pessoal, mobile-first, para variar os "encaixes livres" do dia (almoço,
descompressão pós-trabalho, pós-estudo) usando um baralho rotativo de
interesses — sem repetir nenhum até esgotar todos os outros.

HTML + CSS + JS puro, sem frameworks e sem backend. Todos os dados ficam
salvos no `localStorage` do navegador/celular.

## Como funciona

- O baralho começa com 15 interesses (Videogames, Anime, Mangá, Canto,
  Microcontrolador, Catequese, Bíblia, Xadrez, Literatura, Literatura
  Católica, Filosofia, Programação, AI, Idioma (Francês), Latim).
- Todo dia você escolhe manualmente um item disponível como "tema do dia".
  Ele fica marcado como usado até o ciclo fechar.
- Quando todos os itens forem usados, o ciclo reseta automaticamente e o
  app comemora o fechamento (com contador de ciclos completos no
  Histórico).
- **Smash** é especial: fica fora do ciclo, sempre disponível, com seu
  próprio contador de sessões — não compete pelas vagas do baralho.
- Gerencie o baralho (adicionar/editar/excluir itens) na tela de
  engrenagem ⚙️, e veja o histórico de escolhas, ciclos e sessões de Smash
  na tela de pergaminho 📜.

## Estrutura do projeto

```
baralho-tematico/
├── index.html          # marcação e as 3 telas (Hoje / Gerenciar / Histórico)
├── css/style.css        # visual dark-first, mobile-first
├── js/app.js             # estado, regras de negócio e renderização
├── manifest.json         # metadados de instalação do PWA
├── service-worker.js     # cache offline dos arquivos estáticos
├── icons/                 # ícones em vários tamanhos (+ maskable + apple-touch)
└── README.md
```

## Rodar localmente para testar

Qualquer servidor HTTP estático funciona — é necessário servir os arquivos
por `http://` (não abrir o `index.html` direto com `file://`), porque o
service worker exige um contexto seguro.

**Opção 1 — Python (já vem em quase todo sistema):**

```bash
cd baralho-tematico
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

**Opção 2 — Node (se preferir):**

```bash
cd baralho-tematico
npx serve -l 8000
```

**Opção 3 — VS Code:** extensão "Live Server", clique em "Go Live".

## Instalar no celular

### A partir do servidor local (mesma rede Wi-Fi)

1. Rode o servidor local como acima (`python3 -m http.server 8000`).
2. Descubra o IP local do computador na rede Wi-Fi:
   - macOS/Linux: `ifconfig | grep inet` (ou `ip addr`)
   - Windows: `ipconfig`
3. No celular (conectado na **mesma rede Wi-Fi**), abra o navegador e
   acesse `http://SEU_IP:8000` (ex: `http://192.168.0.42:8000`).
4. **Android (Chrome):** toque no menu (⋮) → "Adicionar à tela inicial"
   (ou vai aparecer um banner automático de instalação).
5. **iOS (Safari):** toque no ícone de compartilhar (□↑) → "Adicionar à
   Tela de Início".

O app passa a abrir em tela cheia, com ícone próprio, e funciona offline
depois da primeira visita (o service worker já deixou tudo em cache).

### Deploy gratuito (acessar de qualquer lugar, sem depender do Wi-Fi)

Como é só HTML/CSS/JS estático, qualquer um destes serve, todos com plano
gratuito:

**GitHub Pages**

1. Suba os arquivos deste projeto para um repositório no GitHub (a raiz do
   repo deve conter o `index.html`).
2. Nas configurações do repositório: **Settings → Pages → Source**,
   selecione a branch (ex: `main`) e a pasta `/root`.
3. Aguarde alguns minutos; o GitHub fornece uma URL do tipo
   `https://SEU_USUARIO.github.io/SEU_REPO/`.
4. Abra essa URL no celular e instale como descrito acima.

**Netlify**

1. Crie uma conta em netlify.com.
2. "Add new site" → "Deploy manually" → arraste a pasta do projeto (ou
   conecte o repositório do GitHub para deploy automático a cada push).
3. Netlify gera uma URL `https://SEU-APP.netlify.app`.

**Vercel**

1. Crie uma conta em vercel.com.
2. "Add New… → Project" → importe o repositório do GitHub (ou use a CLI
   `npx vercel` dentro da pasta do projeto).
3. Como é um projeto estático, o Vercel detecta automaticamente e não
   precisa de build command.

Em qualquer uma dessas opções, o app é servido via HTTPS, o que é
necessário para o service worker funcionar corretamente e para o prompt de
instalação aparecer no Android.

## Dados e privacidade

Tudo fica salvo apenas no `localStorage` do navegador em que você abriu o
app — não há servidor, conta ou sincronização entre dispositivos. Se você
limpar os dados do navegador/app ou trocar de aparelho, o histórico local
se perde (não há backup automático).

## Notas técnicas

- Estado inteiro (itens do baralho, tema do dia, histórico, ciclos,
  sessões de Smash) fica em um único objeto JSON no `localStorage`, sob a
  chave `baralho-interesses:v1`.
- Tema claro/escuro: dark por padrão; o botão 🌙/☀️ no topo alterna e
  lembra sua preferência (chave `baralho-interesses:theme`).
- O service worker faz cache "stale-while-revalidate" simples dos arquivos
  estáticos, então o app abre instantaneamente e funciona sem internet
  depois da primeira visita. Ao atualizar os arquivos do app, mude
  `CACHE_VERSION` em `service-worker.js` para forçar a atualização do
  cache nos dispositivos já instalados.
