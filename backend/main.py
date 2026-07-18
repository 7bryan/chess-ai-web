from contextlib import asynccontextmanager

from engine import ChessGame
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

game = ChessGame()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # server is shutting down -- make sure no stockfish.exe process is left running
    game.close()


app = FastAPI(lifespan=lifespan)

# Allows your frontend (served from a different port/file) to call this API.
# Fine for local dev; tighten allow_origins before deploying publicly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NewGameRequest(BaseModel):
    color: str = "white"  # "white" or "black" -- which side the player takes
    elo: int = 1500  # stockfish strength, roughly 1320-3000


class MoveRequest(BaseModel):
    move: str  # UCI format, e.g. "e2e4" or "e7e8q" for promotion to queen


@app.get("/")
async def read_root():
    return {"status": "ok", "detail": "Backend is active"}


@app.post("/new-game")
async def new_game(req: NewGameRequest):
    if req.color not in ("white", "black"):
        raise HTTPException(400, "color must be 'white' or 'black'")
    if not (1320 <= req.elo <= 3000):
        raise HTTPException(400, "elo must be between 1320 and 3000")

    return game.start_new_game(player_color=req.color, elo=req.elo)


@app.post("/move")
async def make_move(req: MoveRequest):
    try:
        return game.make_player_move(req.move)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(409, str(e))


@app.get("/game-state")
async def game_state():
    return game.get_state()


@app.get("/legal-moves/{square}")
async def legal_moves(square: str):
    """
    Legal destination squares for the piece on `square` (e.g. /legal-moves/e2).
    Used by the frontend to highlight valid moves when a piece is clicked.
    """
    try:
        return {"square": square, "moves": game.get_legal_moves_from(square)}
    except ValueError as e:
        raise HTTPException(400, str(e))
