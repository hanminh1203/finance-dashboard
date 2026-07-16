"""Shared receipt comment helpers."""


def parse_store_comment(comment_text: str) -> tuple[str, str]:
    """Split write convention '{store} : {comment}'."""
    text = str(comment_text or '')
    if ' : ' in text:
        store, comment = text.split(' : ', 1)
        return store.strip(), comment
    return text.strip(), ''
