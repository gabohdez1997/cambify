# 💸 Cambify

![Cambify Hero](https://via.placeholder.com/1200x600/0f172a/ffffff?text=Cambify+-+Modern+Financial+Dashboard)

> Una aplicación web progresiva (PWA) de gestión financiera y casa de cambio con un diseño minimalista, inspirado fuertemente en las directrices visuales de iOS 26 y el efecto Glassmorphism.

## ✨ Características Principales

Cambify está diseñado para facilitar la administración diaria de transacciones, enfocándose en la velocidad, seguridad, y una experiencia de usuario impecable.

- 🔐 **Autenticación Basada en Roles (RBAC):** Sistema de inicio de sesión seguro apoyado por Supabase. Diferenciación estricta entre Administradores y Cajeros/Usuarios.
- 👥 **Gestión de Personal:** Interfaz gráfica para que los administradores puedan dar de alta nuevos usuarios, asignarlos a roles específicos, cambiar sus claves maestras o inhabilitarlos (Bypass de Verificación de Correo).
- 💰 **Jornadas de Caja (Cash Flow):** (En Desarrollo) Sistema estricto de control de balance. Las operaciones inician en \`0.00\` diariamente, atando las entradas y salidas de capital a jornadas trazables.
- 🎨 **Diseño iOS 26 & Glassmorphism:** Estética premium usando CSS nativo (Vanilla), incorporando fondos con desenfoque de cristal (blur), degradados responsivos y tipografía SF Pro.
- 🌓 **Modo Oscuro / Claro Automático:** El sistema reacciona automáticamente a la preferencia del dispositivo operativo o se puede forzar con un interruptor local, re-dibujando los degradados para evitar fatiga visual.

## 🛠 Stack Tecnológico

Cambify es una aplicación moderna que omite herramientas sobre-saturadas a favor de la velocidad y el control absoluto del DOM:

- **Frontend:** [SvelteKit](https://kit.svelte.dev/) (Configurado con \`adapter-auto\` como Fullstack Hibrido).
- **Estilos:** Vanilla CSS (Variables nativas, sin necesidad de Tailwind).
- **Iconografía:** [Lucide Svelte](https://lucide.dev/).
- **Backend & Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, RLS Policies, REST API endpoints).

## 🚀 Despliegue Local y Desarrollo

Sigue estos pasos para levantar el entorno de desarrollo en tu propia máquina.

### 1. Variables de Entorno

Crea un archivo \`.env\` en la raíz del proyecto y añade tus llaves de proyecto de Supabase:

```env
PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="tu-anon-key-jwt-publico"
SUPABASE_SERVICE_ROLE_KEY="tu-secret-role-key-privado"
```
*(Asegúrate de no subir nunca este archivo a repositorios públicos).*

### 2. Configurar Base de Datos

En la consola SQL de tu proyecto Supabase, debes ejecutar los esquemas de tablas iniciales:
- Ejecutar \`supabase_schema.sql\` (Para desplegar los Perfiles y Roles de usuarios).
- Ejecutar \`supabase_schema_cash.sql\` (Para desplegar las tablas de Jornadas de Caja, Movimientos y los gatillos matemáticos).

### 3. Instalar y Ejecutar

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
# Instalar dependencias
npm install

# Correr servidor local de Vite
npm run dev
```

La aplicación estará corriendo y disponible en \`http://localhost:5173\`.

---
*Hecho para el manejo eficiente y moderno de finanzas.*
