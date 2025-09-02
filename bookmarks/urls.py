from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'bookmarks', views.BookmarkViewSet, basename='bookmark')
router.register(r'tags', views.TagViewSet, basename='tag')
router.register(r'collections', views.CollectionViewSet, basename='collection')
router.register(r'activities', views.BookmarkActivityViewSet, basename='activity')
router.register(r'saved-views', views.SavedViewViewSet, basename='saved-view')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', views.login_view, name='login'),
    path('auth/register/', views.register_view, name='register'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me_view, name='me'),
    path('auth/auto-login/', views.auto_login_view, name='auto-login'),
    
    # Quick add bookmark
    path('bookmarks/quick-add/', views.quick_add_bookmark, name='quick-add-bookmark'),
    
    # Statistics
    path('stats/', views.bookmark_stats, name='bookmark-stats'),
    
    # API endpoints
    path('', include(router.urls)),
]