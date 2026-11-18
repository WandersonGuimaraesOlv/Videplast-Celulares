# Celulares e Chips — Videplast

Plataforma que substitui a planilha "Controle de Chips": quem está com cada celular e chip, por centro de custo, com o
estado e as fotos de cada aparelho, o histórico de quem mudou o quê, e o rateio da fatura TIM feito com esse cadastro.

## Quem faz o quê

| Papel | Como entra | O que pode |
| :-- | :-- | :-- |
| **Gestor (TI)** | tabela `cel_gestores` (tela Supervisores) | tudo: cadastrar e excluir chips, trocar centro de custo, supervisores, importar/exportar a planilha, rateio TIM |
| **Supervisor** | tabela `cel_supervisores` (tela Supervisores) | só os itens dos CCs dele: quem usa, setor, dados e estado do celular, fotos, cadastrar celular, ligar/separar celular e chip |
| Outros com acesso no Portal | — | veem o aviso para pedir à TI |

- Trocar o centro de custo é só a TI, porque muda o rateio.
- Toda mudança fica no histórico com quem fez, quando e o motivo.
- Não há conferência mensal obrigatória: o supervisor atualiza quando algo muda.

Quem está usando vem do **Portal de Acesso**: o Nginx do servidor só deixa entrar quem o Portal liberou e repassa o
crachá no cabeçalho `X-Usuario`. O sistema precisa estar cadastrado no Portal (código `celulares`, caminho `/celulares/`).

## Tipos de item

- **Celular + chip**: chip com um celular ligado. Quem usa, setor e CC são os do chip; o celular acompanha.
- **Só chip**: chip sem celular cadastrado (ex.: chip no celular particular, modem, rastreador).
- **Só celular**: celular sem chip (reserva, Wi-Fi, manutenção) num CC ou no estoque da TI (sem CC).

## Pedidos para a TI

Na ficha de cada chip ou celular, o supervisor clica em **Fazer pedido para a TI**: devolver (o setor não precisa mais
ou ninguém usa), reposição do chip, perda ou roubo, celular com defeito ou outro pedido. O pedido aparece na lista
("Pedido à TI") e na aba **Pedidos para a TI**, onde a TI marca em andamento, concluído ou recusado, com a resposta.
O pedido não muda o cadastro sozinho: a TI resolve na ficha (e na TIM). Tudo fica no histórico do item.
Tabela `cel_pedidos`, criada por [supabase/002_pedidos.sql](supabase/002_pedidos.sql).

## Rateio TIM

Aba **Rateio TIM**: envie a fatura em PDF. Cada linha vai para o centro de custo do chip cadastrado aqui (em RV, `1007...`
vale como `1005...`). O valor da fatura fora das linhas (multa, cobrança geral) é rateado proporcionalmente, ou vai inteiro
para o CC do campo 2. Mesmo cálculo do Sistema de Rateios (módulo `backend/src/modules/telefonia`, copiado de lá).

## Dados

Supabase do Imobilizados, tabelas `cel_*` (criadas por [supabase/001_celulares.sql](supabase/001_celulares.sql), rodado
uma vez no SQL Editor) e fotos no bucket privado `celulares-fotos`. Usa também `crachas` (nome de quem usa) e
`centro_de_custo` (CCs da filial). Só o backend acessa, com a chave secret.

## Desenvolvimento

```bash
cd backend && npm install && npm test             # testes (banco em memória, dados sintéticos)
cd backend && USUARIO_DEV=16348 npm run dev        # API em http://localhost:5000 (precisa do .env com o Supabase)
cd frontend && npm install && npm run dev          # telas em http://localhost:5173
```

## Servidor

Publicado em `/celulares/` pelo Nginx do servidor (porta local `CELULARES_PORTA` do `.env`: a primeira livre a partir de 8097), como os outros sistemas, e atualizado pelo
publicador automático a cada commit no ramo `main`. Instalação: `~/celulares-instalar.sh` (ver, testar, criar-repo,
instalar, nginx, no-ar).
