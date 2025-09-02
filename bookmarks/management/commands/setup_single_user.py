from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.conf import settings
import os


class Command(BaseCommand):
    help = 'Setup single-user mode with default admin user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Username for the admin user (default: admin)'
        )
        parser.add_argument(
            '--email',
            type=str,
            default='admin@localhost',
            help='Email for the admin user (default: admin@localhost)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='bookmarkvault123',
            help='Password for the admin user (default: bookmarkvault123)'
        )

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']

        # Check if any users exist
        if User.objects.exists():
            self.stdout.write(
                self.style.WARNING(
                    'Users already exist. Single-user setup skipped.'
                )
            )
            return

        # Create the admin user
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_staff=True,
                is_superuser=True
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created admin user: {username}'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Email: {email}'
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    f'Password: {password}'
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    'Please change the password after first login!'
                )
            )
            
            # Set single-user mode in environment if not set
            if not os.environ.get('SINGLE_USER_MODE'):
                self.stdout.write(
                    self.style.SUCCESS(
                        'Single-user mode enabled. Registration is disabled.'
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'Error creating admin user: {str(e)}'
                )
            )