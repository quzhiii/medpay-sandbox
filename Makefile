.PHONY: install backend frontend dev

install:
	cd services/engine && pip install -r requirements.txt
	cd apps/web && npm install

backend:
	python services/engine/main.py

frontend:
	cd apps/web && npm run dev

dev:
	$(MAKE) -j2 backend frontend
