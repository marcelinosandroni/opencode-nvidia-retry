# Compatibilidade

## OpenCode

| Versão | Status | Observações |
| --- | --- | --- |
| `2.4.1` | Testada | Versão do servidor usada no desenvolvimento e na validação. |
| `2.4.2` | Compatível esperada | Usa a mesma API pública do plugin. |
| OpenCode V1 | Não suportada | A API de plugins e o modelo de inbox são diferentes. |

O plugin requer a API pública de hooks de sessão e o stream público de eventos do OpenCode V2.

## Node.js e Bun

- Node.js 20+ é o baseline dos testes automatizados.
- Bun também é suportado pelo loader de plugins do OpenCode.
- O pacote mantém o código em TypeScript e publica o ponto de entrada `index.ts`.

## Dependências

A única dependência de runtime é `\@opencode/plugin`. O pacote usa a API pública dessa SDK e deve ser instalado com uma versão compatível com o OpenCode utilizado.

## Limites do OpenCode

O retry nativo continua sendo executado pelo core. O plugin apenas ajusta sua decisão pública e retoma a mensagem quando o orçamento nativo do turno termina.

A compatibilidade com o OpenCode não garante que todo provider permaneça indisponível indefinidamente. O comportamento desejado depende de a API pública continuar aceitando a reconciliação do mesmo `messageID` e de o stream de eventos continuar expondo `session.execution.failed`.
