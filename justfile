set dotenv-load

export EDITOR := 'nvim'

alias f := fmt

default:
  @just --list

fmt:
  cargo fmt

forbid:
  ./bin/forbid

ci: forbid
  cargo lclippy --workspace --all-targets -- --deny warnings
  cargo fmt --all -- --check
  cargo ltest --workspace -- --include-ignored

rebuild:
  nixos-rebuild switch
