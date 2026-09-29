# Encomendas — GitHub Pages + Supabase

Este diretório já é o site completo. Ele usa somente HTML, CSS e JavaScript no navegador. O Supabase continua sendo o banco de dados e também passa a cuidar do login.

## 1. Fazer a segurança no Supabase

1. Entre em https://supabase.com/dashboard e abra o projeto usado pelo app antigo.
2. No menu esquerdo, abra **SQL Editor** e clique em **New query**.
3. Abra o arquivo `supabase-setup.sql` desta pasta, copie tudo, cole no editor e clique em **Run**.
4. Uma mensagem de sucesso deve aparecer. O script não apaga nem renomeia tabelas ou dados.

## 2. Criar os usuários

1. No Supabase, abra **Authentication > Users**.
2. Clique em **Add user > Create new user**.
3. Informe seu e-mail e uma senha forte. Marque para o e-mail já ficar confirmado.
4. Repita para cada funcionário.
5. Volte ao **SQL Editor**. Para tornar você administrador, rode:

```sql
insert into public.app_profiles (user_id, nome, papel)
select id, 'João', 'administrador'
from auth.users
where email = 'SEU_EMAIL_AQUI'
on conflict (user_id) do update
set nome = excluded.nome, papel = excluded.papel;
```

6. Para cadastrar um funcionário, troque nome, e-mail e papel:

```sql
insert into public.app_profiles (user_id, nome, papel)
select id, 'Nome do funcionário', 'funcionario'
from auth.users
where email = 'EMAIL_DO_FUNCIONARIO'
on conflict (user_id) do update
set nome = excluded.nome, papel = excluded.papel;
```

O app antigo usava a tabela `users`. Ela permanece intacta, mas não participa mais do login.

## 3. Colocar a URL e a chave pública

1. No Supabase, abra **Project Settings** (ícone de engrenagem).
2. Abra **Data API** ou **API Settings** (o nome pode variar).
3. Copie a **Project URL**.
4. Copie a chave **Publishable key**. Em projetos antigos, use a chave **anon public**.
5. Abra `config.js` e substitua os dois textos entre aspas.

Use somente a chave publishable/anon. Nunca coloque a senha do banco ou a chave `service_role` no site.

## 4. Publicar no GitHub Pages

1. Entre em https://github.com/joaopedrocasagrande/appencomendas.
2. Se o repositório ainda estiver vazio, clique em **uploading an existing file**. Se já tiver arquivos, clique em **Add file > Upload files**.
3. Arraste **todos os arquivos desta pasta**, sem incluir a pasta por fora: `index.html`, `styles.css`, `app.js`, `config.js`, `supabase-setup.sql` e `README.md`.
4. Clique em **Commit changes**.
5. No repositório, abra **Settings > Pages**.
6. Em **Build and deployment**, escolha **Deploy from a branch**. Selecione a branch `main`, pasta `/(root)` e clique em **Save**.
7. Aguarde alguns minutos. O endereço será:

https://joaopedrocasagrande.github.io/appencomendas/

No celular, abra esse endereço no navegador. No iPhone, use **Compartilhar > Adicionar à Tela de Início**. No Android/Chrome, use o menu **⋮ > Adicionar à tela inicial**.

## Teste sem banco

Para apenas conhecer a interface, acrescente `?demo=1` ao fim do endereço. Esse modo usa dados fictícios no navegador e não acessa o Supabase.
