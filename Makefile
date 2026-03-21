.PHONY: build up down shell logs clean

build:
	mkdir -p data
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

shell: up
	docker compose exec dev /usr/bin/fish -l

logs:
	docker compose logs -f

clean: down
	docker compose down --rmi local
