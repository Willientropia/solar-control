# Sol Tech Energia - Guia de Instalação Docker (Windows)

## Pré-requisitos

1. **Docker Desktop para Windows**
   - Baixe em: https://www.docker.com/products/docker-desktop
   - Instale e reinicie o computador se necessário
   - Certifique-se de que o Docker está rodando (ícone na bandeja do sistema)

2. **Git** (opcional, para clonar o repositório)
   - Baixe em: https://git-scm.com/download/win

## Instalação

### Passo 1: Baixar o Projeto

Você pode baixar o projeto de duas formas:

**Opção A - Download direto do Replit:**
- No Replit, clique nos três pontos (...) no painel de arquivos
- Selecione "Download as zip"
- Extraia o arquivo ZIP em uma pasta de sua escolha

**Opção B - Clone via Git (se disponível):**
```bash
git clone <url-do-repositorio>
cd sol-tech-energia
```

### Passo 2: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
SESSION_SECRET=sua-chave-secreta-aqui-mude-isso
DATABASE_URL=postgresql://postgres:postgres@db:5432/soltech
```

### Passo 3: Iniciar a Aplicação

Abra o PowerShell ou Terminal na pasta do projeto e execute:

```bash
docker-compose up -d --build
```

Isso irá:
- Construir a imagem Docker da aplicação
- Iniciar o banco de dados PostgreSQL
- Iniciar a aplicação na porta 5000

### Passo 4: Acessar a Aplicação

Abra o navegador e acesse:
```
http://localhost:5000
```

## Comandos Úteis

```bash
# Ver logs da aplicação
docker-compose logs -f app

# Ver logs do banco de dados
docker-compose logs -f db

# Parar a aplicação
docker-compose down

# Parar e remover todos os dados (banco incluído)
docker-compose down -v

# Reiniciar a aplicação
docker-compose restart

# Reconstruir após alterações no código
docker-compose up -d --build
```

## Migração do Banco de Dados

Na primeira execução, você precisa criar as tabelas do banco:

```bash
docker-compose exec app npm run db:push
```

## Solução de Problemas

### Porta 5000 já em uso
Se a porta 5000 estiver ocupada, edite o `docker-compose.yml` e mude `"5000:5000"` para `"3000:5000"`, depois acesse `http://localhost:3000`.

### Erro de conexão com banco de dados
Aguarde alguns segundos após o `docker-compose up` para o PostgreSQL inicializar completamente.

### Erro de permissão no Windows
Execute o PowerShell como Administrador.

## Backup do Banco de Dados

```bash
# Criar backup
docker-compose exec db pg_dump -U postgres soltech > backup.sql

# Restaurar backup
docker-compose exec -T db psql -U postgres soltech < backup.sql
```

## Estrutura de Pastas

```
sol-tech-energia/
├── Dockerfile              # Configuração do container
├── docker-compose.yml      # Orquestração dos serviços
├── .env                    # Variáveis de ambiente (criar manualmente)
├── client/                 # Frontend React
├── server/                 # Backend Express
├── shared/                 # Schemas compartilhados
└── uploads/                # Arquivos enviados (PDFs, relatórios)
```
