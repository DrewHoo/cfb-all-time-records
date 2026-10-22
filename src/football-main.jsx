import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import FootballRecords from './FootballRecords.jsx'
import './styles.css'

// see main.jsx: hydrate the prerendered page, render fresh in dev
const root = document.getElementById('root')
const app = <React.StrictMode><FootballRecords /></React.StrictMode>
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)
