# Generated migration to add missing fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookmarks', '0002_savedview_bookmark_content_bookmark_is_read_and_more'),
    ]

    operations = [
        # Add cover_image field to Collection model if it doesn't exist
        migrations.AddField(
            model_name='collection',
            name='cover_image',
            field=models.URLField(blank=True, null=True),
        ),
        # Add order field to Collection model if it doesn't exist
        migrations.AddField(
            model_name='collection',
            name='order',
            field=models.PositiveIntegerField(default=0),
        ),
        # Add order field to Tag model if it doesn't exist
        migrations.AddField(
            model_name='tag',
            name='order',
            field=models.PositiveIntegerField(default=0),
        ),
        # Update ordering for Collection
        migrations.AlterModelOptions(
            name='collection',
            options={'ordering': ['order', 'name']},
        ),
        # Update ordering for Tag
        migrations.AlterModelOptions(
            name='tag',
            options={'ordering': ['order', 'name']},
        ),
    ]