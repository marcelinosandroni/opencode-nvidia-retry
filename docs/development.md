# Desenvolvimento

## Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Git

## Preparação

```bash
git clone https://github.com/marcelinosandroni/opencode-nvidia-retry.git
cd opencode-nvidia-retry
npm install
```

## Comandos

```bash
npm run typecheck
npm test
npm run check
```

`npm run check` é o comando usado pela CI e deve passar antes de abrir um PR.

## Executar localmente no OpenCode

Adicione o clone à configuração global:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/caminho/absoluto/opencode-nvidia-retry"
  ]
}
```

Depois de alterar o código, toque no ponto de entrada para acionar o watcher:

```bash
touch index.ts
```

Arquivos sob diretórios de configuração vigiados são recarregados automaticamente. Se o clone estiver fora desses diretórios e o servidor não detectar a alteração, reinicie o serviço apenas durante o desenvolvimento.

Para confirmar:

```bash
opencode plugin list
```

## Estrutura

```text
.
├── index.ts                 # ponto de entrada publicado
├── src/index.ts             # hooks, eventos e ciclo de vida
├── src/policy.ts            # filtros, validação e backoff
├── test/index.test.ts       # testes unitários
├── docs/                    # documentação técnica
└── .github/workflows/       # CI
```

## Estratégia de testes

Os testes usam `node:test` por meio do `tsx` e um contexto mínimo do host. Eles verificam:

- filtros padrão e personalizados;
- precedência e escopo de sessões;
- backoff exponencial e teto de um minuto;
- registro e desativação do hook;
- decisão de retry para erros elegíveis e não elegíveis;
- retomada do mesmo `messageID` depois de `session.execution.failed`.

## Pull requests

1. Crie uma branch a partir de `main`.
2. Faça a alteração e acrescente testes quando necessário.
3. Rode `npm run check`.
4. Atualize a documentação e o changelog.
5. Abra o pull request usando o template apropriado.

## Versionamento e publicação

O projeto segue SemVer:

- **PATCH:** correções sem mudança de contrato;
- **MINOR:** nova opção ou comportamento compatível;
- **MAJOR:** mudança incompatível de configuração ou API.

Revise o pacote com:

```bash
npm pack --dry-run
```

A publicação no npm não é automática. Depois de revisar o artefato, publique com o escopo correto:

```bash
npm publish --access public
```
