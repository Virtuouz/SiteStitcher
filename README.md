# StarterKit

A modern JAMstack website starter kit optimized for component-based development and high-performance static sites. This template provides a robust foundation for building content-rich websites with a focus on maintainability and developer experience.

## Features

- **Component-Based Architecture**
  - Modular development using BookShop components
  - Live component preview and testing
  - Consistent component structure across projects

- **Modern Build Pipeline**
  - Static site generation with 11ty
  - Optimized asset processing
  - Automated image optimization
  - RSS feed generation
  - Favicons generation

- **Advanced Styling System**
  - TailwindCSS for utility-first styling
  - Sass preprocessing for custom styles
  - Automated style compilation
  - Component-specific styling support

## Technology Stack

### Core
- [11ty (Eleventy)](https://www.11ty.dev/) v3.0.0 - Static Site Generator
- [BookShop](https://github.com/CloudCannon/bookshop) v3.11.0 - Component System
- [TailwindCSS](https://tailwindcss.com/) v3.3.3 - Utility CSS Framework
- [Sass](https://sass-lang.com/) - CSS Preprocessor
- [LiquidJS](https://liquidjs.com/) - Templating Engine

### Build Tools
- Concurrently - Parallel task execution
- Node.js utilities for build automation
- Prettier for code formatting

### Additional Features
- 11ty Image for automated image optimization
- 11ty Navigation for site structure
- RSS feed generation
- Table of Contents generation
- Favicon generation
- Netlify Functions support

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm start
```

3. Build for production:

```bash
npm run build
```

## Available Scripts

- `npm start` - Starts development environment
- `npm run build` - Creates production build
- `npm run new` - Generates new BookShop component
- `npm run browser` - Launches BookShop component browser
- `npm run test:componentUse` - Validates component usage
- `npm run test:siteJsonSync` - Validates site configuration
- `npm run syncPermalinks` - Synchronizes permalinks

## License

ISC
