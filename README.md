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
