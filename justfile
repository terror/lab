set dotenv-load

export EDITOR := 'nvim'

alias d := dev
alias f := fmt

default:
  just --list

[group: 'dev']
build:
  bun run build

[group: 'check']
check:
  bun run check

[group: 'dev']
dev: services migrate
  bun run dev

[group: 'format']
fmt:
  bunx oxfmt

[group: 'check']
knip:
  bun run knip

[group: 'check']
lint:
  bun run lint

[group: 'setup']
migrate:
  bun run db:migrate

[group: 'setup']
services:
  docker compose up --no-recreate --wait -d postgres

[group: 'dev']
start:
  bun run start
