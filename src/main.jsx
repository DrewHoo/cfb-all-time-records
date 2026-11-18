import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import FootballRecords from './FootballRecords.jsx'
import './styles.css'
import { setBaked } from './lib/readNext.js'

// What to read next as the prerender baked it, so the hydrate starts from the same list
const readNext = document.getElementById('readnext-data')
if (readNext) setBaked(JSON.parse(readNext.textContent))

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away; the dev server has no baked
// markup, so fall back to a plain render there.
const root = document.getElementById('root')
const app = <React.StrictMode><FootballRecords /></React.StrictMode>
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)
