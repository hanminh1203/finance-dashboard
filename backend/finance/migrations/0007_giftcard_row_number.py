# Wipe giftcards before adding unique row_number (separate from schema change).

from django.db import migrations


def wipe_giftcards(apps, schema_editor):
    Giftcard = apps.get_model('finance', 'Giftcard')
    Giftcard.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_giftcard_and_transaction_fk'),
    ]

    operations = [
        migrations.RunPython(wipe_giftcards, migrations.RunPython.noop),
    ]
