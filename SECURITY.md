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

Uma mudança na classificação do erro pode encerrar o ciclo, pois a correspondência padrão exige `provider.rate-limit` ou `provider.internal`.
