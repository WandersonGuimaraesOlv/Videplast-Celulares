# Celulares e Chips — regras do projeto

- Respostas, documentação e mensagens de commit/PR em **português do Brasil**.
- Nunca colocar dados reais no repositório (fatura, Controle de Chips, nomes, telefones, fotos). Os testes usam dados sintéticos (`backend/tests/support`).
- Nunca colocar chaves no código: o `.env` fica só no servidor.

## Regras de negócio (decididas pela TI em 16/11/2026)

- Plataforma própria no Portal de Acesso (substitui a planilha Controle de Chips e a aba TIM do Sistema de Rateios).
- Supervisor altera direto os itens dos CCs dele, com histórico. Trocar CC (muda o rateio), cadastrar/excluir chip e excluir celular: só gestor (TI).
- Sem conferência mensal: atualiza quando muda.
- Celular ligado a chip: quem usa, setor e CC vêm do chip (`controle-service.js` sincroniza).
- CC sempre conferido no cadastro `centro_de_custo` da filial (`FILIAL`, 1005); `1007...` vira `1005...`.
- O rateio usa `calcularRateio` do módulo telefonia sem mudar a regra: CC da linha = CC do chip; valor fora das linhas proporcional ou inteiro no CC informado.

## Estrutura

```
backend/src/
├── app.js                       # rotas (/api/...), criarApp({ repo }) — testes injetam o repositório em memória
├── server.js, config.js
├── lib/supabase.js
└── modules/
    ├── dados/                   # repositório do Supabase (única parte que fala com o banco/Storage)
    ├── identidade/              # X-Usuario → { cracha, nome, gestor, ccs }
    ├── controle/services/       # lista, ficha, chips, celulares, vínculo, fotos, permissões
    ├── equipe/services/         # supervisores e gestores
    ├── planilhas/services/      # importar/exportar Controle de Chips e rateio TIM
    ├── telefonia/               # leitura da fatura TIM e cálculo do rateio (copiado do Sistema de Rateios)
    ├── centros-custo/           # cadastro de CCs (Supabase, com a lista do código de reserva)
    └── shared/                  # erros, campos, texto, números, PDF
frontend/src/
├── app/ (App.jsx, estilos.css, config.js)
├── modules/controle|equipe|planilhas|telefonia
└── shared/ (api.js, textos.js, reduzir-foto.js, Modal, MensagemStatus)
supabase/001_celulares.sql       # tabelas cel_*, RLS e bucket das fotos
```

## Testes

`cd backend && npm test` — `plataforma.test.js` testa a API inteira (permissões, histórico, importação, rateio, fotos)
com o banco em memória; `telefonia.test.js` é o mesmo do Sistema de Rateios.
