"""Compare and bulk-sync Sheet mirror tables into Postgres."""

from __future__ import annotations

import re
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction as db_transaction
from django.utils import timezone

from finance.db_writer import _parse_date
from finance.models import Receipt, ReceiptItem, Transaction
from finance.sheets_client import SheetsClient


class SyncError(Exception):
    """Raised when Sheet→Postgres sync cannot proceed safely."""


def _cell(row: dict, *names: str) -> Any:
    lower = {str(k).strip().lower(): v for k, v in row.items()}
    for name in names:
        if name.lower() in lower:
            return lower[name.lower()]
    return None


def _sheet_dec(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = re.sub(r'[^0-9.\-]', '', str(value or '').strip())
    if not text or text == '-' or text == '.':
        raise ValueError(f'Invalid decimal: {value!r}')
    try:
        return Decimal(text)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f'Invalid decimal: {value!r}') from exc


def _optional_uuid(value: Any) -> uuid.UUID | None:
    text = str(value or '').strip()
    if not text:
        return None
    try:
        return uuid.UUID(text)
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError(f'Invalid UUID: {value!r}') from exc


def _fp_dec(value: Decimal) -> str:
    return format(value.normalize(), 'f')


def _receipt_fp(receipt_id: uuid.UUID, d: date, total: Decimal) -> tuple:
    return (str(receipt_id), d.isoformat(), _fp_dec(total))


def _item_fp(
    receipt_id: uuid.UUID, name: str, amount: Decimal, unit: str, money: Decimal
) -> tuple:
    return (str(receipt_id), str(name or '').strip(), _fp_dec(amount), str(unit or '').strip(), _fp_dec(money))


def _tx_fp(
    d: date,
    change: Decimal,
    source: str,
    comment: str,
    sub_category: str,
    receipt_id: uuid.UUID | None,
) -> tuple:
    return (
        d.isoformat(),
        _fp_dec(change),
        str(source or '').strip(),
        str(comment or ''),
        str(sub_category or '').strip(),
        str(receipt_id) if receipt_id else '',
    )


def _parse_receipt_row(row: dict, index: int) -> tuple[uuid.UUID, date, Decimal]:
    try:
        rid = _optional_uuid(_cell(row, 'Receipt ID'))
        if rid is None:
            raise ValueError('Receipt ID is required')
        return (
            rid,
            _parse_date(_cell(row, 'Date')),
            _sheet_dec(_cell(row, 'Total')),
        )
    except ValueError as exc:
        raise SyncError(f'Receipt row {index + 1}: {exc}') from exc


def _parse_item_row(row: dict, index: int) -> tuple[uuid.UUID, str, Decimal, str, Decimal]:
    try:
        rid = _optional_uuid(_cell(row, 'Receipt ID'))
        if rid is None:
            raise ValueError('Receipt ID is required')
        name = str(_cell(row, 'Name') or '').strip()
        if not name:
            raise ValueError('Name is required')
        unit = str(_cell(row, 'Unit') or '').strip()
        return (
            rid,
            name,
            _sheet_dec(_cell(row, 'Amount')),
            unit,
            _sheet_dec(_cell(row, 'Money')),
        )
    except ValueError as exc:
        raise SyncError(f'Receipt item row {index + 1}: {exc}') from exc


def _parse_tx_row(
    row: dict, index: int
) -> tuple[date, Decimal, str, str, str, uuid.UUID | None]:
    try:
        return (
            _parse_date(_cell(row, 'Date')),
            _sheet_dec(_cell(row, 'Change')),
            str(_cell(row, 'Source') or '').strip(),
            str(_cell(row, 'Comment') or ''),
            str(_cell(row, 'Sub category', 'Sub Category') or ''),
            _optional_uuid(_cell(row, 'Receipt ID')),
        )
    except ValueError as exc:
        raise SyncError(f'Transaction row {index + 1}: {exc}') from exc


def _parse_sheet_fingerprints(source: dict[str, list[dict]]) -> dict[str, list[tuple]]:
    receipts = [
        _receipt_fp(*_parse_receipt_row(row, i)) for i, row in enumerate(source['receipts'])
    ]
    items = [
        _item_fp(*_parse_item_row(row, i)) for i, row in enumerate(source['receipt_items'])
    ]
    transactions = [
        _tx_fp(*_parse_tx_row(row, i)) for i, row in enumerate(source['transactions'])
    ]
    return {
        'receipt': receipts,
        'receipt_items': items,
        'transactions': transactions,
    }


