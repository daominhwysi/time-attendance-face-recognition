# ⚛️ React TypeScript Boilerplate — Tailwind + ShadCN UI

A modern boilerplate for **React + TypeScript** applications, pre-configured with:

* ⚡️ **Vite** – Super-fast build tool
* 💅 **Tailwind CSS** – Utility-first styling
* 🧩 **ShadCN UI** – Beautiful, customizable components
* 🧠 **TypeScript** – Type-safe and IDE-friendly
* 🎨 **Prettier + ESLint** – Code formatting and linting setup
* 📁 **@/** alias – Clean import paths
* 🚀 Ready for production and easy to extend

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/vandunxg/shadcn_template.git
cd shadcn_template

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

---

## 🧠 Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the development server        |
| `npm run build`   | Build the project for production    |
| `npm run preview` | Preview the production build        |
| `npm run lint`    | Run ESLint to check for code issues |
| `npm run format`  | Format code using Prettier          |

---

## 🎨 Prettier + Tailwind Configuration

```json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "singleQuote": true,
  "semi": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

Example `.prettierignore`:

```
node_modules
dist
build
coverage
```

---

## ⚙️ @/ Alias Configuration

In `vite.config.ts`:

```ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 🧩 ShadCN UI Setup

```bash
npx shadcn-ui init
```

Add components:

```bash
npx shadcn-ui add button card input
```

Browse components: [https://ui.shadcn.com](https://ui.shadcn.com)

---

## 🧱 Project Structure

```
├── src/
│   ├── components/
│   │   └── ui/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   └── main.tsx
├── public/
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 🚀 Deployment

```bash
npm run build
```

The build output will be in `/dist` — deploy easily to **Vercel**, **Netlify**, or **Cloudflare Pages**.

---

## ❤️ Contributing

* Fork this repository
* Create a new branch: `feature/my-feature`
* Open a Pull Request

---

## 📜 License

MIT License © 2025 — [vandunxg](https://github.com/vandunxg)
