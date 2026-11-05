# Solar Control

Sistema de controle de faturas e de geração de energia para a gestão de créditos das usinas da Sol Tech. Cada cliente recebe parte dos créditos de uma usina; o sistema lê a fatura da concessionária, calcula o desconto e gera a fatura do cliente. Tem versão web e app nativo para iPhone.

## O que faz

| Tela | Para quê |
|---|---|
| **Dashboard** | Lucro, receita, geração e economia do mês por usina, pendências e preço do kWh por faixa de contrato |
| **Faturas** | Upload do PDF da concessionária, leitura automática dos valores e fluxo de 5 etapas até o recebimento |
| **Clientes** | Saldo de créditos, consumo médio, contrato e histórico de faturas |
| **Usinas** | Geração real × prevista, lucro e clientes de cada usina |
| **Geração** | Geração mensal de cada usina |
| **Preços kWh** | Tarifa do mês, usada nos cálculos e na simulação |
| **Simulação** | Mostra a um cliente novo quanto ele economizaria, com PDF |
| **Relatórios, Auditoria, Usuários** | Relatórios configuráveis, histórico de alterações e controle de acesso |

Exportação e importação completas em Excel, e backup automático do Postgres.

## Stack

- **Web:** React + TypeScript (Vite, shadcn/ui, TanStack Query) e Express + Drizzle ORM sobre PostgreSQL
- **Login:** JWT com refresh token; papéis por organização
- **iPhone:** SwiftUI pela mesma API, compilado sem Mac com o [xtool](https://xtool.sh). Detalhes em [`ios/SolarControl/README.md`](ios/SolarControl/README.md)
- **Deploy:** Docker na VPS

## Rodar

```bash
npm install
cp .env.example .env     # DATABASE_URL, SESSION_SECRET, JWT_SECRET
npm run db:push
npm run dev
```

Com Docker: `docker compose up -d --build` (guia em [`docs/DOCKER_README.md`](docs/DOCKER_README.md)).

## Publicar uma versão

Uma tag `v*.*.*` dispara o [`release.yml`](.github/workflows/release.yml): gera a imagem Docker no GitHub Container Registry e atualiza a VPS. Commits no `main` não fazem deploy.

```bash
git tag v1.0.16 && git push origin v1.0.16
```

## Estrutura

```
client/src/pages/    telas
server/              API (routes.ts), cron, serviços (Excel, PDF, cálculo)
shared/schema.ts     tabelas: usinas, clientes, faturas, geracao_mensal, precos_kwh, audit_logs…
migrations/          migrations SQL
scripts/             backup, restore e limpeza de backups
ios/SolarControl/    app SwiftUI (SolarCore = regras e cliente HTTP)
docs/                Docker, export/import, diagnósticos de cálculo
```
