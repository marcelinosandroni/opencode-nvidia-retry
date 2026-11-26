# Contribuindo

Obrigado por querer ajudar. Qualquer mudança deve preservar simplicidade, privacidade e compatibilidade com a API pública do OpenCode.

## Antes de começar

1. Abra uma issue descrevendo o problema e a proposta.
2. Verifique se a mudança pode ser feita sem modificar o core do OpenCode.
3. Mantenha o escopo pequeno e focado em retry de provider.

## Desenvolvimento

```bash
npm install
npm run check
```

## Regras de implementação

- Use APIs públicas do SDK de plugins.
- Não altere o core nem APIs privadas do OpenCode.
- Não faça requisições de rede.
- Não introduza dependências de runtime sem justificativa.
- Mantenha o teto do backoff em no máximo 60.000 ms.
- Mantenha a mudança coberta por testes.

## Pull request

Inclua:

- motivação;
- alterações comportamentais;
- atualização da documentação;
- resultado de `npm run check`.

## Commits

Prefira commits pequenos e descritivos. O changelog é atualizado para mudanças de comportamento ou API.
