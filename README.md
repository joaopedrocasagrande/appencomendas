# Encomendas

App web para gerenciar pedidos sob encomenda (China): pedidos, itens, grades/caixas, tamanhos,
frete, desconto, imposto, outras despesas, pagamentos parciais em US$ ou R$, cotação do dólar
do dia, rastreios (vários por pedido) e filtros.

Stack: Next.js 16 + Postgres (Supabase) + Drizzle ORM. Hospedagem gratuita no Vercel.

## Colocar no ar (custo zero)

1. **Supabase** (banco de dados) — crie uma conta em https://supabase.com e um projeto novo
   (região *South America (São Paulo)*). Guarde a senha do banco.
   - Em **Project Settings → Database → Connection string**, copie:
     - *Transaction pooler* (porta 6543) → será o `DATABASE_URL`
     - *Session pooler* (porta 5432) → será o `DIRECT_URL`
   - Troque `[YOUR-PASSWORD]` pela senha do banco.
2. **Vercel** (hospedagem) — crie uma conta em https://vercel.com usando o GitHub e importe
   este repositório. Em **Environment Variables**, cadastre:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `AUTH_SECRET` — uma frase aleatória longa (mínimo 16 caracteres)
3. Clique em **Deploy**. As tabelas do banco são criadas automaticamente no build.
4. Abra o endereço gerado: no primeiro acesso o app pede para criar o **administrador**.
5. No celular, abra o endereço e use "Adicionar à tela inicial" para usar como app.

> O plano gratuito do Supabase pausa o projeto após ~7 dias sem nenhum acesso. Basta entrar no
> painel do Supabase e clicar em "Restore"; os dados não são perdidos.

## Desenvolvimento local

```bash
cp .env.example .env   # ajuste DATABASE_URL para um Postgres local
npm install
npm run db:migrate
npm run dev
```

Após alterar `src/db/schema.ts`, gere a migração com `npm run db:generate`.

## Regras de cálculo

- **Total ao fornecedor** = produtos + frete − desconto + despesas marcadas como "cobradas pelo fornecedor".
- **Imposto incluso no pedido**: já está dentro do valor (fica apenas informativo).
  **Não incluso**: é custo à parte, com controle de pago/pendente. Impostos por pacote ficam em cada rastreio.
- **Pagamentos** podem ser em US$ ou R$; cada um guarda a própria cotação e é convertido para a
  moeda do pedido para calcular o saldo.
- **Custo real por peça** = (pagamentos em R$ + saldo pela cotação do pedido + custos à parte) ÷ peças.
