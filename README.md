# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
# Photogrammetry-Desktop-App

## Firestore Rules (Project Name Uniqueness)

This app stores projects under:

- `Users/{uid}/Projects/{projectNameKey}`

Where `projectNameKey` is a normalized and URL-encoded version of the project name.
Because the document ID is the normalized name key, one user cannot have two projects
with the same name (case/spacing-insensitive).

### Rules file

The Firestore security rules are in `firestore.rules`.

They enforce:

- A user can only read/write their own `Users/{uid}` data.
- Project create/update must keep `uid`, `projectId`, `nameKey`, and `name` consistent.
- `nameKey` must match the document ID.
- Required project fields and types are validated.

### Deploy rules

If you use Firebase CLI, deploy with:

```bash
firebase deploy --only firestore:rules
```

If your project does not yet have Firebase CLI config, initialize once:

```bash
firebase init firestore
```

Then point to this repo's `firestore.rules` file and deploy again.

## Point Cloud Workflow

The viewer loads a single point cloud file from your project output:

- `odm_filterpoints/point_cloud.ply`

Auto-load and drag-and-drop in the 3D viewer both use this `.ply` file path.
