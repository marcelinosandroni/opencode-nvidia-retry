# Segurança

## Versões suportadas

A versão mais recente na branch `main` recebe correções de segurança.

## Relato de vulnerabilidade

Não publique detalhes de uma vulnerabilidade em uma issue pública. Envie um relatório privado pelo mecanismo **Security advisory** do repositório no GitHub.

Inclua:

- versão do plugin e do OpenCode;
- passos de reprodução;
- impacto esperado;
- configuração relevante, sem segredos.

Você receberá uma confirmação em até cinco dias úteis. A correção será coordenada com o mantenedor antes da divulgação.

## Superfície do plugin

O plugin:

- registra o hook público de retry;
- assina eventos públicos de execução;
- lê o modelo e o contexto da sessão somente para avaliar e retomar uma falha elegível;
- reutiliza o texto do último prompt apenas na chamada pública que retoma o mesmo `messageID`;
- não grava prompts, erros ou credenciais em armazenamento próprio;
- não faz requisições de rede;
- não executa código fornecido pelo prompt.

## Limitações conhecidas

Retry infinito pode continuar consumindo quota enquanto o provider estiver indisponível. Use filtros de provider, modelo, tipo e mensagem, além de `sessions`, para reduzir o escopo.

Por padrão, o plugin não restringe o tipo do erro: qualquer falha de uma sessão NVIDIA é repetida, inclusive falhas de rede, quota, autenticação e erros não relacionados ao provider, como `permission.rejected` ou `tool.execution`. Como a retomada reexecuta o prompt inteiro, esses últimos podem repetir efeitos colaterais de ferramentas. Use `excludeErrorTypes` para encerrar o ciclo nesses casos.

Interromper a sessão ou trocar de modelo encerra o ciclo, assim como um hot reload (o estado de retry vive apenas em memória).
