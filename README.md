## Project Structure

```
chess-ai-web/
├── backend/
│   ├── main.py            ← FastAPI app + all routes (new-game, move, eval)
│   ├── engine.py           ← Stockfish wrapper: start/stop, get move, get eval, set elo
│   ├── requirements.txt
│   └── .env.example        ← STOCKFISH_PATH
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── main.js              ← board rendering + click-to-move + all UI logic
│   └── assets/
│       └── pieces/          ← piece images
├── .gitignore
└── README.md
```
