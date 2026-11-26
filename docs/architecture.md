# Arquitetura

## Objetivo

O plugin mantém uma sessão ativa mesmo quando o provider NVIDIA falha com um erro elegível. Não existe uma contagem máxima externa de tentativas.

## Limite do retry nativo

O OpenCode V2 classifica a falha e consulta o hook público `session.retry` antes de agendar a próxima tentativa. Porém, o orçamento nativo do turno é finito. Depois dele, o core conclui a execução e publica `session.execution.failed`.

Um hook sozinho, portanto, não consegue tornar o ciclo total infinito. O plugin combina a decisão do hook com a retomada pública da mensagem após o evento terminal.

## Fluxo

### 1. Retry dentro do turno

O core dispara:

```ts
await ctx.session.hook("retry", (event) => {
  // ...
})
```

Para uma falha elegível, o plugin:

1. valida `enabled` e o escopo da sessão;
2. valida `providerID` e `modelID`;
3. valida o tipo e a mensagem do erro;
4. incrementa o contador de falhas da sessão;
5. calcula `min(maxDelay, initialDelay * 2 ** (failures - 1))`;
6. substitui a decisão por `{ retry: true, delay }`.

A API pública permite que uma falha terminal vire retryable. O plugin não altera a classificação interna do erro.

### 2. Retomada depois de uma falha terminal

O plugin assina o stream público de eventos:

```ts
ctx.event.subscribe({
  types: ["session.execution.started", "session.execution.succeeded", "session.execution.failed", "session.execution.interrupted", "session.deleted"],
})
```

Quando recebe `session.execution.failed`, ele:

1. lê o modelo selecionado da sessão;
2. reaplica os filtros de provider, modelo e erro;
3. lê o contexto público da sessão e localiza o último prompt de usuário;
4. agenda a retomada depois do backoff;
5. chama `ctx.session.prompt` com o mesmo `messageID` e `delivery: "steer"`.

O mesmo ID é essencial. A API de inbox reconcilia a mensagem durável existente em vez de criar um prompt duplicado.

A retomada usa `delivery: "steer"` para priorizar o prompt que falhou sobre follow-ups já enfileirados. Ela ocorre depois de uma falha terminal, quando não há um turno ativo para interromper. Se outra execução começar durante o backoff, o evento `session.execution.started` cancela a retomada automática.

## Estado

O estado é mantido em memória, por sessão:

```text
failures   número de falhas observadas
candidate  último provider/modelo/erro elegível
timer      retomada terminal pendente
```

Transições principais:

- `retry` elegível: incrementa `failures`, cancela uma retomada pendente e agenda o próximo intervalo nativo;
- `execution.failed` elegível: incrementa `failures` e agenda a retomada da mesma mensagem;
- `execution.started` durante um backoff: uma execução iniciada pelo usuário cancela a retomada automática;
- `session.model.selected`: uma troca explícita de modelo cancela a retomada pendente;
- `execution.succeeded`: apaga o estado;
- `execution.interrupted`: apaga o estado e respeita a interrupção do usuário;
- `session.deleted`: apaga o estado;
- unload/hot reload: aborta a assinatura e cancela todos os timers.

## Backoff

O atraso é calculado a partir do número de falhas da sessão:

```text
delay = min(60000, initialDelay * 2 ** (failures - 1))
```

O teto rígido é de 60.000 ms. O valor configurado em `maxDelay` só pode reduzi-lo.

## Superfície de confiança

O plugin considera confiáveis os dados fornecidos pelo host. Ele não altera prompts, ferramentas, agentes, credenciais ou modelos. Também não acessa banco de dados, arquivos ou endpoints externos.
