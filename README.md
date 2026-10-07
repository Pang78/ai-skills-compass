# AI Skills Compass

AI Skills Compass is a curated course discovery website for people exploring
practical AI skills. It was created as a demonstration for Singapore workforce
development officers.

## Features

- Search and filter a curated collection of AI courses
- Compare up to three courses side by side
- Explore suggested pathways for public officers, business owners, career
  explorers, and developers
- Download a selected learning pathway
- Responsive layouts for presentation screens and mobile devices

Course information links back to the respective providers. The catalogue is
curated rather than ranked, and users should confirm current availability,
pricing, and certificate terms with each provider.

## Prerequisites

- Node.js `>=22.13.0`

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

## Validate the production build

```bash
npm run build
```

The project uses React, Next.js, and vinext to produce a Cloudflare
Workers-compatible build.
