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
  bun run fmt

lint:
  bun run lint

start:
  bun run start
