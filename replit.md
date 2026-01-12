# Sol Tech Energia

Sistema web completo para gestão de faturas e créditos de energia solar.

## Visão Geral

A plataforma permite:
- Cadastro de usinas solares geradoras de energia
- Gestão de clientes e unidades consumidoras
- Upload e processamento de faturas da concessionária
- Geração automática de faturas com desconto
- Acompanhamento de geração mensal por usina
- Relatórios financeiros (lucro, economia, saldo kWh)
- Logs de auditoria de todas as ações

## Arquitetura

### Stack Tecnológica
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn/ui
- **Backend**: Express.js + TypeScript
- **Banco de Dados**: PostgreSQL (Neon) + Drizzle ORM
- **Autenticação**: Replit Auth (OIDC)

### Estrutura de Pastas
```
├── client/src/
│   ├── components/     # Componentes reutilizáveis
│   ├── pages/          # Páginas da aplicação
│   ├── hooks/          # Custom hooks (useAuth, useToast)
│   └── lib/            # Utilitários (queryClient, utils)
├── server/
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # DatabaseStorage class
│   ├── db.ts           # Conexão PostgreSQL
│   └── replit_integrations/  # Módulos de autenticação
├── shared/
│   ├── schema.ts       # Modelos Drizzle + tipos TypeScript
│   └── models/auth.ts  # Modelos de autenticação
```

## Modelos de Dados

1. **usinas** - Plantas geradoras de energia solar
2. **clientes** - Clientes com unidades consumidoras vinculadas a usinas
3. **faturas** - Faturas da concessionária processadas
4. **geracao_mensal** - Registros mensais de geração por usina
5. **audit_logs** - Logs de auditoria de todas as ações
6. **user_profiles** - Perfis de usuário com roles (admin/operador)

## Roles de Usuário

### Operador
- Cadastrar usinas e clientes
- Upload e processamento de faturas
- Registrar geração mensal

### Administrador
- Todas as permissões do operador
- Visualizar relatórios financeiros
- Acessar logs de auditoria
- Gerenciar funções de usuários

## Comandos

```bash
npm run dev          # Inicia o servidor de desenvolvimento
npm run db:push      # Aplica migrações no banco de dados
```

## Endpoints da API

### Autenticação
- `GET /api/login` - Inicia fluxo de login
- `GET /api/logout` - Logout
- `GET /api/auth/user` - Usuário atual
- `GET /api/auth/profile` - Perfil do usuário (role)

### CRUD
- `/api/usinas` - CRUD de usinas
- `/api/clientes` - CRUD de clientes
- `/api/faturas` - CRUD de faturas
- `/api/geracao` - CRUD de geração mensal
- `/api/faturas/upload` - Upload de faturas PDF

### Admin Only
- `/api/relatorios` - Relatórios financeiros
- `/api/auditoria` - Logs de auditoria
- `/api/usuarios` - Gerenciamento de usuários

## Design

Sistema segue Material Design com cores solares (amarelo/laranja). Ver `design_guidelines.md` para especificações completas.
