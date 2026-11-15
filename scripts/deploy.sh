#!/usr/bin/env bash
set -euo pipefail

if (( $# != 1 )); then
  printf 'Uso: bash scripts/deploy.sh IMAGEM\n' >&2
  exit 2
fi

imagem=$1
if [[ ! $imagem =~ ^[[:alnum:]][[:alnum:].:/_@-]*$ ]]; then
  printf 'Referência de imagem inválida.\n' >&2
  exit 2
fi

raiz=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
compose=(docker compose --project-directory "$raiz" --file "$raiz/compose.yaml")
export IMAGE="$imagem"
timeout=${DEPLOY_TIMEOUT:-90}
if [[ ! $timeout =~ ^[1-9][0-9]*$ ]]; then
  printf 'DEPLOY_TIMEOUT deve ser um inteiro positivo em segundos.\n' >&2
  exit 2
fi

# Guarda a imagem exata do contêiner anterior somente quando ele está saudável.
anterior=''
container_anterior=$("${compose[@]}" ps --quiet gestao)
if [[ -n $container_anterior ]]; then
  estado=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_anterior")
  if [[ $estado == healthy ]]; then
    anterior=$(docker inspect --format '{{.Image}}' "$container_anterior")
  fi
fi

# Uma imagem já construída no CI ou neste computador dispensa acesso ao registro.
if ! docker image inspect "$imagem" >/dev/null 2>&1; then
  docker pull "$imagem"
fi

subir() {
  local container imagem_esperada imagem_rodando estado
  imagem_esperada=$(docker image inspect --format '{{.Id}}' "$IMAGE") || return 1
  "${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout "$timeout" gestao || return 1
  container=$("${compose[@]}" ps --quiet gestao) || return 1
  [[ -n $container ]] || return 1
  imagem_rodando=$(docker inspect --format '{{.Image}}' "$container") || return 1
  estado=$(docker inspect --format '{{.State.Health.Status}}' "$container") || return 1
  [[ $imagem_rodando == "$imagem_esperada" && $estado == healthy ]]
}

if subir; then
  printf 'Implantação saudável com %s\n' "$imagem"
  exit 0
fi

printf 'A nova implantação falhou. Últimos logs:\n' >&2
"${compose[@]}" logs --no-color --tail=80 gestao >&2 || true

if [[ -z $anterior ]]; then
  "${compose[@]}" stop gestao || true
  printf 'Nenhuma versão saudável anterior encontrada. Os dados foram preservados.\n' >&2
else
  # O ID permanece estável mesmo se a etiqueta original passou a apontar para outra imagem.
  rollback="gestao-devops:rollback-${anterior#sha256:}"
  if docker image tag "$anterior" "$rollback"; then
    export IMAGE="$rollback"
    if subir; then
      printf 'Imagem anterior restaurada (%s). A nova implantação continua reprovada.\n' "$anterior" >&2
      exit 1
    fi
  fi
  printf 'Não foi possível restaurar uma implantação saudável. Consulte os logs do Compose.\n' >&2
fi

exit 1
