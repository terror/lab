set dotenv-load

export EDITOR := 'nvim'

alias f := fmt

default:
  @just --list

fmt:
  bun run fmt

forbid:
  ./bin/forbid

ci: forbid
  bun install --frozen-lockfile
  bun run check
  bun run typecheck
  bun run build

dev:
  bun run dev

build:
  bun run build

typecheck:
  bun run typecheck

rebuild:
  nixos-rebuild switch
