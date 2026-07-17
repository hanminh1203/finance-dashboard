from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from finance.db_reader import get_dashboard_data
from finance.models import Category, Source, Transaction


class DashboardDataTests(TestCase):
    def setUp(self):
        self.source = Source.objects.create(name='Everyday', type='Bank')
        self.salary = Category.objects.create(
            main_category='Earnings',
            sub_category='Salary',
            type='Income',
        )
        self.groceries = Category.objects.create(
            main_category='Living',
            sub_category='Groceries',
            type='Expense',
        )
        self.rent = Category.objects.create(
            main_category='Living',
            sub_category='Rent',
            type='Expense',
        )

    def add_transaction(self, row, value, amount, category=None, comment=''):
        return Transaction.objects.create(
            row_number=row,
            date=value,
            change=Decimal(amount),
            source=self.source,
            category=category,
            comment=comment,
        )

    @patch('finance.db_reader.timezone.localdate', return_value=date(2026, 1, 15))
    def test_dashboard_calculates_current_month_and_three_month_breakdowns(self, _localdate):
        self.add_transaction(1, date(2025, 9, 30), '100.00', self.salary)
        self.add_transaction(2, date(2025, 10, 10), '400.00', self.salary)
        self.add_transaction(3, date(2025, 11, 10), '-50.00', self.groceries)
        self.add_transaction(4, date(2025, 12, 10), '200.00', self.salary)
        self.add_transaction(5, date(2026, 1, 5), '1000.00', self.salary)
        self.add_transaction(6, date(2026, 1, 7), '-300.00', self.rent)
        self.add_transaction(7, date(2026, 1, 8), '-75.00', self.groceries)
        self.add_transaction(8, date(2026, 1, 9), '-25.00', None, 'Transfer')

        data = get_dashboard_data()

        self.assertEqual(data['months'], ['2025/11', '2025/12', '2026/01'])
        self.assertEqual(
            data['summary'],
            {
                'netWorth': 1250.0,
                'income': 1000.0,
                'expense': -375.0,
                'saving': 625.0,
            },
        )
        self.assertEqual(
            data['incomeBreakdown'],
            [{
                'subCategory': 'Salary',
                'amounts': {
                    '2025/11': 0.0,
                    '2025/12': 200.0,
                    '2026/01': 1000.0,
                },
            }],
        )
        self.assertEqual(
            data['expenseBreakdown'],
            [
                {
                    'subCategory': 'Groceries',
                    'amounts': {
                        '2025/11': -50.0,
                        '2025/12': 0.0,
                        '2026/01': -75.0,
                    },
                },
                {
                    'subCategory': 'Rent',
                    'amounts': {
                        '2025/11': 0.0,
                        '2025/12': 0.0,
                        '2026/01': -300.0,
                    },
                },
            ],
        )
        self.assertEqual(
            [transaction['date'] for transaction in data['transactions']],
            ['2026-01-09', '2026-01-08', '2026-01-07', '2026-01-05'],
        )
        self.assertEqual(data['transactions'][1]['subCategory'], 'Groceries')
        self.assertEqual(data['transactions'][1]['type'], 'Expense')

    @patch('finance.db_reader.timezone.localdate', return_value=date(2026, 1, 15))
    def test_dashboard_zero_fills_month_with_no_data(self, _localdate):
        data = get_dashboard_data()

        self.assertEqual(
            data['summary'],
            {'netWorth': 0.0, 'income': 0.0, 'expense': 0.0, 'saving': 0.0},
        )
        self.assertEqual(data['incomeBreakdown'], [])
        self.assertEqual(data['expenseBreakdown'], [])
        self.assertEqual(data['transactions'], [])


class DashboardApiTests(TestCase):
    def test_dashboard_requires_authentication(self):
        response = self.client.get('/api/dashboard')

        self.assertEqual(response.status_code, 401)

    @patch('finance.api_views.get_dashboard_data')
    @patch('finance.api_views.oauth.get_access_token', return_value='token')
    def test_dashboard_returns_backend_payload(self, _access_token, get_data):
        get_data.return_value = {
            'summary': {'netWorth': 10, 'income': 5, 'expense': -2, 'saving': 3},
            'months': [],
            'incomeBreakdown': [],
            'expenseBreakdown': [],
            'transactions': [],
        }

        response = self.client.get('/api/dashboard')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), get_data.return_value)
