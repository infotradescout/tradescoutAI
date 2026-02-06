import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
// Serve the built client from dist/public to match Vite's outDir
const distPath = path.join(__dirname, 'dist', 'public')

app.disable('x-powered-by')

// 1️⃣ Serve hashed assets first with long cache
const assetsPath = path.join(distPath, 'assets')
app.use(
	'/assets',
	express.static(assetsPath, {
		immutable: true,
		maxAge: '1y',
	})
)

// 2️⃣ Serve other static files (but do not auto-fallback to index.html yet)
app.use(
	express.static(distPath, {
		index: false,
		maxAge: '1h',
		setHeaders: (res, filePath) => {
			if (filePath.endsWith('.html')) {
				res.setHeader('Cache-Control', 'no-store')
			}
		},
	})
)

// 3️⃣ SPA fallback LAST – never for /api or /assets
app.get('*', (req, res) => {
	const reqPath = req.path || ''

	if (reqPath.startsWith('/api')) {
		return res.status(404).json({ message: 'Not found' })
	}

	if (reqPath.startsWith('/assets')) {
		return res.status(404).end()
	}

	res.setHeader('Cache-Control', 'no-store')
	res.sendFile(path.join(distPath, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => console.log('✅ TradeScout running on', port))
