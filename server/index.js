import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pkgClient from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'

const { PrismaClient } = pkgClient

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })
const app = express()

app.use(cors())
app.use(express.json())

// Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { username, name, major, bio, avatarColor } = req.body

  if (!username || !name || !major) {
    return res.status(400).json({ error: 'Username, name, and major are required.' })
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' })
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        name,
        major,
        bio: bio || '',
        avatarColor: avatarColor || '#7c563f'
      }
    })

    res.status(201).json(newUser)
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error during registration.' })
  }
})

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username } = req.body

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' })
    }

    res.json(user)
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error during login.' })
  }
})

// Feed Posts Endpoint: GET all posts
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        author: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    res.json(posts)
  } catch (error) {
    console.error('Fetch posts error:', error)
    res.status(500).json({ error: 'Internal server error while fetching posts.' })
  }
})

// Create Post Endpoint
app.post('/api/posts', async (req, res) => {
  const { content, authorId, tags } = req.body

  if (!content || !authorId) {
    return res.status(400).json({ error: 'Content and authorId are required.' })
  }

  try {
    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(authorId) }
    })

    if (!userExists) {
      return res.status(400).json({ error: 'Author profile not found.' })
    }

    const newPost = await prisma.post.create({
      data: {
        content,
        authorId: parseInt(authorId),
        tags: tags || '',
        likes: 0
      },
      include: {
        author: true
      }
    })

    res.status(201).json(newPost)
  } catch (error) {
    console.error('Create post error:', error)
    res.status(500).json({ error: 'Internal server error while creating post.' })
  }
})

// Like Post Endpoint
app.post('/api/posts/:id/like', async (req, res) => {
  const { id } = req.params

  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) }
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' })
    }

    const updatedPost = await prisma.post.update({
      where: { id: parseInt(id) },
      data: {
        likes: post.likes + 1
      },
      include: {
        author: true
      }
    })

    res.json(updatedPost)
  } catch (error) {
    console.error('Like post error:', error)
    res.status(500).json({ error: 'Internal server error while liking post.' })
  }
})

// Immich Proxy Routes
const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL || 'http://159.223.45.67:8080'
const IMMICH_API_KEY = process.env.IMMICH_API_KEY

const immichProxyHeaders = {
  'x-api-key': IMMICH_API_KEY,
  'Content-Type': 'application/json'
}

app.get('/api/immich/people', async (req, res) => {
  try {
    const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/people?withHidden=false`, { headers: immichProxyHeaders })
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
    const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/search/metadata`, {
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
    const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/people/${req.params.id}`, {
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
    const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/people/${req.params.id}/thumbnail`, {
      headers: { 'x-api-key': IMMICH_API_KEY }
    })
    if (!response.ok) return res.status(response.status).send('Thumbnail fetch failed')
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    const arrayBuffer = await response.arrayBuffer()
    res.send(Buffer.from(arrayBuffer))
  } catch (error) {
    console.error('Immich proxy error (person thumbnail):', error)
    res.status(500).send('Proxy error')
  }
})

app.get('/api/immich/assets/:id/thumbnail', async (req, res) => {
  try {
    const size = req.query.size || 'thumbnail'
    const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/assets/${req.params.id}/thumbnail?size=${size}`, {
      headers: { 'x-api-key': IMMICH_API_KEY }
    })
    if (!response.ok) return res.status(response.status).send('Thumbnail fetch failed')
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    const arrayBuffer = await response.arrayBuffer()
    res.send(Buffer.from(arrayBuffer))
  } catch (error) {
    console.error('Immich proxy error (asset thumbnail):', error)
    res.status(500).send('Proxy error')
  }
})

// Seed database with default posts if empty
const seedDataIfEmpty = async () => {
  try {
    const postCount = await prisma.post.count()
    if (postCount === 0) {
      console.log('Seeding initial board posts...')
      // Create a default admin/staff profile
      const staffUser = await prisma.user.upsert({
        where: { username: 'staff_baan7' },
        update: {},
        create: {
          username: 'staff_baan7',
          name: 'Baan 7 Staff',
          major: 'Orientation Board',
          bio: 'Official organizers for Baan 7 Orientation.',
          avatarColor: '#496268'
        }
      })

      // Create a default senior profile
      const seniorUser = await prisma.user.upsert({
        where: { username: 'alex_mercer' },
        update: {},
        create: {
          username: 'alex_mercer',
          name: 'Alex Mercer',
          major: 'Orientation Leader',
          bio: 'Senior student, looking forward to meeting all of you!',
          avatarColor: '#7c563f'
        }
      })

      await prisma.post.createMany({
        data: [
          {
            content: 'Just finished the campus tour. The new science building looks amazing! Can\'t wait for classes to start. 🔥',
            authorId: seniorUser.id,
            tags: 'Orientation',
            likes: 24
          },
          {
            content: 'Welcome incoming freshmen! Make sure to attend the opening ceremony tomorrow at 9 AM in the main hall. It\'s going to be spectacular.',
            authorId: staffUser.id,
            tags: 'Staff',
            likes: 102
          }
        ]
      })
      console.log('Database seeded successfully.')
    }
  } catch (err) {
    console.error('Error during data seeding:', err)
  }
}

const PORT = process.env.PORT || 5001
app.listen(PORT, async () => {
  console.log(`Express API Server listening on port ${PORT}`)
  await seedDataIfEmpty()
})

// Force nodemon restart
