# DevOps na Prática

O Serviço Gestão registra clientes, planos e assinaturas. O laboratório usa Node.js 22, Express, Sequelize e SQLite para demonstrar a automação do build, os testes e o provisionamento.

## Fase 1

Na raiz do projeto, instale as dependências, rode os testes e gere o build.

```sh
npm --prefix app ci
npm --prefix app test
npm --prefix app run build
npm --prefix app start
```

A API atende em `http://localhost:3000`. Consulte `/health` e `/gestao/clientes`.

O GitHub Actions executa esses testes e o build em pull requests e commits em `main`. O segundo job verifica formatação, inicialização e validade do Terraform. O build fica disponível na aba **Actions**, no artefato `gestao-build`.

### Laboratório de infraestrutura

Inicie o Docker Engine e use o Terraform indicado em `infra/main.tf`. Na raiz, rode:

```sh
docker build -t gestao-devops:local .
terraform -chdir=infra init
terraform -chdir=infra plan
terraform -chdir=infra apply
curl --fail http://127.0.0.1:8081/health
curl --fail http://127.0.0.1:8081/gestao/clientes
```

O Terraform cria um contêiner, uma rede e um volume SQLite. Use `terraform -chdir=infra destroy` para remover o laboratório e seu volume de dados.

## Fase 2

Em `main`, o job de entrega aguarda a aprovação dos dois jobs de CI. Ele constrói uma imagem com o SHA do commit, sobe a API com Compose e verifica a saúde e a lista de clientes por HTTP. O mesmo runner aplica o Terraform em outro ambiente e consulta a API na porta 8081.

Na aba **Actions**, baixe o artefato `gestao-entrega-<SHA>` da execução aprovada. Abra o terminal na raiz do projeto e ajuste o caminho para a pasta extraída:

```sh
ARTEFATO=/caminho/para/a/pasta-extraida
(cd "$ARTEFATO" && sha256sum -c SHA256SUMS)
docker load -i "$ARTEFATO/gestao-imagem.tar.gz"
bash scripts/deploy.sh "$(cat "$ARTEFATO/imagem.txt")"
curl --fail http://127.0.0.1:8080/health
docker compose logs --tail=100 gestao
```

Com Docker Desktop no Windows, execute esses comandos no Git Bash. Para gerar a imagem localmente, use `docker compose build gestao` e depois `bash scripts/deploy.sh gestao-devops:local`.

O deploy espera o contêiner ficar saudável e verifica o ID da imagem. Se a nova implantação falhar e houver uma versão saudável anterior, o script tenta restabelecê-la. A reversão troca a imagem e preserva o volume SQLite. Mudanças de esquema exigem uma estratégia de migração própria.

Os logs registram método, caminho, código HTTP e duração. `docker compose ps` mostra a saúde. O processo roda como usuário sem privilégios e a API é publicada apenas na interface local. O job usa um runner descartável. O artefato permite levar a versão aprovada a outro host Docker.
