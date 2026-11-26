# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Alterado

- O filtro padrão não restringe mais o tipo do erro: qualquer falha de uma sessão NVIDIA é repetida indefinidamente, inclusive erros de rede (`provider.transport`, `provider.timeout`), quota, autenticação e falhas internas. A correspondência deixou de depender do texto `the provider had a problem`, que é apenas a apresentação do cliente móvel.
- Uma lista `errorMessages` vazia deixou de desabilitar o retry e passou a significar "sem filtro de texto".
- A retomada terminal passa a usar o modelo capturado no hook de retry quando o erro terminal tem outra forma, evitando parar o ciclo por diferença de mensagem.

### Adicionado

- Nova opção `excludeErrorTypes`, com prioridade sobre `errorTypes`, para encerrar o ciclo em tipos específicos (por exemplo, `permission.rejected`).
- Log de inicialização do plugin com a política efetiva, para confirmar a configuração carregada pelo servidor.

## [0.1.0] - 2026-11-26

### Adicionado

- Primeira versão do plugin `opencode.nvidia-retry`.
- Retry de falhas elegíveis do provider NVIDIA dentro do turno.
- Retomada infinita da mesma mensagem depois de esgotado o orçamento nativo do turno.
- Backoff exponencial com teto rígido de 60 segundos.
- Opção `enabled` e filtros por provider, modelo, tipo de erro, mensagem e sessão.
- Testes unitários e workflow de CI.
- Documentação de instalação, configuração, arquitetura e desenvolvimento.
