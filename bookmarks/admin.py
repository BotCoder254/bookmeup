from django.contrib import admin
from .models import (
    Bookmark, Tag, Collection, BookmarkActivity,
    BookmarkNote, BookmarkSnapshot, BookmarkHighlight
)



@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'user', 'created_at']
    list_filter = ['created_at', 'user']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}
    list_per_page = 25


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'is_public', 'bookmark_count', 'created_at']
    list_filter = ['is_public', 'created_at', 'user']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['bookmark_count']
    list_per_page = 25


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ['title', 'url', 'user', 'domain', 'is_favorite', 'is_archived', 'created_at']
    list_filter = [
        'is_favorite',
        'is_archived',
        'is_public',
        'created_at',
        'user',
        'collection',
        'tags'
    ]
    search_fields = ['title', 'url', 'description', 'domain']
    readonly_fields = ['domain', 'created_at', 'updated_at']
    filter_horizontal = ['tags']
    list_per_page = 25
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'url', 'description')
        }),
        ('Organization', {
            'fields': ('collection', 'tags')
        }),
        ('Metadata', {
            'fields': ('favicon_url', 'screenshot_url', 'domain')
        }),
        ('Settings', {
            'fields': ('is_favorite', 'is_archived', 'is_public', 'visited_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(BookmarkActivity)
class BookmarkActivityAdmin(admin.ModelAdmin):
    list_display = ['bookmark', 'user', 'activity_type', 'timestamp']
    list_filter = ['activity_type', 'timestamp', 'user']
    search_fields = ['bookmark__title', 'bookmark__url']
    readonly_fields = ['timestamp']
    list_per_page = 50
    date_hierarchy = 'timestamp'


@admin.register(BookmarkNote)
class BookmarkNoteAdmin(admin.ModelAdmin):
    list_display = ['bookmark', 'user', 'created_at', 'updated_at', 'is_active']
    list_filter = ['is_active', 'created_at', 'user']
    search_fields = ['bookmark__title', 'content', 'plain_text']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 25
    date_hierarchy = 'created_at'


@admin.register(BookmarkSnapshot)
class BookmarkSnapshotAdmin(admin.ModelAdmin):
    list_display = ['bookmark', 'created_at', 'status']
    list_filter = ['status', 'created_at']
    search_fields = ['bookmark__title', 'plain_text']
    readonly_fields = ['created_at']
    list_per_page = 25
    date_hierarchy = 'created_at'


@admin.register(BookmarkHighlight)
class BookmarkHighlightAdmin(admin.ModelAdmin):
    list_display = ['bookmark', 'user', 'created_at', 'color']
    list_filter = ['color', 'created_at', 'user']
    search_fields = ['bookmark__title', 'text', 'note']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 25
    date_hierarchy = 'created_at'
