.PHONY: install dev build preview clean deploy

# Instalar dependências
install:
	npm install

# Desenvolvimento
dev:
	npm run dev

# Build para produção
build:
	npm run build

# Preview do build
preview:
	npm run preview

# Limpar arquivos gerados
clean:
	rm -rf dist
	rm -rf node_modules
	rm -rf .vite

# Deploy na Vercel (requer vercel CLI instalado)
deploy:
	vercel --prod

# Deploy preview
deploy-preview:
	vercel

# Instalar e build
all: install build
