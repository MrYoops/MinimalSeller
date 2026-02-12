#!/usr/bin/env python3
"""
Debug script to check registered routes
"""

import sys
sys.path.append('backend')

def debug_routes():
    """Check what routes are actually registered"""
    try:
        print("🔍 DEBUGGING REGISTERED ROUTES")
        print("=" * 50)
        
        from backend.server import app
        
        print("📋 Registered routes:")
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                methods = getattr(route, 'methods', set())
                if methods:
                    print(f"   {route.path} -> {list(methods)}")
        
        print("\n🎯 Looking for marketplace routes:")
        for route in app.routes:
            if hasattr(route, 'path') and 'marketplace' in route.path:
                methods = getattr(route, 'methods', set())
                print(f"   📍 {route.path} -> {list(methods)}")
                
        print("\n🔍 Checking products router specifically:")
        from backend.routers.products import router
        print(f"   Products router prefix: {router.prefix}")
        
        print("\n📋 Products router routes:")
        for route in router.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                full_path = router.prefix + route.path
                methods = getattr(route, 'methods', set())
                print(f"   {full_path} -> {list(methods)}")
        
    except Exception as e:
        print(f"❌ DEBUG FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_routes()
