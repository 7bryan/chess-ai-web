import os

import chess
import chess.engine
from dotenv import load_dotenv

load_dotenv()

STOCKFISH_PATH: str = os.getenv("STOCKFISH_PATH", "")
DEFAULT_ELO = 1500
AI_THINK_TIME = 1.0  # seconds Stockfish gets to pick its move
EVAL_TIME = 0.3  # seconds Stockfish gets to just evaluate the position


class ChessGame:
    """
    Wraps a python-chess Board (rules/state) and a Stockfish engine process
    (the AI opponent). One instance = one active game.
    """

    def __init__(self):
        self.board: chess.Board | None = None
        self.engine: chess.engine.SimpleEngine | None = None
        self.player_color: chess.Color = chess.WHITE
        self.elo: int = DEFAULT_ELO
        self.last_ai_move: str | None = None

    def start_new_game(
        self, player_color: str = "white", elo: int = DEFAULT_ELO
    ) -> dict:
        self.close()  # kill any leftover engine process from a previous game

        self.board = chess.Board()
        self.player_color = chess.WHITE if player_color == "white" else chess.BLACK
        self.elo = elo
        self.last_ai_move = None

        self.engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        self.engine.configure(
            {
                "UCI_LimitStrength": True,
                "UCI_Elo": elo,
            }
        )

        # if the player picked black, stockfish (white) moves first
        if self.player_color == chess.BLACK:
            self._make_ai_move()

        return self.get_state()

    def make_player_move(self, move_uci: str) -> dict:
        if self.board is None or self.engine is None:
            raise RuntimeError("No active game. Call /new-game first.")

        move = self._parse_move(move_uci)

        if move not in self.board.legal_moves:
            raise ValueError(f"Illegal move: {move_uci}")

        self.board.push(move)

        if not self.board.is_game_over():
            self._make_ai_move()

        return self.get_state()

    def _parse_move(self, move_uci: str) -> chess.Move:
        """
        Turns a UCI string into a Move, auto-promoting to queen if the
        frontend sent a bare pawn move (e.g. "e7e8") without a promotion
        piece. Raises ValueError on malformed input instead of letting
        python-chess's exception bubble up as a 500.
        """
        try:
            move = chess.Move.from_uci(move_uci)
        except chess.InvalidMoveError:
            raise ValueError(f"Malformed move string: {move_uci}")

        if move not in self.board.legal_moves and len(move_uci) == 4:
            queen_promo = chess.Move.from_uci(move_uci + "q")
            if queen_promo in self.board.legal_moves:
                return queen_promo

        return move

    def _make_ai_move(self) -> None:
        result = self.engine.play(self.board, chess.engine.Limit(time=AI_THINK_TIME))
        if result.move is not None:
            self.board.push(result.move)
            self.last_ai_move = result.move.uci()

    def get_legal_moves_from(self, square_name: str) -> list[str]:
        """Legal destination moves (UCI) for a piece on the given square."""
        if self.board is None:
            return []
        try:
            square = chess.parse_square(square_name)
        except ValueError:
            raise ValueError(f"Invalid square: {square_name}")

        return [m.uci() for m in self.board.legal_moves if m.from_square == square]

    def get_eval(self) -> dict:
        """Position evaluation from White's perspective, for the eval bar."""
        if self.engine is None or self.board is None:
            return {"type": "cp", "value": 0}

        # Stockfish can't analyse a finished position -- infer the result instead.
        if self.board.is_game_over():
            if self.board.is_checkmate():
                # the side to move has been mated, so the mate "belongs" to the other side
                value = -1 if self.board.turn == chess.WHITE else 1
                return {"type": "mate", "value": value}
            return {"type": "cp", "value": 0}  # stalemate/draw

        info = self.engine.analyse(self.board, chess.engine.Limit(time=EVAL_TIME))
        score = info["score"].white()

        if score.is_mate():
            return {"type": "mate", "value": score.mate()}
        return {"type": "cp", "value": score.score()}

    def get_state(self) -> dict:
        if self.board is None:
            return {"active": False}

        return {
            "active": True,
            "fen": self.board.fen(),
            "turn": "white" if self.board.turn == chess.WHITE else "black",
            "player_color": "white" if self.player_color == chess.WHITE else "black",
            "legal_moves": [m.uci() for m in self.board.legal_moves],
            "is_check": self.board.is_check(),
            "is_game_over": self.board.is_game_over(),
            "result": self.board.result() if self.board.is_game_over() else None,
            "eval": self.get_eval(),
            "ai_move": self.last_ai_move,
        }

    def close(self) -> None:
        if self.engine is not None:
            try:
                self.engine.quit()
            except Exception:
                pass  # engine process may already be dead; don't crash on cleanup
            self.engine = None
