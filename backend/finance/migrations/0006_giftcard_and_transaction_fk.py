# Giftcard mirror table + optional Transaction.giftcard FK

import django.db.models.deletion
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_transaction_row_number'),
    ]

    operations = [
        migrations.CreateModel(
            name='Giftcard',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('version', models.PositiveIntegerField(default=1)),
                ('creation_date', models.DateTimeField(auto_now_add=True)),
                ('shop', models.CharField(max_length=256)),
                ('date', models.DateField()),
                ('balance', models.DecimalField(decimal_places=2, max_digits=14)),
            ],
            options={
                'db_table': 'giftcard',
            },
        ),
        migrations.AddField(
            model_name='transaction',
            name='giftcard',
            field=models.ForeignKey(
                blank=True,
                db_column='giftcard_id',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='transactions',
                to='finance.giftcard',
            ),
        ),
    ]
