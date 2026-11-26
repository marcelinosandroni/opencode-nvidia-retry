# Configuração

As opções são JSON e podem ser fornecidas na entrada `plugins` da configuração.

## Opções

| Opção | Tipo | Padrão | Efeito |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Quando `false`, nenhum hook ou assinatura de eventos é registrado. |
| `providerIDs` | `string[]` | `["nvidia"]` | Providers elegíveis. A comparação ignora maiúsculas de minúsculas. |
| `modelIDs` | `string[]` | `[]` | Modelos elegíveis. Uma lista vazia permite todos. |
| `errorTypes` | `string[]` | `[]` | Tipos de erro elegíveis. Uma lista vazia permite todos. |
| `excludeErrorTypes` | `string[]` | `[]` | Tipos de erro que nunca são repetidos. Tem prioridade sobre `errorTypes`. |
| `errorMessages` | `string[]` | `[]` | Fragmentos obrigatórios na mensagem ou no corpo. Uma lista vazia não aplica filtro de texto; `"*"` permite qualquer texto. |
| `sessions` | `string[]` | `[]` | Lista inclusiva de IDs de sessão. Uma lista vazia significa todas. |
| `excludeSessions` | `string[]` | `[]` | Lista excludente de IDs de sessão. |
| `initialDelay` | `number` | `1000` | Primeiro atraso, em milissegundos. |
| `maxDelay` | `number` | `60000` | Teto do atraso, em milissegundos, limitado a `60000`. |

## Comportamento padrão

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "enabled": true
      }
    }
  ]
}
```

Por padrão, **qualquer erro** de uma sessão NVIDIA é repetido indefinidamente: erros de provider (`provider.rate-limit`, `provider.internal`, `provider.transport`, `provider.timeout`, `provider.unknown`, `provider.no-route`, `provider.auth`, quota, etc.) e qualquer outra classificação registrada pelo servidor.

O frontend pode exibir `the provider had a problem`, enquanto o servidor registra o incidente com a classificação estruturada real (HTTP 429 vira `provider.rate-limit`, falha de rede vira `provider.transport`). Como o padrão não restringe tipos nem texto, o retry continua em qualquer uma dessas situações.

## Excluir certos erros

Para nunca repetir um tipo específico de erro, use `excludeErrorTypes`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "excludeErrorTypes": ["permission.rejected", "tool.execution"]
      }
    }
  ]
}
```

Com essa configuração, `permission.rejected` e `tool.execution` encerram o ciclo, enquanto todo o resto continua sendo repetido. A lista tem prioridade sobre `errorTypes`.

## Filtrar modelos

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "providerIDs": ["nvidia"],
        "modelIDs": ["nemotron/test-model", "other/model"]
      }
    }
  ]
}
```

A opção `modelIDs` usa o ID do modelo, sem o ID do provider.

## Personalizar a mensagem de erro

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "errorTypes": ["provider.internal", "provider.transport"],
        "errorMessages": ["the provider had a problem", "temporary capacity"]
      }
    }
  ]
}
```

A correspondência de texto é parcial e ignora maiúsculas de minúsculas. A mensagem do erro e o corpo HTTP são verificados.

O texto `the provider had a problem` é a apresentação do cliente móvel. No servidor, a mesma falha recebe a classificação estruturada real (por exemplo `provider.rate-limit` para HTTP 429 ou `provider.transport` para falha de rede), por isso o filtro de texto fica vazio por padrão. Use `errorMessages` quando quiser limitar o retry a uma mensagem específica do servidor.

Para permitir qualquer tipo de erro, mantenha as listas abertas:

```json
{
  "errorTypes": [],
  "excludeErrorTypes": [],
  "errorMessages": []
}
```

Essa é a configuração padrão e a mais ampla possível.

## Aplicar somente a uma sessão

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "sessions": ["ses_abc123", "ses_def456"]
      }
    }
  ]
}
```

## Desativar temporariamente

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "enabled": false
      }
    }
  ]
}
```

O OpenCode recarrega a configuração e o plugin. Não é preciso reiniciar o servidor.

## Ajustar o backoff

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "initialDelay": 5000,
        "maxDelay": 30000
      }
    }
  ]
}
```

Nesse exemplo, os intervalos crescem `5s, 10s, 20s, 30s, 30s...`.

## Precedência

1. `enabled: false` impede todo o comportamento.
2. `excludeSessions` sempre impede o retry.
3. Uma lista `sessions` não vazia exige que a sessão esteja incluída.
4. O provider e o modelo precisam passar pelos filtros.
5. O tipo do erro não pode estar em `excludeErrorTypes`.
6. O tipo e a mensagem do erro precisam passar pelos filtros restantes.

## Validação

- Valores numéricos finitos e não negativos são aceitos para os atrasos e arredondados para inteiros.
- `maxDelay` é limitado a `60000`, mesmo quando um valor maior é configurado.
- `initialDelay` é limitado ao `maxDelay` efetivo.
- Entradas que não são strings são ignoradas nas listas.
- Uma lista de providers vazia impede qualquer retry.
- Um `modelIDs` que não seja uma lista impede qualquer retry.
- Uma lista de mensagens vazia não aplica filtro de texto; use `"*"` para permitir qualquer texto dentro dos tipos selecionados.
- Uma lista de tipos vazia permite todos os tipos; `excludeErrorTypes` sempre tem prioridade.

## Coexistência com outros plugins

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-mobile-notifications",
    "github:marcelinosandroni/opencode-queue-followups",
    {
      "package": "github:marcelinosandroni/opencode-nvidia-retry",
      "options": {
        "enabled": true
      }
    }
  ]
}
```

Os três plugins são independentes e podem coexistir.
