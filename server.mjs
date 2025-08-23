import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const distPath = path.join(__dirname, 'dist')

app.disable('x-powered-by')
app.use(express.static(distPath, { maxAge: '1h' }))

// SPA fallback – send index.html for any non-file route
app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')))

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => console.log('✅ TradeScout running on', port))