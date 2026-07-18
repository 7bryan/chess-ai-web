# Chess AI

A web-based chess game against a Stockfish-powered AI opponent — a full-stack remaster of my earlier [Pygame chess app](https://github.com/7bryan/chess-ai-pygame), rebuilt with a FastAPI backend and a vanilla JS frontend.

Play as white or black, adjust the engine's playing strength, and follow the position's evaluation live as the game progresses.

## Features

- **Play as white or black** — choose your side before each game; the board orientation flips automatically
- **Adjustable AI strength** — set Stockfish's ELO (1320–3000) via a slider before starting
- **Live evaluation bar** — see who's winning, updated after every move, including mate detection
- **Legal move highlighting** — click a piece to see its legal destinations, with capture squares marked separately
- **Last-move indicator** — the two squares of the most recent move are highlighted
- **Check detection** — the king's square is flagged when in check
- **Clean move rendering** — your move appears instantly; Stockfish's reply follows after a short "thinking" beat, so the two moves never feel like they happen at once

## Tech stack

**Backend**

- [FastAPI](https://fastapi.tiangolo.com/) — API framework
- [python-chess](https://python-chess.readthedocs.io/) — move validation, board state, FEN handling
- [Stockfish](https://stockfishchess.org/) — chess engine, controlled via UCI

**Frontend**

- Vanilla HTML, CSS, and JavaScript — no framework, no build step
- Board rendered directly from FEN; state synced with the backend over a small REST API

## Project structure

```
chess-ai-web/
├── backend/
│   ├── main.py              # FastAPI app: routes for new-game, move, game-state, legal-moves
│   ├── engine.py            # ChessGame: wraps python-chess + the Stockfish process
│   ├── requirements.txt
│   └── .env.example         # STOCKFISH_PATH goes here
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── main.js               # board rendering, click-to-move, eval bar, all UI logic
│   └── assets/
│       └── pieces/            # piece SVGs (cburnett set)
└── README.md
```

## Getting started

### Prerequisites

- [Python 3.11+](https://www.python.org)
- A [Stockfish](https://stockfishchess.org/download/) binary for your OS

### Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/` (see `.env.example`):

```
STOCKFISH_PATH=/absolute/path/to/your/stockfish/binary
```

Run the server:

```bash
fastapi dev main.py
```

The API is now live at `http://127.0.0.1:8000` — visit `/docs` for the interactive Swagger UI.

### Frontend setup

No build step required. Just open `frontend/index.html` in a browser (or serve it with any static file server, e.g. VS Code's Live Server).

Make sure the backend is running first — `main.js` expects it at `http://127.0.0.1:8000` by default.

## API overview

| Method | Endpoint                | Description                                    |
| ------ | ----------------------- | ---------------------------------------------- |
| POST   | `/new-game`             | Starts a new game (`color`, `elo` in body)     |
| POST   | `/move`                 | Submits a move in UCI format (`e2e4`, `e7e8q`) |
| GET    | `/game-state`           | Returns the current board state                |
| GET    | `/legal-moves/{square}` | Legal destination squares for a piece          |

Every response includes the FEN, whose turn it is, check/game-over status, and the current evaluation.

## Deployment notes

This project deploys as **two separate services**, not one:

- **Frontend** — static files, deployable to [Vercel](https://vercel.com), Netlify, or GitHub Pages.
- **Backend** — needs a host that supports long-running processes (e.g. [Railway](https://railway.app), [Render](https://render.com), Fly.io), since it keeps a persistent Stockfish subprocess and in-memory game state alive between requests. This rules out serverless platforms like Vercel for the backend itself.

Once the backend is deployed, update `API_BASE` in `frontend/main.js` to point at its public URL, and tighten the `allow_origins` setting in `backend/main.py`'s CORS config to your actual frontend domain.

## Acknowledgments

- [Stockfish](https://stockfishchess.org/) — chess engine
- [python-chess](https://python-chess.readthedocs.io/) — move generation and board logic
- Piece set: [cburnett](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett), via Lichess's open-source piece assets

## License

MIT
