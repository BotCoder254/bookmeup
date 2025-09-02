from django.apps import AppConfig


class BookmarksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bookmarks'
    
    def ready(self):
        # Auto-setup single user on startup
        import os
        from django.conf import settings
        from django.contrib.auth.models import User
        
        # Only run in development and avoid running during migrations
        if os.environ.get('RUN_MAIN') and getattr(settings, 'AUTO_SETUP_SINGLE_USER', True) and getattr(settings, 'SINGLE_USER_MODE', True):
            try:
                # Only create if no users exist
                if not User.objects.exists():
                    User.objects.create_user(
                        username='admin',
                        email='admin@localhost',
                        password='bookmarkvault123',
                        is_staff=True,
                        is_superuser=True
                    )
                    print('✅ Auto-created single user: admin / bookmarkvault123')
            except Exception as e:
                print(f'❌ Failed to auto-create single user: {e}')
