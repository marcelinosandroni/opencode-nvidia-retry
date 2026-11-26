# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

Nenhuma mudança pendente.

## [0.1.0] - 2026-11-26

### Adicionado

- Primeira versão do plugin `opencode.nvidia-retry`.
- Retry de falhas elegíveis do provider NVIDIA dentro do turno.
- Retomada infinita da mesma mensagem depois de esgotado o orçamento nativo do turno.
- Backoff exponencial com teto rígido de 60 segundos.
- Opção `enabled` e filtros por provider, modelo, tipo de erro, mensagem e sessão.
- Testes unitários e workflow de CI.
- Documentação de instalação, configuração, arquitetura e desenvolvimento.