def _db_fingerprints() -> dict[str, list[tuple]]:
    receipts = [
        _receipt_fp(r.id, r.date, r.total) for r in Receipt.objects.all().iterator()
    ]
    items = [
        _item_fp(it.receipt_id, it.name, it.amount, it.unit, it.money)
        for it in ReceiptItem.objects.all().iterator()
    ]
    transactions = [
        _tx_fp(tx.date, tx.change, tx.source, tx.comment, tx.sub_category, tx.receipt_id)
        for tx in Transaction.objects.all().iterator()
    ]
    return {
        'receipt': receipts,
        'receipt_items': items,
        'transactions': transactions,
    }


def _table_status(sheet_fps: list[tuple], db_fps: list[tuple]) -> dict:
    return {
        'sheet_count': len(sheet_fps),
        'db_count': len(db_fps),
        'matched': sorted(sheet_fps) == sorted(db_fps),
    }


def compare_mirror(client: SheetsClient) -> dict:
    """Return Sheet vs Postgres match status for mirror tables."""
    source = client.get_mirror_source_rows()
    sheet_fps = _parse_sheet_fingerprints(source)
    db_fps = _db_fingerprints()

    tables = {
        key: _table_status(sheet_fps[key], db_fps[key])
        for key in ('transactions', 'receipt', 'receipt_items')
    }
    return {
        'matched': all(t['matched'] for t in tables.values()),
        'checked_at': timezone.now().isoformat(),
        'tables': tables,
    }


def sync_from_sheets(client: SheetsClient) -> dict:
    """
    Wipe Postgres mirror tables and reload from Google Sheet.

    Parses all sheet rows first so validation errors leave the DB unchanged.
    Wipe + insert run in one atomic block.
    """
    source = client.get_mirror_source_rows()

    receipt_objs: list[Receipt] = []
    seen_receipt_ids: set[uuid.UUID] = set()
    for i, row in enumerate(source['receipts']):
        rid, d, total = _parse_receipt_row(row, i)
        if rid in seen_receipt_ids:
            raise SyncError(f'Receipt row {i + 1}: duplicate Receipt ID {rid}')
        seen_receipt_ids.add(rid)
        receipt_objs.append(Receipt(id=rid, version=1, date=d, total=total))

    item_objs: list[ReceiptItem] = []
    for i, row in enumerate(source['receipt_items']):
        rid, name, amount, unit, money = _parse_item_row(row, i)
        if rid not in seen_receipt_ids:
            raise SyncError(
                f'Receipt item row {i + 1}: Receipt ID {rid} not found in Receipt table'
            )
        item_objs.append(
            ReceiptItem(
                id=uuid.uuid4(),
                version=1,
                receipt_id=rid,
                name=name,
                amount=amount,
                unit=unit,
                money=money,
            )
        )

    tx_objs: list[Transaction] = []
    for i, row in enumerate(source['transactions']):
        d, change, source_name, comment, sub_category, receipt_id = _parse_tx_row(row, i)
        if receipt_id is not None and receipt_id not in seen_receipt_ids:
            raise SyncError(
                f'Transaction row {i + 1}: Receipt ID {receipt_id} not found in Receipt table'
            )
        tx_objs.append(
            Transaction(
                id=uuid.uuid4(),
                version=1,
                date=d,
                change=change,
                source=source_name,
                comment=comment,
                sub_category=sub_category,
                receipt_id=receipt_id,
            )
        )

    with db_transaction.atomic():
        Transaction.objects.all().delete()
        ReceiptItem.objects.all().delete()
        Receipt.objects.all().delete()
        Receipt.objects.bulk_create(receipt_objs)
        ReceiptItem.objects.bulk_create(item_objs)
        Transaction.objects.bulk_create(tx_objs)

    return {
        'ok': True,
        'inserted': {
            'transactions': len(tx_objs),
            'receipt': len(receipt_objs),
            'receipt_items': len(item_objs),
        },
    }
