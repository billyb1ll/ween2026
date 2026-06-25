import dotenv from 'dotenv'
dotenv.config() // load .env
dotenv.config({ path: '.env.local', override: true }) // load .env.local
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { Readable } from 'node:stream'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const app = express()

app.use(cors())
app.use(express.json())

// Deprecated SQLite Prisma Routes Removed

// Immich Proxy Routes
const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL
const IMMICH_API_KEY = process.env.IMMICH_API_KEY

const immichProxyHeaders = {
  'x-api-key': IMMICH_API_KEY,
  'Content-Type': 'application/json'
}

app.get('/api/immich/albums', async (req, res) => {
  try {
    const url = new URL(`${IMMICH_SERVER_URL}/api/albums`)
    if (req.query.name) {
      url.searchParams.append('name', req.query.name)
    }
    const response = await fetch(url.toString(), { headers: immichProxyHeaders })
    if (!response.ok) return res.status(response.status).send(await response.text())
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Immich proxy error (albums):', error)
    res.status(500).json({ error: 'Failed to proxy to Immich' })
  }
})

app.get('/api/immich/albums/:id', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/albums/${req.params.id}`, { headers: immichProxyHeaders })
    if (!response.ok) return res.status(response.status).send(await response.text())
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Immich proxy error (album by id):', error)
    res.status(500).json({ error: 'Failed to proxy to Immich' })
  }
})

app.get('/api/immich/people', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/people?withHidden=false`, { headers: immichProxyHeaders })
    if (!response.ok) return res.status(response.status).send(await response.text())
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Immich proxy error (people):', error)
    res.status(500).json({ error: 'Failed to proxy to Immich' })
  }
})

app.post('/api/immich/search/metadata', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/search/metadata`, {
      method: 'POST',
      headers: immichProxyHeaders,
      body: JSON.stringify(req.body)
    })
    if (!response.ok) return res.status(response.status).send(await response.text())
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Immich proxy error (search):', error)
    res.status(500).json({ error: 'Failed to proxy to Immich' })
  }
})

app.put('/api/immich/people/:id', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/people/${req.params.id}`, {
      method: 'PUT',
      headers: immichProxyHeaders,
      body: JSON.stringify(req.body)
    })
    if (!response.ok) return res.status(response.status).send(await response.text())
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Immich proxy error (update person):', error)
    res.status(500).json({ error: 'Failed to proxy to Immich' })
  }
})

app.get('/api/immich/people/:id/thumbnail', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/people/${req.params.id}/thumbnail`, {
      headers: { 'x-api-key': IMMICH_API_KEY }
    })
    if (!response.ok) return res.status(404).send(Buffer.from(''))
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    console.error('Immich proxy error (person thumbnail):', error.message)
    res.status(404).send(Buffer.from(''))
  }
})

app.get('/api/immich/assets/:id/thumbnail', async (req, res) => {
  try {
    const size = req.query.size || 'thumbnail'
    const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${req.params.id}/thumbnail?size=${size}`, {
      headers: { 'x-api-key': IMMICH_API_KEY }
    })
    if (!response.ok) return res.status(404).send(Buffer.from(''))
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    console.error('Immich proxy error (asset thumbnail):', error.message)
    res.status(404).send(Buffer.from(''))
  }
})

app.get('/api/immich/assets/:id/original', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${req.params.id}/original`, {
      headers: { 'x-api-key': IMMICH_API_KEY }
    })
    if (!response.ok) return res.status(404).send(Buffer.from(''))
    
    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
    
    const cd = response.headers.get('content-disposition')
    if (cd) {
      res.set('Content-Disposition', cd)
    } else {
      res.set('Content-Disposition', `attachment; filename="immich-asset-${req.params.id}.jpg"`)
    }
    
    Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    console.error('Immich proxy error (asset original):', error.message)
    res.status(404).send(Buffer.from(''))
  }
})

// Deprecated seedDataIfEmpty removed

const PORT = process.env.PORT || 5001
app.listen(PORT, async () => {
  console.log(`Express API Server listening on port ${PORT}`)
})

// Force nodemon restart
