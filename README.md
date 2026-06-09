# GameMatch

GameMatch é uma aplicação web para descobrir jogos por swipe, salvar favoritos e encontrar matches em grupo. A proposta é transformar a escolha de jogos em uma experiência rápida, visual e compartilhável.

**Demo:** [gamematch-one.vercel.app](https://gamematch-one.vercel.app)

## Por que existe

Escolher um jogo em grupo costuma virar uma conversa longa, cheia de sugestões soltas. O GameMatch organiza essa decisão em uma dinâmica simples: cada pessoa curte ou passa jogos, o sistema registra preferências e ajuda o grupo a encontrar opções em comum.

## Funcionalidades

- Descoberta de jogos em cards com interação de swipe.
- Busca e filtros para explorar títulos.
- Lista de jogos curtidos e histórico de escolhas.
- Salas em grupo para comparar preferências.
- Compartilhamento de jogos e resultado dos matches.
- Autenticação e persistência de dados com Firebase.
- Interface responsiva com foco em uso mobile.

## Stack

- React
- Vite
- Firebase Auth
- Firestore
- RAWG API
- Vitest
- Vercel

## Destaques técnicos

- Componentização da interface para manter cards, listas, salas e estados isolados.
- Integração com API externa de jogos para alimentar a descoberta.
- Persistência de favoritos e salas usando Firebase.
- Fluxo preparado para uso individual e colaboração em grupo.
- Build e deploy configurados para Vercel.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run build
npm run test
npm run lint
npm run format:check
```

## Variáveis de ambiente

Use `.env.example` como base para configurar Firebase e RAWG API no ambiente local.

```bash
cp .env.example .env.local
```

## Status

Projeto público de portfólio, com versão online e estrutura pronta para evoluir com novos filtros, ranking de matches e melhorias de onboarding.
