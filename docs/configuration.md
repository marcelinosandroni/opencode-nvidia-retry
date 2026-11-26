# Configuração

As opções são JSON e podem ser fornecidas na entrada `plugins` da configuração.

## Opções

| Opção | Tipo | Padrão | Efeito |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Quando `false`, nenhum hook ou assinatura de eventos é registrado. |
| `providerIDs` | `string[]` | `["nvidia"]` | Providers elegíveis. A comparação ignora maiúsculas de minúsculas. |
| `modelIDs` | `string[]` | `[]` | Modelos elegíveis. Uma lista vazia permite todos. |
| `errorTypes` | `string[]` | `["provider.rate-limit", "provider.internal"]` | Tipos de erro elegíveis. Uma lista vazia permite todos. |
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

Por padrão, somente erros NVIDIA classificados como `provider.rate-limit` ou `provider.internal` são repetidos.

O frontend pode exibir `the provider had a problem`, enquanto o servidor registra o incidente como HTTP 429 (`provider.rate-limit`) ou `provider.internal`. O filtro padrão usa a classificação estruturada do servidor para cobrir ambos os casos.

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

O texto `the provider had a problem` é a apresentação do cliente móvel. No servidor, a mesma falha costuma ser classificada como `provider.rate-limit` ou `provider.internal`, por isso o filtro de texto fica vazio por padrão. Use `errorMessages` quando quiser limitar o retry a uma mensagem específica do servidor.

Para permitir qualquer erro do provider, remova também a restrição de tipo:

```json
{
  "errorTypes": [],
  "errorMessages": ["*"]
}
```

Essa configuração é ampla e deve ser usada com cuidado.

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
5. O tipo e a mensagem do erro precisam passar pelos filtros.

## Validação

- Valores numéricos finitos e não negativos são aceitos para os atrasos e arredondados para inteiros.
- `maxDelay` é limitado a `60000`, mesmo quando um valor maior é configurado.
- `initialDelay` é limitado ao `maxDelay` efetivo.
- Entradas que não são strings são ignoradas nas listas.
- Uma lista de providers vazia impede qualquer retry.
- Um `modelIDs` que não seja uma lista impede qualquer retry.
- Uma lista de mensagens vazia não aplica filtro de texto; use `"*"` para permitir qualquer texto dentro dos tipos selecionados.

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
