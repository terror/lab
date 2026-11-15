set dotenv-load

export EDITOR := 'nvim'

alias d := dev
alias f := fmt

default:
  just --list

build:
  bun run build

check:
  bun run check

dev:
  bun run dev

fmt:
  bunx oxfmt

knip:
  bun run knip

lint:
  bun run lint

migrate:
  bun run db:migrate

start:
  bun run start
