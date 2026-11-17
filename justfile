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

[group: 'desktop']
[working-directory: 'apps/desktop']
desktop:
  bun run tauri dev

[group: 'desktop']
[working-directory: 'apps/desktop']
desktop-build origin='http://127.0.0.1:3000':
  bun run tauri build --config '{"build":{"frontendDist":"{{origin}}"}}'

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

[group: 'mobile']
[working-directory: 'apps/mobile']
mobile:
  bun run start

[group: 'setup']
pstack:
  bin/sync-pstack

[group: 'setup']
services:
  docker compose up --no-recreate --wait -d postgres

[group: 'dev']
start:
  bun run start

[group: 'dev']
storybook:
  bun run storybook

[group: 'check']
test: services
  bun run test
