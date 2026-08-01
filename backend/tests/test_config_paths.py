from pathlib import Path

from app.core.config import ROOT_ENV_FILE, Settings


def test_settings_load_the_repository_env_file_independent_of_working_directory() -> None:
    repository_root = Path(__file__).resolve().parents[2]

    assert ROOT_ENV_FILE == repository_root / ".env"
    assert Settings.model_config["env_file"] == ROOT_ENV_FILE
    assert ROOT_ENV_FILE.is_absolute()
