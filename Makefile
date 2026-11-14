# make run      → local en modo ensayo (o con Gemini si hay GEMINI_API_KEY en .env)
# make rehearsal → local desde cero + prueba de carga con 400 jugadores falsos
# make test     → pruebas de la lógica del juego
# make deploy   → setup + Cloud Run (gasta créditos)
PORT ?= 8080
run: node_modules
	@echo "App http://localhost:$(PORT) · Pantalla /screen · Host /host  (en local también se entra por nombre)"
	ALLOW_GUEST=1 PORT=$(PORT) npm run dev
rehearsal: node_modules
	rm -rf data && (PORT=$(PORT) MOCK=1 node server.js & echo $$! > .pid) && sleep 1 && \
	node scripts/load.js http://localhost:$(PORT) 400; kill `cat .pid`; rm -f .pid
test:
	npm test
deploy:
	./scripts/setup.sh && ./scripts/deploy.sh
node_modules:
	npm install
.PHONY: run rehearsal test deploy
