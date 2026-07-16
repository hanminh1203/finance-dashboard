# Giftcard.row_number — Google Sheets 1-based row in the Giftcard table

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0007_giftcard_row_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='giftcard',
            name='row_number',
            field=models.PositiveIntegerField(
                help_text='1-based Google Sheets row number in the Giftcard table.',
                unique=True,
            ),
        ),
    ]
