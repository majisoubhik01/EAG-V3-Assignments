from pathlib import Path
import hashlib

ARTIFACT_DIR = Path("state/artifacts")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def put_bytes(data: bytes) -> str:
    digest = hashlib.sha256(data).hexdigest()[:16]
    art_id = f"art:{digest}"
    path = ARTIFACT_DIR / digest
    path.write_bytes(data)
    return art_id


def get_bytes(artifact_id: str) -> bytes:
    digest = artifact_id.replace("art:", "")
    path = ARTIFACT_DIR / digest
    return path.read_bytes()


def exists(artifact_id: str) -> bool:
    digest = artifact_id.replace("art:", "")
    return (ARTIFACT_DIR / digest).exists()
