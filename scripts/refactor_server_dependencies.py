
import os
import glob
import re

ROUTERS_DIR = "backend/routers"

def refactor_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        original_content = content
        
        # 1. Imports
        # Add backend.core.database import if missing and needed
        if "server.db" in content and "from backend.core.database import" not in content:
            content = "from backend.core.database import db\n" + content
            
        # Replace get_current_user import
        content = re.sub(
            r"from backend\.server import get_current_user", 
            "from backend.auth_utils import get_current_user", 
            content
        )
        
        # Remove import backend.server
        content = re.sub(r"import backend\.server\n", "", content)
        content = re.sub(r"import backend\.server", "", content)

        # 2. Usages
        # server.db -> db
        content = re.sub(r"server\.db", "db", content)
        
        # server.client -> client (handle import if needed)
        if "server.client" in content:
            if "from backend.core.database import client" not in content:
                # Append client to import if db import exists
                content = content.replace("from backend.core.database import db", "from backend.core.database import db, client")
                # Or add new line if not found (fallback)
                if "from backend.core.database import db, client" not in content:
                     content = "from backend.core.database import client\n" + content
            
            content = replace_server_client(content)

        if content != original_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Refactored: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error {filepath}: {e}")
        return False

def replace_server_client(content):
    return re.sub(r"server\.client", "client", content)

def main():
    print("🚀 Refactoring server dependencies...")
    files = glob.glob(os.path.join(ROUTERS_DIR, "*.py"))
    
    count = 0
    for filepath in files:
        if refactor_file(filepath):
            count += 1
            
    print(f"✨ Finished. Refactored {count} files.")

if __name__ == "__main__":
    main()
