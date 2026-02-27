# Deploy en VPS DonWeb (Linux) - Guía rápida

Esta guía asume que ya tenés este repo en el servidor.

## 1) Requisitos en VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release ufw nginx certbot python3-certbot-nginx
```

## 2) Instalar Docker + Compose plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker --now
```

## 3) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 4) Variables de entorno

```bash
cp .env.example .env
```

Editar `.env` y definir como mínimo:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=https://TU_DOMINIO`
- `RUN_DB_SEED=false`

## 5) Primer deploy

```bash
./scripts/deploy-prod.sh
```

Opcional (solo primera vez para bootstrap de usuario admin):

```bash
RUN_DB_SEED=true docker compose up -d app
```

Luego volver a `RUN_DB_SEED=false` en `.env`.

## 6) Configurar Nginx como reverse proxy

Copiar template:

```bash
sudo cp deploy/nginx/yanki-control.conf /etc/nginx/sites-available/yanki-control
sudo nano /etc/nginx/sites-available/yanki-control
```

Reemplazar `TU_DOMINIO` por tu dominio real y habilitar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/yanki-control /etc/nginx/sites-enabled/yanki-control
sudo nginx -t
sudo systemctl reload nginx
```

## 7) SSL con Let's Encrypt

```bash
sudo certbot --nginx -d TU_DOMINIO -d www.TU_DOMINIO
```

## 8) Actualizaciones

```bash
git pull
./scripts/deploy-prod.sh
```

## 9) Verificación rápida

```bash
curl -I https://TU_DOMINIO/api/health
```

Debe responder `200`.
