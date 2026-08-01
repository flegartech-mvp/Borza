from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.engine import Engine

from app.database import engine

ALEMBIC_UPGRADE_COMMAND = "cd backend && python -m alembic upgrade head"


class SchemaStateError(RuntimeError):
    """Raised when the connected database is not at the application's Alembic head."""


@dataclass(frozen=True)
class SchemaState:
    current_heads: tuple[str, ...]
    required_heads: tuple[str, ...]

    @property
    def is_current(self) -> bool:
        return set(self.current_heads) == set(self.required_heads)


def _script_directory() -> ScriptDirectory:
    backend_root = Path(__file__).resolve().parents[2]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    return ScriptDirectory.from_config(config)


def inspect_schema_state(bind: Engine = engine) -> SchemaState:
    required_heads = tuple(sorted(_script_directory().get_heads()))
    with bind.connect() as connection:
        context = MigrationContext.configure(connection)
        current_heads = tuple(sorted(context.get_current_heads()))
    return SchemaState(current_heads=current_heads, required_heads=required_heads)


def ensure_schema_at_head(bind: Engine = engine) -> SchemaState:
    state = inspect_schema_state(bind)
    if state.is_current:
        return state
    current = ", ".join(state.current_heads) if state.current_heads else "unversioned"
    required = ", ".join(state.required_heads) if state.required_heads else "none"
    raise SchemaStateError(
        "Database schema is not at the required Alembic head "
        f"(current: {current}; required: {required}). "
        f"Repair it with: {ALEMBIC_UPGRADE_COMMAND}"
    )
