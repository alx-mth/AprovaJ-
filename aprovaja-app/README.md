# AprovaJÁ — Painel de Estudos para Concurso

Aplicação React standalone (fora do Claude), com dados salvos no `localStorage`
do navegador — funciona offline, sem backend, sem login.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

## Gerar build de produção

```bash
npm run build
```

Isso cria a pasta `dist/` com os arquivos estáticos prontos para publicar.
Para testar o build localmente antes de publicar:

```bash
npm run preview
```

## Publicar online (grátis)

### Vercel
1. Crie um repositório no GitHub e suba esta pasta.
2. Em vercel.com, clique em "New Project" e importe o repositório.
3. Framework preset: **Vite**. Não precisa mudar mais nada — clique em Deploy.

### Netlify
1. Suba o repositório no GitHub (ou arraste a pasta `dist/` depois do build
   direto no painel do Netlify, em "Deploys").
2. Se conectar pelo GitHub: build command `npm run build`, publish directory `dist`.

### GitHub Pages
1. Rode `npm run build`.
2. Publique o conteúdo da pasta `dist/` na branch `gh-pages` do repositório
   (pode usar o pacote `gh-pages` ou a aba Settings → Pages do GitHub).

## Sobre os dados

Todas as disciplinas, assuntos, questões, sessões de estudo e o ciclo de
estudos ficam salvos no `localStorage` do navegador, na chave `aprovaja-data`.
Isso significa:

- Os dados **persistem** entre visitas, mesmo fechando o navegador.
- Os dados ficam **atrelados a este navegador/dispositivo específico** — não
  sincronizam entre celular e computador, por exemplo.
- Limpar o cache/dados do site no navegador apaga o histórico salvo.
- Não há limite de sincronização entre dispositivos; se quiser isso no
  futuro, será necessário adicionar um backend (ex: Supabase, Firebase) para
  substituir as chamadas de `localStorage` por chamadas a um banco de dados.

## Estrutura

```
aprovaja-app/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx      # ponto de entrada
│   ├── App.jsx        # todo o sistema (dashboard, disciplinas, ciclo, etc.)
│   └── index.css      # reset básico de página
```
