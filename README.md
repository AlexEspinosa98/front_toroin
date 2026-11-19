# TOROIN Plataforma · Frontend

Aplicación web **multiempresa (marca blanca)** en Next.js. Cada empresa ve su propia marca (nombre, logo, colores) y solo los **módulos que tiene licenciados**; el **super admin** gobierna empresas, módulos y licencias desde `/plataforma`.

Backend: [backend_toroin](https://github.com/AlexEspinosa98/backend_toroin) (FastAPI + PostgreSQL).

## Cómo está armado

- **Next.js 16 (App Router) + TypeScript + Tailwind 4.** Esta versión trae cambios respecto a lo habitual (p. ej. `proxy.ts` en lugar de `middleware.ts`); la documentación local está en `node_modules/next/dist/docs/`.
- **Proxy interno (BFF)** en `src/app/api/`: el navegador nunca habla directo con el backend ni ve el token. El JWT vive en una cookie **httpOnly**; `/api/proxy/*` lo reenvía como `Authorization: Bearer` a una lista cerrada de rutas, y las peticiones que cambian datos exigen la cabecera `x-toroin` (defensa CSRF).
- **Marca dinámica:** `/auth/me` entrega marca y módulos; `lib/branding.ts` los vuelve variables CSS (`--primario`, `--secundario`) y calcula el color de texto con buen contraste.
- **Menú por módulos y rol** (`components/Shell.tsx`). El backend vuelve a validar todo: ocultar un menú no es seguridad.
- **Imágenes** (logos): se reducen en el navegador y se envían como base64 (máx. ~300 KB) para guardarse en la base de datos.

## Pantallas

| Ámbito | Rutas |
|---|---|
| Acceso | `/login` (con marca de la empresa), `/cambiar-password` |
| Super admin | `/plataforma` (panel), `/plataforma/empresas`, `/plataforma/empresas/nueva` (asistente de 4 pasos), `/plataforma/empresas/[id]` (General · Módulos · Licencia · Marca · Usuarios · Auditoría, «Ver como la empresa»), `/plataforma/planes`, `/plataforma/parametros`, `/plataforma/auditoria` |
| Empresa | `/` (inicio), `/obras`, `/personal`, `/usuarios`, `/marca`, `/licencia`, `/m/[modulo]` (módulos licenciados aún en migración) |

## Ejecutar en local

```bash
npm install
cp .env.example .env.local     # API_URL=http://localhost:8000
npm run dev                    # http://localhost:3000
```

Con el backend corriendo (ver su README), entra en `/login`:
- **Plataforma:** deja vacío el código de empresa y usa el super admin que sembraste.
- **Empresa demo:** código `demo`, `admin@demo.com` / `Demo12345` (solo desarrollo).

## Marca blanca por subdominio

Si defines `NEXT_PUBLIC_BASE_DOMAIN=tudominio.com`, `torres.tudominio.com` fija la empresa `torres` en el login. Requiere un dominio con **subdominios comodín** (`*.tudominio.com`) apuntando al proyecto de Vercel. Sin dominio propio, usa `?empresa=codigo` o el campo «Código de empresa».

## Despliegue en Vercel

1. Importa este repo como proyecto nuevo (Framework: Next.js).
2. Variables de entorno: `API_URL` (URL del backend desplegado, sin barra final) y, opcionalmente, `NEXT_PUBLIC_BASE_DOMAIN`.
3. En el backend, agrega la URL del front en `CORS_ORIGINS` (el proxy hace las llamadas desde el servidor, así que normalmente no hace falta).

## Pendiente
Portar los módulos operativos del prototipo (contrato, asistencia, bitácora, control de personal, pagos, finanzas, EPP): hoy aparecen en el menú según licencia, pero muestran «en migración». Más: 2FA, recuperación de contraseña, PWA con modo sin conexión y reportes en PDF.
